import { createClient } from '@supabase/supabase-js'
import { OpenAI } from 'openai'
import { verifyShareToken } from '@/utils/share-token'

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const supabaseServiceClient = process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false }
    })
  : null

const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

const DEFAULT_PORTION_DESCRIPTION = 'one standard serving (around 350g)'
const DEFAULT_INGREDIENT_GUIDANCE = 'roughly 50% vegetables, 25% lean protein, and 25% whole grains or starches'

function buildDefaultFallbackReview(item) {
  const parts = [
    'We could not personalise this dish right now.',
    `Use default guidance: keep to ${DEFAULT_PORTION_DESCRIPTION} and balance your plate with ${DEFAULT_INGREDIENT_GUIDANCE}.`
  ]

  if (item?.nutrition?.calories && Number.isFinite(Number(item.nutrition.calories))) {
    parts.push(`This dish is listed at about ${Number(item.nutrition.calories)} kcal per serving — adjust portions if you are managing calories.`)
  }

  parts.push('Pair with water, add extra greens if available, and go easy on rich sides or sauces.')

  return parts.join(' ')
}

const MEAT_KEYWORDS = ['beef', 'steak', 'pork', 'bacon', 'sausage', 'lamb', 'veal', 'ham', 'prosciutto']
const POULTRY_KEYWORDS = ['chicken', 'turkey', 'duck', 'hen']
const SEAFOOD_KEYWORDS = ['fish', 'salmon', 'tuna', 'cod', 'trout', 'shrimp', 'prawn', 'lobster', 'crab', 'scallop']
const DAIRY_KEYWORDS = ['cheese', 'milk', 'butter', 'cream', 'yogurt', 'yoghurt', 'ghee', 'paneer']
const EGG_KEYWORDS = ['egg', 'omelette', 'aioli', 'mayo', 'mayonnaise']
const REFINED_CARB_KEYWORDS = ['white rice', 'white bread', 'pasta', 'noodle', 'tortilla', 'pizza', 'bagel', 'batter', 'brioche', 'risotto', 'wrap']
const SWEET_KEYWORDS = ['dessert', 'sweet', 'syrup', 'honey', 'caramel', 'cake', 'pastry', 'ice cream', 'pudding', 'glaze']
const FRIED_KEYWORDS = ['fried', 'deep fried', 'crispy', 'battered', 'tempura', 'breaded']
const HIGH_SODIUM_KEYWORDS = ['soy sauce', 'cured', 'pickled', 'brined', 'salted', 'teriyaki', 'miso', 'smoked']
const LEAN_COOKING_KEYWORDS = ['grilled', 'baked', 'roasted', 'steamed', 'poached', 'seared']
const VEGGIE_KEYWORDS = ['salad', 'greens', 'vegetable', 'veg', 'broccoli', 'spinach', 'kale', 'cauliflower', 'zucchini', 'pepper', 'bean', 'lentil']
const WHOLE_GRAIN_KEYWORDS = ['quinoa', 'brown rice', 'farro', 'barley', 'oat', 'oats', 'buckwheat', 'whole grain', 'wild rice']
const HEALTHY_FAT_KEYWORDS = ['olive oil', 'avocado', 'almond', 'walnut', 'chia', 'flax', 'nuts']

function normalizeForMatching(value) {
  if (value === null || value === undefined) return ''
  return value
    .toString()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
}

function containsAny(normalizedText, keywords) {
  if (!normalizedText || !keywords?.length) return false
  return keywords.some((keyword) => {
    if (!keyword) return false
    const candidate = keyword.trim()
    if (!candidate) return false
    if (normalizedText.includes(candidate)) return true
    if (!candidate.endsWith('s') && normalizedText.includes(`${candidate}s`)) return true
    return false
  })
}

function pickNumeric(nutrition, keys) {
  if (!nutrition || typeof nutrition !== 'object') return null
  for (const key of keys) {
    if (key in nutrition) {
      const value = Number(nutrition[key])
      if (Number.isFinite(value)) return value
    }
  }
  return null
}

function formatList(values) {
  if (!Array.isArray(values)) return ''
  const filtered = values.map((value) => value).filter(Boolean)
  if (filtered.length === 0) return ''
  if (filtered.length === 1) return filtered[0]
  const last = filtered[filtered.length - 1]
  const rest = filtered.slice(0, -1)
  return `${rest.join(', ')} and ${last}`
}

