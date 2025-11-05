import Head from 'next/head'
import Link from 'next/link'
import { useRouter } from 'next/router'
import { useMemo } from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { usePartnerSession } from '@/contexts/PartnerSessionContext'

function NavLink({ href, label, isActive }) {
  return (
    <Link
      href={href}
      className={`relative inline-flex items-center text-sm font-medium transition-colors ${
        isActive ? 'text-brand-primary' : 'text-brand-muted hover:text-brand-primary'
      }`}
    >
      {label}
      {isActive && <span className="absolute inset-x-0 bottom-[-10px] mx-auto h-0.5 w-8 rounded-full bg-brand-primary" />}
    </Link>
  )
}

export function AppHeader() {
  const router = useRouter()
  const { isAuthenticated, loading: userLoading, profile, user, signOut } = useAuth()
  const { partner, loading: partnerLoading, clear: clearPartner, refresh: refreshPartner } = usePartnerSession()

  const activeMode = useMemo(() => {
    if (partner) return 'partner'
    if (router.pathname.startsWith('/partner')) return 'partner'
    return 'user'
  }, [partner, router.pathname])

  const handleUserSignOut = async () => {
    await signOut().catch(() => {})
    router.push('/auth')
  }

  const handlePartnerSignOut = async () => {
    await fetch('/api/partners/logout', { method: 'POST' }).catch(() => {})
    clearPartner()
    refreshPartner()
    router.push('/auth?mode=partner')
  }

  const partnerInitials = partner?.restaurant_name
    ? partner.restaurant_name
        .split(' ')
        .map((word) => word[0])
        .join('')
        .slice(0, 2)
        .toUpperCase()
    : 'RP'

  const userLabel = useMemo(() => {
    if (profile?.full_name) return profile.full_name
    if (profile?.name) return profile.name
    if (user?.email) return user.email.split('@')[0]
    return 'You'
  }, [profile, user])

  const userInitial = userLabel?.[0]?.toUpperCase() || 'U'

  return (
    <>
      <Head>
        <title>meal.it | AI menus with health insights</title>
        <meta
          name="description"
          content="Digitize restaurant menus with GPT-5 Mini and deliver dynamic, health-aware dining experiences."
        />
        <link rel="icon" href="/favicon.svg" />
        <meta property="og:title" content="meal.it | AI menus with health insights" />
        <meta
          property="og:description"
          content="Digitize restaurant menus with GPT-5 Mini and deliver dynamic, health-aware dining experiences."
        />
      </Head>
      <header className="sticky top-0 z-40 border-b border-[rgba(15,23,42,0.08)] bg-white/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6">
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-semibold text-brand-ink">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-white shadow-soft">
              mi
            </span>
            <span>meal.it</span>
          </Link>

          {activeMode === 'partner' ? (
          <nav className="hidden items-center gap-8 md:flex">
            <NavLink href="/partner-dashboard" label="Dashboard" isActive={router.pathname === '/partner-dashboard'} />
            <NavLink href="/partner-dashboard#menu" label="Generated menu" isActive={router.asPath.includes('#menu')} />
            <NavLink href="/auth?mode=partner" label="Invite team" isActive={router.pathname === '/auth' && router.query?.mode === 'partner'} />
          </nav>
        ) : (
          <nav className="hidden items-center gap-8 md:flex">
            <NavLink href="/" label="Home" isActive={router.pathname === '/'} />
            <NavLink href="/restaurants" label="Restaurants" isActive={router.pathname.startsWith('/restaurants')} />
            <NavLink href="/scan" label="Scan QR" isActive={router.pathname === '/scan'} />
            <NavLink href="/onboarding" label="How it works" isActive={router.pathname === '/onboarding'} />
          </nav>
        )}

          <div className="flex items-center gap-3">
          {activeMode === 'partner' ? (
            partnerLoading ? (
              <div className="h-8 w-16 animate-pulse rounded-full bg-brand-surface" />
            ) : partner ? (
              <>
                <div className="hidden items-center gap-2 rounded-full border border-brand-border bg-white px-3 py-1.5 text-xs font-medium text-brand-muted md:flex">
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-surface text-sm font-semibold text-brand-primary">
                    {partnerInitials}
                  </span>
                  <div className="flex flex-col text-left">
                    <span className="text-xs uppercase tracking-[0.18em] text-brand-muted/70">Partner</span>
                    <span className="text-sm font-semibold text-brand-ink">{partner.restaurant_name || 'Partner'}</span>
                  </div>
                </div>
                <button className="btn-secondary" onClick={handlePartnerSignOut}>
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/auth?mode=partner" className="btn-primary">
                Partner sign in
              </Link>
            )
          ) : userLoading ? (
            <div className="h-8 w-20 animate-pulse rounded-full bg-brand-surface" />
          ) : isAuthenticated ? (
            <>
              <Link
                href="/profile"
                className="hidden items-center gap-2 rounded-full border border-brand-border bg-white px-3 py-1.5 text-xs font-medium text-brand-muted md:flex"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-surface text-sm font-semibold text-brand-primary">
                  {userInitial}
                </span>
                <span className="text-sm font-semibold text-brand-ink">{userLabel}</span>
              </Link>
              <button className="btn-secondary" onClick={handleUserSignOut}>
                Sign out
              </button>
            </>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/auth" className="text-sm font-semibold text-brand-ink hover:text-brand-primary">
                Sign in
              </Link>
              <Link href="/auth" className="btn-primary">
                Get started
              </Link>
            </div>
          )}
          </div>
        </div>
      </header>
    </>
  )
}

export default AppHeader
