import crypto from 'crypto'

const OLA_NEARBY_ENDPOINT = 'https://api.olamaps.io/places/v1/nearbysearch'

function buildSearchParams({ lat, lng, radius, keyword }) {
  const params = new URLSearchParams({ layers: 'venue', types: 'restaurant' })
  params.set('location', `${lat},${lng}`)
  if (radius) params.set('radius', String(radius))
  if (keyword) params.set('q', keyword)
  return params
}

function normalizePlace(raw) {
  if (!raw) return null
  const geometry = raw.geometry || raw.location || {}
  const lat = geometry.lat ?? geometry.latitude ?? geometry.location?.lat ?? null
  const lng = geometry.lng ?? geometry.lon ?? geometry.longitude ?? geometry.location?.lng ?? null

  return {
    id: raw.id || raw.place_id || raw.reference || crypto.randomUUID(),
    name: raw.name || raw.title || raw.display_name || 'Unknown venue',
    address:
      raw.address || raw.vicinity || raw.formatted_address || raw.full_address || raw.short_address || null,
    categories: raw.categories || raw.types || [],
    rating: raw.rating || raw.user_ratings_total ? Number(raw.rating) || null : null,
    userRatingsTotal: raw.user_ratings_total || raw.reviews_count || null,
    lat,
    lng,
    raw
  }
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const apiKey = process.env.OLA_MAPS_API_KEY
  const secretKey = process.env.OLA_MAPS_SECRET_KEY
  if (!apiKey || !secretKey) {
    return res.status(500).json({
      error: 'Server misconfigured: set OLA_MAPS_API_KEY and OLA_MAPS_SECRET_KEY in environment.'
    })
  }

  const { lat, lng, radius = 1500, keyword = '' } = req.query || {}

  if (!lat || !lng) {
    return res.status(400).json({ error: 'lat and lng query parameters are required.' })
  }

  const searchParams = buildSearchParams({ lat, lng, radius, keyword })
  searchParams.set('api_key', apiKey)

  const requestId = crypto.randomUUID()

  try {
    const response = await fetch(`${OLA_NEARBY_ENDPOINT}?${searchParams.toString()}`, {
      headers: {
        'X-Request-Id': requestId,
        Authorization: `Basic ${Buffer.from(`${apiKey}:${secretKey}`).toString('base64')}`,
        Accept: 'application/json'
      },
      cache: 'no-store'
    })

    if (!response.ok) {
      const text = await response.text()
      return res.status(response.status).json({
        error: 'Upstream Ola Maps request failed.',
        status: response.status,
        details: text ? safeJson(text) : null
      })
    }

    const payload = await response.json()
    const candidates = Array.isArray(payload?.results)
      ? payload.results
      : Array.isArray(payload?.venues)
      ? payload.venues
      : Array.isArray(payload?.items)
      ? payload.items
      : []

    const places = candidates.map(normalizePlace).filter(Boolean)

    return res.status(200).json({
      requestId,
      center: { lat: Number(lat), lng: Number(lng) },
      radius: Number(radius) || 1500,
      keyword: keyword || '',
      places
    })
  } catch (error) {
    console.error('[restaurants/nearby] fetch failed', error)
    return res.status(500).json({ error: 'Failed to fetch nearby restaurants', details: error.message })
  }
}

function safeJson(text) {
  try {
    return JSON.parse(text)
  } catch (_) {
    return text
  }
}