function generateRuleBasedPersonalizedReview({ item, profile }) {
  if (!item || !profile) return null

  const textChunks = [item.name || '', item.description || '', Array.isArray(item.tags) ? item.tags.join(' ') : '']
  if (item.nutrition && typeof item.nutrition === 'object') {
    textChunks.push(
      Object.entries(item.nutrition)
        .map(([key, value]) => `${key} ${value}`)
        .join(' ')
    )
  }
  const normalizedText = normalizeForMatching(textChunks.join(' '))

  const nutrition = item.nutrition || {}
  const calories = pickNumeric(nutrition, ['calories', 'kcal'])
  const protein = pickNumeric(nutrition, ['protein', 'protein_g', 'proteins'])
  const carbs = pickNumeric(nutrition, ['carbs', 'carbohydrates', 'net_carbs'])
  const sugar = pickNumeric(nutrition, ['sugar', 'sugars'])
  const sodium = pickNumeric(nutrition, ['sodium', 'salt'])
  const fat = pickNumeric(nutrition, ['fat', 'total_fat'])

  const adviceSegments = []
  let positiveScore = 0
  let negativeScore = 0
  let usedNutritionMetrics = false

  const allergies = Array.isArray(profile.allergies)
    ? profile.allergies
        .map((entry) => ({ raw: entry, normalized: normalizeForMatching(entry).trim() }))
        .filter((entry) => entry.normalized)
    : []
  const matchedAllergies = allergies.filter((entry) => containsAny(normalizedText, [entry.normalized]))
  if (matchedAllergies.length) {
    const allergyNames = matchedAllergies.map((entry) => entry.raw)
    const advice = `Skip this dish — it likely includes ${formatList(allergyNames)} which you flagged as allergies.`
    return { verdict: 'avoid', advice, confidence: 'high', fallbackText: advice }
  }

  const dietValue = typeof profile.diet === 'string' ? profile.diet.toLowerCase() : ''
  const goalsLower = Array.isArray(profile.goals) ? profile.goals.map((goal) => goal.toLowerCase()) : []
  const conditionsLower = Array.isArray(profile.conditions) ? profile.conditions.map((condition) => condition.toLowerCase()) : []

  if (dietValue.includes('vegan') || dietValue.includes('plant')) {
    if (containsAny(normalizedText, [...MEAT_KEYWORDS, ...POULTRY_KEYWORDS, ...SEAFOOD_KEYWORDS, ...DAIRY_KEYWORDS, ...EGG_KEYWORDS])) {
      negativeScore += 2
      adviceSegments.push('It appears to include animal ingredients, which conflicts with your vegan preference.')
    } else {
      positiveScore += 1
      adviceSegments.push('No obvious animal ingredients show up, so it should align with your vegan preference. Double-check sauces to be sure.')
    }
  } else if (dietValue.includes('vegetarian')) {
    if (containsAny(normalizedText, [...MEAT_KEYWORDS, ...POULTRY_KEYWORDS, ...SEAFOOD_KEYWORDS])) {
      negativeScore += 2
      adviceSegments.push('It likely contains meat or fish, which conflicts with your vegetarian diet.')
    } else if (containsAny(normalizedText, DAIRY_KEYWORDS)) {
      positiveScore += 1
      adviceSegments.push('Dairy-based protein keeps it aligned with your vegetarian pattern.')
    }
  } else if (dietValue.includes('pescatarian')) {
    if (containsAny(normalizedText, [...MEAT_KEYWORDS, ...POULTRY_KEYWORDS])) {
      negativeScore += 1
      adviceSegments.push('It seems to feature land meats, which you usually avoid.')
    } else if (containsAny(normalizedText, SEAFOOD_KEYWORDS)) {
      positiveScore += 1
      adviceSegments.push('Seafood protein keeps this aligned with your pescatarian approach.')
    }
  }

  if (dietValue.includes('low carb') || dietValue.includes('keto')) {
    if (carbs !== null && carbs > 25) {
      negativeScore += 1
      usedNutritionMetrics = true
      adviceSegments.push(`Carbs are around ${Math.round(carbs)}g, which is high for your low-carb plan — keep portions small or swap.`)
    } else if (containsAny(normalizedText, REFINED_CARB_KEYWORDS)) {
      negativeScore += 1
      adviceSegments.push('Refined starches show up here, so limit to a half portion to stay low carb.')
    } else if (protein !== null && protein >= 20) {
      positiveScore += 1
      usedNutritionMetrics = true
      adviceSegments.push('Protein looks solid while carbs stay modest, which suits your low-carb focus.')
    }
  }

  if (dietValue.includes('low sodium')) {
    if (sodium !== null && sodium > 600) {
      negativeScore += 1
      usedNutritionMetrics = true
      adviceSegments.push(`Sodium is estimated near ${Math.round(sodium)}mg, so watch portions for your low-sodium plan.`)
    } else if (containsAny(normalizedText, HIGH_SODIUM_KEYWORDS)) {
      negativeScore += 1
      adviceSegments.push('Savory sauces or cured ingredients could spike sodium, so pair with fresh greens.')
    }
  }

  if (dietValue.includes('low fat')) {
    if (fat !== null && fat > 25) {
      negativeScore += 1
      usedNutritionMetrics = true
      adviceSegments.push(`Total fat is around ${Math.round(fat)}g — keep portions tight for your low-fat goal.`)
    } else if (containsAny(normalizedText, LEAN_COOKING_KEYWORDS)) {
      positiveScore += 1
      adviceSegments.push('Lean cooking methods keep extra fat in check for your low-fat preference.')
    }
  }

  if (dietValue.includes('mediterranean')) {
    if (containsAny(normalizedText, [...VEGGIE_KEYWORDS, ...LEAN_COOKING_KEYWORDS, ...HEALTHY_FAT_KEYWORDS, ...SEAFOOD_KEYWORDS])) {
      positiveScore += 1
      adviceSegments.push('Vegetables, lean proteins, or healthy fats make this feel Mediterranean-friendly.')
    }
  }

  const weightLossGoal = goalsLower.some((goal) => goal.includes('weight') || goal.includes('fat'))
  if (weightLossGoal) {
    if (calories !== null && calories > 650) {
      negativeScore += 1
      usedNutritionMetrics = true
      adviceSegments.push(`At roughly ${Math.round(calories)} kcal, this is energy-dense — split or share it to stay on track for weight loss.`)
    } else if (containsAny(normalizedText, FRIED_KEYWORDS)) {
      negativeScore += 1
      adviceSegments.push('Fried prep adds extra calories, so keep to a few bites for your weight-loss goal.')
    }
  }

  const muscleGoal = goalsLower.some((goal) => goal.includes('muscle') || goal.includes('strength') || goal.includes('protein'))
  if (muscleGoal) {
    if (protein !== null && protein >= 25) {
      positiveScore += 1
      usedNutritionMetrics = true
      adviceSegments.push(`Protein clocks in around ${Math.round(protein)}g which helps your muscle-building focus.`)
    } else if (protein !== null && protein < 15) {
      negativeScore += 1
      usedNutritionMetrics = true
      adviceSegments.push(`Protein is only about ${Math.round(protein)}g — add a lean side to hit your muscle-support target.`)
    }
  }

  const bloodSugarConcern =
    conditionsLower.some((condition) => condition.includes('diabetes') || condition.includes('blood sugar') || condition.includes('prediabetes')) ||
    goalsLower.some((goal) => goal.includes('blood sugar') || goal.includes('glucose'))
  if (bloodSugarConcern) {
    if (sugar !== null && sugar > 15) {
      negativeScore += 1
      usedNutritionMetrics = true
      adviceSegments.push(`Sugars land around ${Math.round(sugar)}g — swap in veggies to steady blood sugar.`)
    } else if (carbs !== null && carbs > 45) {
      negativeScore += 1
      usedNutritionMetrics = true
      adviceSegments.push(`Total carbs are near ${Math.round(carbs)}g, so balance with fibre or choose another dish for blood-sugar control.`)
    } else if (containsAny(normalizedText, SWEET_KEYWORDS)) {
      negativeScore += 1
      adviceSegments.push('Sweet components could spike blood sugar — portion carefully.')
    }
  }

  const heartHealthConcern =
    conditionsLower.some((condition) => condition.includes('hypertension') || condition.includes('blood pressure') || condition.includes('heart')) ||
    goalsLower.some((goal) => goal.includes('heart'))
  if (heartHealthConcern) {
    if (sodium !== null && sodium > 700) {
      negativeScore += 1
      usedNutritionMetrics = true
      adviceSegments.push(`Sodium is high (about ${Math.round(sodium)}mg), so pair with extra greens to support heart health.`)
    } else if (containsAny(normalizedText, FRIED_KEYWORDS)) {
      negativeScore += 1
      adviceSegments.push('Fried prep can add saturated fat — opt for a lighter entree to support heart health.')
    }
  }

  if (containsAny(normalizedText, VEGGIE_KEYWORDS)) {
    positiveScore += 1
    adviceSegments.push('The veggie content helps fibre and micronutrients for your overall goals.')
  }

  if (containsAny(normalizedText, LEAN_COOKING_KEYWORDS)) {
    positiveScore += 1
    adviceSegments.push('Lean cooking methods keep extra fat in check.')
  }

  if (containsAny(normalizedText, WHOLE_GRAIN_KEYWORDS)) {
    positiveScore += 1
    adviceSegments.push('Whole grains give steady energy and fibre.')
  }

  if (containsAny(normalizedText, FRIED_KEYWORDS)) {
    negativeScore += 1
    adviceSegments.push('Fried textures make this heavier — balance with greens or share the serving.')
  }

  const contextPieces = []
  if (profile.diet) contextPieces.push(`You noted a ${profile.diet} diet.`)
  if (profile.goals && profile.goals.length) contextPieces.push(`Goals: ${formatList(profile.goals)}.`)
  if (profile.conditions && profile.conditions.length) contextPieces.push(`Managing: ${formatList(profile.conditions)}.`)

  const uniqueAdvice = []
  adviceSegments.forEach((segment) => {
    const trimmed = segment.trim()
    if (trimmed && !uniqueAdvice.includes(trimmed)) {
      uniqueAdvice.push(trimmed)
    }
  })

  if (uniqueAdvice.length === 0) {
    let neutral = 'Nothing specific stands out against your profile.'
    if (profile.diet) {
      neutral = `Nothing obvious conflicts with your ${profile.diet} diet.`
    }
    uniqueAdvice.push(`${neutral} Use your standard portion of ${DEFAULT_PORTION_DESCRIPTION} and aim for ${DEFAULT_INGREDIENT_GUIDANCE}.`)
  }

  const finalAdviceSegments = [...contextPieces.slice(0, 1), ...uniqueAdvice.slice(0, 3)]
  const advice = finalAdviceSegments.join(' ')

  let verdict = 'moderation'
  if (negativeScore >= 2) {
    verdict = 'avoid'
  } else if (negativeScore === 0 && positiveScore > 0) {
    verdict = 'enjoy'
  }

  const signalStrength = positiveScore + negativeScore
  let confidence = 'low'
  if (usedNutritionMetrics && signalStrength >= 2) {
    confidence = 'high'
  } else if (usedNutritionMetrics || signalStrength > 0) {
    confidence = 'medium'
  }

  return {
    verdict,
    advice,
    confidence,
    fallbackText: advice
  }
}

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

