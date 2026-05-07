// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Security Middleware
// ============================================================================
// Core security utilities: rate limiting, input sanitization, CSRF protection,
// IP extraction, device fingerprinting, and origin validation.
// ============================================================================

import { z, type ZodSchema } from 'zod';

// ============================================================================
// Rate Limiting Configuration
// ============================================================================

/** Rate limiting configuration for API endpoints */
export const rateLimitConfig = {
  /** Time window in milliseconds (15 minutes) */
  windowMs: 15 * 60 * 1000,
  /** Maximum requests per IP within the time window */
  max: 100,
  /** Rate limit for authentication endpoints (stricter) */
  authMax: 5,
  /** Auth rate limit time window in milliseconds (15 minutes) */
  authWindowMs: 15 * 60 * 1000,
  /** Rate limit for file upload endpoints */
  uploadMax: 10,
  /** Upload rate limit time window in milliseconds (15 minutes) */
  uploadWindowMs: 15 * 60 * 1000,
};

// In-memory rate limit store (simple implementation)
const rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();

/**
 * Check if a request should be rate limited.
 * Returns true if the request should be allowed, false if rate limited.
 * @param key - The key to rate limit on (usually IP address)
 * @param limit - Maximum number of requests allowed
 * @param windowMs - Time window in milliseconds
 */
export function checkRateLimit(key: string, limit: number = rateLimitConfig.max, windowMs: number = rateLimitConfig.windowMs): boolean {
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

/**
 * Get rate limit info for a key.
 * Returns remaining requests and reset time.
 */
export function getRateLimitInfo(key: string): { remaining: number; resetTime: number; limit: number } {
  const record = rateLimitStore.get(key);
  const now = Date.now();

  if (!record || now > record.resetTime) {
    return { remaining: rateLimitConfig.max, resetTime: now + rateLimitConfig.windowMs, limit: rateLimitConfig.max };
  }

  return {
    remaining: Math.max(0, rateLimitConfig.max - record.count),
    resetTime: record.resetTime,
    limit: rateLimitConfig.max,
  };
}

// ============================================================================
// Input Sanitization (XSS Prevention)
// ============================================================================

/** HTML entity encoding map for XSS prevention */
const HTML_ENTITIES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#x27;',
  '/': '&#x2F;',
  '`': '&#96;',
};

/** Regex to match HTML entity characters */
const HTML_ENTITY_REGEX = /[&<>"'`/]/g;

/**
 * Sanitize input string to prevent XSS attacks.
 * Encodes dangerous HTML characters into their entity equivalents.
 * @param input - The raw input string to sanitize
 * @returns The sanitized string with HTML entities encoded
 */
export function sanitizeInput(input: string): string {
  if (typeof input !== 'string') return '';

  return input
    .replace(HTML_ENTITY_REGEX, (char) => HTML_ENTITIES[char] ?? char)
    .trim();
}

/**
 * Sanitize all string values in an object recursively.
 * @param obj - The object to sanitize
 * @returns A new object with all string values sanitized
 */
export function sanitizeObject<T extends Record<string, unknown>>(obj: T): T {
  const sanitized: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === 'string') {
      sanitized[key] = sanitizeInput(value);
    } else if (Array.isArray(value)) {
      sanitized[key] = value.map((item) =>
        typeof item === 'string' ? sanitizeInput(item) : item
      );
    } else if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      sanitized[key] = sanitizeObject(value as Record<string, unknown>);
    } else {
      sanitized[key] = value;
    }
  }

  return sanitized as T;
}

// ============================================================================
// API Input Validation
// ============================================================================

/**
 * Validate and sanitize API input using a Zod schema.
 * Throws a formatted error if validation fails, with Arabic messages.
 * @param data - The raw input data to validate
 * @param schema - The Zod schema to validate against
 * @returns The validated and typed data
 * @throws Error with Arabic message if validation fails
 */
export function validateApiInput<T>(data: unknown, schema: ZodSchema<T>): T {
  const result = schema.safeParse(data);

  if (!result.success) {
    const firstError = result.error.errors[0];
    const fieldName = firstError?.path.join('.') ?? 'حقل';
    const errorMessage = firstError?.message ?? 'بيانات غير صالحة';

    throw new Error(`${fieldName}: ${errorMessage}`);
  }

  return result.data;
}

// ============================================================================
// CSRF Protection
// ============================================================================

/** CSRF token length */
const CSRF_TOKEN_LENGTH = 32;

/**
 * Generate a cryptographically secure CSRF token.
 * Uses the Web Crypto API for secure random generation.
 * @returns A hex-encoded CSRF token
 */
