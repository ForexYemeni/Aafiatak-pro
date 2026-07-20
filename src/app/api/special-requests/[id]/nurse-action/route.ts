// POST /api/special-requests/[id]/nurse-action
// يسمح للممرض بقبول أو رفض المهمة المعينة له

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SpecialServiceRequest, Notification, User } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';
import { emitToUser, emitToAdmins } from '@/lib/notifications/socket-client';
import { sendPushToUser } from '@/lib/notifications/push-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const { id } = await params;
    const specialRequest = await SpecialServiceRequest.findById(id);

    if (!specialRequest) {
      return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');
    }

    if (!specialRequest.nurseId || specialRequest.nurseId.toString() !== user.userId) {
      return createErrorResponse('لم يتم تعيينك لهذا الطلب', 403, 'FORBIDDEN');
    }

    if (specialRequest.status !== 'awaiting_nurse') {
      return createErrorResponse('لا يمكن اتخاذ إجراء في الحالة الحالية', 400, 'INVALID_STATUS');
    }

    const body = await request.json();
    const { action } = body; // action: 'accept' | 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return createErrorResponse('الإجراء يجب أن يكون accept أو reject', 400, 'VALIDATION_ERROR');
    }

    if (action === 'accept') {
      // ── قبول المهمة ──
      specialRequest.nurseAcceptedAt = new Date();
      specialRequest.startedAt = new Date();
      specialRequest.status = 'in_progress';

      specialRequest.messages.push({
        senderId: user.userId,
        senderRole: 'nurse',
        type: 'system',
        content: 'قبل الممرض/ـة المهمة - بدأ التنفيذ',
        readBy: [user.userId],
        createdAt: new Date(),
      });
    } else {
      // ── رفض المهمة ──
      specialRequest.nurseRejectedAt = new Date();
      specialRequest.nurseId = undefined;
      specialRequest.status = 'paid'; // العودة لبانتظار تعيين ممرض آخر
      specialRequest.nurseAssignedAt = undefined;

      specialRequest.messages.push({
        senderId: user.userId,
        senderRole: 'nurse',
        type: 'system',
        content: 'رفض الممرض/ـة المهمة - عاد الطلب للإدارة لاختيار ممرض آخر',
        readBy: [user.userId],
        createdAt: new Date(),
      });
    }

    specialRequest.lastMessageAt = new Date();
    specialRequest.lastMessageContent = action === 'accept'
      ? 'تم قبول المهمة - بدأ التنفيذ'
      : 'تم رفض المهمة - عاد الطلب للإدارة';
    specialRequest.lastMessageSender = 'nurse';

    // زيادة عداد غير المقروء للمستفيد والمدراء
    if (!specialRequest.unreadCount) {
      (specialRequest as any).unreadCount = new Map();
    }
    const beneficiaryIdStr = specialRequest.beneficiaryId.toString();
    const beneficiaryCurrent = (specialRequest.unreadCount as Map<string, number>).get(beneficiaryIdStr) || 0;
    (specialRequest.unreadCount as Map<string, number>).set(beneficiaryIdStr, beneficiaryCurrent + 1);

    const admins = await User.find({ role: { $in: ['admin', 'subadmin'] }, isActive: { $ne: false } })
      .select('_id')
      .lean();
    for (const admin of admins) {
      const adminIdStr = admin._id.toString();
      const current = (specialRequest.unreadCount as Map<string, number>).get(adminIdStr) || 0;
      (specialRequest.unreadCount as Map<string, number>).set(adminIdStr, current + 1);
    }

    await specialRequest.save();

    // ── تسجيل النشاط ──
    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: action === 'accept' ? 'accept_special_request_task' : 'reject_special_request_task',
      entity: 'SpecialServiceRequest',
      entityId: id,
      details: action === 'accept'
        ? `قبول مهمة الطلب #${specialRequest.orderNumber}`
        : `رفض مهمة الطلب #${specialRequest.orderNumber}`,
      request,
    });

    // ── إشعار للمدراء ──
    try {
      const notifTitle = action === 'accept'
        ? `تم قبول مهمة الطلب #${specialRequest.orderNumber}`
        : `تم رفض مهمة الطلب #${specialRequest.orderNumber}`;
      const notifBody = action === 'accept'
        ? 'بدأ الممرض/ـة في تنفيذ المهمة'
        : 'رفض الممرض/ـة المهمة - يرجى تعيين ممرض آخر';

      for (const admin of admins) {
        const adminRole = (admin as any).role || 'admin';
        await Notification.create({
          userId: admin._id,
          userRole: adminRole,
          titleAr: notifTitle,
          bodyAr: notifBody,
          type: 'status_change',
          priority: 'high',
          data: { requestId: id, action, voiceAlert: 'true', voiceText: notifBody },
          actionUrl: `/admin/special-requests/${id}`,
          voiceEnabled: true,
          read: false,
        });
        sendPushToUser(admin._id.toString(), {
          title: notifTitle,
          body: notifBody,
          type: 'status_change',
          priority: 'high',
          url: `/admin/special-requests/${id}`,
          userRole: adminRole,
          data: { requestId: id, action, voiceAlert: true, voiceText: notifBody },
        }).catch(() => {});
      }
    } catch {}

    // ── إشعار للمستفيد ──
    try {
      const notifTitle = action === 'accept'
        ? `بدأ تنفيذ طلبك #${specialRequest.orderNumber}`
        : `جارٍ تعيين ممرض آخر لطلبك #${specialRequest.orderNumber}`;
      const notifBody = action === 'accept'
        ? 'قبل الممرض/ـة المهمة وبدأ في التنفيذ'
        : 'لم يتمكن الممرض من قبول المهمة - جارٍ البحث عن ممرض آخر';

      await Notification.create({
        userId: specialRequest.beneficiaryId,
        userRole: 'beneficiary',
        titleAr: notifTitle,
        bodyAr: notifBody,
        type: 'status_change',
        priority: 'medium',
        data: { requestId: id, action, voiceAlert: 'false' },
        actionUrl: `/beneficiary/special-requests/${id}`,
        read: false,
      });

      sendPushToUser(specialRequest.beneficiaryId.toString(), {
        title: notifTitle,
        body: notifBody,
        type: 'status_change',
        priority: 'medium',
        url: `/beneficiary/special-requests/${id}`,
        userRole: 'beneficiary',
        data: { requestId: id, action },
      }).catch(() => {});
    } catch {}

    // ── إرسال أحداث Socket.IO فورية ──
    try {
      const eventPayload = {
        requestId: id,
        action: action === 'accept' ? 'task_accepted' : 'task_rejected',
        newStatus: specialRequest.status,
        nurseId: user.userId,
        actedAt: new Date().toISOString(),
      };

      emitToUser(specialRequest.beneficiaryId.toString(), 'special_request_nurse_action', eventPayload).catch(() => {});
      emitToAdmins('special_request_nurse_action', eventPayload).catch(() => {});
      emitToAdmins('data_change', {
        entity: 'special_request',
        entityId: id,
        action: 'updated',
        changedBy: user.userId,
        changedByRole: user.role,
        timestamp: new Date().toISOString(),
        data: eventPayload,
      }).catch(() => {});
    } catch {}

    return Response.json({
      success: true,
      data: { requestId: id, action, newStatus: specialRequest.status },
      message: action === 'accept'
        ? 'تم قبول المهمة بنجاح - بدأ التنفيذ'
        : 'تم رفض المهمة - عاد الطلب للإدارة',
    });
  } catch (error) {
    console.error('[SPECIAL REQUEST NURSE ACTION ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء اتخاذ الإجراء', 500, 'INTERNAL_ERROR');
  }
}
