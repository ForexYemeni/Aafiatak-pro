// POST /api/auth/login - User login with phone and password
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest, NextResponse } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models/mongoose/User';
import {
  verifyPassword,
  generateToken,
  generateRefreshToken,
  validateYemeniPhone,
  normalizeYemeniPhone,
  createErrorResponse,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { phone, password } = await request.json();

    if (!phone || !password) {
      return createErrorResponse('رقم الهاتف وكلمة المرور مطلوبان', 400, 'VALIDATION_ERROR');
    }

    if (!validateYemeniPhone(phone)) {
      return createErrorResponse('رقم الهاتف غير صالح. يجب أن يبدأ بـ 7 ويتكون من 9 أرقام', 400, 'VALIDATION_ERROR');
    }

    const normalizedPhone = normalizeYemeniPhone(phone);

    // Search in the users collection directly using the base User model
    const user = await User.findOne({ phone: normalizedPhone }).lean();

    if (!user) {
      return createErrorResponse('رقم الهاتف أو كلمة المرور غير صحيحة', 401, 'INVALID_CREDENTIALS');
    }

    if (!user.isActive) {
      return createErrorResponse('الحساب معطل. يرجى التواصل مع الإدارة', 403, 'ACCOUNT_DISABLED');
    }

    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return createErrorResponse('رقم الهاتف أو كلمة المرور غير صحيحة', 401, 'INVALID_CREDENTIALS');
    }

    const tokenPayload = {
      userId: user._id.toString(),
      phone: user.phone,
      role: user.role,
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Update last login (non-critical)
    try {
      await User.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
    } catch {}

    const responseData = {
      user: {
        id: user._id.toString(),
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
        permissions: user.permissions || [],
      },
      token,
      refreshToken,
    };

    const response = NextResponse.json(
      { success: true, data: responseData, message: 'تم تسجيل الدخول بنجاح' },
      { status: 200 }
    );

    // Use NextResponse.cookies.set() for proper cookie handling on Vercel
    // This ensures the cookie is properly set across all Vercel edge functions
    const isProduction = process.env.NODE_ENV === 'production';
    response.cookies.set('auth_token', token, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60, // 7 days
    });

    return response;
  } catch (error) {
    console.error('[AUTH LOGIN ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تسجيل الدخول', 500, 'INTERNAL_ERROR');
  }
}
