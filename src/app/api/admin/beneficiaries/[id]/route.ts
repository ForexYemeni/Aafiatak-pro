// GET/PATCH /api/admin/beneficiaries/[id] - Get/update beneficiary
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Beneficiary } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { id } = await params;
    const beneficiary = await Beneficiary.findById(id).select('-password').lean();
    if (!beneficiary) return createErrorResponse('المستفيد غير موجود', 404, 'NOT_FOUND');

    return Response.json({ success: true, data: { ...beneficiary, id: beneficiary._id.toString() } });
  } catch (error) {
    console.error('[ADMIN BENEFICIARY DETAIL ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    delete body.password;
    delete body._id;

    const beneficiary = await Beneficiary.findByIdAndUpdate(id, body, { new: true }).select('-password').lean();
    if (!beneficiary) return createErrorResponse('المستفيد غير موجود', 404, 'NOT_FOUND');

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'update_beneficiary',
      entity: 'Beneficiary',
      entityId: id,
      details: `تحديث بيانات المستفيد: ${beneficiary.name}`,
      request,
    });

    return Response.json({ success: true, data: { ...beneficiary, id: beneficiary._id.toString() }, message: 'تم تحديث بيانات المستفيد بنجاح' });
  } catch (error) {
    console.error('[ADMIN BENEFICIARY UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحديث', 500, 'INTERNAL_ERROR');
  }
}
