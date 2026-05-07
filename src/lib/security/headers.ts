// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Security Headers
// ============================================================================
// Security headers configuration for HTTP responses.
// Protects against XSS, clickjacking, MIME-type sniffing, and more.
// Compatible with Next.js middleware and API routes.
// ============================================================================

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Security headers to apply to all responses.
 * These headers help protect against common web vulnerabilities.
 */
const SECURITY_HEADERS: Record<string, string> = {
  // Prevent MIME-type sniffing (forces browser to respect Content-Type)
  'X-Content-Type-Options': 'nosniff',

  // Prevent clickjacking by disallowing embedding in iframes
  'X-Frame-Options': 'DENY',

  // Enable browser XSS filter (legacy but still useful)
  'X-XSS-Protection': '1; mode=block',

  // Control referrer information sent with requests
  'Referrer-Policy': 'strict-origin-when-cross-origin',

  // Restrict access to browser features
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=(self)',

  // Force HTTPS for all future requests (1 year, include subdomains)
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains; preload',

  // Content Security Policy
  // Allows: self, inline scripts with nonce, Google Fonts, images from self/data/https
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: https: blob:",
    "connect-src 'self' ws: wss: https:",
    "media-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ].join('; '),
};

/**
 * Add security headers to a Next.js response.
 * @param response - The NextResponse to add headers to
 * @returns The modified NextResponse with security headers
 */
export function addSecurityHeaders(response: NextResponse): NextResponse {
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    response.headers.set(key, value);
  }

  return response;
}

/**
 * Create a new response with security headers applied.
 * Useful for API routes and middleware.
 * @param body - Response body
 * @param options - Response options (status, headers, etc.)
 * @returns A new NextResponse with security headers
 */
export function createSecureResponse(body: BodyInit | null, options?: ResponseInit): NextResponse {
  const response = new NextResponse(body, options);
  return addSecurityHeaders(response);
}

/**
 * Apply security headers to a request in Next.js middleware.
 * This function should be called in the middleware function to add
 * security headers to every response.
 * @param request - The incoming NextRequest
 * @param response - The NextResponse to modify (optional, creates new if not provided)
 * @returns The response with security headers applied
 */
export function applySecurityHeaders(request: NextRequest, response?: NextResponse): NextResponse {
  const nextResponse = response ?? NextResponse.next();

  // Apply security headers
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    nextResponse.headers.set(key, value);
  }

  // Add CORS headers for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin') ?? '';
    const allowedOrigins = [
      'http://localhost:3000',
      'https://localhost:3000',
      'https://aafiatak.com',
      'https://www.aafiatak.com',
      'https://app.aafiatak.com',
      'capacitor://localhost',
    ];

    const isAllowed = allowedOrigins.some((allowed) => origin.startsWith(allowed)) ||
      (process.env.NODE_ENV === 'development' && origin.includes('localhost'));

    if (isAllowed && origin) {
      nextResponse.headers.set('Access-Control-Allow-Origin', origin);
      nextResponse.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
      nextResponse.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-CSRF-Token');
      nextResponse.headers.set('Access-Control-Allow-Credentials', 'true');
      nextResponse.headers.set('Access-Control-Max-Age', '86400'); // 24 hours
    }
  }

  return nextResponse;
}

/**
 * Get the security headers as a plain object.
 * Useful for next.config.ts headers configuration.
 * @returns Object of security header key-value pairs
 */
export function getSecurityHeaders(): Record<string, string> {
  return { ...SECURITY_HEADERS };
}
