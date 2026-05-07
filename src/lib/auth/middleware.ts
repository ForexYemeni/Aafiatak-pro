import { verifyToken } from '@/lib/auth';
import type { AuthenticatedRequest, UserRole, TokenPayload, ApiResponse } from '@/types';

// ---- Authenticate Request ----

/**
 * Extract and verify JWT from Authorization header or cookies.
 * Returns an AuthenticatedRequest with the decoded user payload.
 * Throws an Error if no valid token is found.
 */
export async function authenticateRequest(request: Request): Promise<AuthenticatedRequest> {
  let token: string | null = null;

  // 1. Try Authorization header (Bearer token)
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // 2. Try cookie
  if (!token) {
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
      const cookies = parseCookies(cookieHeader);
      if (cookies['auth-token']) {
        token = cookies['auth-token'];
      }
    }
  }

  // 3. No token found
  if (!token) {
    throw new AuthError('لم يتم العثور على رمز المصادقة', 401);
  }

  // 4. Verify token
  const payload = verifyToken(token);
  if (!payload) {
    throw new AuthError('رمز المصادقة غير صالح أو منتهي الصلاحية', 401);
  }

  // 5. Return authenticated request
  const authenticatedRequest = Object.create(request, {
    user: {
      value: payload,
      writable: false,
      configurable: false,
    },
  }) as AuthenticatedRequest;

  return authenticatedRequest;
}

// ---- Require Role ----

/**
 * Higher-order function that checks if the authenticated user has the required role.
 * Returns a function that takes a request and returns the authenticated user if authorized,
 * or throws an AuthError if not.
 */
export function requireRole(...roles: UserRole[]) {
  return async (request: Request): Promise<AuthenticatedRequest> => {
    const authenticatedReq = await authenticateRequest(request);

    if (!roles.includes(authenticatedReq.user.role)) {
      throw new AuthError('ليس لديك صلاحية للوصول إلى هذا المورد', 403);
    }

    return authenticatedReq;
  };
}

// ---- Create Auth Response ----

/**
 * Create a JSON response with standard API response format.
 */
export function createAuthResponse(data: unknown, status: number = 200): Response {
  const responseBody: ApiResponse<unknown> = {
    success: true,
    data,
  };

  return new Response(JSON.stringify(responseBody), {
    status,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

/**
 * Create an error response with standard API response format.
 */
export function createErrorResponse(message: string, statusCode: number, error?: string): Response {
  const responseBody: ApiResponse<never> = {
    success: false,
    error: error ?? 'AUTH_ERROR',
    message,
    statusCode,
  };

  return new Response(JSON.stringify(responseBody), {
    status: statusCode,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}

// ---- Custom Auth Error ----

export class AuthError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

// ---- Cookie Helpers ----

/**
 * Parse a cookie header string into a key-value object.
 */
function parseCookies(cookieHeader: string): Record<string, string> {
  const cookies: Record<string, string> = {};

  const pairs = cookieHeader.split(';');
  for (const pair of pairs) {
    const trimmed = pair.trim();
    const eqIndex = trimmed.indexOf('=');
    if (eqIndex > 0) {
      const key = trimmed.slice(0, eqIndex).trim();
      const value = trimmed.slice(eqIndex + 1).trim();
      cookies[key] = decodeURIComponent(value);
    }
  }

  return cookies;
}

/**
 * Create a Set-Cookie header value for the auth token.
 */
export function createAuthCookie(token: string, maxAge: number = 7 * 24 * 60 * 60): string {
  return `auth-token=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${maxAge}`;
}

/**
 * Create a Set-Cookie header value that clears the auth token.
 */
export function createClearAuthCookie(): string {
  return 'auth-token=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0';
}

// ---- Extract User from Request (utility) ----

/**
 * Extract the TokenPayload from a request, or return null if unauthenticated.
 * Does not throw - useful for optional auth scenarios.
 */
export async function extractUserFromRequest(request: Request): Promise<TokenPayload | null> {
  try {
    const authenticatedReq = await authenticateRequest(request);
    return authenticatedReq.user;
  } catch {
    return null;
  }
}
