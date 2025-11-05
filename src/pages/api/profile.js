import { createClient } from '@supabase/supabase-js'

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

export default async function handler(req, res) {
  const { supabase, token } = getSupabase(req)
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const toTextArray = (value) => {
    if (Array.isArray(value)) return value
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    }
    if (value === null || value === undefined) return []
    return Array.isArray(value) ? value : []
  }

  if (req.method === 'GET') {
    const { data: user, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user?.user) return res.status(401).json({ error: 'Unauthorized' })
    const user_id = user.user.id
    const { data, error } = await supabase
      .from('user_health_profiles')
      .select('*')
      .eq('user_id', user_id)
      .maybeSingle()
  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(200).json({ profile: null })
  return res.status(200).json({ profile: data })
  }

  if (req.method === 'PUT' || req.method === 'POST') {
    const body = req.body || {}
    const { data: user, error: userErr } = await supabase.auth.getUser()
    if (userErr || !user?.user) return res.status(401).json({ error: 'Unauthorized' })
    const user_id = user.user.id
    const dietValue = body.diet ?? body.diet_type ?? null
    const payload = {
      ...body,
      user_id,
      diet: dietValue,
      diet_type: body.diet_type ?? dietValue,
      allergies: toTextArray(body.allergies),
      conditions: toTextArray(body.conditions)
    }
    // upsert
    const { data, error } = await supabase
      .from('user_health_profiles')
      .upsert(payload, { onConflict: 'user_id' })
      .select('*')
      .single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ profile: data })
  }

  res.setHeader('Allow', 'GET,PUT,POST')
  return res.status(405).json({ error: 'Method Not Allowed' })
}