async function resolveRestaurantRecord({ supabase, identifier }) {
  if (!identifier) return null
  const trimmed = identifier.toString().trim()
  if (!trimmed) return null

  if (uuidRegex.test(trimmed)) {
    const adminClient = supabaseServiceClient || supabase
    const { data: partner } = await adminClient
      .from('restaurant_partners')
      .select('id, restaurant_name, restaurant_slug, cuisine, location')
      .eq('id', trimmed)
      .maybeSingle()
    if (partner) {
      return {
        id: partner.id,
        name: partner.restaurant_name,
        slug: partner.restaurant_slug,
        cuisine: partner.cuisine,
        location: partner.location,
        source: 'partner'
      }
    }

    const { data: restaurant } = await adminClient
      .from('restaurants')
      .select('id, name, slug, cuisine, location')
      .eq('id', trimmed)
      .maybeSingle()
    if (restaurant) {
      return {
        id: restaurant.id,
        name: restaurant.name,
        slug: restaurant.slug,
        cuisine: restaurant.cuisine,
        location: restaurant.location,
        source: 'restaurant'
      }
    }
    return null
  }

  const adminClient = supabaseServiceClient || supabase

  const { data: partnerSlug } = await adminClient
    .from('restaurant_partners')
    .select('id, restaurant_name, restaurant_slug, cuisine, location')
    .eq('restaurant_slug', trimmed)
    .maybeSingle()

  if (partnerSlug) {
    return {
      id: partnerSlug.id,
      name: partnerSlug.restaurant_name,
      slug: partnerSlug.restaurant_slug,
      cuisine: partnerSlug.cuisine,
      location: partnerSlug.location,
      source: 'partner'
    }
  }

  const { data: restaurantSlug } = await adminClient
    .from('restaurants')
    .select('id, name, slug, cuisine, location')
    .eq('slug', trimmed)
    .maybeSingle()

  if (restaurantSlug) {
    return {
      id: restaurantSlug.id,
      name: restaurantSlug.name,
      slug: restaurantSlug.slug,
      cuisine: restaurantSlug.cuisine,
      location: restaurantSlug.location,
      source: 'restaurant'
    }
  }

  return null
}

