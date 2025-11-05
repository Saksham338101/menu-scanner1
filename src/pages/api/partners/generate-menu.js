import { createClient } from '@supabase/supabase-js'
import { OpenAI } from 'openai'
import { createHash } from 'crypto'
import { buildShareUrl, generateShareToken } from '@/utils/share-token'
import { requirePartnerSession } from '@/utils/partner-auth'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false
    }
  }
)
const openaiApiKey = process.env.OPENAI_API_KEY
const openai = openaiApiKey ? new OpenAI({ apiKey: openaiApiKey }) : null
const canLogAiRequests = Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY)

async function logAiRequest({ model, prompt, batchIndex, usage, status = 'success', error }) {
  if (!canLogAiRequests || !model) return

  try {
    const inputPayload = {
      prompt,
      batchIndex
    }

    const responsePayload = {}
    if (usage) {
      responsePayload.usage = usage
    }
    if (error) {
      responsePayload.error = error
    }

    const inputHash = createHash('sha256')
      .update(`${prompt || ''}::${batchIndex ?? 'na'}`)
      .digest('hex')

    await supabase.from('ai_requests').insert({
      request_type: 'menu_assessment',
      model,
      input_hash: inputHash,
      input: inputPayload,
      response: Object.keys(responsePayload).length ? responsePayload : null,
      status,
      tokens_in: usage?.prompt_tokens ?? null,
      tokens_out: usage?.completion_tokens ?? null
    })
  } catch (logError) {
    console.warn('[generate-menu] Failed to log AI request', logError)
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST'])
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = requirePartnerSession(req, res)
  if (!session) {
    return
  }

  const partnerId = session.id
  const { menuImage } = req.body || {}
  if (!menuImage) {
    return res.status(400).json({ error: 'menuImage is required' })
  }

  const partner = await fetchPartner(partnerId)
  if (!partner) {
    return res.status(404).json({ error: 'Partner not found' })
  }

  try {
    const structuredMenu = await extractMenuFromImage(menuImage)
    const items = normalizeItems(structuredMenu?.items)
    if (items.length === 0) {
      return res.status(422).json({ error: 'Unable to detect dishes in the uploaded image. Try a clearer photo.' })
    }

    const savedItems = await persistMenu(partnerId, items)
    const reviewLookup = buildItemLookup(items)
    const formattedItems = savedItems.map((item) => {
      const key = makeItemKey(item)
      const aiReview = item.ai_review || item.nutrition?.ai_review || reviewLookup.get(key) || null
      return {
        ...item,
        aiReview
      }
    })

      const mostRecentCreatedAt = savedItems.length ? savedItems[savedItems.length - 1].created_at : new Date().toISOString()
      const generatedAtIso = new Date(mostRecentCreatedAt).toISOString()

      const shareToken = generateShareToken({
        restaurantId: partner.id,
        generatedAt: generatedAtIso
      })
      const identifier = partner?.restaurant_slug || partner?.slug || partnerId
      const shareUrl = buildShareUrl({
        identifier,
        shareToken,
        origin: req?.headers?.origin,
        req
      })
      return res.status(200).json({
        partner: {
          id: partnerId,
          name: partner.restaurant_name || partner.name || 'Restaurant',
          slug: partner.restaurant_slug || partner.slug || null
        },
        menuItems: formattedItems,
        shareToken,
        menuShareUrl: shareUrl,
        generatedAt: generatedAtIso
    })
  } catch (error) {
    console.error('[generate-menu]', error)
    return res.status(500).json({ error: error.message || 'Menu generation failed' })
  }
}

async function fetchPartner(partnerId) {
  const { data: partner } = await supabase
    .from('restaurant_partners')
    .select('id, restaurant_name, restaurant_slug, cuisine, location')
    .eq('id', partnerId)
    .maybeSingle()

  if (partner) {
    return {
      ...partner,
      source: 'partner'
    }
  }

  const { data: restaurant } = await supabase
    .from('restaurants')
    .select('id, name, slug, cuisine, location')
    .eq('id', partnerId)
    .maybeSingle()

  if (restaurant) {
    return {
      ...restaurant,
      source: 'restaurant'
    }
  }

  return null
}

async function extractMenuFromImage(menuImage) {
  const encoded = cleanupBase64(menuImage)
  const result = await attemptOpenAiExtraction(encoded)
  if (!result?.items?.length) {
    throw new Error('OpenAI did not return any menu items. Please retry with a clearer photo or a cropped page.')
  }
  return result
}

async function attemptOpenAiExtraction(encoded) {
  if (!openai) {
    return null
  }

  const maxItemsPerBatch = 12
  const maxBatches = 6
  const collected = []
  const seenNames = new Set()

  try {
    const simpleMenu = await requestSimpleMenu({ encoded })
    if (simpleMenu?.items?.length) {
      return simpleMenu
    }

    for (let batchIndex = 0; batchIndex < maxBatches; batchIndex += 1) {
      const prompt = buildBatchPrompt({ batchIndex, maxItemsPerBatch, seenNames })
      const payload = await requestMenuBatch({ prompt, encoded, batchIndex })
      const rawItems = Array.isArray(payload.items) ? payload.items : []

      if (rawItems.length === 0) {
        break
      }

      const newItems = []
      for (const item of rawItems) {
        if (!item || !item.name) continue
        const key = item.name.trim().toLowerCase()
        if (seenNames.has(key)) continue
        seenNames.add(key)
        newItems.push(item)
      }

      collected.push(...newItems)

      if (canLogAiRequests) {
        logAiRequest({
          model: 'gpt-5-mini',
          prompt,
          batchIndex,
          usage: payload._usage || null
        }).catch((err) => console.warn('[generate-menu] logAiRequest failed', err))
      }

      const hasMore = Boolean(payload.has_more)
      const reachedLimit = rawItems.length >= maxItemsPerBatch
      const truncated = Boolean(payload.truncated)
      if (!hasMore && !truncated) {
        break
      }
    }
  } catch (error) {
    console.error('[generate-menu] OpenAI extraction failed', error)
    if (canLogAiRequests) {
      logAiRequest({
        model: 'gpt-5-mini',
        prompt: 'menu_image_extraction',
        batchIndex: -1,
        status: 'error',
        error: error.message || 'Unknown OpenAI error'
      }).catch((err) => console.warn('[generate-menu] logAiRequest error handler failed', err))
    }
    throw error
  }

  if (!collected.length) {
    return { items: [] }
  }

  return { items: collected }
}

function buildSimpleMenuPrompt() {
  return [
    'Developer: Begin with a concise checklist (3-7 bullets) of what you will do; keep items conceptual, not implementation-level.',
    'You are tasked with digitizing a restaurant menu from an image.',
    'Identify and separate distinct menu sections (such as Appetizers, Mains, Desserts) as they appear on the menu. If the menu does not have clear sections, use "Menu" as a single section.',
    'For each section, list all items in the same order as they appear on the menu. For each item, include its exact name and price as shown on the menu.',
    'Add a "description" field only if a short description is clearly visible for that item. If there is no readable description, omit the "description" field for that item.',
    'Add a "tags" field only if tags are explicitly given for an item in the menu (such as "vegetarian", "spicy", etc.). Do not infer or invent tags; only include this field if it is clearly indicated. Omit the "tags" field if there are no tags shown for the item.',
    'Do not include any items with unreadable names or prices. Do not invent or infer any items, prices, descriptions, or tags not clearly present in the menu.',
    'For prices, preserve the format used on the menu. If prices are numbers without currency symbols, use them as-is. If a currency symbol is used, include it exactly as shown. Always return the "price" as a string matching the menu’s formatting.',
    'Return only the required JSON structure with no additional comments or explanations.',
    'After creating the JSON output, quickly validate that all items and fields match what is visible and clearly readable in the menu image. If any discrepancies are detected, correct them before returning the output.',
    'Return a JSON object structured as follows:',
    '{ "sections": [   {"name": "Section name as on menu", "items": [  {      "name": "Dish name as on menu", "price": "12.50" or "$12.50" (as on menu), "description": "Short description from menu",  "tags": [ "Tag as on menu" ]  }, ]},  ]}',
    'Omit the "description" and "tags" fields when not present in the menu. Preserve the section and item order from the original menu image.'
  ].join('\n')
}

async function requestSimpleMenu({ encoded }) {
  if (!openai) return null

  try {
    const prompt = buildSimpleMenuPrompt()
    const response = await openai.responses.create({
      model: 'gpt-4o-mini',
      temperature: 0.1,
      max_output_tokens: 2000,
      text: {
        format: {
          type: 'json_schema',
          name: 'menu_sections',
          schema: SIMPLE_MENU_SCHEMA,
          strict: false
        }
      },
      input: [
        {
          role: 'system',
          content: [
            {
              type: 'input_text',
              text: 'You extract structured data from restaurant menus. Always respond with JSON matching the provided schema.'
            }
          ]
        },
        {
          role: 'user',
          content: [
            { type: 'input_text', text: prompt },
            { type: 'input_image', image_url: `data:image/jpeg;base64,${encoded}` }
          ]
        }
      ]
    })

    const { content, truncated } = extractResponsesContent(response)
    if (!content) {
      return null
    }

    const parsed = parseJsonPayload(content)
    const normalized = coerceMenuPayload(parsed)
    if (response.usage) {
      normalized._usage = {
        prompt_tokens: response.usage.input_tokens,
        completion_tokens: response.usage.output_tokens
      }
    }
    if (truncated) {
      normalized.truncated = true
    }
    return normalized
  } catch (error) {
    console.warn('[generate-menu] Simple menu extraction failed', error?.message || error)
    return null
  }
}

function buildBatchPrompt({ batchIndex, maxItemsPerBatch, seenNames }) {
  const baseLines = [
    'You are a meticulous menu digitization assistant.',
    `This is extraction batch ${batchIndex + 1}.`,
    `Return ONLY valid JSON following this schema: {"items":[{"name":"string","description":"string","price":number,"calories":number,"tags":["string"],"review":"short, evidence-based suitability sentence","confidence":"high"|"medium"|"low"}],"has_more":boolean}.`,
    `Provide up to ${maxItemsPerBatch} NEW menu items from the image. Each item must include: full dish name, short description (>= 8 words when possible), price in USD as a number (no symbols), calorie estimate as an integer, descriptive dietary tags (only when clearly present or strongly indicated), and a one-sentence diner-facing suitability review followed by the confidence level field.`,
    'Reviews must be conservative and evidence-based: base statements only on text visible in the item name/description or clear tags. If you infer information (e.g., likely contains dairy or meat), prefix the short rationale with a hedging phrase like "Likely contains" or "May include" and set confidence to "medium" or "low" accordingly.',
    'The review sentence should begin with a short suitability label (choose one: "Excellent fit", "Good fit", "Caution", "Avoid"), then a hyphen, then a concise reason (6–18 words) that cites the evidence (e.g., "contains cheddar" or "listed as vegetarian"). Example: "Good fit - contains grilled vegetables and no explicit meat listed."',
    'Set the confidence field to one of: "high" (explicit info present on menu), "medium" (reasonable inference from names/descriptions), or "low" (speculative). Do not produce numeric confidence scores.',
    'If a field is missing in the image, you may infer a plausible value but mark confidence as "medium" or "low"; when the value is clearly present, set confidence to "high".',
    'Never offer medical advice or absolute statements about allergens. Use careful language: "may contain", "likely contains", "contains" only when clear.',
    'Always set "has_more" to true if additional unique menu items remain beyond this batch; otherwise set it to false.',
    'Respond with JSON only – no commentary.'
  ]

  if (seenNames.size > 0) {
    const seenList = Array.from(seenNames).slice(-40)
    baseLines.push(`We already captured these dish names: ${seenList.join('; ')}. Do not repeat them.`)
  }

  return baseLines.join('\n')
}

const MENU_JSON_SCHEMA = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: ['string', 'null'] },
          price: { type: ['number', 'string', 'null'] },
          calories: { type: ['number', 'string', 'null'] },
          tags: {
            type: 'array',
            items: { type: 'string' }
          },
          review: { type: ['string', 'null'] },
          confidence: { type: ['string', 'null'] }
        },
        required: ['name'],
        additionalProperties: true
      }
    },
    has_more: { type: ['boolean', 'string'] },
    truncated: { type: ['boolean', 'string'] }
  },
  required: ['items'],
  additionalProperties: true
}

