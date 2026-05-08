// ============================================================================
// عافيتك (Aafiatak) Auth Middleware - MongoDB/Mongoose based
// ============================================================================
// Authentication middleware for Next.js API routes
// NO Firebase, NO Prisma - MongoDB only
// ============================================================================

import { NextRequest } from 'next/server';
import { verifyToken, createErrorResponse } from './index';
import type { SubAdminPermission } from '@/types';

// Re-export createErrorResponse for convenience in API routes
export { createErrorResponse } from './index';

// ---- Permission to route mapping ----
// Maps each subadmin permission to the admin API route paths it should access

/**
 * Permission mapping: which permission is required for each admin route prefix.
 * Used by requireSubadminPermission to check if a subadmin has access to a specific route.
 */
const ROUTE_PERMISSION_MAP: Record<string, SubAdminPermission> = {
  '/api/admin/nurses': 'manage_nurses',
  '/api/admin/beneficiaries': 'manage_beneficiaries',
  '/api/admin/orders': 'manage_orders',
  '/api/admin/emergencies': 'manage_emergencies',
  '/api/admin/payments': 'manage_payments',
  '/api/admin/transactions': 'manage_payments',
  '/api/admin/coupons': 'manage_payments',
  '/api/admin/services': 'manage_services',
  '/api/admin/complaints': 'manage_chat',
  '/api/admin/chat': 'manage_chat',
  '/api/admin/ratings': 'view_reports',
  '/api/admin/reports': 'view_reports',
  '/api/admin/activity-log': 'view_reports',
  '/api/admin/dashboard': 'view_reports',
  '/api/admin/settings': 'manage_settings',
  '/api/admin/subadmins': 'manage_settings', // Only admin can actually manage subadmins, but view requires manage_settings
};

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

// ---- Get Subadmin Permissions from DB ----

/**
 * Fetch subadmin permissions from the database.
 * Returns null if user is not a subadmin or if permissions can't be fetched.
 */
async function getSubadminPermissions(userId: string): Promise<SubAdminPermission[] | null> {
  try {
    const { connectDB } = await import('@/lib/mongodb');
    const { User } = await import('@/models/mongoose/User');
    await connectDB();
    const user = await User.findById(userId).select('permissions role').lean();
    if (!user || user.role !== 'subadmin') return null;
    return user.permissions || [];
  } catch {
    return null;
  }
}

// ---- Require Subadmin Permission ----

/**
 * Require a specific subadmin permission.
 * Admins always pass. Subadmins must have the specified permission.
 * Other roles are rejected.
 */
export async function requireSubadminPermission(
  request: NextRequest,
  permission: SubAdminPermission,
  allowedBaseRoles: string[] = ['admin', 'subadmin']
): Promise<{
  user: { userId: string; phone: string; role: string };
  error: null;
} | {
  user: null;
  error: Response;
}> {
  const result = requireRole(request, allowedBaseRoles);
  if (result.error) return result;

  // Admins always have full access
  if (result.user.role === 'admin') {
    return result;
  }

  // Subadmins need the specific permission
  if (result.user.role === 'subadmin') {
    const permissions = await getSubadminPermissions(result.user.userId);
    if (!permissions || !permissions.includes(permission)) {
      return {
        user: null,
        error: createErrorResponse('ليس لديك صلاحية كافية لهذا الإجراء', 403, 'INSUFFICIENT_PERMISSIONS'),
      };
    }
    return result;
  }

  return {
    user: null,
    error: createErrorResponse('ليس لديك صلاحية لهذا الإجراء', 403, 'FORBIDDEN'),
  };
}
