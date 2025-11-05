import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import OlaMapsClient from 'ola-map-sdk'
import { useAuth } from '@/contexts/AuthContext'
import DistanceDuration from '@/components/map-widgets/distance-duration'
import RecenterButton from '@/components/map-widgets/recenter-button'

const PUBLIC_OLA_MAPS_KEY = process.env.NEXT_PUBLIC_OLA_MAPS_API_KEY || process.env.OLA_MAPS_API_KEY || ''
const MAP_STYLE = 'default-light-standard'

export default function RestaurantSearchPage() {
  const router = useRouter()
  const { isAuthenticated, loading } = useAuth()

  const [mapLoaded, setMapLoaded] = useState(false)
  const [userLocation, setUserLocation] = useState(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [suggestions, setSuggestions] = useState([])
  const [selectedRestaurant, setSelectedRestaurant] = useState(null)
  const [distance, setDistance] = useState('')
  const [duration, setDuration] = useState('')
  const [error, setError] = useState('')
  const [routing, setRouting] = useState(false)

  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const maplibreModuleRef = useRef(null)
  const restaurantMarkerRef = useRef(null)
  const userMarkerRef = useRef(null)
  const autocompleteTimeoutRef = useRef(null)
  const clientRef = useRef(null)
  const geoRequestRef = useRef(false)
  const geolocatorRef = useRef(null)

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(`/auth?redirect=${encodeURIComponent(router.asPath)}`)
    }
  }, [isAuthenticated, loading, router])

  useEffect(() => {
    if (!PUBLIC_OLA_MAPS_KEY) return
    clientRef.current = new OlaMapsClient(PUBLIC_OLA_MAPS_KEY)
    return () => {
      clientRef.current = null
    }
  }, [])

  const transformRequest = useCallback((url, resourceType) => {
    const normalized = url.replace('app.olamaps.io', 'api.olamaps.io')
    const separator = normalized.includes('?') ? '&' : '?'
    return {
      url: `${normalized}${separator}api_key=${PUBLIC_OLA_MAPS_KEY}`,
      resourceType
    }
  }, [])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!PUBLIC_OLA_MAPS_KEY || mapInstanceRef.current || !mapContainerRef.current) return

    let cancelled = false

    const initMap = async () => {
      try {
        const [maplibreModule] = await Promise.all([
          import('maplibre-gl'),
          import('maplibre-gl/dist/maplibre-gl.css')
        ])

        if (cancelled) return

        const { Map, NavigationControl, Marker } = maplibreModule
        maplibreModuleRef.current = { Map, NavigationControl, Marker }

        const styleUrl = `https://api.olamaps.io/tiles/vector/v1/styles/${MAP_STYLE}/style.json`
        const map = new Map({
          container: mapContainerRef.current,
          style: styleUrl,
          center: [77.5946, 12.9716],
          zoom: 5,
          transformRequest
        })

        map.addControl(new NavigationControl({ visualizePitch: false, showCompass: true }), 'bottom-left')

        map.on('load', () => {
          setMapLoaded(true)
        })

        mapInstanceRef.current = map
      } catch (err) {
        console.error('[restaurant-search] map init error', err)
        setError('Unable to load Ola Maps right now. Please retry later.')
      }
    }

    initMap()

    return () => {
      cancelled = true
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove()
        mapInstanceRef.current = null
      }
      maplibreModuleRef.current = null
    }
  }, [transformRequest])

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (!isAuthenticated) return
    if (geoRequestRef.current) return

    geoRequestRef.current = true

    let cancelled = false

    const requestLocation = async () => {
      try {
  const geolocatorModule = await import('geolocator')
        if (cancelled) return

  const geolocator = geolocatorModule?.default ?? geolocatorModule
        geolocatorRef.current = geolocator

        const options = {
          enableHighAccuracy: true,
          timeout: 15000,
          maximumAge: 0,
          desiredAccuracy: 30,
          watch: false,
          fallbackToIP: false,
          addressLookup: false,
          timezone: false
        }

        geolocator.locate(options, (err, location) => {
          if (cancelled) return

          if (err) {
            console.warn('[restaurant-search] geolocator error', err)
            const message = typeof err === 'string' ? err : err?.message
            const blocked = err?.code === 1 || /denied/i.test(message || '')
            setError(
              blocked
                ? 'Location access is blocked for this site. Enable it in your browser settings and refresh.'
                : 'Unable to determine your location right now.'
            )
            return
          }

          if (location?.coords) {
            setError('')
            setUserLocation({
              lat: location.coords.latitude,
              lng: location.coords.longitude
            })
          }
        })
      } catch (err) {
        console.warn('[restaurant-search] geolocator load failed', err)
        setError('We could not request location access. Please check your browser settings.')
      }
    }

    if (navigator.permissions?.query) {
      navigator.permissions
        .query({ name: 'geolocation' })
        .then((status) => {
          if (status.state === 'denied') {
            setError('Location access is blocked for this site. Enable it in your browser and refresh.')
          } else {
            requestLocation()
          }
        })
        .catch(() => {
          requestLocation()
        })
    } else {
      requestLocation()
    }

    return () => {
      cancelled = true
      const geolocator = geolocatorRef.current
      if (geolocator && typeof geolocator.stop === 'function') {
        try {
          geolocator.stop()
        } catch (stopError) {
          console.warn('[restaurant-search] geolocator stop failed', stopError)
        }
      }
    }
  }, [isAuthenticated])

  useEffect(() => {
    if (!mapLoaded || !userLocation || !mapInstanceRef.current || !maplibreModuleRef.current) return
    const { Marker: MarkerClass } = maplibreModuleRef.current
    if (userMarkerRef.current) {
      userMarkerRef.current.setLngLat([userLocation.lng, userLocation.lat])
    } else {
      userMarkerRef.current = new MarkerClass({ color: '#16a34a' }).setLngLat([userLocation.lng, userLocation.lat]).addTo(mapInstanceRef.current)
    }
    mapInstanceRef.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 13 })
  }, [mapLoaded, userLocation])

  const triggerAutocomplete = useCallback(async (query) => {
    if (!clientRef.current || !query) return
    try {
      const result = await clientRef.current.places.autocomplete(query, {
        limit: 6,
        include_geometry: true
      })
      setSuggestions(result?.predictions || [])
    } catch (err) {
      console.error('[restaurant-search] autocomplete error', err)
    }
  }, [])

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSuggestions([])
      return
    }

    if (autocompleteTimeoutRef.current) {
      clearTimeout(autocompleteTimeoutRef.current)
    }

    autocompleteTimeoutRef.current = setTimeout(() => {
      triggerAutocomplete(searchTerm.trim())
    }, 300)

    return () => {
      if (autocompleteTimeoutRef.current) {
        clearTimeout(autocompleteTimeoutRef.current)
      }
    }
  }, [searchTerm, triggerAutocomplete])

  const handleSuggestionClick = useCallback((place) => {
    setSearchTerm(place.description || '')
    setSelectedRestaurant(place)
    setSuggestions([])
    setDistance('')
    setDuration('')
    setError('')
  }, [])

  const handleSearchSubmit = useCallback(
    async (event) => {
      event.preventDefault()
      setError('')

      if (!mapInstanceRef.current || !maplibreModuleRef.current) {
        setError('The map is still preparing. Please try again in a moment.')
        return
      }

      if (!selectedRestaurant?.geometry?.location) {
        setError('Select a restaurant from the suggestions before searching.')
        return
      }

      const { lat, lng } = selectedRestaurant.geometry.location
      const { Marker: MarkerClass } = maplibreModuleRef.current

      if (restaurantMarkerRef.current) {
        restaurantMarkerRef.current.setLngLat([lng, lat])
      } else {
        restaurantMarkerRef.current = new MarkerClass({ color: '#1d4ed8' }).setLngLat([lng, lat]).addTo(mapInstanceRef.current)
      }

      mapInstanceRef.current.flyTo({ center: [lng, lat], zoom: 14 })

      if (!userLocation) {
        setDistance('')
        setDuration('')
        return
      }

      if (!clientRef.current) return

      setRouting(true)
      try {
        const directions = await clientRef.current.routing.getDirections(
          { lat: userLocation.lat, lon: userLocation.lng },
          { lat, lon: lng },
          {
            alternatives: false,
            steps: false,
            overview: 'full',
            language: 'en',
            traffic_metadata: false
          }
        )

        const leg = directions?.routes?.[0]?.legs?.[0]
        setDistance(leg?.readable_distance ? `${leg.readable_distance}` : '')
        setDuration(leg?.readable_duration ? `${leg.readable_duration}` : '')
      } catch (err) {
        console.error('[restaurant-search] routing error', err)
        setError('Unable to calculate the route at the moment.')
      } finally {
        setRouting(false)
      }
    },
    [selectedRestaurant, userLocation]
  )

  const handleRecenter = useCallback(() => {
    if (!mapInstanceRef.current || !userLocation) return
    mapInstanceRef.current.flyTo({ center: [userLocation.lng, userLocation.lat], zoom: 13 })
  }, [userLocation])

  const visibleSuggestions = useMemo(() => suggestions.slice(0, 6), [suggestions])

  if (loading || !isAuthenticated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-spin rounded-full border-2 border-brand-primary border-t-transparent" />
          <p className="mt-4 text-sm text-slate-600">Loading your restaurant finder…</p>
        </div>
      </div>
    )
  }

  if (!PUBLIC_OLA_MAPS_KEY) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-100 p-8 text-center text-sm text-slate-600">
        <div>
          <p className="font-semibold text-slate-800">Ola Maps API key missing</p>
          <p className="mt-2">Add <code className="rounded bg-slate-200 px-1">NEXT_PUBLIC_OLA_MAPS_API_KEY</code> to your environment file and restart the dev server.</p>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Restaurant Search · meal.it</title>
      </Head>
      <div className="relative min-h-screen bg-gradient-to-br from-orange-50 via-white to-green-50">
        <div ref={mapContainerRef} className="h-screen w-full" />

        <div className="pointer-events-none absolute inset-0 flex items-start justify-center p-4">
          <div className="pointer-events-auto w-full max-w-2xl rounded-2xl bg-white/95 p-6 shadow-xl backdrop-blur">
            <header className="mb-4 text-center">
              <p className="text-xs uppercase tracking-[0.35em] text-brand-muted">Discover</p>
              <h1 className="text-3xl font-semibold text-brand-ink">Restaurant search</h1>
              <p className="mt-2 text-sm text-brand-muted">Locate great places to eat around you, explore results, and estimate travel time powered by Ola Maps.</p>
            </header>

            <form onSubmit={handleSearchSubmit} className="space-y-3">
              <div className="relative">
                <input
                  type="search"
                  value={searchTerm}
                  onChange={(event) => setSearchTerm(event.target.value)}
                  placeholder="Search restaurants, cuisines, or neighborhoods"
                  className="w-full rounded-xl border border-brand-border px-4 py-3 text-sm shadow-inner focus:border-brand-primary focus:outline-none"
                />
                <button
                  type="submit"
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg bg-brand-primary px-4 py-2 text-xs font-semibold uppercase text-white transition hover:bg-brand-ink"
                  disabled={routing}
                >
                  {routing ? 'Routing…' : 'Go'}
                </button>
              </div>

              {visibleSuggestions.length > 0 ? (
                <ul className="max-h-48 overflow-y-auto rounded-xl border border-brand-border bg-white text-sm shadow-soft">
                  {visibleSuggestions.map((place) => (
                    <li
                      key={place.place_id}
                      onClick={() => handleSuggestionClick(place)}
                      className="cursor-pointer border-b border-brand-border/40 px-4 py-2 hover:bg-brand-surface"
                    >
                      <p className="font-medium text-brand-ink">{place.description}</p>
                      {place?.structured_formatting?.secondary_text ? (
                        <p className="text-xs text-brand-muted">{place.structured_formatting.secondary_text}</p>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
            </form>

            {error ? (
              <div className="mt-4 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {error}
              </div>
            ) : null}

            <div className="mt-6 grid gap-4 text-sm text-brand-muted md:grid-cols-2">
              <div className="rounded-xl border border-brand-border/60 bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-muted">Your location</p>
                {userLocation ? (
                  <p className="mt-2 text-brand-ink">{userLocation.lat.toFixed(4)}, {userLocation.lng.toFixed(4)}</p>
                ) : (
                  <p className="mt-2">Waiting for location permission…</p>
                )}
              </div>
              <div className="rounded-xl border border-brand-border/60 bg-white/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-brand-muted">Selected restaurant</p>
                {selectedRestaurant ? (
                  <p className="mt-2 text-brand-ink">{selectedRestaurant.description}</p>
                ) : (
                  <p className="mt-2">Choose a suggestion to view details.</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {mapLoaded ? (
          <>
            <DistanceDuration distance={distance} duration={duration} />
            <RecenterButton onClick={handleRecenter} disabled={!userLocation} />
          </>
        ) : null}
      </div>
    </>
  )
}
