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

async function fetchRestaurantContext(supabase, restaurantId) {
  const adminSupabase = supabaseServiceClient || supabase

  const [{ data: partner }, { data: restaurant }, { data: items, error: itemsError }] = await Promise.all([
    adminSupabase
      .from('restaurant_partners')
      .select('id, restaurant_name, restaurant_slug, cuisine, location')
      .eq('id', restaurantId)
      .maybeSingle(),
    adminSupabase
      .from('restaurants')
      .select('*')
      .eq('id', restaurantId)
      .maybeSingle(),
    supabase
      .from('menu_items')
      .select('*')
      .eq('restaurant_id', restaurantId)
      .order('created_at', { ascending: true })
  ])

  if (itemsError) return { error: { status: 500, message: itemsError.message } }

  const baseRestaurant = restaurant || partner || null
  const normalizedRestaurant = baseRestaurant
    ? {
        id: baseRestaurant.id,
        name: baseRestaurant.restaurant_name || baseRestaurant.name || 'Restaurant',
        slug: baseRestaurant.slug || baseRestaurant.restaurant_slug || null,
        cuisine: baseRestaurant.cuisine || baseRestaurant.cuisine_type || null,
        description: baseRestaurant.description || null,
        location: baseRestaurant.location || baseRestaurant.address || null
      }
    : null

  return {
    restaurant: normalizedRestaurant,
    items: Array.isArray(items)
      ? items.map((item) => ({
          id: item.id,
          name: item.name,
          description: item.description,
          price: item.price,
          tags: item.tags || [],
          aiReview: item.nutrition?.ai_review || null,
          nutrition: sanitizeNutrition(item.nutrition),
          created_at: item.created_at
        }))
      : []
  }
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

function sanitizeNutrition(nutrition) {
  if (!nutrition || typeof nutrition !== 'object') return null
  const { ai_review, ...rest } = nutrition
  return Object.keys(rest).length ? rest : ai_review ? { ai_review } : null
}

async function generateRestaurantReview({ restaurant, items, profile }) {
  if (!process.env.OPENAI_API_KEY) return null
  if (!items?.length) return null

  const itemsForPrompt = items.slice(0, 10).map((item) => ({
    name: item.name,
    description: item.description,
    price: item.price,
    nutrition: item.nutrition || null
  }))

  const prompt = `You are a nutritionist helping a diner decide if a restaurant fits their health profile.
Restaurant info: ${JSON.stringify(restaurant)}
User health profile: ${JSON.stringify(profile)}
Menu items (first ${itemsForPrompt.length}): ${JSON.stringify(itemsForPrompt)}

Provide a concise, friendly summary (under 200 words) that covers:
- Overall fit for the diner's health goals
- Key dishes to gravitate toward or avoid (reference dish names)
- One actionable ordering tip
Respond in markdown with short paragraphs.`

  try {
    const completion = await openai.chat.completions.create({
  model: 'gpt-5-mini',
  max_completion_tokens: 350,
      messages: [
        { role: 'system', content: 'You are a nutrition expert helping diners make informed choices.' },
        { role: 'user', content: prompt }
      ]
    })
    const content = extractMessageContent(completion.choices?.[0])
    return content || null
  } catch (error) {
    console.error('generateRestaurantReview', error)
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
  const identifier = req.query.id
  if (!identifier) return res.status(400).json({ error: 'restaurant_id required' })

  const resolved = await resolveRestaurantIdentifier(identifier, supabase)
  if (!resolved?.id) {
    return res.status(404).json({ error: 'Restaurant not found' })
  }

  const profileResult = await ensureHealthProfile(supabase, user.id)
  if (profileResult.error) return res.status(profileResult.error.status).json({ error: profileResult.error.message })

  const restaurantData = await fetchRestaurantContext(supabase, resolved.id)
  if (restaurantData.error) return res.status(restaurantData.error.status).json({ error: restaurantData.error.message })
  if (!restaurantData.restaurant) return res.status(404).json({ error: 'Restaurant not found' })

  const review = await generateRestaurantReview({
    restaurant: restaurantData.restaurant,
    items: restaurantData.items,
    profile: profileResult.profile
  })

  return res.status(200).json({
    restaurant: restaurantData.restaurant,
    menuItems: restaurantData.items,
    personalizedSummary: review,
    profile: profileResult.profile
  })
}
