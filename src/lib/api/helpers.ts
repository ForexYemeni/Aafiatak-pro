// ============================================================================
// عافيتك API Helpers - Shared utilities for all API route handlers
// ============================================================================
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// ============================================================================

import { connectDB } from '@/lib/mongodb';
import { ActivityLog, Nurse, Transaction } from '@/models/mongoose';
import { verifyToken } from '@/lib/auth';
import type { PaginationMeta } from '@/types';

// ---- Response Helpers ----

/**
 * Create a success API response with standard format.
 */
export function successResponse<T>(data: T, message?: string, status: number = 200): Response {
  const body: Record<string, unknown> = {
    success: true,
    data,
  };
  if (message) {
    body.message = message;
  }
  return Response.json(body, { status });
}

/**
 * Create a paginated success API response with data array and pagination metadata.
 */
export function paginatedResponse<T>(
  data: T[],
  pagination: PaginationMeta,
  message?: string,
  status: number = 200
): Response {
  const body: Record<string, unknown> = {
    success: true,
    data,
    pagination,
  };
  if (message) {
    body.message = message;
  }
  return Response.json(body, { status });
}

/**
 * Create an error API response with standard format.
 */
export function errorResponse(message: string, status: number, errorCode?: string): Response {
  const body: Record<string, unknown> = {
    success: false,
    error: errorCode ?? 'ERROR',
    message,
    statusCode: status,
  };
  return Response.json(body, { status });
}

// ---- Pagination Helper ----

/**
 * Calculate pagination metadata.
 */
export function paginate(params: { page: number; limit: number; total: number }): PaginationMeta {
  const { page, limit, total } = params;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return {
    page: Math.max(1, page),
    limit: Math.max(1, Math.min(100, limit)),
    total,
    totalPages,
  };
}

/**
 * Parse pagination params from URL search params.
 */
export function parsePagination(url: URL): { page: number; limit: number; skip: number } {
  const page = Math.max(1, parseInt(url.searchParams.get('page') ?? '1', 10) || 1);
  const limit = Math.max(1, Math.min(100, parseInt(url.searchParams.get('limit') ?? '20', 10) || 20));
  const skip = (page - 1) * limit;
  return { page, limit, skip };
}

// ---- Auth Helper ----

/**
 * Extract and verify the authenticated user from the request.
 * Returns TokenPayload or null if unauthenticated.
 */
export function getAuthUserFromRequest(request: Request): { userId: string; phone: string; role: string } | null {
  let token: string | null = null;

  // Try Authorization header
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    token = authHeader.slice(7).trim();
  }

  // Try cookie
  if (!token) {
    const cookieHeader = request.headers.get('Cookie');
    if (cookieHeader) {
      const cookies = parseCookies(cookieHeader);
      if (cookies['auth_token']) {
        token = cookies['auth_token'];
      }
    }
  }

  if (!token) return null;

  const payload = verifyToken(token);
  return payload;
}

/**
 * Require authentication. Returns user payload or throws an error response.
 */
export function requireAuthFromRequest(request: Request): { userId: string; phone: string; role: string } {
  const user = getAuthUserFromRequest(request);
  if (!user) {
    throw new AuthApiError('غير مصرح. يرجى تسجيل الدخول', 401);
  }
  return user;
}

/**
 * Require authentication with specific role(s).
 */
export function requireRoleFromRequest(request: Request, ...roles: string[]): { userId: string; phone: string; role: string } {
  const user = requireAuthFromRequest(request);
  if (!roles.includes(user.role)) {
    throw new AuthApiError('ليس لديك صلاحية للوصول إلى هذا المورد', 403);
  }
  return user;
}

// ---- Activity Log Helper ----

/**
 * Log an activity to the ActivityLog collection.
 */
export async function logActivity(params: {
  userId: string;
  userRole: string;
  action: string;
  entity?: string;
  entityId?: string;
  details?: string;
  request?: Request;
}): Promise<void> {
  try {
    await connectDB();
    const ipAddress = params.request
      ? (params.request.headers.get('x-forwarded-for') ?? params.request.headers.get('x-real-ip') ?? 'unknown')
      : 'unknown';

    await ActivityLog.create({
      userId: params.userId,
      userRole: params.userRole,
      action: params.action,
      entity: params.entity,
      entityId: params.entityId,
      details: params.details,
      ipAddress: ipAddress.split(',')[0]?.trim() ?? 'unknown',
    });
  } catch {
    // Activity logging should never block the main operation
  }
}

// ---- JSON Helpers ----

/**
 * Safely parse a JSON string, returning default value on failure.
 */
