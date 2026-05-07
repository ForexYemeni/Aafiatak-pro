// POST /api/auth/register/beneficiary - Register new beneficiary
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Beneficiary } from '@/models/mongoose';
import {
  hashPassword,
  validateYemeniPhone,
  normalizeYemeniPhone,
  generateReferralCode,
  generateToken,
  generateRefreshToken,
  createAuthCookie,
  createErrorResponse,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { name, phone, password, governorate, district, address, referralCode: usedReferralCode } = await request.json();

    if (!name || !phone || !password) {
      return createErrorResponse('الاسم ورقم الهاتف وكلمة المرور مطلوبون', 400, 'VALIDATION_ERROR');
    }

    if (!validateYemeniPhone(phone)) {
      return createErrorResponse('رقم الهاتف غير صالح. يجب أن يبدأ بـ 7 ويتكون من 9 أرقام', 400, 'VALIDATION_ERROR');
    }

    if (password.length < 6) {
      return createErrorResponse('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 400, 'VALIDATION_ERROR');
    }

    const normalizedPhone = normalizeYemeniPhone(phone);

    // Check if phone already exists
    const existing = await Beneficiary.findOne({ phone: normalizedPhone });
    if (existing) {
      return createErrorResponse('رقم الهاتف مسجل بالفعل', 409, 'PHONE_EXISTS');
    }

    const hashedPassword = await hashPassword(password);
    const referralCode = generateReferralCode();

    const beneficiary = await Beneficiary.create({
      name,
      phone: normalizedPhone,
      password: hashedPassword,
      role: 'beneficiary',
      referralCode,
      referredBy: usedReferralCode || undefined,
      governorate,
      district,
      address,
      isActive: true,
    });

    // Generate tokens for auto-login
    const tokenPayload = {
      userId: beneficiary._id.toString(),
      phone: beneficiary.phone,
      role: beneficiary.role,
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const responseData = {
      user: {
        id: beneficiary._id.toString(),
        name: beneficiary.name,
        phone: beneficiary.phone,
        role: beneficiary.role,
        referralCode: beneficiary.referralCode,
        governorate: beneficiary.governorate,
        district: beneficiary.district,
        isActive: beneficiary.isActive,
      },
      token,
      refreshToken,
    };

    const response = Response.json(
      { success: true, data: responseData, message: 'تم إنشاء الحساب بنجاح' },
      { status: 201 }
    );

    response.headers.set('Set-Cookie', createAuthCookie(token));
    return response;
  } catch (error) {
    console.error('[REGISTER BENEFICIARY ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إنشاء الحساب', 500, 'INTERNAL_ERROR');
  }
}
