// User profile page for health profile management
import { useEffect, useState } from 'react'
import Head from 'next/head'
import { useRouter } from 'next/router'
import HealthProfileForm from '@/components/HealthProfileForm'
import { useAuth } from '@/contexts/AuthContext'

export default function ProfilePage() {
  const router = useRouter()
  const { isAuthenticated, loading, profile, profileLoading } = useAuth()
  const [draftProfile, setDraftProfile] = useState(profile)

  useEffect(() => {
    setDraftProfile(profile)
  }, [profile])

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      const redirect = encodeURIComponent(router.asPath)
      router.replace(`/auth?redirect=${redirect}`)
    }
  }, [isAuthenticated, loading, router])

  if (loading || profileLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
          <p className="mt-4 text-gray-600">Loading your profile…</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) return null

  return (
    <>
      <Head>
        <title>My Health Profile · meal.it</title>
      </Head>
      <div className="min-h-screen bg-gradient-to-br from-orange-50 via-yellow-50 to-green-50 py-12">
        <div className="max-w-2xl mx-auto px-4">
          <div className="mb-6 text-center space-y-2">
            <span className="text-xs uppercase tracking-[0.4em] text-gray-400">Step 1</span>
            <h1 className="text-3xl font-semibold text-gray-900">Complete your health profile</h1>
            <p className="text-sm text-gray-600">
              We use this to personalize restaurant ratings, menu summaries, and dish recommendations for you.
            </p>
          </div>
          <HealthProfileForm value={draftProfile} onSave={setDraftProfile} />
        </div>
      </div>
    </>
  )
}
