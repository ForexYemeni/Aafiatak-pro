import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';
import type { UserRole } from '@/types';
import { applySecurityHeaders } from '@/lib/security/headers';
import { checkRateLimit, rateLimitConfig, getClientIP } from '@/lib/security';

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

// Paths that should redirect away from login if already authenticated
const AUTH_PATHS = ['/login', '/register'];

// ---- JWT Secret (Edge-compatible) ----

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET ?? 'aafiatak-dev-jwt-secret-change-in-production';
  return new TextEncoder().encode(secret);
}

// ---- Helper: Extract token from request ----

function extractToken(request: NextRequest): string | null {
  // Try cookie first
  const cookieToken = request.cookies.get('auth-token')?.value;
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

// ---- Middleware ----

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip middleware for static files and Next.js internals
  if (
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname.includes('.')
  ) {
    const response = NextResponse.next();
    return applySecurityHeaders(request, response);
  }

  // ---- Rate Limiting for API routes ----
  if (pathname.startsWith('/api/')) {
    const clientIP = getClientIP(request);

    // Stricter rate limiting for auth endpoints
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
      const response = NextResponse.json(
        { success: false, message: 'طلبات كثيرة جداً. يرجى المحاولة بعد قليل' },
        { status: 429 }
      );
      response.headers.set('Retry-After', String(Math.ceil(windowMs / 1000)));
      return applySecurityHeaders(request, response);
    }

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      const response = new NextResponse(null, { status: 204 });
      return applySecurityHeaders(request, response);
    }

    const response = NextResponse.next();
    return applySecurityHeaders(request, response);
  }

  const token = extractToken(request);

  // ---- Handle authenticated users on auth pages ----
  if (AUTH_PATHS.some((authPath) => pathname.startsWith(authPath))) {
    if (token) {
      const role = await getUserRoleFromToken(token);
      if (role) {
        // Redirect to role-specific dashboard
        const dashboardPath = getDashboardPath(role);
        const response = NextResponse.redirect(new URL(dashboardPath, request.url));
        return applySecurityHeaders(request, response);
      }
    }
    const response = NextResponse.next();
    return applySecurityHeaders(request, response);
  }

  // ---- Check if current path is protected ----
  const matchingProtection = PROTECTED_ROUTES.find((protection) =>
    pathname.startsWith(protection.pathPrefix)
  );

  // Not a protected route, allow through with security headers
  if (!matchingProtection) {
    const response = NextResponse.next();
    return applySecurityHeaders(request, response);
  }

  // ---- No token found, redirect to login ----
  if (!token) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    return applySecurityHeaders(request, response);
  }

  // ---- Verify token and check role ----
  const userRole = await getUserRoleFromToken(token);

  if (!userRole) {
    // Token is invalid/expired, clear cookie and redirect to login
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    const response = NextResponse.redirect(loginUrl);
    response.cookies.delete('auth-token');
    return applySecurityHeaders(request, response);
  }

  // ---- Check role authorization ----
  if (!matchingProtection.allowedRoles.includes(userRole)) {
    // User doesn't have the right role, redirect to their own dashboard
    const dashboardPath = getDashboardPath(userRole);
    const response = NextResponse.redirect(new URL(dashboardPath, request.url));
    return applySecurityHeaders(request, response);
  }

  // ---- Authorized, allow through with security headers ----
  const response = NextResponse.next();
  return applySecurityHeaders(request, response);
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
