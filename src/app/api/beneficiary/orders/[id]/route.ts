// GET/PATCH /api/beneficiary/orders/[id] - Get/cancel order
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, Beneficiary, Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const { id } = await params;
    const order = await ServiceRequest.findOne({ _id: id, beneficiaryId: user.userId }).lean();
    if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

    return Response.json({ success: true, data: { ...order, id: order._id.toString() } });
  } catch (error) {
    console.error('[BENEFICIARY ORDER DETAIL ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const { id } = await params;
    const body = await request.json();

    // Beneficiary can only cancel their orders
    if (body.status !== 'cancelled') {
      return createErrorResponse('يمكنك فقط إلغاء الطلب', 400, 'INVALID_ACTION');
    }

    const order = await ServiceRequest.findOne({ _id: id, beneficiaryId: user.userId });
    if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

    if (!['pending', 'assigned'].includes(order.status)) {
      return createErrorResponse('لا يمكن إلغاء الطلب في حالته الحالية', 400, 'INVALID_STATUS');
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = body.cancelReason || 'إلغاء بواسطة المستفيد';
    await order.save();

    // Notify nurse if assigned
    if (order.nurseId) {
      try {
        await Notification.create({
          userId: order.nurseId,
          userRole: 'nurse',
          titleAr: 'تم إلغاء الطلب',
          bodyAr: `تم إلغاء الطلب المُعيَّن لك`,
          type: 'status_change',
          priority: 'medium',
          data: { requestId: id, status: 'cancelled' },
          voiceEnabled: true,
        });
      } catch {
        // Non-critical
      }
    }

    return Response.json({
      success: true,
      data: { ...order.toObject(), id: order._id.toString() },
      message: 'تم إلغاء الطلب بنجاح',
    });
  } catch (error) {
    console.error('[BENEFICIARY ORDER CANCEL ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إلغاء الطلب', 500, 'INTERNAL_ERROR');
  }
}
