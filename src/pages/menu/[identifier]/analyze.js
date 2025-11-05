import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

const errorCopy = {
  invalid_token: 'This invitation is no longer valid. Ask the restaurant for a fresh share link.',
  token_expired: 'This menu link has expired. Contact the restaurant to regenerate it.',
  restaurant_not_found: 'We could not find this restaurant. Check the link and try again.',
  menu_not_found: 'This menu is no longer available. Please ask the restaurant for an updated link.',
  health_profile_required: 'Complete your health profile to analyse this menu.',
  share_token_required: 'This menu needs a secure share token. Check the link and try again.',
  item_not_found: 'We could not find that dish anymore. Refresh and try again.',
  personalization_unavailable:
    'Personalised insights are unavailable right now. Using default guidance: one standard serving (around 350g) balanced with roughly 50% vegetables, 25% lean protein, and 25% whole grains or starches.',
  personalization_rule_based: 'We used your saved health profile to tailor this guidance while live coaching catches up.',
  Unauthorized: 'Please sign in again to continue.'
}

const verdictMeta = {
  enjoy: {
    label: 'Great fit',
    badge: 'bg-emerald-100 text-emerald-800 border border-emerald-200',
    text: 'text-emerald-800'
  },
  moderation: {
    label: 'Enjoy in moderation',
    badge: 'bg-amber-100 text-amber-800 border border-amber-200',
    text: 'text-amber-800'
  },
  avoid: {
    label: 'Consider alternatives',
    badge: 'bg-rose-100 text-rose-800 border border-rose-200',
    text: 'text-rose-800'
  }
}

const verdictFallbackAdvice = {
  enjoy: 'Great fit; enjoy freely.',
  moderation: 'Okay occasionally; watch portions or pairings.',
  avoid: 'Conflicts with your profile; seek alternatives.'
}

function buildDefaultFallbackPersonalization(item) {
  const baseMessage =
    'We could not personalise this dish right now. Use default guidance: keep to one standard serving (around 350g) and balance your plate with roughly 50% vegetables, 25% lean protein, and 25% whole grains or starches.'
  const supportiveMessage = 'Pair with water, add extra greens if available, and go easy on rich sides or sauces.'

  const segments = [baseMessage]

  if (item?.nutrition?.calories && Number.isFinite(Number(item.nutrition.calories))) {
    segments.push(`This dish is listed at about ${Number(item.nutrition.calories)} kcal per serving — adjust portions if you are managing calories.`)
  }

  segments.push(supportiveMessage)

  return segments.join(' ')
}

