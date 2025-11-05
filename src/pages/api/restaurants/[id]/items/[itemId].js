import { createClient } from '@supabase/supabase-js'
import { OpenAI } from 'openai'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const supabaseServiceClient = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function getSupabase(req) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const authHeader = req.headers.authorization
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : null
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
  })
  return { supabase, token }
}

async function requireUser(req) {
  const { supabase, token } = getSupabase(req)
  if (!token) return { error: { status: 401, message: 'Unauthorized' } }
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return { error: { status: 401, message: 'Unauthorized' } }
  return { supabase, user: data.user }
}

async function ensureHealthProfile(supabase, userId) {
  const { data, error } = await supabase
    .from('user_health_profiles')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle()
  if (error) return { error: { status: 500, message: error.message } }
  if (!data) return { error: { status: 403, message: 'health_profile_required' } }
  return { profile: data }
}

async function fetchMenuItem(supabase, restaurantId, itemId) {
  const { data, error } = await supabase
    .from('menu_items')
    .select('*')
    .eq('restaurant_id', restaurantId)
    .eq('id', itemId)
    .maybeSingle()
  if (error) return { error: { status: 500, message: error.message } }
  if (!data) return { error: { status: 404, message: 'Menu item not found' } }
  return { item: data }
}

async function resolveRestaurantIdentifier(identifier, supabase) {
  if (!identifier) return null
  const trimmed = identifier.toString().trim()
  if (!trimmed) return null

  if (uuidRegex.test(trimmed)) {
    return { id: trimmed }
  }

  const lookupClient = supabase || createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false
      }
    }
  )

  const { data: restaurant } = await lookupClient
    .from('restaurants')
    .select('id')
    .eq('slug', trimmed)
    .maybeSingle()

  if (restaurant?.id) {
    return { id: restaurant.id }
  }

  if (!supabaseServiceClient) {
    return null
  }

  const { data: partner } = await supabaseServiceClient
    .from('restaurant_partners')
    .select('id')
    .eq('restaurant_slug', trimmed)
    .maybeSingle()

  if (partner?.id) {
    return { id: partner.id }
  }

  return null
}

function buildNutritionSnapshot(nutrition) {
  if (!nutrition || typeof nutrition !== 'object') return {}
  const calories = Number.isFinite(Number(nutrition.calories)) ? Math.round(Number(nutrition.calories)) : null
  const macros = nutrition.macros || nutrition.nutrients || {}
  return {
    calories,
    protein_g: Number.isFinite(Number(macros.protein_g)) ? Number(macros.protein_g) : null,
    carbs_g: Number.isFinite(Number(macros.carbs_g)) ? Number(macros.carbs_g) : null,
    fat_g: Number.isFinite(Number(macros.fat_g)) ? Number(macros.fat_g) : null,
    fiber_g: Number.isFinite(Number(macros.fiber_g)) ? Number(macros.fiber_g) : null,
    sugar_g: Number.isFinite(Number(macros.sugar_g)) ? Number(macros.sugar_g) : null,
    sodium_mg: Number.isFinite(Number(macros.sodium_mg)) ? Number(macros.sodium_mg) : null
  }
}

function sanitizeNutrition(nutrition) {
  if (!nutrition || typeof nutrition !== 'object') return null
  const { ai_review, ...rest } = nutrition
  if (Object.keys(rest).length) return rest
  return ai_review ? { ai_review } : null
}