const SIMPLE_MENU_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          description: { type: ['string', 'null'] },
          items: {
            type: 'array',
            items: {
              type: 'object',
              properties: {
                name: { type: 'string' },
                description: { type: ['string', 'null'] },
                price: { type: ['number', 'string', 'null'] },
                tags: {
                  type: 'array',
                  items: { type: 'string' }
                }
              },
              required: ['name'],
              additionalProperties: true
            }
          }
        },
        required: ['name', 'items'],
        additionalProperties: true
      }
    }
  },
  required: ['sections'],
  additionalProperties: true
}

async function requestMenuBatch({ prompt, encoded, batchIndex }) {
  if (!openai) {
    throw new Error('OpenAI client not available')
  }

  const basePayload = {
    model: 'gpt-5-mini',
    max_completion_tokens: 900,
    response_format: { type: 'json_object' },
    messages: [
      { role: 'system', content: 'You extract structured data from restaurant menus. Always reply with valid JSON.' },
      {
        role: 'user',
        content: [
          { type: 'text', text: prompt },
          { type: 'image_url', image_url: { url: `data:image/jpeg;base64,${encoded}` } }
        ]
      }
    ]
  }

  const attempts = [
    { ...basePayload, _label: 'json_object' },
    { ...basePayload, response_format: undefined, _label: 'no_response_format', max_completion_tokens: 1200 },
    { ...basePayload, response_format: undefined, model: 'gpt-4.1-mini', temperature: 0.2, max_completion_tokens: 1600, _label: 'fallback_model' },
    {
      useResponsesApi: true,
      _label: 'responses_gpt4o_mini',
      model: 'gpt-4o-mini',
      max_output_tokens: 2000
    },
    {
      useResponsesApi: true,
      _label: 'responses_gpt4.1',
      model: 'gpt-4.1',
      max_output_tokens: 2600
    }
  ]

  for (const attempt of attempts) {
    const { _label, useResponsesApi, ...payload } = attempt
    let response

    try {
      if (useResponsesApi) {
        response = await openai.responses.create({
          model: payload.model,
          max_output_tokens: payload.max_output_tokens,
          text: {
            format: {
              type: 'json_schema',
              name: 'menu_batch',
              schema: MENU_JSON_SCHEMA,
              strict: false
            }
          },
          input: [
            {
              role: 'system',
              content: [
                {
                  type: 'input_text',
                  text: 'You extract structured data from restaurant menus. Always reply with valid JSON that matches the provided schema.'
                }
              ]
            },
            {
              role: 'user',
              content: [
                { type: 'input_text', text: prompt },
                { type: 'input_image', image_url: `data:image/jpeg;base64,${encoded}` }
              ]
            }
          ]
        })
      } else {
        response = await openai.chat.completions.create(payload)
      }
    } catch (apiError) {
      console.warn(`[generate-menu] OpenAI request failed (${_label})`, apiError?.message || apiError)
      continue
    }

    let content = null
    let truncated = false
    let usage = null

    if (useResponsesApi) {
      const extracted = extractResponsesContent(response)
      content = extracted.content
      truncated = extracted.truncated
      usage = response.usage ? { prompt_tokens: response.usage.input_tokens, completion_tokens: response.usage.output_tokens } : null
    } else {
      const choice = response.choices?.[0]
      content = extractMessageContent(choice)
      truncated = choice?.finish_reason === 'length'
      usage = response.usage || null
    }

    if (!content) {
      const debugTarget = useResponsesApi ? response?.output ?? null : response?.choices?.[0] ?? null
      try {
        console.warn(`OpenAI menu extraction missing content (${_label}), continuing to next strategy`, JSON.stringify(debugTarget, null, 2))
      } catch (_) {
        console.warn(`OpenAI menu extraction missing content (${_label}), continuing to next strategy`)
      }
      continue
    }

    try {
      const parsed = parseJsonPayload(content)
      const normalized = coerceMenuPayload(parsed)
      if (usage) {
        normalized._usage = usage
      }
      if (truncated) {
        normalized.truncated = true
      }
      return normalized
    } catch (parseError) {
      console.warn(`[generate-menu] Failed to parse OpenAI response (${_label})`, parseError?.message || parseError)
      continue
    }
  }

  throw new Error(`OpenAI did not return JSON for batch ${batchIndex + 1}`)
}