export default function AnalyzeMenuPage() {
  const router = useRouter()
  const routerReady = router.isReady
  const identifier = useMemo(() => {
    const raw = router.query?.identifier
    if (Array.isArray(raw)) return raw[0] || ''
    return typeof raw === 'string' ? raw : ''
  }, [router.query?.identifier])
  const shareToken = useMemo(() => {
    const raw = router.query?.share
    return typeof raw === 'string' ? raw.trim() : ''
  }, [router.query?.share])

  const { isAuthenticated, loading, hasHealthProfile, profileLoading, getAccessToken } = useAuth()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [restaurant, setRestaurant] = useState(null)
  const [menuItems, setMenuItems] = useState([])
  const [summary, setSummary] = useState('')
  const [updatedAtIso, setUpdatedAtIso] = useState('')
  const [expandedReviews, setExpandedReviews] = useState({})
  const [itemReviews, setItemReviews] = useState({})

  const busy = useMemo(() => loading || profileLoading || status === 'loading', [loading, profileLoading, status])

  const fetchItemReview = useCallback(
    async (item, fallbackText) => {
      if (!item || !item.id) return
      if (!shareToken) return
      const itemKey = item.id || item.name
      if (!itemKey) return

      setItemReviews((prev) => {
        const existingData = prev[itemKey]?.data || {}
        return {
          ...prev,
          [itemKey]: {
            status: 'loading',
            data: {
              fallbackReview: fallbackText ?? existingData.fallbackReview ?? buildDefaultFallbackPersonalization(item),
              personalizedAdvice: existingData.personalizedAdvice ?? null,
              personalizedVerdict: existingData.personalizedVerdict ?? null,
              personalizedConfidence: existingData.personalizedConfidence ?? null
            },
            warning: '',
            error: ''
          }
        }
      })

      try {
        const token = await getAccessToken()
        if (!token) {
          throw new Error('Please sign in again to continue.')
        }

        const url = `/api/menu/${encodeURIComponent(identifier)}/analyze?share=${encodeURIComponent(shareToken)}&itemId=${encodeURIComponent(item.id)}`
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const json = await res.json().catch(() => ({}))

        if (!res.ok) {
          const message = errorCopy[json?.error] || json?.error || 'We could not personalise this dish right now.'
          throw new Error(message)
        }

    const review = json?.itemReview || {}
    const warning = typeof json?.warning === 'string' ? json.warning : ''
    const fallbackResponse = json?.fallbackReview ?? fallbackText ?? buildDefaultFallbackPersonalization(item)
        const advice = review.personalizedAdvice || null
        const verdict = review.personalizedVerdict || null
        const confidence = review.personalizedConfidence || null

        setItemReviews((prev) => ({
          ...prev,
          [itemKey]: {
            status: 'success',
            data: {
              fallbackReview: fallbackResponse,
              personalizedAdvice: advice,
              personalizedVerdict: verdict,
              personalizedConfidence: confidence
            },
            warning,
            error: ''
          }
        }))
      } catch (fetchError) {
        setItemReviews((prev) => ({
          ...prev,
          [itemKey]: {
            status: 'error',
            data: {
              fallbackReview:
                fallbackText ?? prev[itemKey]?.data?.fallbackReview ?? buildDefaultFallbackPersonalization(item),
              personalizedAdvice: null,
              personalizedVerdict: null,
              personalizedConfidence: null
            },
            warning: '',
            error: fetchError.message || 'We could not personalise this dish.'
          }
        }))
      }
    },
    [getAccessToken, identifier, shareToken]
  )

  const handleToggleReview = useCallback(
    (item) => {
      if (!item) return
      const itemKey = item.id || item.name
      if (!itemKey) return

      setExpandedReviews((prev) => {
        const nextOpen = !prev[itemKey]
        if (nextOpen && item.id) {
          const currentReview = itemReviews[itemKey]
          if (!currentReview || currentReview.status === 'idle' || currentReview.status === 'error') {
            const fallback = item.aiReview || item.nutrition?.ai_review || null
            fetchItemReview(item, fallback)
          }
        }
        return {
          ...prev,
          [itemKey]: nextOpen
        }
      })
    },
    [itemReviews, fetchItemReview]
  )

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      const redirect = encodeURIComponent(router.asPath)
      router.replace(`/auth?redirect=${redirect}`)
    }
  }, [isAuthenticated, loading, router])

  useEffect(() => {
    if (!identifier || !shareToken || !isAuthenticated || profileLoading || !hasHealthProfile) return

    let cancelled = false
    const load = async () => {
      setStatus('loading')
      setError('')
      try {
        const token = await getAccessToken()
        if (!token) {
          if (!cancelled) {
            setError('Please sign in again to continue.')
            setStatus('error')
          }
          return
        }

        const res = await fetch(`/api/menu/${encodeURIComponent(identifier)}/analyze?share=${encodeURIComponent(shareToken)}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const json = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (!cancelled) {
            const code = json?.error
            setError(errorCopy[code] || 'We could not analyse this menu right now. Please try again later.')
            setStatus('error')
          }
          return
        }

        if (!cancelled) {
          setRestaurant(json.restaurant || null)
          setMenuItems(Array.isArray(json.menuItems) ? json.menuItems : [])
          setSummary(json.personalizedSummary || '')
          setUpdatedAtIso(json.updatedAtIso || '')
          setExpandedReviews({})
          setItemReviews({})
          setStatus('success')
        }
      } catch (err) {
        console.error('analyze menu load', err)
        if (!cancelled) {
          setError('Network error while analysing this menu. Please retry.')
          setStatus('error')
        }
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [getAccessToken, hasHealthProfile, identifier, isAuthenticated, profileLoading, shareToken])

  const summaryHtml = useMemo(() => {
    if (!summary) return ''
    const escaped = summary
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return escaped.replace(/\n/g, '<br/>')
  }, [summary])

  const updatedLabel = useMemo(() => formatUpdatedLabel(updatedAtIso), [updatedAtIso])

  if (!routerReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
        </div>
      </div>
    )
  }

  if (!shareToken) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-green-50 px-6 text-center space-y-4">
        <h1 className="text-3xl font-semibold text-gray-900">Share link required</h1>
        <p className="text-gray-600 max-w-xl">
          This personalised review needs the secure share token provided by the restaurant. Check the link and try again.
        </p>
        <Link href="/" className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
          Back home
        </Link>
      </div>
    )
  }

  if (busy) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          <p className="mt-4 text-gray-600">Analysing this menu for your profile…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  if (!hasHealthProfile && !profileLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-green-50 px-6 text-center space-y-4">
        <h1 className="text-3xl font-semibold text-gray-900">Add your health profile</h1>
        <p className="text-gray-600 max-w-lg">
          Complete your health profile so we can tailor this menu to your goals and dietary needs.
        </p>
        <button
          onClick={() => router.push(`/profile?redirect=${encodeURIComponent(router.asPath)}`)}
          className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
        >
          Complete health profile
        </button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-green-50 px-6 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">We could not analyse this menu</h1>
        <p className="text-gray-600 max-w-md">{error || 'Unable to continue with this personalised analysis.'}</p>
        <div className="flex gap-3 flex-wrap justify-center">
          <button
            onClick={() => router.reload()}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          >
            Try again
          </button>
          <Link
            href={`/menu/${identifier}?share=${encodeURIComponent(shareToken)}`}
            className="px-5 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:border-gray-400"
          >
            View public menu
          </Link>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{restaurant?.name ? `${restaurant.name} · Personalised review` : 'Menu analysis · meal.it'}</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
          <header className="space-y-3 text-center">
            <span className="text-xs uppercase tracking-[0.4em] text-gray-400">Personalised review</span>
            <h1 className="text-4xl font-semibold text-gray-900">{restaurant?.name || 'Restaurant Menu'}</h1>
            {restaurant?.cuisine && <p className="text-sm text-gray-500">{restaurant.cuisine}</p>}
            {restaurant?.location && <p className="text-xs text-gray-400">{restaurant.location}</p>}
            {updatedLabel && <p className="text-xs text-gray-400">Menu generated {updatedLabel}</p>}
            <div className="flex gap-3 justify-center pt-2">
              <Link
                href={`/menu/${identifier}?share=${encodeURIComponent(shareToken)}`}
                className="px-4 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:border-gray-400"
              >
                View shared menu
              </Link>
            </div>
          </header>

          {summary && (
            <section className="bg-blue-50 border border-blue-200 rounded-2xl p-6 shadow-sm text-left">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">How this menu fits your goals</h2>
              <div className="prose prose-sm text-blue-900" dangerouslySetInnerHTML={{ __html: summaryHtml }} />
            </section>
          )}

          {menuItems.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-500 shadow-sm">
              No dishes found yet. Check back soon.
            </div>
          ) : (
            <ul className="space-y-5">
              {menuItems.map((item) => {
                const itemKey = item.id || item.name
                const reviewState = itemReviews[itemKey] || { status: 'idle', data: null, error: '', warning: '' }
                const reviewData = reviewState.data || {}
                const personalizedVerdict = reviewData.personalizedVerdict || null
                const personalizedConfidence = reviewData.personalizedConfidence || null
                const personalizedAdvice = reviewData.personalizedAdvice || null
                const storedFallback = reviewData.fallbackReview
                const fallbackReview = storedFallback ?? (item.aiReview || item.nutrition?.ai_review || null)
                const defaultAdvice = !personalizedAdvice && personalizedVerdict ? verdictFallbackAdvice[personalizedVerdict] || '' : ''
                const isExpanded = Boolean(expandedReviews[itemKey])
                const canFetch = Boolean(item.id)
                const hasReviewContent = canFetch || Boolean(fallbackReview)

                let toggleLabel = 'View personalised review'
                if (reviewState.status === 'loading') {
                  toggleLabel = 'Generating personalised review…'
                } else if (personalizedAdvice) {
                  toggleLabel = isExpanded ? 'Hide personalised review' : 'View personalised review'
                } else if (fallbackReview) {
                  toggleLabel = isExpanded ? 'Hide AI review' : 'View AI review'
                } else if (canFetch) {
                  toggleLabel = isExpanded ? 'Hide details' : 'View personalised review'
                }

                return (
                  <li key={itemKey} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                    <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                      <div className="space-y-2">
                        <h2 className="text-xl font-semibold text-gray-900">{item.name}</h2>
                        {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
                        {personalizedVerdict && verdictMeta[personalizedVerdict] && (
                          <div className="flex flex-wrap items-center gap-2 pt-1">
                            <span className={`inline-flex items-center px-3 py-1 text-xs font-semibold rounded-full ${verdictMeta[personalizedVerdict].badge}`}>
                              {verdictMeta[personalizedVerdict].label}
                            </span>
                            {personalizedConfidence && (
                              <span className="text-xs uppercase tracking-wide text-gray-400">{personalizedConfidence} confidence</span>
                            )}
                          </div>
                        )}
                        {hasReviewContent && (
                          <div className="pt-2 space-y-2">
                            <button
                              type="button"
                              onClick={() => handleToggleReview(item)}
                              disabled={reviewState.status === 'loading' && !isExpanded}
                              className="text-sm font-semibold text-blue-600 hover:text-blue-700 disabled:cursor-not-allowed"
                            >
                              {toggleLabel}
                            </button>
                            {isExpanded && (
                              <div className="space-y-2">
                                {reviewState.status === 'loading' && (
                                  <p className="text-sm text-gray-500">Analysing this dish for your goals…</p>
                                )}
                                {reviewState.status === 'error' && (
                                  <div className="text-sm text-red-600 space-y-2">
                                    <p>{reviewState.error || 'Unable to personalise this dish right now.'}</p>
                                    {canFetch && (
                                      <button
                                        type="button"
                                        onClick={() => fetchItemReview(item, fallbackReview)}
                                        className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                                      >
                                        Try again
                                      </button>
                                    )}
                                    {fallbackReview && (
                                      <p className="text-sm text-emerald-700 italic">{fallbackReview}</p>
                                    )}
                                  </div>
                                )}
                                {reviewState.status === 'success' && reviewState.warning && (
                                  <p className="text-xs text-amber-600">{errorCopy[reviewState.warning] || 'Personalised insights are limited right now.'}</p>
                                )}
                                {reviewState.status === 'success' && (personalizedAdvice || defaultAdvice) && (
                                  <p className={`text-sm ${verdictMeta[personalizedVerdict]?.text || 'text-emerald-700'} italic`}>{personalizedAdvice || defaultAdvice}</p>
                                )}
                                {reviewState.status === 'success' && !personalizedAdvice && fallbackReview && (
                                  <p className="text-sm text-emerald-700 italic">{fallbackReview}</p>
                                )}
                                {reviewState.status === 'idle' && fallbackReview && (
                                  <p className="text-sm text-emerald-700 italic">{fallbackReview}</p>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                        {Array.isArray(item.tags) && item.tags.length > 0 && (
                          <div className="flex flex-wrap gap-2 mt-2">
                            {item.tags.map((tag) => (
                              <span
                                key={tag}
                                className="text-xs uppercase tracking-wide bg-blue-50 text-blue-600 px-2 py-1 rounded"
                              >
                                {tag}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="text-right">
                        {Number.isFinite(Number(item.price)) && (
                          <div className="text-lg font-semibold text-gray-900">${Number(item.price).toFixed(2)}</div>
                        )}
                        {item.nutrition?.calories && (
                          <div className="text-xs text-gray-500">{item.nutrition.calories} kcal</div>
                        )}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  )
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
    console.warn('[analyze-menu] Failed to format date', error)
    return ''
  }
}
