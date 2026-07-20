// POST /api/special-requests/[id]/verify-payment
// يسمح للإدارة بقبول أو رفض إثبات الدفع

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SpecialServiceRequest, Notification } from '@/models/mongoose';
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

    if (specialRequest.status !== 'awaiting_payment_review') {
      return createErrorResponse('لا يمكن مراجعة الدفع في الحالة الحالية', 400, 'INVALID_STATUS');
    }

    const body = await request.json();
    const { action, rejectionReason } = body; // action: 'verify' | 'reject'

    if (!['verify', 'reject'].includes(action)) {
      return createErrorResponse('الإجراء يجب أن يكون verify أو reject', 400, 'VALIDATION_ERROR');
    }

    if (action === 'reject' && (!rejectionReason || rejectionReason.trim().length === 0)) {
      return createErrorResponse('سبب الرفض مطلوب', 400, 'VALIDATION_ERROR');
    }

    if (action === 'verify') {
      // ── قبول الدفع ──
      specialRequest.paymentStatus = 'completed';
      specialRequest.paymentVerifiedAt = new Date();
      specialRequest.status = 'paid';
      specialRequest.paymentRejectionReason = undefined;

      // إضافة رسالة نظام
      specialRequest.messages.push({
        senderId: user.userId,
        senderRole: user.role,
        type: 'system',
        content: `تم قبول الدفع بنجاح - بانتظار تعيين ممرض أو تنفيذ الخدمة`,
        readBy: [user.userId],
        createdAt: new Date(),
      });
    } else {
      // ── رفض الدفع ──
      specialRequest.paymentStatus = 'failed';
      specialRequest.paymentRejectionReason = rejectionReason.trim();
      specialRequest.hasPaymentProof = false;
      specialRequest.paymentProofData = undefined;
      specialRequest.status = 'awaiting_payment'; // العودة لبانتظار الدفع

      // إضافة رسالة في المحادثة بسببة الرفض
      specialRequest.messages.push({
        senderId: user.userId,
        senderRole: user.role,
        type: 'rejection_reason',
        content: `تم رفض إثبات الدفع - السبب: ${rejectionReason.trim()}`,
        readBy: [user.userId],
        createdAt: new Date(),
      });
    }

    specialRequest.lastMessageAt = new Date();
    specialRequest.lastMessageContent = action === 'verify'
      ? 'تم قبول الدفع بنجاح'
      : `تم رفض الدفع - ${rejectionReason.trim()}`;
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
      action: action === 'verify' ? 'verify_special_request_payment' : 'reject_special_request_payment',
      entity: 'SpecialServiceRequest',
      entityId: id,
      details: action === 'verify'
        ? `قبول دفع الطلب #${specialRequest.orderNumber}`
        : `رفض دفع الطلب #${specialRequest.orderNumber} - السبب: ${rejectionReason}`,
      request,
    });

    // ── إشعار للمستفيد ──
    try {
      const notifTitle = action === 'verify'
        ? `تم قبول الدفع للطلب #${specialRequest.orderNumber}`
        : `تم رفض الدفع للطلب #${specialRequest.orderNumber}`;
      const notifBody = action === 'verify'
        ? 'تم قبول إثبات الدفع بنجاح - سيتم البدء في تنفيذ الخدمة قريباً'
        : `تم رفض إثبات الدفع - السبب: ${rejectionReason.trim()}. يرجى رفع إثبات دفع جديد.`;

      await Notification.create({
        userId: specialRequest.beneficiaryId,
        userRole: 'beneficiary',
        titleAr: notifTitle,
        bodyAr: notifBody,
        type: action === 'verify' ? 'payment' : 'system',
        priority: 'high',
        data: {
          requestId: id,
          action,
          rejectionReason: action === 'reject' ? rejectionReason : undefined,
          voiceAlert: 'true',
          voiceText: notifBody,
        },
        actionUrl: `/beneficiary/special-requests/${id}`,
        voiceEnabled: true,
        read: false,
      });

      sendPushToUser(specialRequest.beneficiaryId.toString(), {
        title: notifTitle,
        body: notifBody,
        type: action === 'verify' ? 'payment' : 'system',
        priority: 'high',
        url: `/beneficiary/special-requests/${id}`,
        userRole: 'beneficiary',
        data: { requestId: id, action, voiceAlert: true, voiceText: notifBody },
      }).catch(() => {});
    } catch {}

    // ── إرسال أحداث Socket.IO فورية ──
    try {
      const eventPayload = {
        requestId: id,
        action,
        newStatus: specialRequest.status,
        rejectionReason: action === 'reject' ? rejectionReason : undefined,
        verifiedAt: new Date().toISOString(),
      };

      emitToUser(specialRequest.beneficiaryId.toString(), 'special_request_payment_verified', eventPayload).catch(() => {});
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
        action,
        newStatus: specialRequest.status,
      },
      message: action === 'verify'
        ? 'تم قبول الدفع بنجاح'
        : 'تم رفض الدفع - تم إرسال سبب الرفض للمستفيد',
    });
  } catch (error) {
    console.error('[SPECIAL REQUEST VERIFY PAYMENT ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء مراجعة الدفع', 500, 'INTERNAL_ERROR');
  }
}
