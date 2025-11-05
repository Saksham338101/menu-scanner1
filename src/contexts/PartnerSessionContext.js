import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'

const PartnerSessionContext = createContext(null)

export function PartnerSessionProvider({ children }) {
  const [partner, setPartner] = useState(null)
  const [initialised, setInitialised] = useState(false)
  const [loading, setLoading] = useState(true)

  const loadSession = useCallback(async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/partners/me', { credentials: 'include' })
      if (!res.ok) {
        setPartner(null)
        return
      }
      const json = await res.json().catch(() => null)
      setPartner(json?.partner || null)
    } catch (error) {
      console.warn('[partner-session] failed to load partner session', error)
      setPartner(null)
    } finally {
      setLoading(false)
      setInitialised(true)
    }
  }, [])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  const value = useMemo(
    () => ({
      partner,
      loading,
      initialised,
      refresh: loadSession,
      clear: () => setPartner(null),
      setPartner
    }),
    [partner, loading, initialised, loadSession]
  )

  return <PartnerSessionContext.Provider value={value}>{children}</PartnerSessionContext.Provider>
}

export function usePartnerSession() {
  const context = useContext(PartnerSessionContext)
  if (!context) {
    throw new Error('usePartnerSession must be used within PartnerSessionProvider')
  }
  return context
}
