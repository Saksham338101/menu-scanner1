import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/utils/supabaseClient'
import { usePartnerSession } from '@/contexts/PartnerSessionContext'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [profile, setProfile] = useState(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const { refresh: refreshPartnerSession, clear: clearPartnerSession } = usePartnerSession()

  useEffect(() => {
    let mounted = true
    const init = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        if (!mounted) return
        setUser(session?.user || null)
      } finally {
        setLoading(false)
      }
    }
    init()
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null)
    })
    return () => {
      mounted = false
      sub?.subscription?.unsubscribe?.()
    }
  }, [])

  const getAccessToken = useCallback(async () => {
    const tokenRes = await supabase.auth.getSession()
    return tokenRes?.data?.session?.access_token || null
  }, [])

  const fetchProfile = useCallback(async () => {
    setProfileLoading(true)
    if (!user) {
      setProfile(null)
      setProfileLoading(false)
      return
    }
    try {
      const token = await getAccessToken()
      if (!token) {
        setProfile(null)
        setProfileLoading(false)
        return
      }
      const res = await fetch('/api/profile', { headers: { Authorization: `Bearer ${token}` } })
      if (res.ok) {
        const json = await res.json()
        setProfile(json?.profile || null)
      } else if (res.status === 404) {
        setProfile(null)
      }
    } catch (_) {
      setProfile(null)
    } finally {
      setProfileLoading(false)
    }
  }, [getAccessToken, user])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  const hasHealthProfile = useMemo(() => {
    if (!profile) return false
    const keysToCheck = ['diet', 'allergies', 'conditions', 'goals']
    return keysToCheck.some((key) => {
      const value = profile[key]
      return typeof value === 'string' ? value.trim().length > 0 : Boolean(value)
    })
  }, [profile])

  const value = useMemo(() => ({
    user,
    profile,
    loading,
    isAuthenticated: !!user,
    profileLoading,
    hasHealthProfile,
    getAccessToken,
    refreshProfile: fetchProfile,
    signIn: async ({ email, password }) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      setUser(data.user)
      await fetchProfile()
      await fetch('/api/partners/logout', { method: 'POST' }).catch(() => {})
      clearPartnerSession()
      return data
    },
    signUp: async ({ email, password }) => {
      const { data, error } = await supabase.auth.signUp({ 
        email, 
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        }
      })
      if (error) throw error
      setUser(data.user)
      await fetchProfile()
      await fetch('/api/partners/logout', { method: 'POST' }).catch(() => {})
      clearPartnerSession()
      return data
    },
    signInWithGoogle: async () => {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
        }
      })
      if (error) throw error
      await fetch('/api/partners/logout', { method: 'POST' }).catch(() => {})
      clearPartnerSession()
      return data
    },
    resetPassword: async ({ email }) => {
      const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
      if (error) throw error
      return data
    },
    signOut: async () => {
      await supabase.auth.signOut()
      setUser(null)
      setProfile(null)
      setProfileLoading(false)
      refreshPartnerSession()
    },
  }), [clearPartnerSession, fetchProfile, getAccessToken, hasHealthProfile, loading, profile, profileLoading, refreshPartnerSession, user])

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