function extractMessageContent(choice) {
  if (!choice) return null

  if (typeof choice.text === 'string' && choice.text.trim()) {
    return choice.text.trim()
  }

  const message = choice.message
  if (!message) return null

  if (typeof message === 'string') {
    return message.trim() || null
  }

  const candidate = message.content ?? message.text ?? null

  if (typeof candidate === 'string' && candidate.trim()) {
    return candidate.trim()
  }

  if (Array.isArray(candidate)) {
    const parts = []
    candidate.forEach((part) => {
      if (!part) return
      if (typeof part === 'string' && part.trim()) {
        parts.push(part.trim())
        return
      }
      if (typeof part.text === 'string' && part.text.trim()) {
        parts.push(part.text.trim())
        return
      }
      if (typeof part.value === 'string' && part.value.trim()) {
        parts.push(part.value.trim())
      }
    })

    if (parts.length) {
      const joined = parts.join('').trim()
      if (joined) return joined
    }
  }

  if (typeof message.content === 'object' && message.content !== null) {
    const { text, value } = message.content
    if (typeof text === 'string' && text.trim()) return text.trim()
    if (typeof value === 'string' && value.trim()) return value.trim()
  }

  return null
}

function extractResponsesContent(response) {
  const outputs = Array.isArray(response?.output) ? response.output : []
  const textParts = []
  let truncated = false

  outputs.forEach((entry) => {
    if (entry?.content && Array.isArray(entry.content)) {
      entry.content.forEach((part) => {
        if (!part) return
        if (typeof part === 'string' && part.trim()) {
          textParts.push(part.trim())
          return
        }
        if (part.type === 'output_text' && typeof part.text === 'string') {
          textParts.push(part.text)
          return
        }
        if (part.type === 'text' && typeof part.text === 'string') {
          textParts.push(part.text)
          return
        }
        if (part.type === 'output_json' && part.json) {
          try {
            textParts.push(JSON.stringify(part.json))
          } catch (_) {
            /* ignore */
          }
          return
        }
        if (part.type === 'json' && part.json) {
          try {
            textParts.push(JSON.stringify(part.json))
          } catch (_) {
            /* ignore */
          }
        }
      })
    }

    if (entry?.finish_reason === 'max_output_tokens' || entry?.finish_reason === 'length' || entry?.status === 'incomplete') {
      truncated = true
    }
  })

  if (!textParts.length && typeof response?.output_text === 'string' && response.output_text.trim()) {
    textParts.push(response.output_text.trim())
  }

  const content = textParts.join('').trim() || null
  return { content, truncated }
}

