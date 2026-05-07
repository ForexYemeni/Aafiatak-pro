// GET/PATCH /api/admin/orders/[id] - Get/update order
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { id } = await params;
    const order = await ServiceRequest.findById(id).lean();
    if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

    return Response.json({ success: true, data: { ...order, id: order._id.toString() } });
  } catch (error) {
    console.error('[ADMIN ORDER DETAIL ERROR]', error);
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

    delete body._id;

    const updateData: any = { ...body };
    if (body.status === 'completed') updateData.completedAt = new Date();
    if (body.status === 'cancelled') {
      updateData.cancelledAt = new Date();
      updateData.cancelReason = body.cancelReason || 'إلغاء بواسطة الإدارة';
    }

    const order = await ServiceRequest.findByIdAndUpdate(id, updateData, { new: true }).lean();
    if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'update_order',
      entity: 'ServiceRequest',
      entityId: id,
      details: `تحديث حالة الطلب إلى: ${body.status || 'محدث'}`,
      request,
    });

    return Response.json({ success: true, data: { ...order, id: order._id.toString() }, message: 'تم تحديث الطلب بنجاح' });
  } catch (error) {
    console.error('[ADMIN ORDER UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحديث', 500, 'INTERNAL_ERROR');
  }
}
