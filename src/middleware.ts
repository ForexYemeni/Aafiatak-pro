import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import type { UserRole } from '@/types';

// ---- Route Protection Configuration ----

interface RouteProtection {
  pathPrefix: string;
  allowedRoles: UserRole[];
}

const PROTECTED_ROUTES: RouteProtection[] = [
  { pathPrefix: '/admin', allowedRoles: ['admin', 'subadmin'] },
  { pathPrefix: '/nurse', allowedRoles: ['nurse'] },
  { pathPrefix: '/beneficiary', allowedRoles: ['beneficiary'] },
];

// ---- JWT Secret (Edge-compatible) ----

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? 'aafiatak-dev-jwt-secret-change-in-production';
  return new TextEncoder().encode(secret);
}

// ---- Helper: Extract token from request ----

function extractToken(request: NextRequest): string | null {
  // Try cookie first
  const cookieToken = request.cookies.get('auth_token')?.value;
  if (cookieToken) {
    return cookieToken;
  }

  // Try Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return authHeader.slice(7).trim();
  }

  return null;
}

// ---- Helper: Get user role from token (Edge-compatible using jose) ----

async function getUserRoleFromToken(token: string): Promise<UserRole | null> {
  try {
    const secret = getJwtSecret();
    const { payload } = await jwtVerify(token, secret);

    if (typeof payload === 'object' && payload !== null && 'role' in payload) {
      const role = payload.role as string;
      if (['admin', 'subadmin', 'nurse', 'beneficiary'].includes(role)) {
        return role as UserRole;
      }
    }

    return null;
  } catch {
    return null;
  }
}

// ---- Helper: Get dashboard path for a role ----

function getDashboardPath(role: UserRole): string {
  switch (role) {
    case 'admin':
    case 'subadmin':
      return '/admin';
    case 'nurse':
      return '/nurse';
    case 'beneficiary':
      return '/beneficiary';
    default:
      return '/';
  }
}

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
  // Rate Limiting & CORS for API routes
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
  // Auth pages: '/', '/login', '/register'
  // Do NOT redirect authenticated users here — let the client handle it.
  // The client has better context about the auth state and can avoid
  // the redirect loop that occurs when middleware redirects but
  // the cookie is expired/invalid while localStorage has stale auth data.
  // ============================================================

  const token = extractToken(request);

  // ---- Handle logout parameter ----
  if (pathname === '/' && request.nextUrl.searchParams.get('logout') === 'true') {
    const response = NextResponse.next();
    response.cookies.delete('auth_token');
    return response;
  }

  // ---- Check if current path is protected ----
  const matchingProtection = PROTECTED_ROUTES.find((protection) =>
    pathname.startsWith(protection.pathPrefix)
  );

  // Not a protected route, allow through
  if (!matchingProtection) {
    return NextResponse.next();
  }

  // ---- No token found, redirect to login ----
  if (!token) {
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ---- Verify token and check role ----
  const userRole = await getUserRoleFromToken(token);

  if (!userRole) {
    // Token is invalid/expired, clear cookie and redirect to login
    const loginUrl = new URL('/', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('auth_token');
    return response;
  }

  // ---- Check role authorization ----
  if (!matchingProtection.allowedRoles.includes(userRole)) {
    // User doesn't have the right role, redirect to their own dashboard
    const dashboardPath = getDashboardPath(userRole);
    // Prevent redirect loop: don't redirect to the same path
    if (pathname === dashboardPath) {
      return NextResponse.next();
    }
    return NextResponse.redirect(new URL(dashboardPath, request.url));
  }

  // ---- Authorized, allow through ----
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
