// POST /api/special-requests/[id]/confirm-receipt
// يسمح للمستفيد بتأكيد استلام الخدمة بعد التنفيذ

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

    if (specialRequest.status !== 'completed') {
      return createErrorResponse('يجب أن يكون الطلب مكتمل التنفيذ قبل التأكيد', 400, 'INVALID_STATUS');
    }

    // ── تأكيد الاستلام ──
    specialRequest.beneficiaryConfirmedAt = new Date();

    // إضافة رسالة نظام
    specialRequest.messages.push({
      senderId: user.userId,
      senderRole: 'beneficiary',
      type: 'system',
      content: 'أكد المستفيد استلام الخدمة',
      readBy: [user.userId],
      createdAt: new Date(),
    });

    specialRequest.lastMessageAt = new Date();
    specialRequest.lastMessageContent = 'تم تأكيد استلام الخدمة';
    specialRequest.lastMessageSender = 'beneficiary';

    // زيادة عداد غير المقروء للمدراء والممرض
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
    if (specialRequest.nurseId) {
      const nurseIdStr = specialRequest.nurseId.toString();
      const current = (specialRequest.unreadCount as Map<string, number>).get(nurseIdStr) || 0;
      (specialRequest.unreadCount as Map<string, number>).set(nurseIdStr, current + 1);
    }

    await specialRequest.save();

    // ── تسجيل النشاط ──
    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'confirm_special_request_receipt',
      entity: 'SpecialServiceRequest',
      entityId: id,
      details: `تأكيد استلام الخدمة للطلب #${specialRequest.orderNumber}`,
      request,
    });

    // ── إشعار للمدراء ──
    try {
      for (const admin of admins) {
        const adminRole = (admin as any).role || 'admin';
        await Notification.create({
          userId: admin._id,
          userRole: adminRole,
          titleAr: `تم تأكيد استلام الطلب #${specialRequest.orderNumber}`,
          bodyAr: 'أكد المستفيد استلام الخدمة - يرجى انتظار التقييم',
          type: 'status_change',
          priority: 'medium',
          data: { requestId: id },
          actionUrl: `/admin/special-requests/${id}`,
          read: false,
        });
      }
    } catch {}

    // ── إشعار للممرض ──
    if (specialRequest.nurseId) {
      try {
        await Notification.create({
          userId: specialRequest.nurseId,
          userRole: 'nurse',
          titleAr: `تم تأكيد استلام خدمتك #${specialRequest.orderNumber}`,
          bodyAr: 'أكد المستفيد استلام الخدمة بنجاح - شكراً لك',
          type: 'status_change',
          priority: 'medium',
          data: { requestId: id },
          actionUrl: '/nurse/special-requests',
          read: false,
        });
        sendPushToUser(specialRequest.nurseId.toString(), {
          title: 'تم تأكيد استلام الخدمة',
          body: 'أكد المستفيد استلام خدمتك بنجاح',
          type: 'status_change',
          priority: 'medium',
          url: '/nurse/special-requests',
          userRole: 'nurse',
          data: { requestId: id },
        }).catch(() => {});
      } catch {}
    }

    // ── إرسال أحداث Socket.IO فورية ──
    try {
      const eventPayload = {
        requestId: id,
        action: 'receipt_confirmed',
        confirmedAt: specialRequest.beneficiaryConfirmedAt.toISOString(),
      };

      if (specialRequest.nurseId) {
        emitToUser(specialRequest.nurseId.toString(), 'special_request_receipt_confirmed', eventPayload).catch(() => {});
      }
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
      data: { requestId: id },
      message: 'تم تأكيد الاستلام - يرجى تقييم الخدمة',
    });
  } catch (error) {
    console.error('[SPECIAL REQUEST CONFIRM RECEIPT ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تأكيد الاستلام', 500, 'INTERNAL_ERROR');
  }
}
