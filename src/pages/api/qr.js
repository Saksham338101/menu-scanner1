import { createClient } from '@supabase/supabase-js'
import { generateQrDataUrl } from '@/utils/qr'
import { resolveAppOrigin } from '@/utils/app-origin'

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

const anonClient =
  supabaseUrl && anonKey
    ? createClient(supabaseUrl, anonKey, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false }
      })
    : null

const serviceClient =
  supabaseUrl && serviceKey
    ? createClient(supabaseUrl, serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false }
      })
    : null

function getReadClient() {
  return serviceClient || anonClient
}

function getBaseUrl(req) {
  return resolveAppOrigin({ req })
}

async function resolveRestaurantIdentifier(identifier) {
  const trimmed = typeof identifier === 'string' ? identifier.trim() : String(identifier || '').trim()
  if (!trimmed) return null

  const client = getReadClient()
  const fallback = { id: trimmed, slug: trimmed }

  if (!client) {
    return fallback
  }

  if (uuidRegex.test(trimmed)) {
    const { data } = await client
      .from('restaurants')
      .select('id, slug')
      .eq('id', trimmed)
      .maybeSingle()

    if (data) {
      return { id: data.id, slug: data.slug || data.id }
    }

    if (serviceClient) {
      const { data: partner } = await serviceClient
        .from('restaurant_partners')
        .select('id, restaurant_slug')
        .eq('id', trimmed)
        .maybeSingle()

      if (partner) {
        return { id: partner.id, slug: partner.restaurant_slug || partner.id }
      }
    }

    return fallback
  }

  const { data: restaurant } = await client
    .from('restaurants')
    .select('id, slug')
    .eq('slug', trimmed)
    .maybeSingle()

  if (restaurant) {
    return { id: restaurant.id, slug: restaurant.slug || restaurant.id }
  }

  if (serviceClient) {
    const { data: partner } = await serviceClient
      .from('restaurant_partners')
      .select('id, restaurant_slug')
      .eq('restaurant_slug', trimmed)
      .maybeSingle()

    if (partner) {
      return { id: partner.id, slug: partner.restaurant_slug || partner.id }
    }
  }

  return fallback
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  const { data, restaurant, size = '256x256', format = 'json' } = req.query

  let payload = typeof data === 'string' && data.trim() ? data.trim() : ''

  try {
    if (!payload && restaurant) {
      const resolved = await resolveRestaurantIdentifier(restaurant)
      if (!resolved) {
        return res.status(404).json({ error: 'Restaurant not found' })
      }
      const baseUrl = getBaseUrl(req)
      payload = `${baseUrl}/restaurants/${resolved.slug || resolved.id}`
    }

    if (!payload) {
      return res.status(400).json({ error: 'Provide a data or restaurant parameter.' })
    }

    const imageDataUrl = await generateQrDataUrl(payload, { size })
    if (!imageDataUrl) {
      return res.status(500).json({ error: 'QR generation failed' })
    }

    if (format === 'image') {
      const base64 = imageDataUrl.split(',')[1]
      const buffer = Buffer.from(base64, 'base64')
      res.setHeader('Content-Type', 'image/png')
      return res.status(200).send(buffer)
    }

    return res.status(200).json({ data: payload, image: imageDataUrl, size })
  } catch (error) {
    console.error('[api/qr]', error)
    return res.status(500).json({ error: 'Unexpected error generating QR code' })
  }
}