export function generateCSRFToken(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '').substring(0, CSRF_TOKEN_LENGTH);
  }

  // Fallback for environments without crypto.randomUUID
  const bytes = new Uint8Array(CSRF_TOKEN_LENGTH);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    // Last resort fallback (not cryptographically secure)
    for (let i = 0; i < CSRF_TOKEN_LENGTH; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  return Array.from(bytes)
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Validate a CSRF token against the expected token.
 * Uses constant-time comparison to prevent timing attacks.
 * @param token - The token to validate
 * @param expectedToken - The expected token value
 * @returns True if the tokens match, false otherwise
 */
export function validateCSRFToken(token: string, expectedToken: string): boolean {
  if (!token || !expectedToken) return false;
  if (token.length !== expectedToken.length) return false;

  // Constant-time comparison to prevent timing attacks
  let mismatch = 0;
  for (let i = 0; i < token.length; i++) {
    mismatch |= token.charCodeAt(i) ^ expectedToken.charCodeAt(i);
  }

  return mismatch === 0;
}

// ============================================================================
// Client IP Extraction
// ============================================================================

/**
 * Get the client IP address from a request.
 * Checks various headers that may contain the real IP (proxies, load balancers).
 * @param request - The incoming HTTP request
 * @returns The client IP address or 'unknown'
 */
export function getClientIP(request: Request): string {
  // Check X-Forwarded-For header (common for reverse proxies)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    // The first IP in the list is the original client IP
    const firstIP = forwardedFor.split(',')[0]?.trim();
    if (firstIP) return firstIP;
  }

  // Check X-Real-IP header (common for Nginx)
  const realIP = request.headers.get('x-real-ip');
  if (realIP) return realIP.trim();

  // Check CF-Connecting-IP header (Cloudflare)
  const cfIP = request.headers.get('cf-connecting-ip');
  if (cfIP) return cfIP.trim();

  // Check True-Client-IP header (Cloudflare Enterprise)
  const trueClientIP = request.headers.get('true-client-ip');
  if (trueClientIP) return trueClientIP.trim();

  return 'unknown';
}

// ============================================================================
// Device Fingerprinting
// ============================================================================

/**
 * Generate a device fingerprint from request headers.
 * Uses a combination of User-Agent, Accept-Language, and other headers
 * to create a semi-unique identifier for the client device.
 * This is NOT a tracking mechanism — it's used for security (fraud detection).
 * @param request - The incoming HTTP request
 * @returns A hex-encoded device fingerprint
 */
export function generateDeviceFingerprint(request: Request): string {
  const components: string[] = [];

  // User-Agent
  const userAgent = request.headers.get('user-agent') ?? '';
  components.push(userAgent);

  // Accept-Language
  const acceptLanguage = request.headers.get('accept-language') ?? '';
  components.push(acceptLanguage);

  // Accept-Encoding
  const acceptEncoding = request.headers.get('accept-encoding') ?? '';
  components.push(acceptEncoding);

  // Screen-related headers from Capacitor
  const screenWidth = request.headers.get('x-screen-width') ?? '';
  const screenHeight = request.headers.get('x-screen-height') ?? '';
  components.push(`${screenWidth}x${screenHeight}`);

  // Platform
  const platform = request.headers.get('sec-ch-ua-platform') ?? '';
  components.push(platform);

  // Combine and hash
  const fingerprint = components.join('|');

  // Simple hash function (for fingerprinting, not cryptographic)
  let hash = 0;
  for (let i = 0; i < fingerprint.length; i++) {
    const char = fingerprint.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }

  return Math.abs(hash).toString(16).padStart(8, '0') +
    Math.abs(hash * 31).toString(16).padStart(8, '0');
}

// ============================================================================
// Origin Validation
// ============================================================================

/** Allowed origins for CORS and CSRF protection */
const ALLOWED_ORIGINS: string[] = [
  'http://localhost:3000',
  'https://localhost:3000',
  'https://aafiatak.com',
  'https://www.aafiatak.com',
  'https://app.aafiatak.com',
  // Capacitor native apps use the configured server URL
  'capacitor://localhost',
  'http://localhost',
];

/**
 * Check if a request is from an allowed origin.
 * Used for CORS and CSRF protection.
 * @param request - The incoming HTTP request
 * @returns True if the origin is allowed, false otherwise
 */
export function isAllowedOrigin(request: Request): boolean {
  const origin = request.headers.get('origin') ?? '';
  const referer = request.headers.get('referer') ?? '';

  // Check origin header
  if (origin) {
    // Allow all localhost origins in development
    if (process.env.NODE_ENV === 'development' && origin.includes('localhost')) {
      return true;
    }
    return ALLOWED_ORIGINS.some((allowed) => origin.startsWith(allowed));
  }

  // Check referer header as fallback
  if (referer) {
    if (process.env.NODE_ENV === 'development' && referer.includes('localhost')) {
      return true;
    }
    return ALLOWED_ORIGINS.some((allowed) => referer.startsWith(allowed));
  }

  // No origin or referer — allow for same-origin requests (API calls)
  // but could be blocked in stricter configurations
  return true;
}
