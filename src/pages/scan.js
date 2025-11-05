// QR Scanner page for authenticated users
import { useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Head from 'next/head'
import { useRouter } from 'next/router'
import { useAuth } from '@/contexts/AuthContext'

const QrCameraScanner = dynamic(() => import('@/components/QrCameraScanner'), { ssr: false })

export default function ScanPage() {
  const router = useRouter()
  const { isAuthenticated, loading, hasHealthProfile, profileLoading } = useAuth()
  const [scannedUrl, setScannedUrl] = useState('')
  const [error, setError] = useState('')
  const [cameraActive, setCameraActive] = useState(true)

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.replace(`/auth?redirect=${encodeURIComponent(router.asPath)}`)
    }
  }, [isAuthenticated, loading, router])

  const ready = useMemo(
    () => isAuthenticated && hasHealthProfile && !loading && !profileLoading,
    [hasHealthProfile, isAuthenticated, loading, profileLoading]
  )

  const handleManualInput = (e) => {
    setScannedUrl(e.target.value)
    if (error) setError('')
  }

  const handleGo = () => {
    if (!scannedUrl) return
    try {
      const url = new URL(scannedUrl, window.location.origin)
      if (url.origin !== window.location.origin) {
        setError('Only meal.it QR codes are supported.')
        return
      }
      router.push(url.pathname + url.search)
    } catch (_) {
      setError('Invalid QR code URL')
    }
  }

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          <p className="mt-4 text-gray-600">Preparing your scanner…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null
  }

  if (!hasHealthProfile) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-yellow-50 to-green-50">
        <Head>
          <title>Scan QR · meal.it</title>
        </Head>
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md text-center space-y-4">
          <h1 className="text-2xl font-semibold text-gray-900">Add your health profile first</h1>
          <p className="text-sm text-gray-600">Complete your health profile so we can tailor menus and restaurant reviews to your needs.</p>
          <button
            onClick={() => router.push('/profile?redirect=' + encodeURIComponent(router.asPath))}
            className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
          >
            Go to health profile
          </button>
        </div>
      </div>
    )
  }

  return (
    <>
      <Head>
        <title>Scan QR · meal.it</title>
      </Head>
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 via-yellow-50 to-green-50">
        <div className="bg-white rounded-xl shadow-lg p-8 w-full max-w-md text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Scan a restaurant QR</h1>
          <p className="mb-4 text-gray-600">We will personalise the menu experience using your health profile.</p>
          {ready && cameraActive ? (
            <>
              <QrCameraScanner
                onScan={(url) => {
                  setScannedUrl(url)
                  setCameraActive(false)
                  setTimeout(() => handleGo(), 400)
                }}
                onError={(err) => {
                  setError(typeof err === 'string' ? err : 'Camera error')
                  setCameraActive(false)
                }}
              />
              <button
                className="mt-4 text-sm text-gray-500 underline"
                onClick={() => setCameraActive(false)}
              >
                Switch to manual entry
              </button>
            </>
          ) : (
            <>
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Paste a meal.it QR link"
                  value={scannedUrl}
                  onChange={handleManualInput}
                  className="w-full px-4 py-2 border rounded-lg"
                />
              </div>
              <button
                onClick={handleGo}
                disabled={!scannedUrl}
                className="w-full py-3 bg-gradient-to-r from-orange-500 to-yellow-500 text-white font-semibold rounded-lg disabled:opacity-50"
              >
                View menu
              </button>
              {cameraActive === false && (
                <button
                  className="mt-2 text-sm text-gray-500 underline"
                  onClick={() => { setCameraActive(true); setError('') }}
                >
                  Scan with camera
                </button>
              )}
            </>
          )}
          {error && <div className="text-red-600 mt-2 text-sm">{error}</div>}
        </div>
      </div>
    </>
  )
}
