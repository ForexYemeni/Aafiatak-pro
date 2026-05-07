// ============================================================================
// عافيتك (Aafiatak) Auth Middleware - MongoDB/Mongoose based
// ============================================================================
// Authentication middleware for Next.js API routes
// NO Firebase, NO Prisma - MongoDB only
// ============================================================================

import { NextRequest } from 'next/server';
import { verifyToken, createErrorResponse } from './index';

// Re-export createErrorResponse for convenience in API routes
export { createErrorResponse } from './index';

// ---- Get Auth User ----

/**
 * Extract and verify JWT from Authorization header or cookies.
 * Returns the decoded user payload or null if unauthenticated.
 */
export function getAuthUser(request: NextRequest): { userId: string; phone: string; role: string } | null {
  // 1. Try Authorization header (Bearer token)
  const authHeader = request.headers.get('Authorization');
  let token: string | null = null;

  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.substring(7);
  }

  // 2. Try cookie
  if (!token) {
    const cookieToken = request.cookies.get('auth_token')?.value;
    if (cookieToken) {
      token = cookieToken;
    }
  }

  // 3. No token found
  if (!token) return null;

  // 4. Verify token
  const payload = verifyToken(token);
  if (!payload) return null;

  return payload;
}

// ---- Require Auth ----

/**
 * Require authentication. Returns user payload or an error response.
 */
export function requireAuth(request: NextRequest): {
  user: { userId: string; phone: string; role: string };
  error: null;
} | {
  user: null;
  error: Response;
} {
  const user = getAuthUser(request);
  if (!user) {
    return {
      user: null,
      error: createErrorResponse('غير مصرح. يرجى تسجيل الدخول', 401, 'UNAUTHORIZED'),
    };
  }
  return { user, error: null };
}

// ---- Require Role ----

/**
 * Require authentication with specific role(s).
 * Returns user payload if authorized, or an error response.
 */
export function requireRole(request: NextRequest, roles: string[]): {
  user: { userId: string; phone: string; role: string };
  error: null;
} | {
  user: null;
  error: Response;
} {
  const result = requireAuth(request);
  if (result.error) return result;

  if (!roles.includes(result.user.role)) {
    return {
      user: null,
      error: createErrorResponse('ليس لديك صلاحية لهذا الإجراء', 403, 'FORBIDDEN'),
    };
  }

  return result;
}
