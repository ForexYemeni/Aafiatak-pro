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

    const nurse = await Nurse.findById(user.userId).select('name').lean();
    const nurseName = nurse?.name || 'الممرض/ـة';

    if (action === 'accept') {
      order.status = 'accepted';
      await order.save();

      // ── Notifications for ALL parties ──
      try {
        // 1️⃣ Notify BENEFICIARY: Your request has been accepted
        await Notification.create({
          userId: order.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: 'تم قبول طلبك',
          bodyAr: `تم قبول طلبك من ${nurseName} وسيقوم بالوصول قريباً`,
          type: 'status_change',
          priority: 'high',
          data: { requestId: id, status: 'accepted', nurseId: user.userId },
          actionUrl: `/beneficiary/orders/${id}`,
          voiceEnabled: true,
        });

        sendPushToUser(order.beneficiaryId.toString(), {
          title: 'تم قبول طلبك',
          body: `تم قبول طلبك من ${nurseName} وسيقوم بالوصول قريباً`,
          type: 'service_accepted',
          priority: 'high',
          url: `/beneficiary/orders/${id}`,
          userRole: 'beneficiary',
          data: { requestId: id, status: 'accepted' },
        }).catch(() => {});

        // 2️⃣ Notify ADMIN: Nurse accepted the order
        const { User } = await import('@/models/mongoose');
        const admins = await User.find({ role: 'admin' }).select('_id').lean();
        for (const admin of admins) {
          await Notification.create({
            userId: admin._id,
            userRole: 'admin',
            titleAr: 'قبول الممرض للطلب',
            bodyAr: `قبل ${nurseName} الطلب #${id.slice(-6)} وسيبدأ التنفيذ قريباً`,
            type: 'status_change',
            priority: 'medium',
            data: { requestId: id, status: 'accepted', nurseId: user.userId },
            actionUrl: '/admin/orders',
            read: false,
          });

          sendPushToUser(admin._id.toString(), {
            title: 'قبول الممرض للطلب',
            body: `قبل ${nurseName} الطلب #${id.slice(-6)} وسيبدأ التنفيذ قريباً`,
            type: 'service_accepted',
            priority: 'medium',
            url: '/admin/orders',
            userRole: 'admin',
            data: { requestId: id, status: 'accepted' },
          }).catch(() => {});
        }
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

      // ── Notifications for ALL parties ──
      try {
        // 1️⃣ Notify BENEFICIARY: Nurse rejected, looking for another
        await Notification.create({
          userId: order.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: 'جاري البحث عن ممرض بديل',
          bodyAr: `الممرض المعين لم يتمكن من تنفيذ طلبك. جاري البحث عن ممرض بديل`,
          type: 'status_change',
          priority: 'medium',
          data: { requestId: id, status: 'pending' },
          actionUrl: `/beneficiary/orders/${id}`,
          voiceEnabled: true,
        });

        sendPushToUser(order.beneficiaryId.toString(), {
          title: 'جاري البحث عن ممرض بديل',
          body: 'الممرض المعين لم يتمكن من تنفيذ طلبك. جاري البحث عن بديل',
          type: 'status_change',
          priority: 'medium',
          url: `/beneficiary/orders/${id}`,
          userRole: 'beneficiary',
          data: { requestId: id, status: 'pending' },
        }).catch(() => {});

        // 2️⃣ Notify ADMIN: Nurse rejected the assignment
        const { User } = await import('@/models/mongoose');
        const admins = await User.find({ role: 'admin' }).select('_id').lean();
        for (const admin of admins) {
          await Notification.create({
            userId: admin._id,
            userRole: 'admin',
            titleAr: 'رفض ممرض طلباً',
            bodyAr: `رفض الممرض ${nurseName} الطلب #${id.slice(-6)} - يرجى تعيين ممرض بديل`,
            type: 'status_change',
            priority: 'high',
            data: { requestId: id, status: 'rejected', nurseId: user.userId },
            actionUrl: '/admin/orders',
            voiceEnabled: true,
            read: false,
          });

          sendPushToUser(admin._id.toString(), {
            title: 'رفض ممرض طلباً',
            body: `رفض الممرض ${nurseName} الطلب #${id.slice(-6)} - يرجى تعيين بديل`,
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
