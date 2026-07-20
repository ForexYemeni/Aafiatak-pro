// POST /api/special-requests/[id]/assign-nurse
// يسمح للإدارة بتعيين ممرض لتنفيذ الطلب

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SpecialServiceRequest, Nurse, Notification } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';
import { emitToUser, emitToAdmins } from '@/lib/notifications/socket-client';
import { sendPushToUser } from '@/lib/notifications/push-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { id } = await params;
    const specialRequest = await SpecialServiceRequest.findById(id);

    if (!specialRequest) {
      return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');
    }

    if (specialRequest.status !== 'paid') {
      return createErrorResponse('يجب أن يكون الطلب مدفوعاً قبل تعيين ممرض', 400, 'INVALID_STATUS');
    }

    const body = await request.json();
    const { nurseId } = body;

    if (!nurseId) {
      return createErrorResponse('معرف الممرض مطلوب', 400, 'VALIDATION_ERROR');
    }

    // التحقق من وجود الممرض
    const nurse = await Nurse.findById(nurseId).select('name phone rating isAvailable isOnline').lean();
    if (!nurse) {
      return createErrorResponse('الممرض غير موجود', 404, 'NURSE_NOT_FOUND');
    }

    // تعيين الممرض
    specialRequest.nurseId = nurseId as any;
    specialRequest.nurseAssignedAt = new Date();
    specialRequest.nurseAcceptedAt = undefined;
    specialRequest.nurseRejectedAt = undefined;
    specialRequest.status = 'awaiting_nurse';

    // إضافة رسالة نظام
    specialRequest.messages.push({
      senderId: user.userId,
      senderRole: user.role,
      type: 'system',
      content: `تم تعيين الممرض/ـة ${nurse.name} للطلب - بانتظار قبول المهمة`,
      readBy: [user.userId],
      createdAt: new Date(),
    });

    specialRequest.lastMessageAt = new Date();
    specialRequest.lastMessageContent = `تم تعيين ${nurse.name} للطلب`;
    specialRequest.lastMessageSender = user.role;

    // زيادة عداد غير المقروء للمستفيد والممرض
    if (!specialRequest.unreadCount) {
      (specialRequest as any).unreadCount = new Map();
    }
    const beneficiaryIdStr = specialRequest.beneficiaryId.toString();
    const beneficiaryCurrent = (specialRequest.unreadCount as Map<string, number>).get(beneficiaryIdStr) || 0;
    (specialRequest.unreadCount as Map<string, number>).set(beneficiaryIdStr, beneficiaryCurrent + 1);
    (specialRequest.unreadCount as Map<string, number>).set(nurseId, 1);

    await specialRequest.save();

    // ── تسجيل النشاط ──
    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'assign_nurse_to_special_request',
      entity: 'SpecialServiceRequest',
      entityId: id,
      details: `تعيين الممرض ${nurse.name} للطلب #${specialRequest.orderNumber}`,
      request,
    });

    // ── إشعار للممرض ──
    try {
      const notifTitle = `مهمة جديدة - طلب خدمة خاصة #${specialRequest.orderNumber}`;
      const notifBody = `تم تعيينك لطلب خدمة خاصة: ${specialRequest.serviceName} - المبلغ بعد خصم العمولة: ${specialRequest.nursePayout || 0} ر.ي`;

      await Notification.create({
        userId: nurseId,
        userRole: 'nurse',
        titleAr: notifTitle,
        bodyAr: notifBody,
        type: 'assignment',
        priority: 'high',
        data: {
          requestId: id,
          nursePayout: specialRequest.nursePayout,
          voiceAlert: 'true',
          voiceText: `لديك مهمة جديدة. المبلغ المتوقع: ${specialRequest.nursePayout || 0} ريال`,
        },
        actionUrl: `/nurse/special-requests/${id}`,
        voiceEnabled: true,
        read: false,
      });

      sendPushToUser(nurseId, {
        title: notifTitle,
        body: notifBody,
        type: 'assignment',
        priority: 'high',
        url: `/nurse/special-requests/${id}`,
        userRole: 'nurse',
        data: { requestId: id, nursePayout: specialRequest.nursePayout, voiceAlert: true, voiceText: `لديك مهمة جديدة بقيمة ${specialRequest.nursePayout || 0} ريال` },
      }).catch(() => {});
    } catch {}

    // ── إشعار للمستفيد ──
    try {
      await Notification.create({
        userId: specialRequest.beneficiaryId,
        userRole: 'beneficiary',
        titleAr: `تم تعيين ممرض/ـة لطلبك #${specialRequest.orderNumber}`,
        bodyAr: `تم تعيين ${nurse.name} لتنفيذ طلبك - بانتظار قبول المهمة`,
        type: 'status_change',
        priority: 'medium',
        data: { requestId: id, nurseName: nurse.name },
        actionUrl: `/beneficiary/special-requests/${id}`,
        read: false,
      });

      sendPushToUser(specialRequest.beneficiaryId.toString(), {
        title: 'تم تعيين ممرض/ـة',
        body: `تم تعيين ${nurse.name} لتنفيذ طلبك`,
        type: 'status_change',
        priority: 'medium',
        url: `/beneficiary/special-requests/${id}`,
        userRole: 'beneficiary',
        data: { requestId: id, nurseName: nurse.name },
      }).catch(() => {});
    } catch {}

    // ── إرسال أحداث Socket.IO فورية ──
    try {
      const eventPayload = {
        requestId: id,
        action: 'nurse_assigned',
        nurseId,
        nurseName: nurse.name,
        nursePayout: specialRequest.nursePayout,
        newStatus: specialRequest.status,
        assignedAt: new Date().toISOString(),
      };

      emitToUser(nurseId, 'special_request_assigned', eventPayload).catch(() => {});
      emitToUser(specialRequest.beneficiaryId.toString(), 'special_request_assigned', eventPayload).catch(() => {});
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
      data: {
        requestId: id,
        nurseId,
        nurseName: nurse.name,
        newStatus: specialRequest.status,
      },
      message: 'تم تعيين الممرض بنجاح - بانتظار قبول المهمة',
    });
  } catch (error) {
    console.error('[SPECIAL REQUEST ASSIGN NURSE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تعيين الممرض', 500, 'INTERNAL_ERROR');
  }
}
