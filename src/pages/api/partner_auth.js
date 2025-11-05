// API route: /api/partner_auth
// Handles partner login/register (separate from user auth)
import { createClient } from '@supabase/supabase-js'
import bcrypt from 'bcryptjs'
import { setPartnerSessionCookie } from '@/utils/partner-auth'

const PARTNER_TABLE = 'restaurant_partners'
const RESTAURANTS_TABLE = 'restaurants'

function getSupabase() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl) {
    throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL')
  }

  const apiKey = serviceKey || anonKey

  return createClient(supabaseUrl, apiKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  })
}

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function slugify(value) {
  if (!value) return ''
  return value
    .toString()
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
}

async function generateUniqueSlug(supabase, base) {
  const baseSlug = slugify(base) || 'restaurant'
  let attempt = 0

  while (attempt < 25) {
    const candidate = attempt === 0 ? baseSlug : `${baseSlug}-${attempt}`

    const [{ data: partnerMatch }, { data: restaurantMatch }] = await Promise.all([
      supabase.from(PARTNER_TABLE).select('id').eq('restaurant_slug', candidate).maybeSingle(),
      supabase.from(RESTAURANTS_TABLE).select('id').eq('slug', candidate).maybeSingle()
    ])

    if (!partnerMatch && !restaurantMatch) {
      return candidate
    }

    attempt += 1
  }

  return `${baseSlug}-${Math.random().toString(36).slice(2, 8)}`
}

async function ensureRestaurantRecord(supabase, { partnerId, restaurantName, slug }) {
  const payload = {
    id: partnerId,
    name: restaurantName || 'Partner Restaurant',
    slug,
    owner_user_id: null,
    metadata: {
      partner_id: partnerId,
      source: 'partner_portal'
    }
  }

  const { error } = await supabase
    .from(RESTAURANTS_TABLE)
    .upsert(payload, { onConflict: 'id' })

  if (error && /duplicate key value violates unique constraint/.test(error.message || '')) {
    return { retry: true }
  }

  if (error) {
    throw error
  }

  return { retry: false }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })
  const { mode, email, password, restaurantName } = req.body || {}
  if (!email || !password) return res.status(400).json({ error: 'Email and password required' })
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return res.status(500).json({
      error: 'Server misconfigured: set SUPABASE_SERVICE_ROLE_KEY to enable partner authentication.'
    })
  }
  const supabase = getSupabase()

  if (mode === 'register') {
    if (!restaurantName) {
      return res.status(400).json({ error: 'Restaurant name required' })
    }

    const normalizedEmail = email.toLowerCase()

    let existing
    try {
      const existingRes = await supabase.from(PARTNER_TABLE).select('id').eq('email', normalizedEmail).maybeSingle()
      if (existingRes.error) {
        console.error('[partner_auth] check existing partner failed', existingRes.error)
        return res.status(500).json({ error: 'Database error checking existing partner' })
      }
      existing = existingRes.data
    } catch (dbErr) {
      console.error('[partner_auth] unexpected DB error (check existing)', dbErr)
      return res.status(500).json({ error: 'Database error checking existing partner' })
    }
    if (existing) return res.status(400).json({ error: 'Email already registered' })

    const hash = await bcrypt.hash(password, 10)

    let slug = await generateUniqueSlug(supabase, restaurantName)
    let partnerInsertError = null
    let partnerData = null

    try {
      const response = await supabase.from(PARTNER_TABLE).insert({
        email: normalizedEmail,
        password_hash: hash,
        restaurant_name: restaurantName,
        restaurant_slug: slug
      }).select('*').single()

      if (response.error) {
        console.error('[partner_auth] partner insert failed', response.error)
        return res.status(500).json({ error: 'Database error inserting partner' })
      }

      partnerData = response.data
    } catch (err) {
      console.error('[partner_auth] unexpected DB error (insert)', err)
      return res.status(500).json({ error: 'Partner registration failed due to database error' })
    }

    let ensureResult
    try {
      ensureResult = await ensureRestaurantRecord(supabase, {
        partnerId: partnerData.id,
        restaurantName,
        slug
      })
    } catch (err) {
      console.error('[partner_auth] ensureRestaurantRecord failed', err)
      return res.status(500).json({ error: 'Failed to create restaurant record' })
    }

    if (ensureResult.retry) {
      slug = await generateUniqueSlug(supabase, `${restaurantName}-${Math.random().toString(36).slice(2, 4)}`)

      const { error: updateError } = await supabase
        .from(PARTNER_TABLE)
        .update({ restaurant_slug: slug })
        .eq('id', partnerData.id)

      if (updateError) {
        return res.status(500).json({ error: updateError.message })
      }

      const retryResult = await ensureRestaurantRecord(supabase, {
        partnerId: partnerData.id,
        restaurantName,
        slug
      })

      if (retryResult.retry) {
        return res.status(500).json({ error: 'Could not allocate unique restaurant slug. Retry registration.' })
      }
    }

    setPartnerSessionCookie(res, {
      id: partnerData.id,
      email: partnerData.email,
      restaurant_slug: slug
    })

    return res.status(200).json({
      partner: {
        id: partnerData.id,
        email: partnerData.email,
        restaurant_name: partnerData.restaurant_name,
        restaurant_slug: slug
      }
    })
  }

  if (mode === 'login') {
    const normalizedEmail = email.toLowerCase()

    let partner
    try {
      const fetchRes = await supabase.from(PARTNER_TABLE).select('*').eq('email', normalizedEmail).maybeSingle()
      if (fetchRes.error) {
        console.error('[partner_auth] fetch partner failed', fetchRes.error)
        return res.status(500).json({ error: 'Database error fetching partner' })
      }
      partner = fetchRes.data
    } catch (err) {
      console.error('[partner_auth] unexpected DB error (fetch)', err)
      return res.status(500).json({ error: 'Database error fetching partner' })
    }

    if (!partner) return res.status(400).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, partner.password_hash)
    if (!valid) return res.status(400).json({ error: 'Invalid credentials' })

    let slug = partner.restaurant_slug

    if (!slug || !slug.trim()) {
      slug = await generateUniqueSlug(supabase, partner.restaurant_name || partner.email.split('@')[0])

      await supabase
        .from(PARTNER_TABLE)
        .update({ restaurant_slug: slug })
        .eq('id', partner.id)

      await ensureRestaurantRecord(supabase, {
        partnerId: partner.id,
        restaurantName: partner.restaurant_name || partner.email,
        slug
      })
    } else if (!uuidRegex.test(slug)) {
      await ensureRestaurantRecord(supabase, {
        partnerId: partner.id,
        restaurantName: partner.restaurant_name || partner.email,
        slug
      })
    }

    setPartnerSessionCookie(res, {
      id: partner.id,
      email: partner.email,
      restaurant_slug: slug
    })

    return res.status(200).json({
      partner: {
        id: partner.id,
        email: partner.email,
        restaurant_name: partner.restaurant_name,
        restaurant_slug: slug
      }
    })
  }

  return res.status(400).json({ error: 'Invalid mode' })
}