async function generateNutritionLabel({ item, profile }) {
  if (!process.env.OPENAI_API_KEY) return null
  const nutrition = buildNutritionSnapshot(item.nutrition)
  const prompt = `Create a concise nutrition label style summary for the following restaurant dish. Include calories, macros, and a short personalised note for the diner's health profile.

Dish: ${item.name}
Description: ${item.description || 'No description provided'}
Stored nutrition data: ${JSON.stringify(nutrition)}
User health profile: ${JSON.stringify(profile)}

Return markdown with sections:
1. Key numbers (calories + macros)
2. Highlights (1 bullet)
3. Watch outs (1 bullet)
4. Ordering tip (1 sentence)`

  try {
    const completion = await openai.chat.completions.create({
  model: 'gpt-5-mini',
  max_completion_tokens: 320,
      messages: [
        { role: 'system', content: 'You are a nutrition coach who writes friendly, precise menu guidance.' },
        { role: 'user', content: prompt }
      ]
    })
    const content = extractMessageContent(completion.choices?.[0])
    return content || null
  } catch (error) {
    console.error('generateNutritionLabel', error)
    return null
  }
}

function extractMessageContent(choice) {
  if (!choice?.message) return null
  const { message } = choice
  const { content } = message

  if (typeof content === 'string' && content.trim()) {
    return content.trim()
  }

  if (Array.isArray(content)) {
    const combined = content
      .map((part) => {
        if (!part) return ''
        if (typeof part === 'string') return part
        if (typeof part.text === 'string') return part.text
        if (part.type === 'output_text' && typeof part.text === 'string') return part.text
        if (part.type === 'output_json' && part.json) {
          try {
            return JSON.stringify(part.json)
          } catch (_) {
            return ''
          }
        }
        if (part.type === 'json' && part.json) {
          try {
            return JSON.stringify(part.json)
          } catch (_) {
            return ''
          }
        }
        return ''
      })
      .join('')
      .trim()
    if (combined) return combined
  }

  if (content && typeof content === 'object') {
    if (typeof content.text === 'string' && content.text.trim()) {
      return content.text.trim()
    }
    if (content.json) {
      try {
        return JSON.stringify(content.json)
      } catch (_) {
        /* ignore */
      }
    }
  }

  if (message.parsed) {
    if (typeof message.parsed === 'string') {
      const trimmed = message.parsed.trim()
      if (trimmed) return trimmed
    }
    try {
      return JSON.stringify(message.parsed)
    } catch (_) {
      /* ignore */
    }
  }

  const toolCall = message.tool_calls?.[0]
  if (toolCall?.function) {
    const args = toolCall.function.arguments
    if (typeof args === 'string' && args.trim()) return args.trim()
    if (args && typeof args === 'object') {
      try {
        return JSON.stringify(args)
      } catch (_) {
        /* ignore */
      }
    }
  }

  if (message.function_call?.arguments) {
    const args = message.function_call.arguments
    if (typeof args === 'string' && args.trim()) return args.trim()
    if (args && typeof args === 'object') {
      try {
        return JSON.stringify(args)
      } catch (_) {
        /* ignore */
      }
    }
  }

  return null
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const ctx = await requireUser(req)
  if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message })

  const { supabase, user } = ctx
  const { id: identifier, itemId } = req.query
  if (!identifier || !itemId) return res.status(400).json({ error: 'restaurant_id and item_id required' })

  const resolved = await resolveRestaurantIdentifier(identifier, supabase)
  if (!resolved?.id) {
    return res.status(404).json({ error: 'Restaurant not found' })
  }

  const profileResult = await ensureHealthProfile(supabase, user.id)
  if (profileResult.error) return res.status(profileResult.error.status).json({ error: profileResult.error.message })

  const itemResult = await fetchMenuItem(supabase, resolved.id, itemId)
  if (itemResult.error) return res.status(itemResult.error.status).json({ error: itemResult.error.message })

  const nutritionSnapshot = buildNutritionSnapshot(itemResult.item.nutrition)
  const aiLabel = await generateNutritionLabel({ item: itemResult.item, profile: profileResult.profile })
  const sanitizedItem = {
    ...itemResult.item,
    aiReview: itemResult.item.nutrition?.ai_review || null,
    nutrition: sanitizeNutrition(itemResult.item.nutrition)
  }

  return res.status(200).json({
    item: sanitizedItem,
    nutrition: nutritionSnapshot,
    aiLabel
  })
}
