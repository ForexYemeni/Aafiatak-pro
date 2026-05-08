// GET/PATCH /api/admin/orders/[id] - Get/update order
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest } from '@/models/mongoose';
import { requireSubadminPermission, requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity, creditNurseEarnings } from '@/lib/api/helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_orders');
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
    const { user, error } = await requireSubadminPermission(request, 'manage_orders');
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

    // If status is changing to completed, we need the full order first for earnings credit
    if (body.status === 'completed') {
      const order = await ServiceRequest.findById(id);
      if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

      // Don't re-complete already completed orders
      if (order.status === 'completed') {
        return createErrorResponse('الطلب مكتمل بالفعل', 400, 'ALREADY_COMPLETED');
      }

      order.status = 'completed';
      order.completedAt = new Date();
      if (body.notes) order.notes = body.notes;
      await order.save();

      // Credit nurse earnings if nurse is assigned
      if (order.nurseId && order.nursePayout > 0) {
        await creditNurseEarnings({
          requestId: order._id.toString(),
          nurseId: order.nurseId.toString(),
          beneficiaryId: order.beneficiaryId.toString(),
          amount: order.totalPrice || 0,
          commission: order.commission || 0,
          nursePayout: order.nursePayout || 0,
          paymentMethod: order.paymentMethod,
        });
      }

      await logActivity({
        userId: user!.userId,
        userRole: user!.role,
        action: 'update_order',
        entity: 'ServiceRequest',
        entityId: id,
        details: 'تحديث حالة الطلب إلى: مكتمل',
        request,
      });

      return Response.json({ success: true, data: { ...order.toObject(), id: order._id.toString() }, message: 'تم تحديث الطلب بنجاح' });
    }

    // For other status changes, use simple update
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
