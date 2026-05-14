// POST /api/auth/register/nurse - Register new nurse
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse } from '@/models/mongoose';
import {
  hashPassword,
  validateYemeniPhone,
  normalizeYemeniPhone,
  generateToken,
  generateRefreshToken,
  createAuthCookie,
  createErrorResponse,
} from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { name, phone, password, specialization, experience, governorate, district, licenseNumber, address } = await request.json();

    if (!name || !phone || !password) {
      return createErrorResponse('الاسم ورقم الهاتف وكلمة المرور مطلوبون', 400, 'VALIDATION_ERROR');
    }

    if (!validateYemeniPhone(phone)) {
      return createErrorResponse('رقم الهاتف غير صالح. يجب أن يبدأ بـ 7 ويتكون من 9 أرقام', 400, 'VALIDATION_ERROR');
    }

    if (password.length < 8) {
      return createErrorResponse('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 400, 'VALIDATION_ERROR');
    }

    const normalizedPhone = normalizeYemeniPhone(phone);

    // Check if phone already exists
    const existing = await Nurse.findOne({ phone: normalizedPhone });
    if (existing) {
      return createErrorResponse('رقم الهاتف مسجل بالفعل', 409, 'PHONE_EXISTS');
    }

    const hashedPassword = await hashPassword(password);

    const nurse = await Nurse.create({
      name,
      phone: normalizedPhone,
      password: hashedPassword,
      role: 'nurse',
      specialization: specialization || [],
      experience: experience || 0,
      governorate,
      district,
      licenseNumber,
      address,
      verificationStatus: 'unverified',
      isActive: true,
    });

    // Generate tokens for auto-login
    const tokenPayload = {
      userId: nurse._id.toString(),
      phone: nurse.phone,
      role: nurse.role,
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    const responseData = {
      user: {
        id: nurse._id.toString(),
        name: nurse.name,
        phone: nurse.phone,
        role: nurse.role,
        verificationStatus: nurse.verificationStatus,
        governorate: nurse.governorate,
        isActive: nurse.isActive,
      },
      token,
      refreshToken,
    };

    const response = Response.json(
      { success: true, data: responseData, message: 'تم إنشاء حساب الممرض بنجاح. سيتم مراجعة بياناتك' },
      { status: 201 }
    );

    response.headers.set('Set-Cookie', createAuthCookie(token));
    return response;
  } catch (error) {
    console.error('[REGISTER NURSE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إنشاء الحساب', 500, 'INTERNAL_ERROR');
  }
}
