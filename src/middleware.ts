import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limit';

// ============================================================================
// عافيتك (Aafiatak) — Middleware
// ============================================================================
// Handles:
//  1. Rate limiting (Upstash Redis in prod, in-memory fallback in dev)
//  2. CORS headers for API routes
//
// Page-level auth is handled by client-side AuthHydrationGuard in each layout.
// API routes protect themselves via requireAuth() / requireRole().
// ============================================================================

function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIP = forwardedFor.split(',')[0]?.trim();
    if (firstIP) return firstIP;
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP.trim();
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP.trim();
  return 'unknown';
}

const ALLOWED_ORIGINS = [
  'https://aafiatak.com',
  'https://www.aafiatak.com',
  'https://app.aafiatak.com',
  'capacitor://localhost',
];

function setCORSHeaders(response: NextResponse, request: NextRequest): void {
  const origin = request.headers.get('origin') ?? '';
  const isDev = process.env.NODE_ENV === 'development';
  const isAllowed =
    ALLOWED_ORIGINS.some((o) => origin.startsWith(o)) ||
    (isDev && origin.includes('localhost'));

  if (isAllowed && origin) {
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    response.headers.set(
      'Access-Control-Allow-Methods',
      'GET, POST, PUT, PATCH, DELETE, OPTIONS'
    );
    response.headers.set(
      'Access-Control-Allow-Headers',
      'Content-Type, Authorization, X-CSRF-Token'
    );
    response.headers.set('Access-Control-Max-Age', '86400');
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const clientIP = getClientIP(request);

  // ---- Handle CORS preflight ----
  if (request.method === 'OPTIONS') {
    const response = new NextResponse(null, { status: 204 });
    setCORSHeaders(response, request);
    return response;
  }

  // ---- Rate Limiting ----
  const isAuth = pathname.startsWith('/api/auth/login') || pathname.startsWith('/api/auth/register');
  const isUpload = pathname.startsWith('/api/upload');

  const { limit, windowMs } = isAuth
    ? RATE_LIMITS.auth
    : isUpload
    ? RATE_LIMITS.upload
    : RATE_LIMITS.api;

  const rateLimitKey = `rl:${clientIP}:${isAuth ? 'auth' : isUpload ? 'upload' : 'api'}`;
  const result = await checkRateLimit(rateLimitKey, limit, windowMs);

  if (!result.allowed) {
    return NextResponse.json(
      { success: false, message: 'طلبات كثيرة جداً. يرجى المحاولة بعد قليل.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((result.resetAt - Date.now()) / 1000)),
          'X-RateLimit-Limit': String(limit),
          'X-RateLimit-Remaining': '0',
          'X-RateLimit-Reset': String(result.resetAt),
        },
      }
    );
  }

  // ---- Pass through with CORS + rate limit headers ----
  const response = NextResponse.next();
  setCORSHeaders(response, request);
  response.headers.set('X-RateLimit-Limit', String(limit));
  response.headers.set('X-RateLimit-Remaining', String(result.remaining));
  response.headers.set('X-RateLimit-Reset', String(result.resetAt));

  return response;
}

export const config = {
  matcher: ['/api/:path*'],
};