function parseJsonPayload(content) {
  if (!content || typeof content !== 'string') {
    throw new Error('Empty response content')
  }

  const trimmed = content.trim()
  try {
    return JSON.parse(trimmed)
  } catch (error) {
    const start = trimmed.indexOf('{')
    const end = trimmed.lastIndexOf('}')
    if (start !== -1 && end !== -1 && end > start) {
      const candidate = trimmed.slice(start, end + 1)
      try {
        return JSON.parse(candidate)
      } catch (_) {
        /* ignore */
      }
    }

    const fallbackItems = convertTextToMenuItems(trimmed)
    if (fallbackItems.length) {
      return { items: fallbackItems, has_more: false, __coercedFromText: true }
    }

    throw error
  }
}

function coerceMenuPayload(parsed) {
  const hasMoreValue = parsed && typeof parsed === 'object' ? parsed.has_more : undefined
  const truncatedValue = parsed && typeof parsed === 'object' ? parsed.truncated : undefined

  const result = {
    items: [],
    has_more:
      typeof hasMoreValue === 'boolean'
        ? hasMoreValue
        : typeof hasMoreValue === 'string'
          ? hasMoreValue.toLowerCase() === 'true'
          : false,
    truncated:
      typeof truncatedValue === 'boolean'
        ? truncatedValue
        : typeof truncatedValue === 'string'
          ? truncatedValue.toLowerCase() === 'true'
          : false
  }

  if (!parsed) {
    return result
  }

  const visited = new WeakSet()
  const seenNames = new Set()

  const collectCandidate = (raw, sectionName) => {
    if (!raw || typeof raw !== 'object') return

    if (Array.isArray(raw.items) && raw.items.length) {
      const nextSection = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim() : sectionName || null
      raw.items.forEach((child) => collectCandidate(child, nextSection))
    }

    const candidate = createMenuItemCandidate(raw, sectionName)
    if (!candidate) return
    const key = candidate.name.toLowerCase()
    if (seenNames.has(key)) return
    seenNames.add(key)
    result.items.push(candidate)
  }

  const visit = (value) => {
    if (!value) return
    const valueType = typeof value
    if (valueType !== 'object') {
      if (valueType === 'string') {
        const textItems = convertTextToMenuItems(value)
        textItems.forEach((item) => collectCandidate(item, null))
      }
      return
    }

    if (visited.has(value)) return
    visited.add(value)

    if (Array.isArray(value)) {
      value.forEach((entry) => {
        if (!entry) return
        if (typeof entry === 'object') {
          collectCandidate(entry, null)
          visit(entry)
        } else if (typeof entry === 'string') {
          const itemsFromString = convertTextToMenuItems(entry)
          itemsFromString.forEach((item) => collectCandidate(item, null))
        }
      })
      return
    }

    collectCandidate(value, null)

    Object.keys(value).forEach((key) => {
      const child = value[key]
      if (!child) return
      if (Array.isArray(child) || typeof child === 'object' || typeof child === 'string') {
        visit(child)
      }
    })
  }

  if (Array.isArray(parsed)) {
    visit(parsed)
  } else if (typeof parsed === 'object') {
    const primaryCollections = [
      parsed.items,
      parsed.menu,
      parsed.menuItems,
      parsed.dishes,
      parsed.entries,
      parsed.products,
      parsed.options,
      parsed.sections
    ]

    primaryCollections.forEach((collection) => {
      if (collection) {
        visit(collection)
      }
    })

    visit(parsed)
  }

  return result
}

