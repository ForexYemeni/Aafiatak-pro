// PATCH/DELETE /api/admin/specializations/[id]

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Specialization } from '@/models/mongoose/Specialization';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    const allowed: Record<string, unknown> = {};
    if (body.label !== undefined) allowed.label = body.label;
    if (body.category !== undefined) allowed.category = body.category;
    if (body.isActive !== undefined) allowed.isActive = body.isActive;
    if (body.order !== undefined) allowed.order = body.order;

    const spec = await Specialization.findOneAndUpdate(
      { id },
      { $set: allowed },
      { new: true }
    ).lean();

    if (!spec) return createErrorResponse('التخصص غير موجود', 404, 'NOT_FOUND');

    return Response.json({ success: true, data: spec });
  } catch (error) {
    console.error('[ADMIN SPEC PATCH ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { error } = requireRole(request, ['admin']);
    if (error) return error;

    const { id } = await params;

    const spec = await Specialization.findOne({ id }).lean();
    if (!spec) return createErrorResponse('التخصص غير موجود', 404, 'NOT_FOUND');

    if ((spec as any).isDefault) {
      return createErrorResponse('لا يمكن حذف التخصصات الافتراضية — يمكنك إلغاء تفعيلها بدلاً من ذلك', 400, 'CANNOT_DELETE_DEFAULT');
    }

    await Specialization.deleteOne({ id });

    return Response.json({ success: true, message: 'تم حذف التخصص' });
  } catch (error) {
    console.error('[ADMIN SPEC DELETE ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}
