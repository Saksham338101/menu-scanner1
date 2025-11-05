import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useEffect, useMemo, useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'

export default function RestaurantMenuPage() {
  const router = useRouter()
  const { id } = router.query
  const { isAuthenticated, loading, hasHealthProfile, profileLoading, getAccessToken } = useAuth()
  const [status, setStatus] = useState('idle')
  const [error, setError] = useState('')
  const [restaurant, setRestaurant] = useState(null)
  const [menuItems, setMenuItems] = useState([])
  const [summary, setSummary] = useState('')

  const busy = useMemo(() => loading || profileLoading || status === 'loading', [loading, profileLoading, status])

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(`/auth?redirect=${encodeURIComponent(router.asPath)}`)
    }
  }, [isAuthenticated, loading, router])

  useEffect(() => {
    const load = async () => {
      if (!id || !isAuthenticated || !hasHealthProfile || profileLoading) return
      setStatus('loading')
      setError('')
      try {
        const token = await getAccessToken()
        if (!token) {
          setError('Please sign in again to view this menu.')
          setStatus('error')
          return
        }
        const res = await fetch(`/api/restaurants/${id}/menu`, {
          headers: { Authorization: `Bearer ${token}` }
        })
        const json = await res.json()
        if (!res.ok) {
          if (json.error === 'health_profile_required') {
            setError('Complete your health profile to unlock personalised menus.')
          } else {
            setError(json.error || 'Unable to load this menu right now.')
          }
          setStatus('error')
          return
        }
        setRestaurant(json.restaurant)
        setMenuItems(json.menuItems || [])
        setSummary(json.personalizedSummary || '')
        setStatus('success')
      } catch (err) {
        console.error('load menu', err)
        setError('Network error while loading the menu. Please retry.')
        setStatus('error')
      }
    }
    load()
  }, [getAccessToken, hasHealthProfile, id, isAuthenticated, profileLoading])

  const summaryHtml = useMemo(() => {
    if (!summary) return ''
    const escaped = summary
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
    return escaped.replace(/\n/g, '<br/>')
  }, [summary])

  if (busy) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          <p className="mt-4 text-gray-600">Preparing your personalised menu…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  if (!hasHealthProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-green-50 px-6 text-center space-y-4">
        <h1 className="text-3xl font-semibold text-gray-900">Add your health profile</h1>
        <p className="text-gray-600 max-w-lg">
          We personalise restaurant reviews and dish nutrition based on your health goals. Complete your profile to continue.
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
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-white to-green-50 px-6 text-center space-y-4">
        <h1 className="text-2xl font-semibold text-gray-900">Something went wrong</h1>
        <p className="text-gray-600 max-w-sm">{error || 'Unable to load this menu at the moment.'}</p>
        <div className="flex gap-4">
          <button
            onClick={() => router.reload()}
            className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
          >
            Try again
          </button>
          <button
            onClick={() => router.push('/')}
            className="px-5 py-2 rounded-lg border border-gray-300 text-sm font-semibold text-gray-700 hover:border-gray-400"
          >
            Back home
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>{restaurant?.name ? `${restaurant.name} · meal.it` : 'Restaurant menu · meal.it'}</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
        <div className="max-w-4xl mx-auto px-6 py-12 space-y-10">
          <header className="space-y-3 text-center">
            <span className="text-xs uppercase tracking-[0.4em] text-gray-400">Smart menu</span>
            <h1 className="text-4xl font-semibold text-gray-900">{restaurant?.name || 'Restaurant Menu'}</h1>
            {restaurant?.cuisine && <p className="text-sm text-gray-500">{restaurant.cuisine}</p>}
            {restaurant?.location && <p className="text-xs text-gray-400">{restaurant.location}</p>}
          </header>

          {summary && (
            <section className="bg-blue-50 border border-blue-200 rounded-2xl p-6 shadow-sm text-left">
              <h2 className="text-lg font-semibold text-blue-900 mb-2">Personalised health review</h2>
              <div className="prose prose-sm text-blue-900" dangerouslySetInnerHTML={{ __html: summaryHtml }} />
            </section>
          )}

          {menuItems.length === 0 ? (
            <div className="bg-white border border-dashed border-gray-300 rounded-2xl p-12 text-center text-gray-500 shadow-sm">
              No dishes found yet. Check back soon.
            </div>
          ) : (
            <ul className="space-y-5">
              {menuItems.map((item) => (
                <li key={item.id} className="bg-white border border-gray-100 rounded-2xl p-6 shadow-sm">
                  <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                    <div className="space-y-2">
                      <h2 className="text-xl font-semibold text-gray-900">{item.name}</h2>
                      {item.description && <p className="text-sm text-gray-500">{item.description}</p>}
                      {(item.aiReview || item.nutrition?.ai_review) && (
                        <p className="text-sm text-emerald-700 italic">{item.aiReview || item.nutrition?.ai_review}</p>
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
                  <div className="mt-4 flex flex-wrap gap-3">
                    <Link
                      href={`/restaurants/${id}/item/${item.id}`}
                      className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                    >
                      View nutrition insights
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}
