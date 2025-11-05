import { NextResponse } from 'next/server';

// Basic Content Security Policy builder
function buildCSP(origin) {
  const self = `'self'`;
  // Adjust these domains if you add external images/fonts/analytics
  const img = [self, 'data:', 'blob:'];
  const connect = [self, 'https://*.supabase.co', 'https://api.openai.com'];
  const font = [self, 'https://fonts.gstatic.com'];
  const style = [self, `'unsafe-inline'`]; // Tailwind JIT inline classes; replace with nonce+hashes for stricter prod
  const script = [self].concat(process.env.NODE_ENV === 'development' ? [`'unsafe-eval'`] : []); // drop unsafe-eval in production
  return [
    `default-src ${self}`,
    `base-uri ${self}`,
    `form-action ${self}`,
    `img-src ${img.join(' ')}`,
    `connect-src ${connect.join(' ')}`,
    `font-src ${font.join(' ')}`,
    `style-src ${style.join(' ')}`,
    `script-src ${script.join(' ')}`,
    `object-src 'none'`,
    `frame-ancestors ${self}`,
    `upgrade-insecure-requests`
  ].join('; ');
}

export function middleware(req) {
  const res = NextResponse.next();
  const origin = req.headers.get('origin') || '';

  res.headers.set('X-Frame-Options','SAMEORIGIN');
  res.headers.set('X-Content-Type-Options','nosniff');
  res.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  res.headers.set('Permissions-Policy','camera=(self), microphone=(), geolocation=()');
  res.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  res.headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
  res.headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains; preload');
  res.headers.set('Content-Security-Policy', buildCSP(origin));
  res.headers.set('Cache-Control', 'no-store');
  return res;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
