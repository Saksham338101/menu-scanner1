import Head from 'next/head'
import Image from 'next/image'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function MenuItemPage() {
  const router = useRouter()
  const { id, itemId } = router.query
  const { isAuthenticated, loading, hasHealthProfile, profileLoading, getAccessToken } = useAuth()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [item, setItem] = useState(null)
  const [nutrition, setNutrition] = useState(null)
  const [aiLabel, setAiLabel] = useState('')

  const busy = useMemo(() => loading || profileLoading || status === 'loading', [loading, profileLoading, status])

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(`/auth?redirect=${encodeURIComponent(router.asPath)}`)
    }
  }, [isAuthenticated, loading, router])

  useEffect(() => {
    const loadItem = async () => {
      if (!id || !itemId || !isAuthenticated || !hasHealthProfile || profileLoading) return
      setStatus('loading')
      setError('')
      try {
        const token = await getAccessToken()
        if (!token) {
          setError('Please sign in again to view this dish.')
          setStatus('error')
          return
        }
        const res = await fetch(`/api/restaurants/${id}/items/${itemId}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const json = await res.json()
        if (!res.ok) {
          if (json.error === 'health_profile_required') {
            setError('Complete your health profile to unlock nutrition insights.')
          } else {
            setError(json.error || 'Unable to load this dish at the moment.')
          }
          setStatus('error')
          return
        }
        setItem(json.item)
        setNutrition(json.nutrition || null)
        setAiLabel(json.aiLabel || '')
        setStatus('success')
      } catch (err) {
        console.error('load menu item', err)
        setError('Network error while loading this dish. Please retry.')
        setStatus('error')
      }
    }
    loadItem()
  }, [getAccessToken, hasHealthProfile, id, isAuthenticated, itemId, profileLoading])

  const calories = nutrition?.calories || null
  const aiLabelHtml = useMemo(() => {
    if (!aiLabel) return ''
    const escaped = aiLabel.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    return escaped.replace(/\n/g, '<br/>')
  }, [aiLabel])

  if (busy) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          <p className="mt-4 text-gray-600">Loading personalised nutrition…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  if (!hasHealthProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-white via-orange-50 to-green-50 px-6 text-center space-y-4">
        <h1 className="text-3xl font-semibold text-gray-900">Add your health profile</h1>
        <p className="text-gray-600 max-w-lg">
          We personalise dish summaries and nutrition labels for you. Complete your profile to continue.
        </p>
        <button
          onClick={() => router.push('/profile?redirect=' + encodeURIComponent(router.asPath))}
          className="px-6 py-3 rounded-lg bg-blue-600 text-white font-semibold hover:bg-blue-700"
        >
          Complete health profile
        </button>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-white via-orange-50 to-green-50 px-6 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">Something went wrong</h1>
        <p className="text-gray-600 max-w-sm">{error || 'Unable to load this dish at the moment.'}</p>
        <div className="flex gap-3">
          <button
            onClick={() => router.reload()}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          >
            Try again
          </button>
          <button
            onClick={() => router.push(`/restaurants/${id}`)}
            className="px-5 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:border-gray-400"
          >
            Back to menu
          </button>
        </div>
      </div>
    )
  }

  if (!item) return null

  return (
    <>
      <Head>
        <title>{item.name ? `${item.name} · Nutrition insights` : 'Dish insights'} · meal.it</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-white via-orange-50 to-green-50">
        <div className="max-w-3xl mx-auto px-6 py-12 space-y-6">
          <button
            onClick={() => router.push(`/restaurants/${id}`)}
            className="text-sm text-blue-600 hover:text-blue-700"
          >
            ← Back to menu
          </button>
          <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row md:items-start gap-6">
              {item.image_url && (
                <div className="relative w-full md:w-60 h-48">
                  <Image
                    src={item.image_url}
                    alt={item.name}
                    fill
                    className="rounded-lg border border-gray-100 object-cover"
                    sizes="(max-width: 768px) 100vw, 240px"
                  />
                </div>
              )}
              <div className="flex-1 space-y-3">
                <h1 className="text-3xl font-semibold text-gray-900">{item.name}</h1>
                {item.description && <p className="text-gray-600">{item.description}</p>}
                {(item.aiReview || item.nutrition?.ai_review) && (
                  <p className="text-emerald-700 italic text-sm">{item.aiReview || item.nutrition?.ai_review}</p>
                )}
                <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                  {Number.isFinite(Number(item.price)) && (
                    <span className="font-semibold text-gray-900 text-lg">${Number(item.price).toFixed(2)}</span>
                  )}
                  {calories && <span>{calories} kcal</span>}
                </div>
                {Array.isArray(item.tags) && item.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
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
            </div>
            {nutrition && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(nutrition).map(([key, value]) => (
                  value !== null && (
                    <div key={key} className="bg-gray-50 border border-gray-100 rounded-lg p-3 text-center">
                      <div className="text-xs uppercase tracking-wide text-gray-500">{key.replace(/_/g, ' ')}</div>
                      <div className="text-lg font-semibold text-gray-900">{value}</div>
                    </div>
                  )
                ))}
              </div>
            )}
          </section>

          <section className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-gray-900">AI-powered nutrition coach</h2>
              <button
                onClick={() => router.reload()}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                Refresh
              </button>
            </div>
            <p className="text-sm text-gray-500">
              Generated with GPT-5 Mini using your health profile. Treat this as guidance—always follow professional medical advice.
            </p>
            <div
              className="bg-gradient-to-br from-green-50 to-white border border-green-100 rounded-xl p-4 text-sm text-gray-700"
              dangerouslySetInnerHTML={{ __html: aiLabelHtml || 'AI summary unavailable right now.' }}
            />
          </section>
        </div>
      </div>
    </>
  )
}
