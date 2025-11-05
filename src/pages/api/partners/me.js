import { createClient } from '@supabase/supabase-js'
import { readPartnerSession } from '@/utils/partner-auth'

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceKey) {
    throw new Error('Partner session endpoint requires SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(url, serviceKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
}

const supabase = (() => {
  try {
    return getServiceClient()
  } catch (error) {
    console.error('[partners/me] Supabase client init failed', error)
    return null
  }
})()

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  if (!supabase) {
    return res.status(500).json({ error: 'Service misconfigured' })
  }

  const session = readPartnerSession(req)
  if (!session?.id) {
    return res.status(401).json({ error: 'partner_unauthenticated' })
  }

  const { data: partner, error } = await supabase
    .from('restaurant_partners')
    .select('id, email, restaurant_name, restaurant_slug, cuisine, location')
    .eq('id', session.id)
    .maybeSingle()

  if (error) {
    console.error('[partners/me] fetch partner failed', error)
    return res.status(500).json({ error: 'Failed to load partner profile' })
  }

  if (!partner) {
    return res.status(404).json({ error: 'partner_not_found' })
  }

  return res.status(200).json({
    partner: {
      id: partner.id,
      email: partner.email,
      restaurant_name: partner.restaurant_name,
      restaurant_slug: partner.restaurant_slug,
      cuisine: partner.cuisine || null,
      location: partner.location || null
    }
  })
}
