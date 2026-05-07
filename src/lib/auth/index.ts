import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { TokenPayload, UserRole } from '@/types';

// ---- Constants ----
const SALT_ROUNDS = 12;
const JWT_EXPIRY = process.env.JWT_EXPIRY ?? '7d';
const JWT_REFRESH_EXPIRY = process.env.JWT_REFRESH_EXPIRY ?? '30d';
const JWT_SECRET = process.env.JWT_SECRET ?? 'aafiatak-dev-jwt-secret-change-in-production';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET ?? 'aafiatak-dev-refresh-secret-change-in-production';

// ---- Password Hashing ----

/**
 * Hash a plaintext password using bcryptjs with 12 salt rounds.
 */
export async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(SALT_ROUNDS);
  const hash = await bcrypt.hash(password, salt);
  return hash;
}

/**
 * Verify a plaintext password against a stored bcrypt hash.
 */
export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// ---- JWT Token Generation ----

/**
 * Generate a JWT access token with 7d expiry.
 */
export function generateToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRY } as jwt.SignOptions);
}

/**
 * Generate a JWT refresh token with 30d expiry.
 */
export function generateRefreshToken(payload: TokenPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: JWT_REFRESH_EXPIRY } as jwt.SignOptions);
}

/**
 * Verify and decode a JWT access token.
 * Returns the decoded payload or null if invalid/expired.
 */
export function verifyToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return {
      userId: decoded.userId,
      phone: decoded.phone,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

/**
 * Verify and decode a JWT refresh token.
 * Returns the decoded payload or null if invalid/expired.
 */
export function verifyRefreshToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET) as TokenPayload;
    return {
      userId: decoded.userId,
      phone: decoded.phone,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

// ---- Yemen Phone Validation ----

/**
 * Validate a Yemen phone number.
 * Accepts formats: 7XXXXXXXX (9 digits starting with 7)
 * Also accepts +9677XXXXXXXXX and 9677XXXXXXXXX
 */
export function validateYemeniPhone(phone: string): boolean {
  // Remove all whitespace and dashes
  const cleaned = phone.replace(/[\s\-]/g, '');

  // Format: 7XXXXXXXX (9 digits starting with 7)
  if (/^7\d{8}$/.test(cleaned)) {
    return true;
  }

  // Format: +9677XXXXXXXXX
  if (/^\+9677\d{7}$/.test(cleaned)) {
    return true;
  }

  // Format: 9677XXXXXXXXX
  if (/^9677\d{7}$/.test(cleaned)) {
    return true;
  }

  return false;
}

/**
 * Format a Yemen phone number to international format: +967XXXXXXXXX
 * Input can be: 7XXXXXXXX, 9677XXXXXXXXX, or +9677XXXXXXXXX
 */
export function formatYemeniPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-]/g, '');

  // Already in international format with +
  if (cleaned.startsWith('+967')) {
    return cleaned;
  }

  // Starts with 967 without +
  if (cleaned.startsWith('967')) {
    return `+${cleaned}`;
  }

  // Starts with 7 (local format)
  if (cleaned.startsWith('7')) {
    return `+967${cleaned}`;
  }

  // Fallback: return with +967 prefix
  return `+967${cleaned}`;
}

/**
 * Normalize a Yemen phone number to local format: 7XXXXXXXX
 * Useful for database lookups.
 */
export function normalizeYemeniPhone(phone: string): string {
  const cleaned = phone.replace(/[\s\-]/g, '');

  // Strip +967 or 967 prefix
  if (cleaned.startsWith('+967')) {
    return cleaned.slice(4);
  }

  if (cleaned.startsWith('967')) {
    return cleaned.slice(3);
  }

  return cleaned;
}

// ---- Role Helpers ----

/**
 * Check if a role string is a valid UserRole.
 */
export function isValidRole(role: string): role is UserRole {
  return ['admin', 'subadmin', 'nurse', 'beneficiary'].includes(role);
}

/**
 * Get the Prisma model name for a given role.
 */
export function getPrismaModelForRole(role: UserRole): 'admin' | 'subAdmin' | 'nurse' | 'beneficiary' {
  const mapping: Record<UserRole, 'admin' | 'subAdmin' | 'nurse' | 'beneficiary'> = {
    admin: 'admin',
    subadmin: 'subAdmin',
    nurse: 'nurse',
    beneficiary: 'beneficiary',
  };
  return mapping[role];
}
