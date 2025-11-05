// /api/nutrition/recommendations - AI diet advice based on summary
import OpenAI from 'openai';
import { supabase } from '../../../utils/supabaseClient';
import { rateLimitMiddleware } from '../../../utils/rateLimit';

const memoryCache = new Map(); // simple in-memory cache {userId: { ts, data }}

async function getUser(req){
  const authHeader = req.headers.authorization;
  if(!authHeader?.startsWith('Bearer ')) return null;
  const token = authHeader.split(' ')[1];
  const { data: { user }, error } = await supabase.auth.getUser(token);
  if (error || !user) return null; return user;
}

export default async function handler(req,res){
  const user = await getUser(req);
  if(!user) return res.status(401).json({ error:'Authentication required' });
  if(req.method !== 'POST') { res.setHeader('Allow',['POST']); return res.status(405).end('Method Not Allowed'); }

  try {
    // Rate limit: 2 requests per minute for recommendations
    if (!rateLimitMiddleware(req, res, `rec:${user.id}`, { windowMs: 60_000, max: 2 })) return;

    // In-memory short cache (60s) to avoid duplicate model calls in same minute
    const now = Date.now();
    const cached = memoryCache.get(user.id);
    if (cached && (now - cached.ts) < 60_000) {
      return res.status(200).json({ cached: true, ...cached.data });
    }

    // Persistent cache: look for most recent recommendation within last 6 hours
    const { data: recentRows, error: selectErr } = await supabase
      .from('nutrition_recommendations')
      .select('id, created_at, payload')
      .eq('user_id', user.id)
      .gte('created_at', new Date(now - 6 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1);
    if (selectErr) console.warn('Persistent cache select error', selectErr.message);
    if (recentRows && recentRows.length) {
      const row = recentRows[0];
      memoryCache.set(user.id, { ts: now, data: row.payload });
      return res.status(200).json({ cached: true, persistent: true, ...row.payload });
    }

    const { summary } = req.body; // expect object from /summary endpoint
    if(!summary || !summary.averages) return res.status(400).json({ error:'Missing summary. Call /api/nutrition/summary first.'});

    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are a registered dietitian AI. Given the following macro averages and totals over a period, produce:
1. Overall assessment (short paragraph)
2. Macro feedback (bullet for calories, protein, carbs, fat, fiber, sugar, sodium)
3. 3 meal adjustment suggestions
4. 3 sustainable habit tips
Return JSON with keys: overall_assessment, macro_feedback (object), meal_suggestions (array), habit_tips (array).
Data: ${JSON.stringify(summary.averages)}.`;

    const completion = await openai.chat.completions.create({
  model: 'gpt-5-mini',
      messages:[{ role:'user', content: prompt }],
      max_completion_tokens:700
    });
    const text = completion.choices[0]?.message?.content || '';
    let json;
    try { json = JSON.parse(text); } catch { json = { overall_assessment: text }; }

    const data = { recommendations: json, generated_at: new Date().toISOString() };
    memoryCache.set(user.id, { ts: now, data });

    // Store persistent copy
    const { error: insertErr } = await supabase
      .from('nutrition_recommendations')
      .insert({ user_id: user.id, payload: data })
      .select('id');
    if (insertErr) console.warn('Insert persistent rec error', insertErr.message);

    res.status(200).json(data);
  } catch(e){
    console.error('Recommendations error', e);
    res.status(500).json({ error: e.message });
  }
}