export function safeJsonParse<T>(json: string | null | undefined, defaultValue: T): T {
  if (!json) return defaultValue;
  try {
    return JSON.parse(json) as T;
  } catch {
    return defaultValue;
  }
}

// ---- Error Class ----

/**
 * Custom API error that can be caught and converted to an error response.
 */
export class AuthApiError extends Error {
  public readonly statusCode: number;

  constructor(message: string, statusCode: number = 400) {
    super(message);
    this.name = 'AuthApiError';
    this.statusCode = statusCode;
  }
}

/**
 * Handle an API error, converting AuthApiError to proper responses or returning a generic 500.
 */
export function handleApiError(error: unknown): Response {
  if (error instanceof AuthApiError) {
    return errorResponse(error.message, error.statusCode, 'API_ERROR');
  }

  if (error instanceof Error && 'statusCode' in error) {
    const authError = error as { statusCode: number; message: string };
    return errorResponse(authError.message, authError.statusCode, 'AUTH_ERROR');
  }

  console.error('[API ERROR]', error);
  return errorResponse('حدث خطأ غير متوقع', 500, 'INTERNAL_ERROR');
}

// ---- Cookie Parser ----

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

// ---- Validation Helpers ----

/**
 * Validate that required fields exist in the request body.
 */
export function validateRequired(body: Record<string, unknown>, fields: string[]): string | null {
  for (const field of fields) {
    if (body[field] === undefined || body[field] === null || body[field] === '') {
      return `الحقل "${field}" مطلوب`;
    }
  }
  return null;
}

/**
 * Calculate pricing for a service request.
 */
export function calculatePricing(params: {
  basePrice: number;
  isEmergency: boolean;
  isNightService: boolean;
  isFridayService: boolean;
  commissionRate: number;
  emergencyFee: number;
  nightFeePercent: number;
  fridayFeePercent: number;
  loyaltyDiscount?: number;
  couponDiscount?: number;
}): {
  basePrice: number;
  nightFee: number;
  fridayFee: number;
  emergencyFee: number;
  discount: number;
  loyaltyDiscount: number;
  couponDiscount: number;
  totalPrice: number;
  commission: number;
  nursePayout: number;
} {
  const nightFee = params.isNightService ? params.basePrice * (params.nightFeePercent / 100) : 0;
  const fridayFee = params.isFridayService ? params.basePrice * (params.fridayFeePercent / 100) : 0;
  const emergencyFee = params.isEmergency ? params.emergencyFee : 0;
  const loyaltyDiscount = params.loyaltyDiscount ?? 0;
  const couponDiscount = params.couponDiscount ?? 0;

  const subtotal = params.basePrice + nightFee + fridayFee + emergencyFee;
  const totalPrice = Math.max(0, subtotal - loyaltyDiscount - couponDiscount);
  const commission = totalPrice * (params.commissionRate / 100);
  const nursePayout = totalPrice - commission;

  return {
    basePrice: params.basePrice,
    nightFee,
    fridayFee,
    emergencyFee,
    discount: 0,
    loyaltyDiscount,
    couponDiscount,
    totalPrice: Math.round(totalPrice),
    commission: Math.round(commission),
    nursePayout: Math.round(nursePayout),
  };
}

// ---- Nurse Earnings Credit Helper ----

/**
 * Credit nurse earnings when an order is completed.
 * Updates nurse.totalEarnings, nurse.availableBalance, nurse.completedJobs,
 * and creates a Transaction record.
 * Guarded against double-credit by checking if a Transaction already exists for this requestId.
 */
export async function creditNurseEarnings(params: {
  requestId: string;
  nurseId: string;
  beneficiaryId: string;
  amount: number;
  commission: number;
  nursePayout: number;
  paymentMethod?: string;
}): Promise<void> {
  try {
    // Guard against double-credit
    const existingTx = await Transaction.findOne({ requestId: params.requestId });
    if (existingTx) {
      // Already credited, skip
      return;
    }

    // Update nurse earnings
    const nurse = await Nurse.findById(params.nurseId);
    if (!nurse) return;

    nurse.totalEarnings += params.nursePayout;
    nurse.availableBalance += params.nursePayout;
    nurse.completedJobs += 1;
    await nurse.save();

    // Create transaction record
    await Transaction.create({
      requestId: params.requestId,
      beneficiaryId: params.beneficiaryId,
      nurseId: params.nurseId,
      amount: params.amount,
      commission: params.commission,
      netAmount: params.nursePayout,
      paymentMethod: params.paymentMethod || 'cash',
      status: 'completed',
    });
  } catch (error) {
    console.error('[CREDIT NURSE EARNINGS ERROR]', error);
    // Don't throw - we don't want to block order completion
  }
}
