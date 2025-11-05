// Simple in-memory rate limiter (per key) with sliding window
// For production horizontal scale, replace with Redis / Upstash.
const buckets = new Map(); // key -> { count, reset }

export function rateLimit(key, { windowMs = 60_000, max = 5 } = {}) {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now > bucket.reset) {
    bucket = { count: 0, reset: now + windowMs };
  }
  bucket.count++;
  buckets.set(key, bucket);
  const remaining = Math.max(0, max - bucket.count);
  return {
    success: bucket.count <= max,
    remaining,
    reset: bucket.reset,
    retryAfter: bucket.count <= max ? 0 : Math.ceil((bucket.reset - now) / 1000)
  };
}

export function rateLimitMiddleware(req, res, key, options) {
  const result = rateLimit(key, options);
  res.setHeader('X-RateLimit-Limit', options.max);
  res.setHeader('X-RateLimit-Remaining', result.remaining);
  res.setHeader('X-RateLimit-Reset', Math.floor(result.reset / 1000));
  if (!result.success) {
    res.setHeader('Retry-After', result.retryAfter);
    res.status(429).json({ error: 'Rate limit exceeded. Try again later.' });
    return false;
  }
  return true;
}