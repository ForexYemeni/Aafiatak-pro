import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/prisma';
import { authenticateRequest, createErrorResponse } from '@/lib/auth/middleware';
import type { AppUser, AdminUser, SubAdminUser, NurseUser, BeneficiaryUser, MeResponse } from '@/types';

// ---- GET /api/auth/me ----

export async function GET(request: NextRequest) {
  try {
    const authenticatedReq = await authenticateRequest(request);
    const { userId, role } = authenticatedReq.user;

    let user: AppUser | null = null;

    switch (role) {
      case 'admin': {
        const admin = await db.admin.findUnique({ where: { id: userId } });
        if (admin) {
          user = {
            id: admin.id,
            name: admin.name,
            phone: admin.phone,
            role: 'admin',
            isActive: admin.isActive,
            createdAt: admin.createdAt.toISOString(),
            updatedAt: admin.updatedAt.toISOString(),
          } satisfies AdminUser;
        }
        break;
      }

      case 'subadmin': {
        const subAdmin = await db.subAdmin.findUnique({ where: { id: userId } });
        if (subAdmin) {
          user = {
            id: subAdmin.id,
            name: subAdmin.name,
            phone: subAdmin.phone,
            role: 'subadmin',
            isActive: subAdmin.isActive,
            createdAt: subAdmin.createdAt.toISOString(),
            updatedAt: subAdmin.updatedAt.toISOString(),
          } satisfies SubAdminUser;
        }
        break;
      }

      case 'nurse': {
        const nurse = await db.nurse.findUnique({ where: { id: userId } });
        if (nurse) {
          user = {
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
          } satisfies NurseUser;
        }
        break;
      }

      case 'beneficiary': {
        const beneficiary = await db.beneficiary.findUnique({ where: { id: userId } });
        if (beneficiary) {
          user = {
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
          } satisfies BeneficiaryUser;
        }
        break;
      }

      default:
        return createErrorResponse('دور المستخدم غير صالح', 400, 'INVALID_ROLE');
    }

    if (!user) {
      return createErrorResponse('لم يتم العثور على المستخدم', 404, 'USER_NOT_FOUND');
    }

    if (!user.isActive) {
      return createErrorResponse('الحساب معطل', 403, 'ACCOUNT_DISABLED');
    }

    const responseData: MeResponse = { user };

    return NextResponse.json(
      { success: true, data: responseData },
      { status: 200 }
    );
  } catch (error) {
    if (error instanceof Error && 'statusCode' in error) {
      const authError = error as { statusCode: number; message: string };
      return createErrorResponse(authError.message, authError.statusCode, 'AUTH_ERROR');
    }

    console.error('[AUTH ME ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء استرجاع بيانات المستخدم', 500, 'INTERNAL_ERROR');
  }
}
