// API route: /api/user_health_profile
// Stores and fetches user health profile in Supabase
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

  if (req.method === 'GET') {
    const { data, error } = await supabase.from('user_health_profiles').select('*').eq('user_id', 'auth.uid()').maybeSingle()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ profile: data })
  }

  if (req.method === 'POST') {
    const body = req.body || {}
    // Upsert profile for current user
    const { data, error } = await supabase.from('user_health_profiles').upsert({
      ...body,
      user_id: 'auth.uid()'
    }, { onConflict: ['user_id'] }).select('*').single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ profile: data })
  }

  return res.status(405).json({ error: 'Method not allowed' })
}