function createMenuItemCandidate(raw, sectionName) {
  if (!raw || typeof raw !== 'object') return null

  if (Array.isArray(raw.items) && !pickFirst(raw, ['price', 'price_usd', 'priceUsd', 'cost', 'amount', 'price_value'])) {
    return null
  }

  const nameValue = pickFirstText(raw, ['name', 'title', 'item', 'dish', 'label', 'menu_item'])
  if (!nameValue) return null

  const descriptionValue = pickFirstText(raw, ['description', 'details', 'summary', 'about', 'note'])
  const priceValue = pickFirst(raw, ['price', 'price_usd', 'priceUsd', 'cost', 'amount', 'price_value'])
  const caloriesValue = pickFirst(raw, ['calories', 'kcal', 'calorie', 'energy'])
  const tagsValue = pickFirst(raw, ['tags', 'labels', 'attributes', 'dietary', 'keywords', 'flags'])
  const reviewValue = pickFirstText(raw, ['review', 'blurb', 'aiReview', 'ai_review'])
  const confidenceValue = pickFirstText(raw, ['confidence', 'certainty', 'quality'])

  let tags = []
  if (Array.isArray(tagsValue)) {
    tags = tagsValue.map((tag) => String(tag).trim()).filter(Boolean)
  } else if (typeof tagsValue === 'string') {
    tags = tagsValue
      .split(/[;,|]/)
      .map((tag) => tag.trim())
      .filter(Boolean)
  }

  const candidate = {
    name: nameValue,
    description: descriptionValue || null,
    price: priceValue,
    calories: caloriesValue,
    tags,
    review: reviewValue || null,
    confidence: confidenceValue || null,
    section: sectionName || pickFirstText(raw, ['section', 'category', 'group']) || null
  }

  return candidate
}

