import OpenAI from 'openai';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

export const config = {
    api: {
        responseLimit: '100mb',
    },
}

function getSupabaseFromReq(req) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!supabaseUrl || !supabaseAnonKey) return { supabase: null, token: null };
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: token ? { Authorization: `Bearer ${token}` } : {} },
        auth: { persistSession: false, detectSessionInUrl: false }
    });
    return { supabase, token };
}

// Function to detect food and calories from a base64 encoded image using GPT-5
async function detectFoodAndCalories(base64Image, { req } = {}) {
    const openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY
    });

    // Extract MIME type and pure base64 data from the image string
    const match = base64Image.match(/^data:(image\/\w+);base64,(.*)$/);
    if (!match) {
        throw new Error('Invalid image data format.');
    }

    const mimeType = match[1];
    const base64Data = match[2];

    // Prepare Supabase client and optional user for logging and caching
    const { supabase, token } = getSupabaseFromReq(req || { headers: {} });
    let userId = null;
    if (supabase && token) {
        try {
            const { data: { user } } = await supabase.auth.getUser();
            userId = user?.id || null;
        } catch (_) {}
    }

    // Compute hash of image payload for cache key
    const imageHash = crypto.createHash('sha256').update(base64Data).digest('hex');

    // Try cache for authenticated users
    if (supabase && userId) {
        try {
            const { data: cached, error: cacheErr } = await supabase
                .from('food_analysis_cache')
                .select('analysis')
                .eq('user_id', userId)
                .eq('image_hash', imageHash)
                .maybeSingle();
            if (!cacheErr && cached?.analysis) {
                return { ...cached.analysis, _source: 'cache' };
            }
        } catch (_) { /* ignore cache failures */ }
    }

        const prompt = `You are an expert dietitian. Analyze the food image and output ONLY valid JSON (no extra text) with this exact schema:
{
    "items": ["string", ...],
    "total_calories": number,
    "nutrition": {
        "calories": number,
        "protein": number,
        "carbs": number,
        "fat": number,
        "fiber": number,
        "sugar": number,
        "sodium": number,
        "serving_size": "string"
    },
    "verdict": "Healthy" | "Moderate" | "Unbalanced" | "Limit",
    "food_specific_advice": "Detailed advice (max 200 chars) specifically about THIS food - ingredients, cooking method, portion, nutritional benefits/concerns, and specific improvements for THIS meal"
}
Rules:
1. Keys must be double-quoted.
2. Numbers are pure numbers (no units text) and non-negative.
3. If uncertain, approximate fairly rather than returning 0 except for truly absent nutrients.
4. Items array lists distinct visible components (max 6 items, concise singular nouns).
5. verdict logic guideline: High added sugar, sodium, or saturated fat -> 'Limit'; calorically dense but partially balanced -> 'Unbalanced'; fairly balanced but could improve fiber/protein -> 'Moderate'; well-balanced macros + moderate calories + reasonable sugar/sodium -> 'Healthy'.
6. food_specific_advice must be specific to THIS exact food/meal - mention ingredients, cooking method, portion size concerns, what makes it healthy/unhealthy, and specific actionable improvements for THIS dish.
7. Output ONLY JSON.`;

    // Helper to coerce a value into a finite non-negative number
    const num = (v, def = 0) => {
        if (typeof v === 'number' && Number.isFinite(v)) return v;
        if (typeof v === 'string') {
            // Strip common non-numeric chars (e.g., units like "kcal", commas)
            const cleaned = v.replace(/[^0-9.+-]/g, '');
            const parsed = parseFloat(cleaned);
            if (Number.isFinite(parsed)) return parsed;
        }
        return def;
    };

    const buildNutrition = (obj) => {
        if (!obj || typeof obj !== 'object') obj = {};
        return {
            calories: num(obj.calories),
            protein: num(obj.protein),
            carbs: num(obj.carbs),
            fat: num(obj.fat),
            fiber: num(obj.fiber),
            sugar: num(obj.sugar),
            sodium: num(obj.sodium),
            serving_size: typeof obj.serving_size === 'string' && obj.serving_size.trim() ? obj.serving_size.trim() : '1 serving'
        };
    };

    // Extract a balanced JSON object from text, handling code fences if present
    const extractJsonObject = (text) => {
        if (typeof text !== 'string') return null;
        // Prefer fenced code block content if present
        const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
        if (fenceMatch && fenceMatch[1]) {
            return fenceMatch[1].trim();
        }
        // Balanced brace extraction
        const start = text.indexOf('{');
        if (start === -1) return null;
        let depth = 0;
        let inString = false;
        let escape = false;
        for (let i = start; i < text.length; i++) {
            const ch = text[i];
            if (inString) {
                if (escape) {
                    escape = false;
                } else if (ch === '\\') {
                    escape = true;
                } else if (ch === '"') {
                    inString = false;
                }
                continue;
            }
            if (ch === '"') {
                inString = true;
            } else if (ch === '{') {
                depth++;
            } else if (ch === '}') {
                depth--;
                if (depth === 0) {
                    return text.slice(start, i + 1);
                }
            }
        }
        return null; // Unbalanced
    };

    // Attempt strict parse, then cleanup common issues and retry
    const parseModelJson = (raw) => {
        const tryParse = (s) => {
            try { return JSON.parse(s); } catch (_) { return null; }
        };
        let s = raw;
        // First try as-is
        let parsed = tryParse(s);
        if (parsed) return parsed;
        // Remove comments (// and /* */)
        s = s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\n)\s*\/\/.*(?=\n|$)/g, '$1');
        parsed = tryParse(s);
        if (parsed) return parsed;
        // Remove trailing commas before } or ]
        s = s.replace(/,\s*([}\]])/g, '$1');
        parsed = tryParse(s);
        if (parsed) return parsed;
        // Quote unquoted object keys: { key: -> { "key": and , key: -> , "key":
        s = s.replace(/([\{,]\s*)([A-Za-z_][A-Za-z0-9_]*)\s*:/g, '$1"$2":');
        parsed = tryParse(s);
        if (parsed) return parsed;
        // Replace single quotes with double quotes as last resort
        s = s.replace(/'([^']*)'/g, '"$1"');
        parsed = tryParse(s);
        if (parsed) return parsed;
        throw new Error('Invalid JSON format from model');
    };

    try {
        const response = await openai.chat.completions.create({
            model: 'gpt-5-mini',
            messages: [
                {
                    role: 'user',
                    content: [
                        {
                            type: 'text',
                            text: prompt
                        },
                        {
                            type: 'image_url',
                            image_url: {
                                url: base64Image
                            }
                        }
                    ]
                }
            ],
            max_completion_tokens: 1500
        });

        const text = response.choices[0]?.message?.content ?? '';
        const jsonStr = extractJsonObject(text);
        if (!jsonStr) {
            throw new Error('No valid JSON found in the response.');
        }
        const parsedRaw = parseModelJson(jsonStr);

        // Normalize items
        let items = Array.isArray(parsedRaw.items) ? parsedRaw.items.filter(i => typeof i === 'string').map(s => s.trim()).filter(Boolean) : [];

        // Normalize calories (prefer top-level total_calories; fallback to nutrition.calories)
        const totalCaloriesRaw = parsedRaw.total_calories ?? (parsedRaw.nutrition && parsedRaw.nutrition.calories);
        let totalCalories = num(totalCaloriesRaw);

        // Normalize nutrition (support either nested nutrition or flat fields)
        let nutritionCandidate = parsedRaw.nutrition && typeof parsedRaw.nutrition === 'object'
            ? parsedRaw.nutrition
            : {
                calories: parsedRaw.calories ?? parsedRaw.total_calories,
                protein: parsedRaw.protein,
                carbs: parsedRaw.carbs,
                fat: parsedRaw.fat,
                fiber: parsedRaw.fiber,
                sugar: parsedRaw.sugar,
                sodium: parsedRaw.sodium,
                serving_size: parsedRaw.serving_size
            };

        const nutrition = buildNutrition(nutritionCandidate);

        // If total_calories is 0 but nutrition.calories is present, sync them
        if (!totalCalories && nutrition.calories) {
            totalCalories = num(nutrition.calories);
        }

                // Simple health heuristic
                const cal = nutrition.calories || 0;
                const protein = nutrition.protein || 0;
                const sugar = nutrition.sugar || 0;
                const fat = nutrition.fat || 0;
                const sodium = nutrition.sodium || 0;
                let score = 0;
                if (protein > 15) score += 2; else if (protein > 8) score += 1;
                if (sugar > 20) score -= 2; else if (sugar > 10) score -= 1;
                if (fat > 25) score -= 1;
                if (sodium > 600) score -= 1;
                if (cal >= 250 && cal <= 650) score += 1; // moderate meal size
                let health_label = 'neutral';
                if (score >= 2) health_label = 'healthy'; else if (score <= -2) health_label = 'unhealthy';
                const adviceMap = {
                    healthy: 'Good balance overall. Keep pairing protein with fiber-rich foods.',
                    neutral: 'Decent meal. Consider adding lean protein or vegetables to optimize nutrient density.',
                    unhealthy: 'High in sugar, fat, or sodium. Try reducing processed ingredients and add whole foods.'
                };
                // verdict & food_specific_advice from model; fallback to heuristic if absent
                const verdict = typeof parsedRaw.verdict === 'string' ? parsedRaw.verdict : (health_label === 'healthy' ? 'Healthy' : health_label === 'unhealthy' ? 'Limit' : 'Moderate');
                const food_specific_advice = typeof parsedRaw.food_specific_advice === 'string' && parsedRaw.food_specific_advice.length <= 200 ? parsedRaw.food_specific_advice : adviceMap[health_label];
                const analysis = {
                    items,
                    count: totalCalories,
                    nutrition,
                    health_assessment: {
                        score,
                        label: health_label,
                        advice: adviceMap[health_label]
                    },
                    verdict,
                    food_specific_advice
                };
                // Log AI request (best-effort) and cache per-user if available
                (async () => {
                    try {
                        if (supabase) {
                            await supabase.from('ai_requests').insert({
                                user_id: userId,
                                request_type: 'detect_food',
                                model: 'gpt-5-mini',
                                input_hash: imageHash,
                                input: { mimeType, length: base64Data?.length || 0 },
                                response: analysis,
                                status: 'success'
                            });
                            if (userId) {
                                await supabase.from('food_analysis_cache').upsert({
                                    user_id: userId,
                                    image_hash: imageHash,
                                    analysis
                                }, { onConflict: 'user_id,image_hash' });
                            }
                        }
                    } catch (_) { /* ignore log/cache errors */ }
                })();
                return analysis;
    } catch (error) {
        console.error('API call failed:', error);
        // Log failure
        try {
            const { supabase } = getSupabaseFromReq(req || { headers: {} });
            if (supabase) {
                await supabase.from('ai_requests').insert({
                    request_type: 'detect_food',
                    model: 'gpt-5-mini',
                    status: 'error',
                    response: { message: String(error?.message || error) }
                });
            }
        } catch (_) {}
        throw new Error(`Failed to detect food and calories: ${error.message}`);
    }
}

// Handler for Next.js API route
export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            const { image } = req.body;
            const { items, count, nutrition, verdict, food_specific_advice, health_assessment, _source } = await detectFoodAndCalories(image, { req });

            // Return enhanced response with nutrition data
            res.status(200).json({ items, count, nutrition, verdict, food_specific_advice, health_assessment, success: true, source: _source || 'openai' });
        } catch (error) {
            // Return an error response
            res.status(500).json({ success: false, message: error.message });
        }
    } else {
        // Return a 405 Method Not Allowed response for non-POST requests
        res.setHeader('Allow', ['POST']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
}
