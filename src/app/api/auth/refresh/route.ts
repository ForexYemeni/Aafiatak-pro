import { NextRequest, NextResponse } from 'next/server';
import { verifyRefreshToken, generateToken, generateRefreshToken } from '@/lib/auth';
import { createAuthCookie, createErrorResponse } from '@/lib/auth/middleware';
import type { RefreshTokenRequest, RefreshTokenResponse } from '@/types';

// ---- POST /api/auth/refresh ----

export async function POST(request: NextRequest) {
  try {
    const body: RefreshTokenRequest = await request.json();
    const { refreshToken } = body;

    if (!refreshToken) {
      return createErrorResponse('رمز التحديث مطلوب', 400, 'VALIDATION_ERROR');
    }

    // Verify the refresh token
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return createErrorResponse('رمز التحديث غير صالح أو منتهي الصلاحية', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Generate new tokens
    const newToken = generateToken({
      userId: payload.userId,
      phone: payload.phone,
      role: payload.role,
    });

    const newRefreshToken = generateRefreshToken({
      userId: payload.userId,
      phone: payload.phone,
      role: payload.role,
    });

    const responseData: RefreshTokenResponse = {
      token: newToken,
      refreshToken: newRefreshToken,
    };

    const response = NextResponse.json(
      { success: true, data: responseData, message: 'تم تجديد رمز المصادقة بنجاح' },
      { status: 200 }
    );

    // Set new auth cookie
    response.headers.set('Set-Cookie', createAuthCookie(newToken));

    return response;
  } catch (error) {
    console.error('[AUTH REFRESH ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تجديد رمز المصادقة', 500, 'INTERNAL_ERROR');
  }
}
