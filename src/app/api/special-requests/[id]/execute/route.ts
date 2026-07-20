// POST /api/special-requests/[id]/execute
// يسمح للإدارة بتنفيذ الخدمة مباشرة (بدون تعيين ممرض)

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SpecialServiceRequest, Notification } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity, creditNurseEarnings } from '@/lib/api/helpers';
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

    // التحقق من الحالة - يجب أن تكون مدفوعة
    if (specialRequest.status !== 'paid') {
      return createErrorResponse('يجب أن يكون الطلب مدفوعاً قبل التنفيذ', 400, 'INVALID_STATUS');
    }

    const body = await request.json();
    const { notes } = body;

    // ── تنفيذ مباشر من الإدارة ──
    specialRequest.executeByAdmin = true;
    specialRequest.startedAt = new Date();
    specialRequest.status = 'in_progress';

    // إضافة رسالة نظام
    specialRequest.messages.push({
      senderId: user.userId,
      senderRole: user.role,
      type: 'system',
      content: 'بدأ تنفيذ الخدمة بواسطة الإدارة',
      readBy: [user.userId],
      createdAt: new Date(),
    });

    specialRequest.lastMessageAt = new Date();
    specialRequest.lastMessageContent = 'بدأ تنفيذ الخدمة بواسطة الإدارة';
    specialRequest.lastMessageSender = user.role;

    // زيادة عداد غير المقروء للمستفيد
    if (!specialRequest.unreadCount) {
      (specialRequest as any).unreadCount = new Map();
    }
    const beneficiaryIdStr = specialRequest.beneficiaryId.toString();
    const current = (specialRequest.unreadCount as Map<string, number>).get(beneficiaryIdStr) || 0;
    (specialRequest.unreadCount as Map<string, number>).set(beneficiaryIdStr, current + 1);

    await specialRequest.save();

    // ── تسجيل النشاط ──
    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'execute_special_request_by_admin',
      entity: 'SpecialServiceRequest',
      entityId: id,
      details: `بدء تنفيذ الطلب #${specialRequest.orderNumber} بواسطة الإدارة`,
      request,
    });

    // ── إشعار للمستفيد ──
    try {
      const notifTitle = `بدأ تنفيذ طلبك #${specialRequest.orderNumber}`;
      const notifBody = 'بدأت الإدارة في تنفيذ طلب الخدمة الخاصة بك مباشرة';

      await Notification.create({
        userId: specialRequest.beneficiaryId,
        userRole: 'beneficiary',
        titleAr: notifTitle,
        bodyAr: notifBody,
        type: 'status_change',
        priority: 'high',
        data: { requestId: id, voiceAlert: 'true', voiceText: notifBody },
        actionUrl: `/beneficiary/special-requests/${id}`,
        voiceEnabled: true,
        read: false,
      });

      sendPushToUser(specialRequest.beneficiaryId.toString(), {
        title: notifTitle,
        body: notifBody,
        type: 'status_change',
        priority: 'high',
        url: `/beneficiary/special-requests/${id}`,
        userRole: 'beneficiary',
        data: { requestId: id, voiceAlert: true, voiceText: notifBody },
      }).catch(() => {});
    } catch {}

    // ── إرسال أحداث Socket.IO فورية ──
    try {
      const eventPayload = {
        requestId: id,
        action: 'execute_started',
        newStatus: specialRequest.status,
        executeByAdmin: true,
        startedAt: specialRequest.startedAt.toISOString(),
      };

      emitToUser(specialRequest.beneficiaryId.toString(), 'special_request_execution_started', eventPayload).catch(() => {});
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
      data: { requestId: id, newStatus: specialRequest.status },
      message: 'تم بدء تنفيذ الخدمة بواسطة الإدارة',
    });
  } catch (error) {
    console.error('[SPECIAL REQUEST EXECUTE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء بدء التنفيذ', 500, 'INTERNAL_ERROR');
  }
}
