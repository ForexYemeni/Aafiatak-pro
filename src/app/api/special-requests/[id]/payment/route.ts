// POST /api/special-requests/[id]/payment
// يسمح للمستفيد برفع إثبات الدفع للطلب الخاص

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SpecialServiceRequest, Notification, User } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';
import { emitToAdmins, emitToUser } from '@/lib/notifications/socket-client';
import { sendPushToUser } from '@/lib/notifications/push-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const { id } = await params;
    const specialRequest = await SpecialServiceRequest.findById(id);

    if (!specialRequest) {
      return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');
    }

    if (specialRequest.beneficiaryId.toString() !== user.userId) {
      return createErrorResponse('ليس لديك صلاحية على هذا الطلب', 403, 'FORBIDDEN');
    }

    // التحقق من الحالة - يجب أن تكون بانتظار الدفع
    if (!['awaiting_payment', 'awaiting_payment_review'].includes(specialRequest.status)) {
      return createErrorResponse('لا يمكن رفع إثبات الدفع في الحالة الحالية', 400, 'INVALID_STATUS');
    }

    const body = await request.json();
    const { paymentMethod, paymentMethodId, hasPaymentProof, paymentProofData } = body;

    if (!hasPaymentProof || !paymentProofData) {
      return createErrorResponse('إثبات الدفع مطلوب', 400, 'VALIDATION_ERROR');
    }

    // تحديث بيانات الدفع
    specialRequest.paymentMethod = paymentMethod || 'bank_transfer';
    specialRequest.paymentMethodId = paymentMethodId || undefined;
    specialRequest.hasPaymentProof = true;
    specialRequest.paymentProofData = paymentProofData;
    specialRequest.paymentStatus = 'awaiting_confirmation';
    specialRequest.status = 'awaiting_payment_review';

    // إضافة رسالة في المحادثة بنوع payment_proof
    specialRequest.messages.push({
      senderId: user.userId,
      senderRole: 'beneficiary',
      type: 'payment_proof',
      content: `تم رفع إثبات الدفع - طريقة الدفع: ${paymentMethod || 'تحويل'}`,
      imageUrl: paymentProofData, // عرض الإثبات كصورة
      readBy: [user.userId],
      createdAt: new Date(),
    });

    specialRequest.lastMessageAt = new Date();
    specialRequest.lastMessageContent = 'تم رفع إثبات الدفع';
    specialRequest.lastMessageSender = 'beneficiary';

    // زيادة عداد غير المقروء للمدراء
    if (!specialRequest.unreadCount) {
      (specialRequest as any).unreadCount = new Map();
    }
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
      action: 'submit_special_request_payment',
      entity: 'SpecialServiceRequest',
      entityId: id,
      details: `رفع إثبات دفع للطلب #${specialRequest.orderNumber}`,
      request,
    });

    // ── إشعار للمدراء ──
    try {
      const notifTitle = `إثبات دفع جديد للطلب #${specialRequest.orderNumber}`;
      const notifBody = `رفع ${specialRequest.beneficiaryName} إثبات دفع - يرجى المراجعة`;

      for (const admin of admins) {
        const adminRole = (admin as any).role || 'admin';
        await Notification.create({
          userId: admin._id,
          userRole: adminRole,
          titleAr: notifTitle,
          bodyAr: notifBody,
          type: 'payment',
          priority: 'high',
          data: { requestId: id, voiceAlert: 'true', voiceText: notifBody },
          actionUrl: `/admin/special-requests/${id}`,
          voiceEnabled: true,
          read: false,
        });
        sendPushToUser(admin._id.toString(), {
          title: notifTitle,
          body: notifBody,
          type: 'payment',
          priority: 'high',
          url: `/admin/special-requests/${id}`,
          userRole: adminRole,
          data: { requestId: id, voiceAlert: true, voiceText: notifBody },
        }).catch(() => {});
      }
    } catch {}

    // ── إشعار للمستفيد ──
    try {
      await Notification.create({
        userId: user.userId,
        userRole: 'beneficiary',
        titleAr: 'تم استلام إثبات الدفع',
        bodyAr: 'تم رفع إثبات الدفع بنجاح - سيتم مراجعته من الإدارة خلال وقت قصير',
        type: 'payment',
        priority: 'medium',
        data: { requestId: id },
        actionUrl: `/beneficiary/special-requests/${id}`,
        read: false,
      });
      sendPushToUser(user.userId, {
        title: 'تم استلام إثبات الدفع',
        body: 'سيتم مراجعته من الإدارة خلال وقت قصير',
        type: 'payment',
        priority: 'medium',
        url: `/beneficiary/special-requests/${id}`,
        userRole: 'beneficiary',
        data: { requestId: id },
      }).catch(() => {});
    } catch {}

    // ── إرسال أحداث Socket.IO فورية ──
    try {
      const eventPayload = {
        requestId: id,
        action: 'payment_proof_submitted',
        newStatus: specialRequest.status,
        submittedAt: new Date().toISOString(),
      };

      emitToAdmins('special_request_payment_submitted', eventPayload).catch(() => {});
      emitToAdmins('data_change', {
        entity: 'special_request',
        entityId: id,
        action: 'updated',
        changedBy: user.userId,
        changedByRole: user.role,
        timestamp: new Date().toISOString(),
        data: eventPayload,
      }).catch(() => {});
      emitToUser(user.userId, 'data_change', {
        entity: 'special_request',
        entityId: id,
        action: 'updated',
        timestamp: new Date().toISOString(),
        data: eventPayload,
      }).catch(() => {});
    } catch {}

    return Response.json({
      success: true,
      data: { requestId: id, newStatus: specialRequest.status },
      message: 'تم رفع إثبات الدفع بنجاح - بانتظار المراجعة',
    });
  } catch (error) {
    console.error('[SPECIAL REQUEST PAYMENT ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء رفع إثبات الدفع', 500, 'INTERNAL_ERROR');
  }
}