async function fetchRestaurantContext({ supabase, restaurantId }) {
  const adminClient = supabaseServiceClient || supabase

  const [{ data: partner }, { data: restaurant }, { data: items, error: itemsError }] = await Promise.all([
    adminClient
      .from('restaurant_partners')
      .select('id, restaurant_name, restaurant_slug, cuisine, location')
      .eq('id', restaurantId)
      .maybeSingle(),
    adminClient
      .from('restaurants')
      .select('id, name, slug, cuisine, location, description, address')
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
    console.error('analyze-menu.generateRestaurantReview', error)
    return null
  }
}

function sanitizeProfileForPrompt(profile) {
  if (!profile || typeof profile !== 'object') {
    return {
      diet: null,
      allergies: [],
      conditions: [],
      goals: [],
      notes: null
    }
  }

  const toArray = (value) => {
    if (!value) return []
    if (Array.isArray(value)) {
      return value
        .map((entry) => (typeof entry === 'string' ? entry.trim() : ''))
        .filter(Boolean)
    }
    if (typeof value === 'string') {
      return value
        .split(',')
        .map((entry) => entry.trim())
        .filter(Boolean)
    }
    return []
  }

  return {
    diet: profile.diet || profile.diet_type || null,
    allergies: toArray(profile.allergies),
    conditions: toArray(profile.conditions),
    goals: toArray(profile.goals),
    notes: typeof profile.notes === 'string' ? profile.notes.trim() || null : null
  }
}

async function generatePersonalizedItemReview({ restaurant, item, profile, sanitizedProfile: presetSanitizedProfile }) {
  if (!process.env.OPENAI_API_KEY) return null
  if (!item) return null

  const sanitizedProfile = presetSanitizedProfile || sanitizeProfileForPrompt(profile)
  const payload = {
    dinerProfile: sanitizedProfile,
    restaurant: {
      name: restaurant?.name || 'Restaurant',
      cuisine: restaurant?.cuisine || null
    },
    menuItem: {
      id: String(item.id),
      name: item.name,
      description: item.description || null,
      price: item.price ?? null,
      calories: item.nutrition?.calories ?? null,
      tags: Array.isArray(item.tags) ? item.tags.slice(0, 8) : [],
      nutrition: item.nutrition || null
    },
    instructions: {
      verdicts: {
        enjoy: 'Great fit; enjoy freely.',
        moderation: 'Okay occasionally; watch portions or pairings.',
        avoid: 'Conflicts with profile; seek alternatives.'
      },
      format: {
        type: 'object',
        properties: {
          verdict: { type: 'string' },
          advice: { type: 'string' },
          confidence: { type: 'string' }
        }
      }
    }
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-5-mini',
      max_completion_tokens: 200,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'You are a nutrition coach. Respond ONLY with JSON describing how well a single dish matches the diner profile.'
        },
        {
          role: 'user',
          content: JSON.stringify(payload)
        }
      ]
    })

    const content = extractMessageContent(completion.choices?.[0])
    if (!content) return null

    let parsed
    try {
      parsed = JSON.parse(content)
    } catch (jsonError) {
      console.warn('[analyze-menu] Failed to parse item review JSON', jsonError)
      return null
    }

    const verdict = typeof parsed.verdict === 'string' ? parsed.verdict.trim().toLowerCase() : null
    const advice = typeof parsed.advice === 'string' ? parsed.advice.trim() : ''
    const confidence = typeof parsed.confidence === 'string' ? parsed.confidence.trim().toLowerCase() : null

    if (!verdict || !['enjoy', 'moderation', 'avoid'].includes(verdict)) {
      return null
    }

    return {
      verdict,
      advice,
      confidence: ['high', 'medium', 'low'].includes(confidence) ? confidence : null
    }
  } catch (error) {
    console.error('[analyze-menu] Item review generation failed', error)
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

function latestMenuTimestamp(items) {
  if (!Array.isArray(items) || items.length === 0) return null
  const last = items[items.length - 1]
  if (!last?.created_at) return null
  const iso = new Date(last.created_at).toISOString()
  return Number.isNaN(new Date(iso).getTime()) ? null : iso
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const identifier = req.query.identifier
  const shareParam = req.query.share
  const shareToken = typeof shareParam === 'string' ? shareParam.trim() : ''
  const itemIdParam = req.query.itemId
  const itemId = typeof itemIdParam === 'string' ? itemIdParam.trim() : ''

  if (!identifier) return res.status(400).json({ error: 'identifier_required' })
  if (!shareToken) return res.status(400).json({ error: 'share_token_required' })

  const ctx = await requireUser(req)
  if (ctx.error) return res.status(ctx.error.status).json({ error: ctx.error.message })

  const { supabase, user } = ctx

  const restaurantRecord = await resolveRestaurantRecord({ supabase, identifier })
  if (!restaurantRecord) {
    return res.status(404).json({ error: 'restaurant_not_found' })
  }

  const verification = verifyShareToken({
    token: shareToken,
    restaurantId: restaurantRecord.id
  })

  if (!verification.valid) {
    return res.status(403).json({ error: 'invalid_token' })
  }

  const profileResult = await ensureHealthProfile(supabase, user.id)
  if (profileResult.error) {
    return res.status(profileResult.error.status).json({ error: profileResult.error.message })
  }
  const sanitizedProfile = sanitizeProfileForPrompt(profileResult.profile)

  const restaurantData = await fetchRestaurantContext({ supabase, restaurantId: restaurantRecord.id })
  if (restaurantData.error) {
    return res.status(restaurantData.error.status).json({ error: restaurantData.error.message })
  }
  if (!restaurantData.restaurant) {
    return res.status(404).json({ error: 'restaurant_not_found' })
  }

  const items = restaurantData.items || []
  const mostRecentIso = latestMenuTimestamp(items)
  if (!mostRecentIso) {
    return res.status(404).json({ error: 'menu_not_found' })
  }

  const tokenTimestamp = new Date(verification.generatedAt).getTime()
  const menuTimestamp = new Date(mostRecentIso).getTime()
  if (!Number.isFinite(tokenTimestamp) || !Number.isFinite(menuTimestamp) || Math.abs(menuTimestamp - tokenTimestamp) > 60000) {
    return res.status(403).json({ error: 'token_expired' })
  }

  if (itemId) {
    const targetItem = items.find((entry) => String(entry.id) === itemId)
    if (!targetItem) {
      return res.status(404).json({ error: 'item_not_found' })
    }

    const review = await generatePersonalizedItemReview({
      restaurant: restaurantData.restaurant,
      item: targetItem,
      profile: profileResult.profile,
      sanitizedProfile
    })

    if (!review) {
      const ruleBased = generateRuleBasedPersonalizedReview({ item: targetItem, profile: sanitizedProfile })
      if (ruleBased) {
        return res.status(200).json({
          itemReview: {
            id: String(targetItem.id),
            personalizedVerdict: ruleBased.verdict,
            personalizedAdvice: ruleBased.advice,
            personalizedConfidence: ruleBased.confidence
          },
          fallbackReview: ruleBased.fallbackText,
          generatedAtIso: verification.generatedAt,
          warning: 'personalization_rule_based'
        })
      }

      const fallbackMessage = targetItem.aiReview || targetItem.nutrition?.ai_review || buildDefaultFallbackReview(targetItem)
      return res.status(200).json({
        itemReview: {
          id: String(targetItem.id),
          personalizedVerdict: null,
          personalizedAdvice: null,
          personalizedConfidence: null
        },
        fallbackReview: fallbackMessage,
        generatedAtIso: verification.generatedAt,
        warning: 'personalization_unavailable'
      })
    }

    return res.status(200).json({
      itemReview: {
        id: String(targetItem.id),
        personalizedVerdict: review.verdict,
        personalizedAdvice: review.advice,
        personalizedConfidence: review.confidence
      },
      fallbackReview: targetItem.aiReview || targetItem.nutrition?.ai_review || null,
      generatedAtIso: verification.generatedAt
    })
  }

  const preparedItems = items.map((item) => ({
    ...item,
    personalizedVerdict: null,
    personalizedAdvice: null,
    personalizedConfidence: null
  }))

  return res.status(200).json({
    restaurant: restaurantData.restaurant,
    menuItems: preparedItems,
    updatedAtIso: verification.generatedAt
  })
}
