// PartnerAuthForm - login/register for restaurant partners
import { useRouter } from 'next/router'
import { useState } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { usePartnerSession } from '@/contexts/PartnerSessionContext'

export default function PartnerAuthForm({ onBack, initialMode }) {
  const [mode, setMode] = useState(initialMode === 'register' ? 'register' : 'login') // 'login' or 'register'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [restaurantName, setRestaurantName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const { isAuthenticated, signOut } = useAuth()
  const { refresh: refreshPartner } = usePartnerSession()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    try {
      if (isAuthenticated) {
        await signOut().catch(() => {})
      }
      const res = await fetch(`/api/partner_auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          email,
          password,
          restaurantName: mode === 'register' ? restaurantName : undefined
        })
      })
      const json = await res.json()
      if (res.ok) {
        if (json.partner) {
          await refreshPartner()
          await router.replace('/partner/menu-upload')
          return
        }
        await refreshPartner()
        await router.replace('/partner/menu-upload')
      } else {
        setError(json.error || 'Error')
      }
    } catch (err) {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
  <h2 className="text-xl font-bold mb-2">{mode === 'login' ? 'Partner Login' : 'Partner Registration'}</h2>
      {mode === 'register' && (
        <div>
          <label className="block text-sm font-semibold mb-1">Restaurant Name</label>
          <input type="text" required value={restaurantName} onChange={e=>setRestaurantName(e.target.value)} className="w-full px-4 py-2 border rounded-lg" placeholder="e.g. Healthy Bites" />
        </div>
      )}
      <div>
        <label className="block text-sm font-semibold mb-1">Email</label>
        <input type="email" required value={email} onChange={e=>setEmail(e.target.value)} className="w-full px-4 py-2 border rounded-lg" placeholder="you@restaurant.com" />
      </div>
      <div>
        <label className="block text-sm font-semibold mb-1">Password</label>
        <input type="password" required value={password} onChange={e=>setPassword(e.target.value)} className="w-full px-4 py-2 border rounded-lg" placeholder="••••••••" />
      </div>
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-500 text-white font-semibold rounded-lg hover:from-blue-600 hover:to-purple-600 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {loading ? (mode === 'login' ? 'Logging in...' : 'Registering...') : (mode === 'login' ? 'Login' : 'Register')}
      </button>
      <div className="mt-4 text-center text-sm">
        {mode === 'login' ? (
          <>Not registered? <button type="button" className="text-blue-600 font-semibold" onClick={()=>setMode('register')}>Register here</button></>
        ) : (
          <>Already a partner? <button type="button" className="text-blue-600 font-semibold" onClick={()=>setMode('login')}>Login here</button></>
        )}
      </div>
      <button type="button" className="mt-2 text-sm text-gray-500 underline" onClick={onBack}>Back</button>
    </form>
  )
}