function pickFirst(source, keys) {
  for (const key of keys) {
    if (source[key] !== undefined && source[key] !== null) {
      return source[key]
    }
  }
  return null
}

function pickFirstText(source, keys) {
  for (const key of keys) {
    const value = source[key]
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (trimmed) return trimmed
    }
  }
  return null
}

function convertTextToMenuItems(text) {
  if (!text || typeof text !== 'string') return []

  const cleaned = text
    .replace(/```(?:json|text|markdown)?/gi, '')
    .replace(/```/g, '')
    .replace(/\r/g, '')
    .trim()

  if (!cleaned) return []

  const segments = splitTextSegments(cleaned)
  const items = []
  const seen = new Set()

  for (const segment of segments) {
    const item = parseSegmentToItem(segment)
    if (!item || !item.name) continue
    const key = item.name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    items.push(item)
    if (items.length >= 60) break
  }

  return items
}

function splitTextSegments(text) {
  const byBlankLines = text
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)

  if (byBlankLines.length > 1) {
    return byBlankLines
  }

  const lines = text.split(/\n/).map((line) => line.trim())
  const segments = []
  let current = []

  for (const line of lines) {
    if (!line) {
      if (current.length) {
        segments.push(current.join(' '))
        current = []
      }
      continue
    }

    if (/^(?:[-*•]|\d+[.)])\s*/.test(line)) {
      if (current.length) {
        segments.push(current.join(' '))
      }
      current = [line.replace(/^(?:[-*•]|\d+[.)])\s*/, '')]
    } else {
      current.push(line)
    }
  }

  if (current.length) {
    segments.push(current.join(' '))
  }

  return segments.length ? segments : [text]
}

