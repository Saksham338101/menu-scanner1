import { createHmac, randomUUID, timingSafeEqual } from 'crypto'
import { resolveAppOrigin } from './app-origin'

function getSecret() {
  return (
    process.env.MENU_SHARE_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'dev-share-secret'
  )
}

export function generateShareToken({ restaurantId, generatedAt }) {
  if (!restaurantId || !generatedAt) {
    throw new Error('restaurantId and generatedAt required to generate share token')
  }

  const payload = {
    r: restaurantId,
    t: generatedAt,
    n: randomUUID()
  }

  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url')
  const signature = createHmac('sha256', getSecret()).update(encodedPayload).digest('base64url')
  return `${encodedPayload}.${signature}`
}

export function verifyShareToken({ token, restaurantId }) {
  if (!token || typeof token !== 'string') {
    return { valid: false }
  }

  const [encodedPayload, signature] = token.split('.')
  if (!encodedPayload || !signature) {
    return { valid: false }
  }

  try {
    const expectedSignature = createHmac('sha256', getSecret()).update(encodedPayload).digest('base64url')
    const provided = Buffer.from(signature, 'base64url')
    const expected = Buffer.from(expectedSignature, 'base64url')

    if (provided.length !== expected.length || !timingSafeEqual(provided, expected)) {
      return { valid: false }
    }

    const payloadJson = Buffer.from(encodedPayload, 'base64url').toString('utf8')
    const payload = JSON.parse(payloadJson)

    if (!payload || payload.r !== restaurantId || !payload.t) {
      return { valid: false }
    }

    const generatedAt = new Date(payload.t)
    if (Number.isNaN(generatedAt.getTime())) {
      return { valid: false }
    }

    return {
      valid: true,
      generatedAt: generatedAt.toISOString()
    }
  } catch (error) {
    console.warn('[share-token] Failed to verify share token', error)
    return { valid: false }
  }
}

export function buildShareUrl({ origin, identifier, shareToken, req, fallback } = {}) {
  if (!identifier || !shareToken) return ''
  const baseOrigin = resolveAppOrigin({ origin, req, fallback })
  return `${baseOrigin}/menu/${identifier}?share=${encodeURIComponent(shareToken)}`
}
