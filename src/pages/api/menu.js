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
  if (req.method === 'GET') {
    const { restaurant_id } = req.query
    if (!restaurant_id) return res.status(400).json({ error: 'restaurant_id required' })
    const { data, error } = await supabase.from('menu_items').select('*').eq('restaurant_id', restaurant_id).order('created_at', { ascending: false })
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ items: data })
  }

  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  if (req.method === 'POST') {
    const body = req.body || {}
    const { data, error } = await supabase.from('menu_items').insert(body).select('*').single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(201).json({ item: data })
  }

  if (req.method === 'PUT') {
    const body = req.body || {}
    const { id, ...update } = body
    if (!id) return res.status(400).json({ error: 'id required' })
    const { data, error } = await supabase.from('menu_items').update(update).eq('id', id).select('*').single()
    if (error) return res.status(500).json({ error: error.message })
    return res.status(200).json({ item: data })
  }

  if (req.method === 'DELETE') {
    const { id } = req.query
    if (!id) return res.status(400).json({ error: 'id required' })
    const { error } = await supabase.from('menu_items').delete().eq('id', id)
    if (error) return res.status(500).json({ error: error.message })
    return res.status(204).end()
  }

  res.setHeader('Allow', 'GET,POST,PUT,DELETE')
  return res.status(405).json({ error: 'Method Not Allowed' })
}
