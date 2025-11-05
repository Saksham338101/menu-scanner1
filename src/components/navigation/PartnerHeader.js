import Link from 'next/link'
import { useRouter } from 'next/router'
import { useState } from 'react'

export function PartnerHeader() {
  const router = useRouter()
  const [signingOut, setSigningOut] = useState(false)

  const handleSignOut = async () => {
    setSigningOut(true)
    try {
      await fetch('/api/partners/logout', { method: 'POST', credentials: 'include' })
    } catch (error) {
      console.error('[PartnerHeader] sign out failed', error)
    } finally {
      setSigningOut(false)
      router.replace('/auth?mode=partner')
    }
  }

  return (
    <header className="bg-slate-900 text-white border-b border-slate-800">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between gap-6">
        <Link href="/partner-dashboard" className="text-2xl font-semibold tracking-tight">
          meal.<span className="text-emerald-300">it</span>
        </Link>
        <nav className="hidden md:flex items-center gap-6 text-sm text-slate-200">
          <Link href="/partner-dashboard" className="hover:text-white transition">Dashboard</Link>
          <Link href="/menu/demo" className="hover:text-white transition">Demo menu</Link>
          <Link href="/" className="hover:text-white transition">View public site</Link>
        </nav>
        <div className="flex items-center gap-4">
          <a
            href="mailto:support@meal.it"
            className="hidden sm:inline-flex items-center px-3 py-1.5 text-xs font-semibold rounded-lg bg-slate-800 hover:bg-slate-700"
          >
            Need help?
          </a>
          <button
            type="button"
            onClick={handleSignOut}
            disabled={signingOut}
            className="inline-flex items-center px-4 py-2 rounded-lg bg-rose-500 hover:bg-rose-600 text-sm font-semibold disabled:opacity-70"
          >
            {signingOut ? 'Signing out…' : 'Sign out'}
          </button>
        </div>
      </div>
    </header>
  )
}

export default PartnerHeader
