import cookie from 'cookie'

const PARTNER_COOKIE_NAME = 'partner_session_token'
const TOKEN_MAX_AGE_SECONDS = 60 * 60 * 24 * 7 // 7 days
const SESSION_ALLOWED_FIELDS = ['id', 'email', 'restaurant_slug']

function sanitisePayload(payload) {
  if (!payload || typeof payload !== 'object') return null
  const cleaned = {}
  for (const key of SESSION_ALLOWED_FIELDS) {
    if (payload[key] !== undefined) cleaned[key] = payload[key]
  }
  if (!cleaned.id) return null
  cleaned.issued_at = Date.now()
  return cleaned
}

function encodeSession(payload) {
  const sanitised = sanitisePayload(payload)
  if (!sanitised) return null
  return Buffer.from(JSON.stringify(sanitised)).toString('base64url')
}

function decodeSession(token) {
  if (!token) return null
  try {
    const json = Buffer.from(token, 'base64url').toString('utf8')
    const parsed = JSON.parse(json)
    if (!parsed?.id) return null
    return parsed
  } catch (error) {
    return null
  }
}

export function signPartnerToken(payload) {
  return encodeSession(payload)
}

export function verifyPartnerToken(token) {
  return decodeSession(token)
}

export function setPartnerSessionCookie(res, payload) {
  const token = signPartnerToken(payload)
  if (!token) {
    throw new Error('Unable to create partner session token')
  }
  const serialized = cookie.serialize(PARTNER_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: TOKEN_MAX_AGE_SECONDS,
    path: '/'
  })
  res.setHeader('Set-Cookie', serialized)
  return token
}

export function clearPartnerSessionCookie(res) {
  const serialized = cookie.serialize(PARTNER_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/'
  })
  res.setHeader('Set-Cookie', serialized)
}

export function readPartnerSession(req) {
  const header = req.headers.cookie || ''
  if (!header) return null
  const cookies = cookie.parse(header)
  const token = cookies[PARTNER_COOKIE_NAME]
  return verifyPartnerToken(token)
}

export function requirePartnerSession(req, res) {
  const session = readPartnerSession(req)
  if (!session?.id) {
    res.status(401).json({ error: 'partner_unauthenticated' })
    return null
  }
  return session
}
