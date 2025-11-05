function normalizeOrigin(value, defaultProtocol = 'https') {
  if (!value) return null
  const trimmed = String(value).trim()
  if (!trimmed) return null
  if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
    return trimmed.replace(/\/+$/, '')
  }
  return `${defaultProtocol}://${trimmed}`.replace(/\/+$/, '')
}

function getHeaderValue(req, keys) {
  if (!req?.headers) return null
  for (const key of keys) {
    const raw = req.headers[key]
    if (!raw) continue
    if (Array.isArray(raw)) {
      const candidate = raw.find((entry) => entry && String(entry).trim())
      if (candidate) return String(candidate).split(',')[0].trim()
      continue
    }
    const str = String(raw).trim()
    if (str) return str.split(',')[0].trim()
  }
  return null
}

function selectProtocol(forwardedProto, host) {
  if (forwardedProto) {
    return forwardedProto.includes(',') ? forwardedProto.split(',')[0].trim() : forwardedProto.trim()
  }
  if (host && host.includes('localhost')) {
    return 'http'
  }
  return 'https'
}

function parseForwardedHeader(value) {
  if (!value) return {}
  const entry = String(value).split(',')[0]
  const segments = entry.split(';')
  const result = {}
  for (const segment of segments) {
    const [rawKey, rawVal] = segment.split('=')
    if (!rawKey || !rawVal) continue
    const key = rawKey.trim().toLowerCase()
    const val = rawVal.trim()
    if (key === 'proto' || key === 'scheme') {
      result.protocol = val
    } else if (key === 'host') {
      result.host = val
    }
  }
  return result
}

export function resolveAppOrigin(options = {}) {
  const {
    origin,
    req,
    fallback = `http://localhost:${process.env.PORT || 3000}`
  } = options

  const envOrigin =
    origin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    process.env.NEXT_PUBLIC_VERCEL_URL ||
    process.env.VERCEL_URL ||
    process.env.SITE_URL ||
    process.env.URL

  const normalizedEnv = normalizeOrigin(envOrigin)
  if (normalizedEnv) {
    return normalizedEnv
  }

  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }

  if (req) {
    const forwarded = parseForwardedHeader(getHeaderValue(req, ['forwarded']))
    const forwardedHost = getHeaderValue(req, ['x-forwarded-host']) || forwarded.host
    const host = forwardedHost || getHeaderValue(req, ['host'])
    if (host) {
      const protoHeader = getHeaderValue(req, ['x-forwarded-proto', 'x-forwarded-protocol', 'x-forwarded-scheme']) || forwarded.protocol
      const protocol = selectProtocol(protoHeader, host)
      const normalizedRequestOrigin = normalizeOrigin(`${protocol}://${host}`, protocol)
      if (normalizedRequestOrigin) {
        return normalizedRequestOrigin
      }
    }
  }

  return normalizeOrigin(fallback) || 'http://localhost:3000'
}

export function withResolvedOrigin(callback, options) {
  const origin = resolveAppOrigin(options)
  return callback(origin)
}
