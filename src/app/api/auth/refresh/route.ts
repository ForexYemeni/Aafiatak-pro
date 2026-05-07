// POST /api/auth/refresh - Refresh JWT access token
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User, Nurse, Beneficiary } from '@/models/mongoose';
import {
  verifyRefreshToken,
  generateToken,
  generateRefreshToken,
  createAuthCookie,
  createErrorResponse,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { refreshToken } = await request.json();

    if (!refreshToken) {
      return createErrorResponse('رمز التحديث مطلوب', 400, 'VALIDATION_ERROR');
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      return createErrorResponse('رمز التحديث غير صالح أو منتهي الصلاحية', 401, 'INVALID_REFRESH_TOKEN');
    }

    // Verify user still exists and is active
    let user: any = null;
    if (payload.role === 'nurse') {
      user = await Nurse.findById(payload.userId).select('-password').lean();
    } else if (payload.role === 'beneficiary') {
      user = await Beneficiary.findById(payload.userId).select('-password').lean();
    } else {
      user = await User.findById(payload.userId).select('-password').lean();
    }

    if (!user || !user.isActive) {
      return createErrorResponse('الحساب غير موجود أو معطل', 401, 'ACCOUNT_INVALID');
    }

    // Generate new tokens
    const newTokenPayload = {
      userId: user._id.toString(),
      phone: user.phone,
      role: user.role,
    };

    const newToken = generateToken(newTokenPayload);
    const newRefreshToken = generateRefreshToken(newTokenPayload);

    const response = Response.json({
      success: true,
      data: {
        token: newToken,
        refreshToken: newRefreshToken,
      },
      message: 'تم تجديد الرمز بنجاح',
    });

    response.headers.set('Set-Cookie', createAuthCookie(newToken));
    return response;
  } catch (error) {
    console.error('[AUTH REFRESH ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تجديد الرمز', 500, 'INTERNAL_ERROR');
  }
}