function parseSegmentToItem(segment) {
  if (!segment) return null
  let working = segment.replace(/\s+/g, ' ').trim()
  if (!working) return null

  const lower = working.toLowerCase()
  if (lower.startsWith('note:') || lower.startsWith('total:') || lower.startsWith('serves')) {
    return null
  }

  const priceMatch = working.match(/\$?\d{1,4}(?:\.\d{1,2})?/)
  const caloriesMatch = working.match(/(\d{2,4})\s*(?:k?cal|calories?|cal\b)/i)

  const price = priceMatch ? parsePrice(priceMatch[0]) : null
  const calories = caloriesMatch ? parseInt(caloriesMatch[1], 10) : null

  if (priceMatch) {
    working = working.replace(priceMatch[0], '').trim()
  }
  if (caloriesMatch) {
    working = working.replace(caloriesMatch[0], '').trim()
  }

  const separatorMatch = working.match(/^(.*?)(?:\s[-–—:]\s|\.\s+)(.+)$/)
  let namePart = working
  let descriptionPart = ''

  if (separatorMatch) {
    namePart = separatorMatch[1]
    descriptionPart = separatorMatch[2]
  } else {
    const dashSplit = working.split(/\s[-–—:]\s/)
    if (dashSplit.length > 1) {
      namePart = dashSplit.shift()
      descriptionPart = dashSplit.join(' - ')
    }
  }

  namePart = namePart.replace(/^[\d. )-]+/, '').trim()
  if (!namePart) return null

  const tags = deriveTagsFromText(segment)

  return {
    name: namePart,
    description: descriptionPart ? descriptionPart.trim() : null,
    price,
    calories,
    tags,
    review: null,
    confidence: 'estimated'
  }
}

