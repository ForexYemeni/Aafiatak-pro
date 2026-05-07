// POST /api/auth/login - User login with phone and password
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User, Nurse, Beneficiary } from '@/models/mongoose';
import {
  verifyPassword,
  generateToken,
  generateRefreshToken,
  validateYemeniPhone,
  normalizeYemeniPhone,
  createAuthCookie,
  createErrorResponse,
} from '@/lib/auth';
import { logActivity } from '@/lib/api/helpers';

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

    // Search across all user collections using Mongoose discriminator models
    let user: any = null;

    // Check Nurse first (most common login)
    user = await Nurse.findOne({ phone: normalizedPhone }).lean();
    if (!user) {
      // Check Beneficiary
      user = await Beneficiary.findOne({ phone: normalizedPhone }).lean();
    }
    if (!user) {
      // Check base User (admin/subadmin)
      user = await User.findOne({ phone: normalizedPhone }).lean();
    }

    if (!user) {
      return createErrorResponse('رقم الهاتف أو كلمة المرور غير صحيحة', 401, 'INVALID_CREDENTIALS');
    }

    // Check if account is active
    if (!user.isActive) {
      return createErrorResponse('الحساب معطل. يرجى التواصل مع الإدارة', 403, 'ACCOUNT_DISABLED');
    }

    // Verify password
    const isValid = await verifyPassword(password, user.password);
    if (!isValid) {
      return createErrorResponse('رقم الهاتف أو كلمة المرور غير صحيحة', 401, 'INVALID_CREDENTIALS');
    }

    // Generate tokens
    const tokenPayload = {
      userId: user._id.toString(),
      phone: user.phone,
      role: user.role,
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Update last login
    try {
      const Model = user.role === 'nurse' ? Nurse : user.role === 'beneficiary' ? Beneficiary : User;
      await Model.findByIdAndUpdate(user._id, { lastLoginAt: new Date() });
    } catch {
      // Non-critical update
    }

    // Log activity
    await logActivity({
      userId: user._id.toString(),
      userRole: user.role,
      action: 'login',
      details: 'تسجيل دخول ناجح',
      request,
    });

    // Build response
    const responseData = {
      user: {
        id: user._id.toString(),
        name: user.name,
        phone: user.phone,
        role: user.role,
        isActive: user.isActive,
      },
      token,
      refreshToken,
    };

    const response = Response.json(
      { success: true, data: responseData, message: 'تم تسجيل الدخول بنجاح' },
      { status: 200 }
    );

    response.headers.set('Set-Cookie', createAuthCookie(token));
    return response;
  } catch (error) {
    console.error('[AUTH LOGIN ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تسجيل الدخول', 500, 'INTERNAL_ERROR');
  }
}
