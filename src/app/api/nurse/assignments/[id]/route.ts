// POST/PATCH /api/nurse/assignments/[id] - Accept/reject assignment
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, Nurse, Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { sendPushToUser } from '@/lib/notifications/push-service';

async function handleAssignmentAction(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const { id } = await params;
    const body = await request.json();

    // Support both formats:
    // 1. { action: 'accept' | 'reject' } (POST format)
    // 2. { status: 'accepted' | 'rejected' } (PATCH format)
    let action = body.action;
    if (!action && body.status) {
      if (body.status === 'accepted') action = 'accept';
      else if (body.status === 'rejected') action = 'reject';
    }

    if (!['accept', 'reject'].includes(action)) {
      return createErrorResponse('الإجراء مطلوب (accept/reject)', 400, 'VALIDATION_ERROR');
    }

    const order = await ServiceRequest.findById(id);
    if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

    if (order.nurseId?.toString() !== user.userId) {
      return createErrorResponse('هذا الطلب غير معين لك', 403, 'FORBIDDEN');
    }

    if (order.status !== 'assigned') {
      return createErrorResponse('لا يمكن التعامل مع هذا الطلب في حالته الحالية', 400, 'INVALID_STATUS');
    }

    if (action === 'accept') {
      order.status = 'accepted';
      await order.save();

      // Notify beneficiary with action URL to view order details
      try {
        const nurse = await Nurse.findById(user.userId).select('name').lean();
        await Notification.create({
          userId: order.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: 'تم قبول طلبك',
          bodyAr: `تم قبول طلبك من ${nurse?.name || 'الممرض/ـة'} وسيقوم بالوصول قريباً`,
          type: 'status_change',
          priority: 'high',
          data: { requestId: id, status: 'accepted', nurseId: user.userId },
          actionUrl: `/beneficiary/orders/${id}`,
          voiceEnabled: true,
        });

        // Send push notification to beneficiary
        sendPushToUser(order.beneficiaryId.toString(), {
          title: 'تم قبول طلبك',
          body: `تم قبول طلبك من ${nurse?.name || 'الممرض/ـة'} وسيقوم بالوصول قريباً`,
          type: 'service_accepted',
          priority: 'high',
          url: `/beneficiary/orders/${id}`,
          userRole: 'beneficiary',
          data: { requestId: id, status: 'accepted' },
        }).catch(() => {}); // Non-blocking
      } catch {
        // Non-critical
      }

      return Response.json({
        success: true,
        data: { ...order.toObject(), id: order._id.toString() },
        message: 'تم قبول الطلب بنجاح',
      });
    } else {
      order.status = 'pending';
      order.nurseId = undefined;
      await order.save();

      // Notify admin about rejection
      try {
        const nurse = await Nurse.findById(user.userId).select('name').lean();
        await Notification.create({
          userRole: 'admin',
          titleAr: 'رفض ممرض طلباً',
          bodyAr: `رفض الممرض ${nurse?.name || 'غير معروف'} الطلب الموكل إليه`,
          type: 'status_change',
          priority: 'high',
          data: { requestId: id, status: 'rejected', nurseId: user.userId },
          voiceEnabled: false,
        });

        // Send push notification to admins
        const { User } = await import('@/models/mongoose');
        const admins = await User.find({ role: 'admin' }).select('_id').lean();
        for (const admin of admins) {
          sendPushToUser(admin._id.toString(), {
            title: 'رفض ممرض طلباً',
            body: `رفض الممرض ${nurse?.name || 'غير معروف'} الطلب الموكل إليه`,
            type: 'service_cancelled',
            priority: 'high',
            url: '/admin/orders',
            userRole: 'admin',
            data: { requestId: id, status: 'rejected' },
          }).catch(() => {});
        }
      } catch {
        // Non-critical
      }

      return Response.json({
        success: true,
        data: { ...order.toObject(), id: order._id.toString() },
        message: 'تم رفض الطلب',
      });
    }
  } catch (error) {
    console.error('[NURSE ASSIGNMENT ACTION ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleAssignmentAction(request, { params });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleAssignmentAction(request, { params });
}
