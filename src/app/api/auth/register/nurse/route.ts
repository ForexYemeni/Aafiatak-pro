import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import {
  hashPassword,
  generateToken,
  generateRefreshToken,
  validateYemeniPhone,
  normalizeYemeniPhone,
} from '@/lib/auth';
import { createAuthCookie, createErrorResponse } from '@/lib/auth/middleware';
import type { RegisterNurseRequest, RegisterNurseResponse, NurseUser } from '@/types';

// ---- POST /api/auth/register/nurse ----

export async function POST(request: NextRequest) {
  try {
    const body: RegisterNurseRequest = await request.json();
    const { name, phone, password, specialty, licenseNo, hospital, governorate, district } = body;

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

    // ---- Create nurse ----
    const nurse = await db.nurse.create({
      data: {
        name: name.trim(),
        phone: normalizedPhone,
        password: hashedPassword,
        role: 'nurse',
        specialty: specialty?.trim() ?? null,
        licenseNo: licenseNo?.trim() ?? null,
        hospital: hospital?.trim() ?? null,
        governorate: governorate?.trim() ?? null,
        district: district?.trim() ?? null,
      },
    });

    // ---- Generate tokens ----
    const tokenPayload = {
      userId: nurse.id,
      phone: nurse.phone,
      role: 'nurse' as const,
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // ---- Log activity ----
    try {
      const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
      await db.activityLog.create({
        data: {
          userId: nurse.id,
          userRole: 'nurse',
          action: 'register',
          details: 'تسجيل ممرض/ـة جديد/ـة',
          ipAddress: ipAddress.split(',')[0]?.trim() ?? 'unknown',
        },
      });
    } catch {
      // Activity logging should not block registration
    }

    // ---- Build response ----
    const nurseUser: NurseUser = {
      id: nurse.id,
      name: nurse.name,
      phone: nurse.phone,
      role: 'nurse',
      specialty: nurse.specialty,
      licenseNo: nurse.licenseNo,
      hospital: nurse.hospital,
      governorate: nurse.governorate,
      district: nurse.district,
      isActive: nurse.isActive,
      createdAt: nurse.createdAt.toISOString(),
      updatedAt: nurse.updatedAt.toISOString(),
    };

    const responseData: RegisterNurseResponse = {
      user: nurseUser,
      token,
      refreshToken,
    };

    const response = NextResponse.json(
      { success: true, data: responseData, message: 'تم تسجيل الممرض/ـة بنجاح' },
      { status: 201 }
    );

    // Set auth cookie
    response.headers.set('Set-Cookie', createAuthCookie(token));

    return response;
  } catch (error) {
    console.error('[NURSE REGISTER ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تسجيل الممرض/ـة', 500, 'INTERNAL_ERROR');
  }
}
