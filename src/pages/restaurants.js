// Restaurant directory for diners
import { useEffect, useMemo, useState } from 'react'
import Head from 'next/head'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useAuth } from '@/contexts/AuthContext'

export default function RestaurantsPage() {
  const router = useRouter()
  const { isAuthenticated, loading, profile } = useAuth()
  const [restaurants, setRestaurants] = useState([])
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('loading')

  useEffect(() => {
    const fetchRestaurants = async () => {
      try {
        const res = await fetch('/api/restaurants')
        const json = await res.json()
        if (!res.ok) throw new Error(json.error || 'Failed to fetch restaurants')
        setRestaurants(json.restaurants || [])
        setStatus('success')
      } catch (error) {
        console.error('Error fetching restaurants:', error)
        setStatus('error')
      }
    }
    fetchRestaurants()
  }, [])

  const filteredRestaurants = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return restaurants
    return restaurants.filter((rest) =>
      [rest.name, rest.cuisine, rest.cuisine_type, rest.description, rest.location]
        .filter(Boolean)
        .some((value) => value.toLowerCase().includes(term))
    )
  }, [restaurants, search])

  const handleViewMenu = (restaurantRecord) => {
    if (!restaurantRecord) return
    const identifier = restaurantRecord.slug || restaurantRecord.restaurant_slug || restaurantRecord.id
    if (!isAuthenticated) {
      router.push(`/auth?redirect=${encodeURIComponent(`/restaurants/${identifier}`)}`)
      return
    }
    router.push(`/restaurants/${identifier}`)
  }

  return (
    <>
      <Head>
        <title>Restaurants · meal.it</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50 py-12">
        <div className="max-w-6xl mx-auto px-6 space-y-12">
          <header className="text-center space-y-4">
            <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold uppercase tracking-[0.4em] bg-blue-100 text-blue-600">
              Explore
            </span>
            <h1 className="text-4xl md:text-5xl font-semibold text-gray-900">Find menus that fit your health goals</h1>
            <p className="text-base md:text-lg text-gray-600 max-w-2xl mx-auto">
              Browse restaurants digitized by GPT-5 Mini. Sign in to unlock personalised summaries and nutrition labels matched to your health profile.
            </p>
            {!loading && !isAuthenticated && (
              <div className="flex justify-center">
                <Link
                  href="/auth"
                  className="px-5 py-3 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700"
                >
                  Sign in for personalised insights
                </Link>
              </div>
            )}
            {isAuthenticated && !profile && (
              <div className="flex justify-center">
                <Link
                  href="/profile"
                  className="px-5 py-3 rounded-lg bg-yellow-500 text-white text-sm font-semibold hover:bg-yellow-600"
                >
                  Complete your health profile
                </Link>
              </div>
            )}
          </header>

          <div className="max-w-xl mx-auto">
            <div className="relative">
              <input
                type="text"
                placeholder="Search by cuisine, neighbourhood, or restaurant name"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full px-6 py-4 pr-12 text-base border-2 border-gray-200 rounded-2xl shadow-sm focus:outline-none focus:border-blue-500"
              />
              <span className="absolute right-5 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
            </div>
          </div>

          {status === 'loading' && (
            <div className="text-center py-12 text-gray-500">Loading restaurants…</div>
          )}

          {status === 'error' && (
            <div className="text-center py-12 text-red-600">
              We couldn’t load the directory right now. Please refresh or try again later.
            </div>
          )}

          {status === 'success' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {filteredRestaurants.length === 0 ? (
                <div className="col-span-full bg-white border border-gray-200 rounded-2xl p-12 text-center text-gray-500 shadow-sm">
                  No restaurants match your search yet.
                </div>
              ) : (
                filteredRestaurants.map((restaurant) => (
                  <article
                    key={restaurant.slug || restaurant.id}
                    className="bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-transform hover:-translate-y-1"
                  >
                    {restaurant.image_url && (
                      <div className="relative w-full h-48">
                        <Image
                          src={restaurant.image_url}
                          alt={restaurant.name}
                          fill
                          className="object-cover"
                          sizes="(max-width: 768px) 100vw, 600px"
                        />
                      </div>
                    )}
                    <div className="p-6 space-y-3">
                      <div className="flex items-center justify-between">
                        <h2 className="text-xl font-semibold text-gray-900">{restaurant.name}</h2>
                        {(restaurant.cuisine || restaurant.cuisine_type) && (
                          <span className="text-xs uppercase tracking-wide text-blue-600 bg-blue-50 px-2 py-1 rounded">
                            {restaurant.cuisine || restaurant.cuisine_type}
                          </span>
                        )}
                      </div>
                      {restaurant.description && (
                        <p className="text-sm text-gray-600 line-clamp-3">{restaurant.description}</p>
                      )}
                      {restaurant.location && (
                        <p className="text-xs text-gray-400">{restaurant.location}</p>
                      )}
                      <div className="pt-2">
                        <button
                          onClick={() => handleViewMenu(restaurant)}
                          className="w-full px-4 py-3 rounded-lg bg-gray-900 text-white text-sm font-semibold hover:bg-black"
                        >
                          {isAuthenticated ? 'View personalised menu' : 'Sign in to view menu'}
                        </button>
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
