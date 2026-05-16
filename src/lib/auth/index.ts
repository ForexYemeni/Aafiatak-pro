// ============================================================================
// عافيتك (Aafiatak) Auth Library - MongoDB/Mongoose based
// ============================================================================
// Authentication utilities using bcryptjs + JWT
// NO Firebase, NO Prisma - MongoDB only
// ============================================================================

import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// ---- Constants ----
const SALT_ROUNDS = 12;
const JWT_EXPIRY = process.env.JWT_EXPIRY ?? '7d';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY ?? '30d';

// ── JWT Secrets — REQUIRED at runtime. ────────────────────────────────────
// A missing secret means every JWT would be signed with `undefined`, which
// node-jsonwebtoken converts to the string "undefined" — trivially forgeable.
// We use lazy initialization so the build succeeds without env vars, but
// the server will crash at runtime if they are missing.
const JWT_SECRET: string = process.env.JWT_SECRET ?? '';
const JWT_REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET ?? '';

function ensureSecrets(): void {
  if (!JWT_SECRET) {
    throw new Error(
      '[AUTH FATAL] JWT_SECRET is not set. ' +
      'Set it in your .env file or deployment environment variables.'
    );
  }
  if (!JWT_REFRESH_SECRET) {
    throw new Error(
      '[AUTH FATAL] JWT_REFRESH_SECRET is not set. ' +
      'Set it in your .env file or deployment environment variables.'
    );
  }
}

// ---- Password Hashing ----

/**
 * Hash a plaintext password using bcryptjs with 12 salt rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  return bcrypt.hash(password, salt);
}

/**
 * Verify a plaintext password against a stored bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ---- JWT Token Generation ----

/**
 * Generate a JWT access token.
 */
export function generateToken(payload: { userId: string; phone: string; role: string }): string {
  ensureSecrets();
  const expiresIn = parseExpiry(JWT_EXPIRY);
  return jwt.sign(payload, JWT_SECRET, { expiresIn });
}

/**
 * Generate a JWT refresh token.
 */
export function generateRefreshToken(payload: { userId: string; phone: string; role: string }): string {
  ensureSecrets();
  const expiresIn = parseExpiry(JWT_REFRESH_EXPIRY);
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn });
}

/**
 * Parse JWT expiry value - converts string like "7d" to seconds or returns as-is.
 */
function parseExpiry(value: string): string | number {
  if (/^\d+$/.test(value)) return parseInt(value, 10);
  if (/^\d+\s*(ms|s|m|h|d|w|y|seconds?|minutes?|hours?|days?|weeks?|years?)$/i.test(value.trim())) {
    return value.trim();
  }
  console.warn(`[Auth] Unrecognized JWT expiry format: "${value}". Defaulting to 7d.`);
  return '7d';
}

/**
 * Verify and decode a JWT access token.
 * Returns the decoded payload or null if invalid/expired.
 */
export function verifyToken(token: string): { userId: string; phone: string; role: string } | null {
  if (!JWT_SECRET) return null;
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; phone: string; role: string };
    return { userId: decoded.userId, phone: decoded.phone, role: decoded.role };
  } catch {
    return null;
  }
}

/**
 * Verify and decode a JWT refresh token.
 * Returns the decoded payload or null if invalid/expired.
 */
export function verifyRefreshToken(token: string): { userId: string; phone: string; role: string } | null {
  if (!JWT_REFRESH_SECRET) return null;
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as { userId: string; phone: string; role: string };
    return { userId: decoded.userId, phone: decoded.phone, role: decoded.role };
  } catch {
    return null;
  }
}

// ---- Yemen Phone Validation ----

/**
 * Validate a Yemen phone number.
 * Accepts formats: 7XXXXXXXX, +9677XXXXXXXXX, 9677XXXXXXXXX
 */
export function validateYemeniPhone(phone: string): boolean {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (/^7\d{8}$/.test(cleaned)) return true;
  if (/^\+9677\d{8}$/.test(cleaned)) return true;
  if (/^9677\d{8}$/.test(cleaned)) return true;
  return false;
}

/**
 * Normalize a Yemen phone number to local format: 7XXXXXXXX
 */
export function normalizeYemeniPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+967')) return cleaned.slice(4);
  if (cleaned.startsWith('967')) return cleaned.slice(3);
  return cleaned;
}

/**
 * Format a Yemen phone number to international format: +967XXXXXXXXX
 */
export function formatYemeniPhone(phone: string): string {
  return `+967${normalizeYemeniPhone(phone)}`;
}

// ---- Cookie Helpers ----

/**
 * Create a Set-Cookie header value for the auth token.
 */
export function createAuthCookie(token: string, maxAge: number = 7 * 24 * 60 * 60): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const secure = isProduction ? '; Secure' : '';
  return `auth_token=${encodeURIComponent(token)}; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=${maxAge}`;
}

/**
 * Create a Set-Cookie header value that clears the auth token.
 */
export function createClearAuthCookie(): string {
  const isProduction = process.env.NODE_ENV === 'production';
  const secure = isProduction ? '; Secure' : '';
  return `auth_token=; HttpOnly${secure}; SameSite=Lax; Path=/; Max-Age=0`;
}

// ---- Error Response Helper ----

/**
 * Create a standard error response.
 */
export function createErrorResponse(message: string, status: number, code: string): Response {
  return Response.json({ success: false, error: { message, code } }, { status });
}

// ---- Referral Code Generator ----

/**
 * Generate a cryptographically secure referral code with prefix AFK-.
 * Uses crypto.getRandomValues() instead of Math.random() for unpredictability.
 */
export function generateReferralCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = new Uint8Array(6);
  crypto.getRandomValues(bytes);
  let code = 'AFK-';
  for (let i = 0; i < 6; i++) {
    code += chars[bytes[i] % chars.length];
  }
  return code;
}

// ---- Role Helpers ----

/**
 * Check if a role string is a valid role.
 */
export function isValidRole(role: string): role is 'admin' | 'subadmin' | 'nurse' | 'beneficiary' {
  return ['admin', 'subadmin', 'nurse', 'beneficiary'].includes(role);
}
