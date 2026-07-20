// GET /api/special-requests/[id]
// مسار عام لجلب تفاصيل طلب خدمة خاص (للمستفيد والإدارة والممرض)
// يتحقق من الصلاحيات بناءً على دور المستخدم

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SpecialServiceRequest, Nurse } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { serializeDoc } from '@/lib/mongoose/serialize';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { id } = await params;
    const specialRequest = await SpecialServiceRequest.findById(id).lean();

    if (!specialRequest) {
      return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');
    }

    // ── التحقق من الصلاحيات ──
    const isAdmin = user.role === 'admin' || user.role === 'subadmin';
    const isBeneficiary = user.role === 'beneficiary' && specialRequest.beneficiaryId.toString() === user.userId;
    const isNurse = user.role === 'nurse' && specialRequest.nurseId?.toString() === user.userId;

    if (!isAdmin && !isBeneficiary && !isNurse) {
      return createErrorResponse('ليس لديك صلاحية للوصول إلى هذا الطلب', 403, 'FORBIDDEN');
    }

    // ── جلب اسم الممرض إذا كان معيناً ──
    let nurseName: string | null = null;
    let nursePhone: string | null = null;
    let nurseRating: number = 0;
    if (specialRequest.nurseId) {
      const nurse = await Nurse.findById(specialRequest.nurseId).select('name phone rating').lean();
      if (nurse) {
        nurseName = nurse.name;
        nursePhone = nurse.phone || null;
        nurseRating = nurse.rating || 0;
      }
    }

    const result = {
      ...serializeDoc(specialRequest),
      nurseName,
      nursePhone,
      nurseRating,
    };

    return Response.json({ success: true, data: result });
  } catch (error) {
    console.error('[SPECIAL REQUEST DETAIL ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب تفاصيل الطلب', 500, 'INTERNAL_ERROR');
  }
}
