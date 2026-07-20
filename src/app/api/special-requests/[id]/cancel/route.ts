// POST /api/special-requests/[id]/cancel
// إلغاء طلب خدمة خاص (من الإدارة أو المستفيد)

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

    const { id } = await params;
    const specialRequest = await SpecialServiceRequest.findById(id);

    if (!specialRequest) {
      return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');
    }

    const isAdmin = user.role === 'admin' || user.role === 'subadmin';
    const isBeneficiary = user.role === 'beneficiary' && specialRequest.beneficiaryId.toString() === user.userId;

    if (!isAdmin && !isBeneficiary) {
      return createErrorResponse('ليس لديك صلاحية على هذا الطلب', 403, 'FORBIDDEN');
    }

    // لا يمكن إلغاء طلب مكتمل أو ملغي أو مرفوض
    if (['completed', 'cancelled', 'rejected'].includes(specialRequest.status)) {
      return createErrorResponse('لا يمكن إلغاء الطلب في الحالة الحالية', 400, 'INVALID_STATUS');
    }

    const body = await request.json();
    const { reason } = body;

    // ── إلغاء الطلب ──
    specialRequest.status = 'cancelled';
    specialRequest.cancelledAt = new Date();
    specialRequest.cancelReason = reason?.trim() || (isAdmin ? 'إلغاء بواسطة الإدارة' : 'إلغاء من قبل المستفيد');

    // إضافة رسالة نظام
    specialRequest.messages.push({
      senderId: user.userId,
      senderRole: user.role,
      type: 'system',
      content: `تم إلغاء الطلب - السبب: ${specialRequest.cancelReason}`,
      readBy: [user.userId],
      createdAt: new Date(),
    });

    specialRequest.lastMessageAt = new Date();
    specialRequest.lastMessageContent = `تم إلغاء الطلب: ${specialRequest.cancelReason}`;
    specialRequest.lastMessageSender = user.role;

    // زيادة عداد غير المقروء
    if (!specialRequest.unreadCount) {
      (specialRequest as any).unreadCount = new Map();
    }
    if (!isBeneficiary) {
      const beneficiaryIdStr = specialRequest.beneficiaryId.toString();
      const current = (specialRequest.unreadCount as Map<string, number>).get(beneficiaryIdStr) || 0;
      (specialRequest.unreadCount as Map<string, number>).set(beneficiaryIdStr, current + 1);
    }
    if (!isAdmin) {
      const admins = await User.find({ role: { $in: ['admin', 'subadmin'] }, isActive: { $ne: false } })
        .select('_id')
        .lean();
      for (const admin of admins) {
        const adminIdStr = admin._id.toString();
        const current = (specialRequest.unreadCount as Map<string, number>).get(adminIdStr) || 0;
        (specialRequest.unreadCount as Map<string, number>).set(adminIdStr, current + 1);
      }
    }

    await specialRequest.save();

    // ── تسجيل النشاط ──
    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'cancel_special_request',
      entity: 'SpecialServiceRequest',
      entityId: id,
      details: `إلغاء الطلب #${specialRequest.orderNumber} - السبب: ${specialRequest.cancelReason}`,
      request,
    });

    // ── إشعار للأطراف الأخرى ──
    try {
      const notifTitle = `تم إلغاء الطلب #${specialRequest.orderNumber}`;
      const notifBody = `تم إلغاء الطلب - السبب: ${specialRequest.cancelReason}`;

      // إشعار المستفيد (إذا كان الملغي من الإدارة)
      if (!isBeneficiary) {
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
      }

      // إشعار المدراء (إذا كان الملغي من المستفيد)
      if (!isAdmin) {
        const admins = await User.find({ role: { $in: ['admin', 'subadmin'] }, isActive: { $ne: false } })
          .select('_id role')
          .lean();
        for (const admin of admins) {
          await Notification.create({
            userId: admin._id,
            userRole: (admin as any).role || 'admin',
            titleAr: notifTitle,
            bodyAr: notifBody,
            type: 'status_change',
            priority: 'high',
            data: { requestId: id, voiceAlert: 'true', voiceText: notifBody },
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
            userRole: (admin as any).role || 'admin',
            data: { requestId: id, voiceAlert: true, voiceText: notifBody },
          }).catch(() => {});
        }
      }

      // إشعار الممرض إذا كان معيناً
      if (specialRequest.nurseId) {
        await Notification.create({
          userId: specialRequest.nurseId,
          userRole: 'nurse',
          titleAr: notifTitle,
          bodyAr: notifBody,
          type: 'status_change',
          priority: 'medium',
          data: { requestId: id },
          actionUrl: '/nurse/special-requests',
          read: false,
        });
        sendPushToUser(specialRequest.nurseId.toString(), {
          title: notifTitle,
          body: notifBody,
          type: 'status_change',
          priority: 'medium',
          url: '/nurse/special-requests',
          userRole: 'nurse',
          data: { requestId: id },
        }).catch(() => {});
      }
    } catch {}

    // ── إرسال أحداث Socket.IO فورية ──
    try {
      const eventPayload = {
        requestId: id,
        action: 'cancelled',
        newStatus: 'cancelled',
        cancelReason: specialRequest.cancelReason,
        cancelledAt: specialRequest.cancelledAt.toISOString(),
      };

      emitToUser(specialRequest.beneficiaryId.toString(), 'special_request_cancelled', eventPayload).catch(() => {});
      if (specialRequest.nurseId) {
        emitToUser(specialRequest.nurseId.toString(), 'special_request_cancelled', eventPayload).catch(() => {});
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
      data: { requestId: id, newStatus: 'cancelled' },
      message: 'تم إلغاء الطلب بنجاح',
    });
  } catch (error) {
    console.error('[SPECIAL REQUEST CANCEL ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إلغاء الطلب', 500, 'INTERNAL_ERROR');
  }
}
