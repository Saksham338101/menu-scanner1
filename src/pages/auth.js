// Unified authentication page: choose User or Partner login
import { useState, useEffect } from 'react'
import Head from 'next/head'
import AuthModal from '@/components/AuthModal'
import PartnerAuthForm from '@/components/PartnerAuthForm'
import { useRouter } from 'next/router'

export default function AuthPage() {
  const router = useRouter()
  const [mode, setMode] = useState('choice') // 'choice', 'user', 'partner'

  useEffect(() => {
    const q = router.query
    if (q?.mode === 'partner' || q?.mode === 'partner_register') {
      setMode(q.mode === 'partner_register' ? 'partner_register' : 'partner')
    }
    if (q?.mode === 'user') setMode('user')
  }, [router.query])

  return (
    <>
      <Head>
        <title>Sign in · meal.it</title>
      </Head>
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-green-50">
        <div className="bg-white rounded-2xl shadow-lg p-10 w-full max-w-md text-center space-y-6">
          {mode === 'choice' && (
            <>
              <div className="space-y-2">
                <span className="text-xs uppercase tracking-widest text-gray-400">Welcome back</span>
                <h1 className="text-3xl font-semibold text-gray-900">Sign in to meal.it</h1>
                <p className="text-sm text-gray-500">Choose how you want to access the platform.</p>
              </div>
              <div className="space-y-3">
                <button
                  className="w-full py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700"
                  onClick={() => setMode('user')}
                >
                  Continue as diner
                </button>
                <button
                  className="w-full py-3 bg-gray-900 text-white font-semibold rounded-lg hover:bg-black"
                  onClick={() => setMode('partner')}
                >
                  Partner login
                </button>
                <button
                  className="w-full py-3 border border-gray-200 text-gray-700 font-semibold rounded-lg hover:border-gray-300"
                  onClick={() => setMode('partner_register')}
                >
                  Partner registration
                </button>
              </div>
            </>
          )}
          {mode === 'user' && (
            <div className="space-y-4">
              <AuthModal
                isOpen={true}
                onClose={() => setMode('choice')}
                mode="signin"
                redirect={router.query?.redirect}
              />
              <button className="text-sm text-gray-500 underline" onClick={() => setMode('choice')}>
                Back to options
              </button>
            </div>
          )}
          {mode === 'partner' && (
            <PartnerAuthForm onBack={() => setMode('choice')} />
          )}
          {mode === 'partner_register' && (
            <PartnerAuthForm onBack={() => setMode('choice')} initialMode="register" />
          )}
        </div>
      </div>
    </>
  )
}
