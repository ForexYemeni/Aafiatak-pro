import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import {
  verifyPassword,
  generateToken,
  generateRefreshToken,
  validateYemeniPhone,
  normalizeYemeniPhone,
} from '@/lib/auth';
import {
  createAuthCookie,
  createErrorResponse,
} from '@/lib/auth/middleware';
import type {
  LoginRequest,
  LoginResponse,
  AppUser,
  AdminUser,
  SubAdminUser,
  NurseUser,
  BeneficiaryUser,
  UserRole,
} from '@/types';

// ---- POST /api/auth/login ----

export async function POST(request: NextRequest) {
  try {
    const body: LoginRequest = await request.json();
    const { phone, password } = body;

    // Validate input
    if (!phone || !password) {
      return createErrorResponse('رقم الهاتف وكلمة المرور مطلوبان', 400, 'VALIDATION_ERROR');
    }

    if (!validateYemeniPhone(phone)) {
      return createErrorResponse('رقم الهاتف غير صالح. يجب أن يبدأ بـ 7 ويتكون من 9 أرقام', 400, 'VALIDATION_ERROR');
    }

    const normalizedPhone = normalizeYemeniPhone(phone);

    // Search across all user collections
    let user: AppUser | null = null;
    let userRole: UserRole | null = null;

    // Check Admin
    const admin = await db.admin.findUnique({ where: { phone: normalizedPhone } });
    if (admin) {
      user = mapAdminToAppUser(admin);
      userRole = 'admin';
    }

    // Check SubAdmin
    if (!user) {
      const subAdmin = await db.subAdmin.findUnique({ where: { phone: normalizedPhone } });
      if (subAdmin) {
        user = mapSubAdminToAppUser(subAdmin);
        userRole = 'subadmin';
      }
    }

    // Check Nurse
    if (!user) {
      const nurse = await db.nurse.findUnique({ where: { phone: normalizedPhone } });
      if (nurse) {
        user = mapNurseToAppUser(nurse);
        userRole = 'nurse';
      }
    }

    // Check Beneficiary
    if (!user) {
      const beneficiary = await db.beneficiary.findUnique({ where: { phone: normalizedPhone } });
      if (beneficiary) {
        user = mapBeneficiaryToAppUser(beneficiary);
        userRole = 'beneficiary';
      }
    }

    // User not found
    if (!user || !userRole) {
      return createErrorResponse('رقم الهاتف أو كلمة المرور غير صحيحة', 401, 'INVALID_CREDENTIALS');
    }

    // Check if account is active
    if (!user.isActive) {
      return createErrorResponse('الحساب معطل. يرجى التواصل مع الإدارة', 403, 'ACCOUNT_DISABLED');
    }

    // Verify password - need to get the raw record for the password hash
    let storedHash: string | null = null;
    switch (userRole) {
      case 'admin': {
        const record = await db.admin.findUnique({ where: { phone: normalizedPhone } });
        storedHash = record?.password ?? null;
        break;
      }
      case 'subadmin': {
        const record = await db.subAdmin.findUnique({ where: { phone: normalizedPhone } });
        storedHash = record?.password ?? null;
        break;
      }
      case 'nurse': {
        const record = await db.nurse.findUnique({ where: { phone: normalizedPhone } });
        storedHash = record?.password ?? null;
        break;
      }
      case 'beneficiary': {
        const record = await db.beneficiary.findUnique({ where: { phone: normalizedPhone } });
        storedHash = record?.password ?? null;
        break;
      }
    }

    if (!storedHash) {
      return createErrorResponse('رقم الهاتف أو كلمة المرور غير صحيحة', 401, 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await verifyPassword(password, storedHash);
    if (!isPasswordValid) {
      return createErrorResponse('رقم الهاتف أو كلمة المرور غير صحيحة', 401, 'INVALID_CREDENTIALS');
    }

    // Generate tokens
    const tokenPayload = {
      userId: user.id,
      phone: user.phone,
      role: userRole,
    };

    const token = generateToken(tokenPayload);
    const refreshToken = generateRefreshToken(tokenPayload);

    // Log activity
    try {
      const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
      await db.activityLog.create({
        data: {
          userId: user.id,
          userRole: userRole,
          action: 'login',
          details: 'تسجيل دخول ناجح',
          ipAddress: ipAddress.split(',')[0]?.trim() ?? 'unknown',
        },
      });
    } catch {
      // Activity logging should not block login
    }

    // Build response
    const responseData: LoginResponse = {
      user,
      token,
      refreshToken,
    };

    const response = NextResponse.json(
      { success: true, data: responseData, message: 'تم تسجيل الدخول بنجاح' },
      { status: 200 }
    );

    // Set auth cookie
    response.headers.set('Set-Cookie', createAuthCookie(token));

    return response;
  } catch (error) {
    console.error('[AUTH LOGIN ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تسجيل الدخول', 500, 'INTERNAL_ERROR');
  }
}

// ---- Mapper Functions ----

function mapAdminToAppUser(admin: { id: string; name: string; phone: string; role: string; isActive: boolean; createdAt: Date; updatedAt: Date }): AdminUser {
  return {
    id: admin.id,
    name: admin.name,
    phone: admin.phone,
    role: 'admin',
    isActive: admin.isActive,
    createdAt: admin.createdAt.toISOString(),
    updatedAt: admin.updatedAt.toISOString(),
  };
}

function mapSubAdminToAppUser(subAdmin: { id: string; name: string; phone: string; role: string; isActive: boolean; createdAt: Date; updatedAt: Date }): SubAdminUser {
  return {
    id: subAdmin.id,
    name: subAdmin.name,
    phone: subAdmin.phone,
    role: 'subadmin',
    isActive: subAdmin.isActive,
    createdAt: subAdmin.createdAt.toISOString(),
    updatedAt: subAdmin.updatedAt.toISOString(),
  };
}

function mapNurseToAppUser(nurse: { id: string; name: string; phone: string; role: string; specialty: string | null; licenseNo: string | null; hospital: string | null; governorate: string | null; district: string | null; isActive: boolean; createdAt: Date; updatedAt: Date }): NurseUser {
  return {
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
}

function mapBeneficiaryToAppUser(beneficiary: { id: string; name: string; phone: string; role: string; referralCode: string; governorate: string | null; district: string | null; address: string | null; dateOfBirth: Date | null; gender: string | null; isActive: boolean; createdAt: Date; updatedAt: Date }): BeneficiaryUser {
  return {
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
}