function deriveTagsFromText(text) {
  const lower = text.toLowerCase()
  const tagMap = [
    { key: 'vegan', label: 'vegan' },
    { key: 'vegetarian', label: 'vegetarian' },
    { key: 'gluten-free', label: 'gluten-free' },
    { key: 'gluten free', label: 'gluten-free' },
    { key: 'spicy', label: 'spicy' },
    { key: 'keto', label: 'keto' },
    { key: 'halal', label: 'halal' },
    { key: 'organic', label: 'organic' },
    { key: 'dairy-free', label: 'dairy-free' },
    { key: 'dairy free', label: 'dairy-free' }
  ]

  const tags = new Set()
  tagMap.forEach(({ key, label }) => {
    if (lower.includes(key)) {
      tags.add(label)
    }
  })

  return Array.from(tags)
}

function normalizeItems(rawItems) {
  if (!Array.isArray(rawItems)) return []
  return rawItems
    .map((item) => {
      if (!item || !item.name) return null
      const priceValue = parsePrice(item.price)
      const caloriesValue = parseCalories(item.calories)
      const reviewValue = typeof item.review === 'string' ? item.review.trim() : null
      const confidence = typeof item.confidence === 'string' ? item.confidence.toLowerCase() : 'high'

      const nutrition = {}
      if (caloriesValue) nutrition.calories = caloriesValue
      if (reviewValue) nutrition.ai_review = reviewValue

      const tags = Array.isArray(item.tags) ? item.tags.map((tag) => String(tag).trim()).filter(Boolean) : []
      if (confidence === 'estimated' && !tags.includes('estimated')) {
        tags.push('estimated')
      }

      const sectionTag = typeof item.section === 'string' ? item.section.trim() : ''
      if (sectionTag) {
        const sectionLabel = `section:${sectionTag}`
        const hasSectionTag = tags.some((tag) => tag.toLowerCase() === sectionLabel.toLowerCase())
        if (!hasSectionTag) {
          tags.push(sectionLabel)
        }
      }

      return {
        name: item.name.trim(),
        description: item.description?.trim() || null,
        price: priceValue,
        section: sectionTag || null,
        tags,
        nutrition: Object.keys(nutrition).length ? nutrition : null,
        aiReview: reviewValue
      }
    })
    .filter(Boolean)
}

async function persistMenu(partnerId, items) {
  await supabase.from('menu_items').delete().eq('restaurant_id', partnerId)

  const rows = items.map((item) => ({
    restaurant_id: partnerId,
    name: item.name,
    description: item.description,
    price: item.price,
    tags: item.tags,
    nutrition: item.nutrition
  }))

  const { data, error } = await supabase.from('menu_items').insert(rows).select('*')
  if (error) {
    if (/row-level security/i.test(error.message || '') || error.code === '42501') {
      throw new Error('Supabase blocked menu save due to row-level security. Add SUPABASE_SERVICE_ROLE_KEY to the API environment or update your RLS policies for menu_items.')
    }
    throw new Error(error.message)
  }

  const orderedData = (data || []).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
  return orderedData.map((row) => ({
    ...row,
    ai_review: row.nutrition?.ai_review || null
  }))
}

function cleanupBase64(b64) {
  if (!b64) return ''
  return b64.includes(',') ? b64.split(',')[1] : b64
}

function parsePrice(value) {
  if (value === null || value === undefined) return null
  const numeric = parseFloat(String(value).replace(/[^0-9.]/g, ''))
  return Number.isFinite(numeric) ? numeric : null
}

function parseCalories(value) {
  if (value === null || value === undefined) return null
  const numeric = parseFloat(String(value).replace(/[^0-9.]/g, ''))
  return Number.isFinite(numeric) ? Math.round(numeric) : null
}

function makeItemKey(item) {
  if (!item) return ''
  const name = String(item.name || '').trim().toLowerCase()
  const price = item.price !== undefined && item.price !== null ? Number(item.price).toFixed(2) : ''
  return `${name}::${price}`
}

function buildItemLookup(items) {
  const map = new Map()
  items.forEach((item) => {
    const key = makeItemKey(item)
    if (key) {
      map.set(key, item.aiReview || null)
    }
  })
  return map
}