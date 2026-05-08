// PATCH /api/nurse/orders/[id] - Update order status (start/complete)
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { creditNurseEarnings } from '@/lib/api/helpers';
import { sendPushToUser } from '@/lib/notifications/push-service';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const { id } = await params;
    const { action } = await request.json();

    const order = await ServiceRequest.findById(id);
    if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

    if (order.nurseId?.toString() !== user.userId) {
      return createErrorResponse('هذا الطلب غير معين لك', 403, 'FORBIDDEN');
    }

    if (action === 'start') {
      // Start the service: accepted → in_progress
      if (order.status !== 'accepted') {
        return createErrorResponse('لا يمكن بدء الطلب في حالته الحالية', 400, 'INVALID_STATUS');
      }
      order.status = 'in_progress';
      order.startedAt = new Date();
      await order.save();

      // Notify beneficiary
      try {
        await Notification.create({
          userId: order.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: 'بدأ تنفيذ طلبك',
          bodyAr: 'بدأ الممرض بتنفيذ طلب الخدمة الخاص بك',
          type: 'status_change',
          priority: 'medium',
          data: { requestId: id, status: 'in_progress' },
          voiceEnabled: true,
        });

        // Send push notification to beneficiary
        sendPushToUser(order.beneficiaryId.toString(), {
          title: 'بدأ تنفيذ طلبك',
          body: 'بدأ الممرض بتنفيذ طلب الخدمة الخاص بك',
          type: 'service_started',
          priority: 'medium',
          url: `/beneficiary/orders/${id}`,
          userRole: 'beneficiary',
          data: { requestId: id, status: 'in_progress' },
        }).catch(() => {}); // Non-blocking
      } catch {
        // Non-critical
      }

      return Response.json({
        success: true,
        data: { ...order.toObject(), id: order._id.toString() },
        message: 'تم بدء تنفيذ الطلب',
      });
    }

    if (action === 'complete') {
      // Complete the service: in_progress → completed
      if (order.status !== 'in_progress') {
        return createErrorResponse('لا يمكن إكمال الطلب في حالته الحالية', 400, 'INVALID_STATUS');
      }
      order.status = 'completed';
      order.completedAt = new Date();
      await order.save();

      // Credit nurse earnings
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

      // Notify beneficiary
      try {
        await Notification.create({
          userId: order.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: 'تم إكمال طلبك',
          bodyAr: 'تم إكمال طلب الخدمة بنجاح. يرجى تقييم الخدمة',
          type: 'status_change',
          priority: 'high',
          data: { requestId: id, status: 'completed' },
          voiceEnabled: true,
        });

        // Send push notification to beneficiary
        sendPushToUser(order.beneficiaryId.toString(), {
          title: 'تم إكمال طلبك',
          body: 'تم إكمال طلب الخدمة بنجاح. يرجى تقييم الخدمة',
          type: 'service_completed',
          priority: 'high',
          url: `/beneficiary/orders/${id}`,
          userRole: 'beneficiary',
          data: { requestId: id, status: 'completed' },
        }).catch(() => {}); // Non-blocking
      } catch {
        // Non-critical
      }

      return Response.json({
        success: true,
        data: { ...order.toObject(), id: order._id.toString() },
        message: 'تم إكمال الطلب بنجاح',
      });
    }

    return createErrorResponse('إجراء غير معروف. استخدم: start أو complete', 400, 'INVALID_ACTION');
  } catch (error) {
    console.error('[NURSE ORDER ACTION ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}
