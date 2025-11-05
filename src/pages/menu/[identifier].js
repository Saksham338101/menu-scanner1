import Head from 'next/head'
import Link from 'next/link'
import { createClient } from '@supabase/supabase-js'
import { verifyShareToken } from '@/utils/share-token'

function normaliseSections(items = []) {
  const sectionsMap = new Map()
  const defaultSectionName = 'Menu'

  items.forEach((item) => {
    if (!item) return

    const tags = Array.isArray(item.tags) ? item.tags : []
    let sectionName = item.section || null
    const remainingTags = []

    tags.forEach((tag) => {
      if (typeof tag !== 'string') return
      const trimmedTag = tag.trim()
      if (!trimmedTag) return
      const match = trimmedTag.match(/^section:(.+)$/i)
      if (match && !sectionName) {
        sectionName = match[1].trim() || defaultSectionName
      } else {
        remainingTags.push(trimmedTag)
      }
    })

    const cleanTags = remainingTags.filter(Boolean)
    const bucket = sectionName || defaultSectionName

    if (!sectionsMap.has(bucket)) {
      sectionsMap.set(bucket, [])
    }

    sectionsMap.get(bucket).push({
      id: item.id,
      name: item.name,
      description: item.description || null,
      price: item.price,
      tags: cleanTags,
      nutrition: item.nutrition || null,
      aiReview: item.ai_review || item.aiReview || item.nutrition?.ai_review || null
    })
  })

  return Array.from(sectionsMap.entries()).map(([name, entries]) => ({
    name,
    items: entries
  }))
}

