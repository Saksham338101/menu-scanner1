import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/router'
import { createClient } from '@supabase/supabase-js'
import MenuImageUpload from '@/components/MenuImageUpload'
import QrImage from '@/components/QrImage'
import LoadingSpinner from '@/components/spinner'
import { PartnerLayout } from '@/components/layouts/PartnerLayout'
import { resolveAppOrigin } from '@/utils/app-origin'

function buildMenuShareUrl(identifier, shareToken) {
  if (!identifier) return ''
  const origin = resolveAppOrigin()
  const base = `${origin}/menu/${identifier}`
  return shareToken ? `${base}?share=${shareToken}` : base
}

function createSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  return createClient(url, anonKey)
}

export default function PartnerDashboard() {
  const router = useRouter()
  const [partner, setPartner] = useState(null)
  const [sessionLoading, setSessionLoading] = useState(true)
  const [menuLoading, setMenuLoading] = useState(false)
  const [menuItems, setMenuItems] = useState([])
  const [uploadedImage, setUploadedImage] = useState(null)
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [generating, setGenerating] = useState(false)
  const [menuUrl, setMenuUrl] = useState('')
  const [qrDownloadUrl, setQrDownloadUrl] = useState('')
  const [shareToken, setShareToken] = useState('')

  const supabase = useMemo(() => createSupabase(), [])

  useEffect(() => {
    let active = true
    const loadSession = async () => {
      try {
        const res = await fetch('/api/partners/me', { credentials: 'include' })
        if (!res.ok) {
          router.replace('/auth?mode=partner')
          return
        }
        const json = await res.json().catch(() => null)
        if (!active) return
        setPartner(json?.partner || null)
      } catch (loadError) {
        console.error('[partner-dashboard] failed to load partner session', loadError)
        router.replace('/auth?mode=partner')
      } finally {
        if (active) setSessionLoading(false)
      }
    }
    loadSession()
    return () => {
      active = false
    }
  }, [router])

  useEffect(() => {
    if (!partner) return
    if (!shareToken) {
      setMenuUrl('')
      return
    }
    const menuIdentifier = partner.restaurant_slug || partner.id
    setMenuUrl(buildMenuShareUrl(menuIdentifier, shareToken))
  }, [partner, shareToken])

  useEffect(() => {
    if (!partner) return
    let cancelled = false
    const loadMenu = async () => {
      setMenuLoading(true)
      try {
        const { data, error: menuError } = await supabase
          .from('menu_items')
          .select('*')
          .eq('restaurant_id', partner.id)
          .order('created_at', { ascending: false })
        if (menuError) {
          console.error(menuError)
          if (!cancelled) setError('Could not load your menu yet. Please try again in a moment.')
        }
        if (!cancelled) {
          setMenuItems(data || [])
          if (!data?.length) {
            setQrDownloadUrl('')
            setShareToken('')
          }
        }
      } catch (menuLoadError) {
        console.error(menuLoadError)
        if (!cancelled) setError('Unable to load your menu right now.')
      } finally {
        if (!cancelled) setMenuLoading(false)
      }
    }
    loadMenu()
    return () => {
      cancelled = true
    }
  }, [partner, supabase])

  const handleGenerateMenu = async () => {
    if (!uploadedImage?.base64) {
      setError('Please upload a clear menu photo before generating.')
      return
    }
    setError('')
    setStatus('Scanning your menu with GPT-5 Mini…')
    setShareToken('')
    setGenerating(true)
    setQrDownloadUrl('')
    try {
      const response = await fetch('/api/partners/generate-menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          menuImage: uploadedImage.base64
        })
      })
      const json = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(json.error || 'Failed to generate menu')
      setStatus('Menu updated successfully!')
      if (json.partner) {
        setPartner((prev) => ({
          ...(prev || {}),
          id: json.partner.id,
          restaurant_name: json.partner.name || json.partner.restaurant_name || prev?.restaurant_name,
          restaurant_slug: json.partner.slug || json.partner.restaurant_slug || prev?.restaurant_slug
        }))
      }
      setMenuItems(json.menuItems || [])
      if (json.shareToken) {
        setShareToken(json.shareToken)
      }
      if (json.menuShareUrl) {
        setMenuUrl(json.menuShareUrl)
      }
    } catch (err) {
      console.error(err)
      setError(err.message || 'Menu generation failed. Please try again.')
    } finally {
      setGenerating(false)
    }
  }

  if (sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <LoadingSpinner />
      </div>
    )
  }

  if (!partner) {
    return null
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
      <header className="space-y-2">
        <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Partner workspace</p>
        <h1 className="text-3xl font-semibold text-slate-900">{partner.restaurant_name || 'Your restaurant'}</h1>
        <p className="text-sm text-slate-600 max-w-2xl">
          Upload a menu photo, let GPT-5 Mini digitize every dish, and share an interactive menu instantly with diners.
        </p>
      </header>

      <section className="bg-white/95 border border-slate-200 rounded-2xl p-6 shadow-sm space-y-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">1. Upload your menu</h2>
          <p className="text-sm text-slate-500">
            Use a bright, in-focus photo. We automatically clean, parse, and structure your dishes for the digital menu.
          </p>
        </div>
        <MenuImageUpload onChange={setUploadedImage} />
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <button
            onClick={handleGenerateMenu}
            disabled={generating}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 disabled:opacity-60"
          >
            {generating ? 'Generating menu…' : 'Generate menu with GPT-5 Mini'}
          </button>
          {status && <p className="text-sm text-emerald-600">{status}</p>}
        </div>
        {error && <p className="text-sm text-rose-600">{error}</p>}
      </section>

      <section className="bg-white/95 border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-slate-900">2. Review generated menu</h2>
          <span className="text-xs font-semibold px-3 py-1 rounded-full bg-slate-100 text-slate-600">Live preview</span>
        </div>
        {menuLoading ? (
          <LoadingSpinner />
        ) : menuItems.length === 0 ? (
          <p className="text-sm text-slate-500">Your generated dishes will appear here after you upload a menu photo.</p>
        ) : (
          <ul className="space-y-4">
            {menuItems.map((item) => (
              <li key={item.id} className="border border-slate-100 rounded-xl p-4 hover:border-slate-200">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-lg font-semibold text-slate-900">{item.name}</h3>
                    {item.description && <p className="text-sm text-slate-500">{item.description}</p>}
                    {(item.aiReview || item.ai_review) && (
                      <p className="text-sm text-emerald-700 italic">{item.aiReview || item.ai_review}</p>
                    )}
                    {Array.isArray(item.tags) && item.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-2">
                        {item.tags.map((tag) => (
                          <span key={tag} className="text-xs uppercase tracking-wide bg-blue-50 text-blue-600 px-2 py-1 rounded">
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right space-y-1">
                    {Number.isFinite(Number(item.price)) && (
                      <div className="text-lg font-semibold text-slate-900">${Number(item.price).toFixed(2)}</div>
                    )}
                    {item.nutrition?.calories && (
                      <div className="text-xs text-slate-500">{item.nutrition.calories} kcal</div>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="bg-white/95 border border-slate-200 rounded-2xl p-6 shadow-sm">
        <h2 className="text-xl font-semibold text-slate-900 mb-4">3. Share with customers</h2>
        {menuItems.length === 0 ? (
          <p className="text-sm text-slate-500">Generate a menu first to unlock your live link and QR code.</p>
        ) : !menuUrl ? (
          <p className="text-sm text-slate-500">Hang tight—we are securing your latest share link.</p>
        ) : (
          <div className="flex flex-col md:flex-row md:items-start gap-6">
            <div className="self-start">
              <QrImage
                data={menuUrl}
                size="200x200"
                alt={`QR code for ${partner.restaurant_name}`}
                className="rounded-lg border border-slate-200"
                onReady={(url) => setQrDownloadUrl(url)}
              />
              <button
                className="mt-3 text-sm font-semibold text-blue-600 hover:text-blue-700"
                onClick={() => {
                  if (!qrDownloadUrl) return
                  const anchor = document.createElement('a')
                  anchor.href = qrDownloadUrl
                  anchor.download = `menu-${partner.id}.png`
                  document.body.appendChild(anchor)
                  anchor.click()
                  anchor.remove()
                }}
                disabled={!qrDownloadUrl}
              >
                Download QR code
              </button>
            </div>
            <div className="flex-1 space-y-3">
              <p className="text-sm text-slate-600">
                Share this link or print the QR code for tables. Diners get a clean, interactive menu with AI-powered nutrition insights.
              </p>
              <div className="text-xs font-mono break-all bg-slate-50 border border-dashed border-slate-200 rounded p-3">{menuUrl}</div>
              <button
                className="text-sm font-semibold text-blue-600 hover:text-blue-700"
                onClick={() => {
                  if (!menuUrl) return
                  if (navigator?.clipboard?.writeText) {
                    navigator.clipboard
                      .writeText(menuUrl)
                      .then(() => setStatus('Menu link copied to clipboard'))
                      .catch(() => setStatus('Copy failed. Please copy the link manually.'))
                  } else {
                    setStatus('Copy failed. Please copy the link manually.')
                  }
                }}
              >
                Copy link
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  )
}

PartnerDashboard.getLayout = function getLayout(page) {
  return <PartnerLayout>{page}</PartnerLayout>
}
