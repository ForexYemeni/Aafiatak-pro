import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  hashPassword,
  generateToken,
  generateRefreshToken,
  validateYemeniPhone,
  normalizeYemeniPhone,
} from '@/lib/auth';
import { createAuthCookie, createErrorResponse } from '@/lib/auth/middleware';
import type { RegisterBeneficiaryRequest, RegisterBeneficiaryResponse, BeneficiaryUser } from '@/types';

// ---- POST /api/auth/register/beneficiary ----

/**
 * Generate a unique referral code for a beneficiary.
 * Format: AF-XXXXXX (6 alphanumeric characters)
 */
async function generateUniqueReferralCode(): Promise<string> {
  const characters = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codeLength = 6;
  let attempts = 0;
  const maxAttempts = 20;

  while (attempts < maxAttempts) {
    let code = 'AF-';
    for (let i = 0; i < codeLength; i++) {
      const randomIndex = Math.floor(Math.random() * characters.length);
      code += characters[randomIndex];
    }

    // Check uniqueness
    const existing = await db.beneficiary.findUnique({ where: { referralCode: code } });
    if (!existing) {
      return code;
    }

    attempts++;
  }

  // Fallback: use timestamp-based code
  const timestamp = Date.now().toString(36).toUpperCase();
  return `AF-${timestamp.slice(-6)}`;
}

export async function POST(request: NextRequest) {
  try {
    const body: RegisterBeneficiaryRequest = await request.json();
    const { name, phone, password, governorate, district, address, dateOfBirth, gender } = body;

    // ---- Validate required fields ----
    if (!name || name.trim().length < 2) {
      return createErrorResponse('الاسم مطلوب ويجب أن يكون حرفين على الأقل', 400, 'VALIDATION_ERROR');
    }

    if (!phone) {
      return createErrorResponse('رقم الهاتف مطلوب', 400, 'VALIDATION_ERROR');
    }

    if (!validateYemeniPhone(phone)) {
      return createErrorResponse('رقم الهاتف غير صالح. يجب أن يبدأ بـ 7 ويتكون من 9 أرقام', 400, 'VALIDATION_ERROR');
    }

    if (!password || password.length < 6) {
      return createErrorResponse('كلمة المرور مطلوبة ويجب أن تكون 6 أحرف على الأقل', 400, 'VALIDATION_ERROR');
    }

    const normalizedPhone = normalizeYemeniPhone(phone);

    // ---- Check phone uniqueness across all collections ----
    const existingAdmin = await db.admin.findUnique({ where: { phone: normalizedPhone } });
    if (existingAdmin) {
      return createErrorResponse('رقم الهاتف مسجل بالفعل', 409, 'PHONE_EXISTS');
    }

    const existingSubAdmin = await db.subAdmin.findUnique({ where: { phone: normalizedPhone } });
    if (existingSubAdmin) {
      return createErrorResponse('رقم الهاتف مسجل بالفعل', 409, 'PHONE_EXISTS');
    }

    const existingNurse = await db.nurse.findUnique({ where: { phone: normalizedPhone } });
    if (existingNurse) {
      return createErrorResponse('رقم الهاتف مسجل بالفعل', 409, 'PHONE_EXISTS');
    }

    const existingBeneficiary = await db.beneficiary.findUnique({ where: { phone: normalizedPhone } });
    if (existingBeneficiary) {
      return createErrorResponse('رقم الهاتف مسجل بالفعل', 409, 'PHONE_EXISTS');
    }

    // ---- Hash password ----
    const hashedPassword = await hashPassword(password);

    // ---- Generate unique referral code ----
    const referralCode = await generateUniqueReferralCode();

    // ---- Create beneficiary ----
    const beneficiary = await db.beneficiary.create({
      data: {
        name: name.trim(),
        phone: normalizedPhone,
        password: hashedPassword,
        role: 'beneficiary',
        referralCode,
        governorate: governorate?.trim() ?? null,
        district: district?.trim() ?? null,
        address: address?.trim() ?? null,
        dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null,
        gender: gender ?? null,
      },
    });

    // ---- Generate tokens ----
    const tokenPayload = {
      userId: beneficiary.id,
      phone: beneficiary.phone,
      role: 'beneficiary' as const,
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // ---- Log activity ----
    try {
      const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
      await db.activityLog.create({
        data: {
          userId: beneficiary.id,
          userRole: 'beneficiary',
          action: 'register',
          details: 'تسجيل مستفيد جديد',
          ipAddress: ipAddress.split(',')[0]?.trim() ?? 'unknown',
        },
      });
    } catch {
      // Activity logging should not block registration
    }

    // ---- Build response ----
    const beneficiaryUser: BeneficiaryUser = {
      id: beneficiary.id,
      name: beneficiary.name,
      phone: beneficiary.phone,
      role: 'beneficiary',
      referralCode: beneficiary.referralCode,
      governorate: beneficiary.governorate,
      district: beneficiary.district,
      address: beneficiary.address,
      dateOfBirth: beneficiary.dateOfBirth?.toISOString() ?? null,
      gender: beneficiary.gender,
      isActive: beneficiary.isActive,
      createdAt: beneficiary.createdAt.toISOString(),
      updatedAt: beneficiary.updatedAt.toISOString(),
    };

    const responseData: RegisterBeneficiaryResponse = {
      user: beneficiaryUser,
      token,
      refreshToken,
    };

    const response = NextResponse.json(
      { success: true, data: responseData, message: 'تم تسجيل المستفيد بنجاح' },
      { status: 201 }
    );

    // Set auth cookie
    response.headers.set('Set-Cookie', createAuthCookie(token));

    return response;
  } catch (error) {
    console.error('[BENEFICIARY REGISTER ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تسجيل المستفيد', 500, 'INTERNAL_ERROR');
  }
}
