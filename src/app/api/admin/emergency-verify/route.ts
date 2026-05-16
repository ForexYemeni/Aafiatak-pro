// GET /api/admin/emergency-verify
// ═══════════════════════════════════════════════════════════════════════
// Verify an emergency backup/restore token.
// Returns admin info if the token is valid and not expired.
// ═══════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { createErrorResponse } from '@/lib/auth/middleware';
import { connectDB } from '@/lib/mongodb';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET ?? '';

interface EmergencyTokenPayload {
  type: string;
  userId: string;
  role: string;
  iat: number;
  exp: number;
}

export async function GET(request: NextRequest) {
  try {
    // ── Extract token from query or Authorization header ─────────────
    let token = request.nextUrl.searchParams.get('token');

    if (!token) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        const bearerToken = authHeader.substring(7);
        // Only accept emergency tokens from Bearer header
        if (bearerToken) {
          token = bearerToken;
        }
      }
    }

    if (!token) {
      return createErrorResponse('رمز الطوارئ مطلوب', 401, 'TOKEN_REQUIRED');
    }

    // ── Verify token ─────────────────────────────────────────────────
    let decoded: EmergencyTokenPayload;
    try {
      decoded = jwt.verify(token, JWT_SECRET) as EmergencyTokenPayload;
    } catch {
      return createErrorResponse('رمز الطوارئ غير صالح أو منتهي الصلاحية', 401, 'INVALID_TOKEN');
    }

    // ── Validate token type ──────────────────────────────────────────
    if (decoded.type !== 'emergency') {
      return createErrorResponse('نوع الرمز غير صالح', 401, 'INVALID_TOKEN_TYPE');
    }

    // ── Fetch admin info ─────────────────────────────────────────────
    await connectDB();
    const { User } = await import('@/models/mongoose/User');
    const admin = await User.findById(decoded.userId).select('name phone role').lean();

    if (!admin || admin.role !== 'admin') {
      return createErrorResponse('حساب الإدارة غير موجود', 404, 'ADMIN_NOT_FOUND');
    }

    // ── Calculate remaining time ─────────────────────────────────────
    const now = Math.floor(Date.now() / 1000);
    const remainingSeconds = decoded.exp - now;

    // ── Return admin info ────────────────────────────────────────────
    return Response.json({
      success: true,
      admin: {
        name: admin.name,
        phone: admin.phone,
      },
      expiresIn: remainingSeconds,
    });

  } catch (err) {
    console.error('[EMERGENCY VERIFY ERROR]', err);
    return createErrorResponse('حدث خطأ في التحقق من رمز الطوارئ', 500, 'INTERNAL_ERROR');
  }
}
