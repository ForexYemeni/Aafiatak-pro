// GET/PATCH/DELETE /api/admin/services/[id] - Get/update/delete service
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Service } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { id } = await params;
    const service = await Service.findById(id).lean();
    if (!service) return createErrorResponse('الخدمة غير موجودة', 404, 'NOT_FOUND');

    return Response.json({ success: true, data: { ...service, id: service._id.toString() } });
  } catch (error) {
    console.error('[ADMIN SERVICE DETAIL ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    delete body._id;

    const service = await Service.findByIdAndUpdate(id, body, { new: true }).lean();
    if (!service) return createErrorResponse('الخدمة غير موجودة', 404, 'NOT_FOUND');

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'update_service',
      entity: 'Service',
      entityId: id,
      details: 'تحديث بيانات الخدمة',
      request,
    });

    return Response.json({ success: true, data: { ...service, id: service._id.toString() }, message: 'تم تحديث الخدمة بنجاح' });
  } catch (error) {
    console.error('[ADMIN SERVICE UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحديث', 500, 'INTERNAL_ERROR');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const { id } = await params;
    const service = await Service.findByIdAndDelete(id).lean();
    if (!service) return createErrorResponse('الخدمة غير موجودة', 404, 'NOT_FOUND');

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'delete_service',
      entity: 'Service',
      entityId: id,
      details: 'حذف الخدمة',
      request,
    });

    return Response.json({ success: true, message: 'تم حذف الخدمة بنجاح' });
  } catch (error) {
    console.error('[ADMIN SERVICE DELETE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء الحذف', 500, 'INTERNAL_ERROR');
  }
}