export default function PublicMenuPage({ restaurant, sections, updatedAtIso, shareToken }) {
  if (!restaurant) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 px-6 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">Menu not found</h1>
        <p className="text-gray-600 max-w-sm">This menu link is no longer active. Please contact the restaurant for the latest dishes.</p>
        <Link href="/" className="px-4 py-2 rounded-md bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
          Back to meal.it
        </Link>
      </div>
    )
  }

  const updatedLabel = formatUpdatedLabel(updatedAtIso)

  return (
    <>
      <Head>
        <title>{restaurant.displayName} · Digital Menu</title>
        <meta
          name="description"
          content={`Browse the latest dishes from ${restaurant.displayName}. Prices, tags, and highlights included.`}
        />
      </Head>
      <main className="min-h-screen bg-white">
        <div className="max-w-3xl mx-auto px-4 py-10 space-y-8">
          <header className="text-center space-y-4">
            <h1 className="text-3xl font-semibold text-gray-900">{restaurant.displayName}</h1>
            {restaurant.cuisine && <p className="text-sm text-gray-500">{restaurant.cuisine}</p>}
            {restaurant.location && <p className="text-xs text-gray-400">{restaurant.location}</p>}
            {updatedLabel && (
              <p className="text-xs text-gray-400">Updated {updatedLabel}</p>
            )}
            {shareToken && (
              <Link
                href={`/menu/${restaurant.slug || restaurant.id}/analyze?share=${encodeURIComponent(shareToken)}`}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-blue-600 rounded-md hover:bg-blue-700"
              >
                Analyze with my profile
              </Link>
            )}
          </header>

          {sections.length === 0 ? (
            <div className="border border-dashed border-gray-300 rounded-lg p-10 text-center text-gray-500">
              Menu items will appear here once the restaurant has uploaded them.
            </div>
          ) : (
            <div className="space-y-6">
              {sections.map((section) => (
                <section key={section.name} className="space-y-3">
                  <h2 className="text-xl font-semibold text-gray-900">{section.name}</h2>
                  <ul className="space-y-3">
                    {section.items.map((item) => (
                      <li key={item.id || item.name} className="border border-gray-200 rounded-lg p-4">
                        <div className="flex flex-col gap-3">
                          <div>
                            <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
                            {item.description && <p className="text-sm text-gray-600 mt-1">{item.description}</p>}
                          </div>
                          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-gray-600">
                            {Number.isFinite(Number(item.price)) && (
                              <span className="font-semibold text-gray-900">${Number(item.price).toFixed(2)}</span>
                            )}
                            {item.nutrition?.calories && <span>{item.nutrition.calories} kcal</span>}
                            {item.aiReview && <span className="italic text-emerald-700">{item.aiReview}</span>}
                          </div>
                          {Array.isArray(item.tags) && item.tags.length > 0 && (
                            <div className="flex flex-wrap gap-2">
                              {item.tags.map((tag) => (
                                <span key={tag} className="text-xs uppercase tracking-wide bg-blue-50 text-blue-600 px-2 py-1 rounded">
                                  {tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </section>
              ))}
            </div>
          )}

          <footer className="text-center text-xs text-gray-400 pt-6 border-t border-gray-200">
            Powered by meal.it · AI-assisted menu digitisation
          </footer>
        </div>
      </main>
    </>
  )
}

export async function getServerSideProps({ params, query }) {
  const identifier = params?.identifier
  const shareTokenParam = typeof query?.share === 'string' ? query.share.trim() : ''
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!identifier || !shareTokenParam || !supabaseUrl || !serviceKey) {
    return { notFound: true }
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false }
  })

  const restaurantResult = await resolveRestaurantRecord({ supabase, identifier })

  if (!restaurantResult) {
    return { notFound: true }
  }

  const verification = verifyShareToken({
    token: shareTokenParam,
    restaurantId: restaurantResult.id
  })

  if (!verification.valid) {
    return { notFound: true }
  }

  const { id, name, slug, cuisine, location } = restaurantResult
  const { data: menuItems, error: menuError } = await supabase
    .from('menu_items')
    .select('id, name, description, price, tags, nutrition, created_at')
    .eq('restaurant_id', id)
    .order('created_at', { ascending: true })

  if (menuError) {
    console.warn('[digital-menu] Failed to load menu items', menuError)
    return { notFound: true }
  }

  const sections = normaliseSections(menuItems || [])
  const mostRecentRaw = Array.isArray(menuItems) && menuItems.length > 0 ? menuItems[menuItems.length - 1].created_at : null
  const mostRecent = mostRecentRaw ? new Date(mostRecentRaw).toISOString() : null

  if (!mostRecent) {
    return { notFound: true }
  }

  const tokenTimestamp = new Date(verification.generatedAt).getTime()
  const menuTimestamp = new Date(mostRecent).getTime()
  if (!Number.isFinite(tokenTimestamp) || !Number.isFinite(menuTimestamp) || Math.abs(menuTimestamp - tokenTimestamp) > 60000) {
    return { notFound: true }
  }

  return {
    props: {
      restaurant: {
        id,
        slug: slug || identifier,
        displayName: name || slug || identifier,
        cuisine: cuisine || null,
        location: location || null
      },
      sections,
      updatedAtIso: verification.generatedAt,
      shareToken: shareTokenParam
    }
  }
}

async function resolveRestaurantRecord({ supabase, identifier }) {
  const trimmed = String(identifier).trim()
  if (!trimmed) return null

  const bySlug = await supabase
    .from('restaurant_partners')
    .select('id, restaurant_name, restaurant_slug, cuisine, location')
    .eq('restaurant_slug', trimmed)
    .maybeSingle()

  if (bySlug?.data) {
    return {
      id: bySlug.data.id,
      name: bySlug.data.restaurant_name,
      slug: bySlug.data.restaurant_slug,
      cuisine: bySlug.data.cuisine,
      location: bySlug.data.location,
      source: 'partner'
    }
  }

  const byPartnerId = await supabase
    .from('restaurant_partners')
    .select('id, restaurant_name, restaurant_slug, cuisine, location')
    .eq('id', trimmed)
    .maybeSingle()

  if (byPartnerId?.data) {
    return {
      id: byPartnerId.data.id,
      name: byPartnerId.data.restaurant_name,
      slug: byPartnerId.data.restaurant_slug,
      cuisine: byPartnerId.data.cuisine,
      location: byPartnerId.data.location,
      source: 'partner'
    }
  }

  const restaurantSlug = await supabase
    .from('restaurants')
    .select('id, name, slug, cuisine, location')
    .eq('slug', trimmed)
    .maybeSingle()

  if (restaurantSlug?.data) {
    return {
      id: restaurantSlug.data.id,
      name: restaurantSlug.data.name,
      slug: restaurantSlug.data.slug,
      cuisine: restaurantSlug.data.cuisine,
      location: restaurantSlug.data.location,
      source: 'restaurant'
    }
  }

  const restaurantById = await supabase
    .from('restaurants')
    .select('id, name, slug, cuisine, location')
    .eq('id', trimmed)
    .maybeSingle()

  if (restaurantById?.data) {
    return {
      id: restaurantById.data.id,
      name: restaurantById.data.name,
      slug: restaurantById.data.slug,
      cuisine: restaurantById.data.cuisine,
      location: restaurantById.data.location,
      source: 'restaurant'
    }
  }

  return null
}

function formatUpdatedLabel(isoString) {
  if (!isoString) return ''
  try {
    const formatter = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC'
    })
    return formatter.format(new Date(isoString))
  } catch (error) {
    console.warn('[digital-menu] Failed to format updated date', error)
    return ''
  }
}
