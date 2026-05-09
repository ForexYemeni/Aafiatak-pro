import { NextRequest, NextResponse } from 'next/server';

// ============================================================================
// عافيتك (Aafiatak) - Simplified Middleware
// ============================================================================
// ONLY handles API rate limiting and CORS.
// Page-level auth redirects are handled entirely by client-side code
// (AuthHydrationGuard in each layout) to avoid redirect loops.
// API routes protect themselves via requireAuth() / requireRole().
// ============================================================================

// ---- Simple Rate Limiting (Edge-compatible) ----

const rateLimitStore = new Map<string, { count: number; resetTime: number }>();

interface RateLimitConfig {
  windowMs: number;
  max: number;
  authMax: number;
  authWindowMs: number;
  uploadMax: number;
  uploadWindowMs: number;
}

const rateLimitConfig: RateLimitConfig = {
  windowMs: 15 * 60 * 1000,
  max: 200,
  authMax: 20,
  authWindowMs: 15 * 60 * 1000,
  uploadMax: 30,
  uploadWindowMs: 15 * 60 * 1000,
};

function checkRateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const record = rateLimitStore.get(key);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(key, { count: 1, resetTime: now + windowMs });
    return true;
  }

  if (record.count >= limit) {
    return false;
  }

  record.count += 1;
  return true;
}

function getClientIP(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    const firstIP = forwardedFor.split(',')[0]?.trim();
    if (firstIP) return firstIP;
  }
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP.trim();
  return 'unknown';
}

// ---- Middleware ----

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ============================================================
  // Skip middleware for static files and Next.js internals
  // ============================================================
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    return NextResponse.next();
  }

  // ============================================================
  // Rate Limiting & CORS for API routes ONLY
  // ============================================================
  if (pathname.startsWith('/api/')) {
    const clientIP = getClientIP(request);

    const isAuthEndpoint = pathname.startsWith('/api/auth/login') ||
      pathname.startsWith('/api/auth/register');
    const isUploadEndpoint = pathname.startsWith('/api/upload');

    const limit = isAuthEndpoint
      ? rateLimitConfig.authMax
      : isUploadEndpoint
        ? rateLimitConfig.uploadMax
        : rateLimitConfig.max;
    const windowMs = isAuthEndpoint
      ? rateLimitConfig.authWindowMs
      : isUploadEndpoint
        ? rateLimitConfig.uploadWindowMs
        : rateLimitConfig.windowMs;

    const rateLimitKey = `${clientIP}:${pathname}`;
    const isAllowed = checkRateLimit(rateLimitKey, limit, windowMs);

    if (!isAllowed) {
      return NextResponse.json(
        { success: false, message: 'طلبات كثيرة جداً. يرجى المحاولة بعد قليل' },
        { status: 429 }
      );
    }

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204 });
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
      response.headers.set('Access-Control-Max-Age', '86400');
      return response;
    }

    const response = NextResponse.next();

    // Add CORS headers for allowed origins
    const origin = request.headers.get('origin') ?? '';
    const allowedOrigins = [
      'https://aafiatak.com',
      'https://www.aafiatak.com',
      'https://app.aafiatak.com',
      'capacitor://localhost',
    ];
    const isAllowedOrigin = allowedOrigins.some((allowed) => origin.startsWith(allowed)) ||
      (process.env.NODE_ENV === 'development' && origin.includes('localhost'));
    if (isAllowedOrigin && origin) {
      response.headers.set('Access-Control-Allow-Origin', origin);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

    return response;
  }

  // ============================================================
  // All non-API, non-static routes: just pass through.
  // Auth protection is handled by client-side AuthHydrationGuard.
  // API routes protect themselves via requireAuth().
  // ============================================================
  return NextResponse.next();
}

// ---- Matcher Configuration ----

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
