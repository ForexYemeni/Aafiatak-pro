// POST /api/special-requests/[id]/complete
// يسمح للممرض أو الإدارة بإنهاء تنفيذ الخدمة

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SpecialServiceRequest, Notification, User } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity, creditNurseEarnings } from '@/lib/api/helpers';
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

    // التحقق من الصلاحيات
    const isAdmin = user.role === 'admin' || user.role === 'subadmin';
    const isNurse = user.role === 'nurse' && specialRequest.nurseId?.toString() === user.userId;

    if (!isAdmin && !isNurse) {
      return createErrorResponse('ليس لديك صلاحية لإكمال هذا الطلب', 403, 'FORBIDDEN');
    }

    if (specialRequest.status !== 'in_progress') {
      return createErrorResponse('يجب أن يكون الطلب قيد التنفيذ قبل الإكمال', 400, 'INVALID_STATUS');
    }

    const body = await request.json();
    const { notes } = body;

    // ── إكمال التنفيذ ──
    specialRequest.completedAt = new Date();
    specialRequest.status = 'completed';

    // إضافة رسالة نظام
    specialRequest.messages.push({
      senderId: user.userId,
      senderRole: user.role,
      type: 'system',
      content: 'تم تنفيذ الخدمة - بانتظار تأكيد المستفيد',
      readBy: [user.userId],
      createdAt: new Date(),
    });

    specialRequest.lastMessageAt = new Date();
    specialRequest.lastMessageContent = 'تم تنفيذ الخدمة - بانتظار التأكيد';
    specialRequest.lastMessageSender = user.role;

    // زيادة عداد غير المقروء للمستفيد
    if (!specialRequest.unreadCount) {
      (specialRequest as any).unreadCount = new Map();
    }
    const beneficiaryIdStr = specialRequest.beneficiaryId.toString();
    const current = (specialRequest.unreadCount as Map<string, number>).get(beneficiaryIdStr) || 0;
    (specialRequest.unreadCount as Map<string, number>).set(beneficiaryIdStr, current + 1);

    await specialRequest.save();

    // ── إذا كان التنفيذ بواسطة ممرض، نُضيف الأرباح ──
    // ملاحظة: نستخدم نفس دالة creditNurseEarnings الموجودة في المشروع
    if (isNurse && specialRequest.nurseId && specialRequest.nursePayout && specialRequest.nursePayout > 0) {
      try {
        // نستخدم requestId كمعرف فريد لمنع الإضافة المزدوجة
        // نضيف prefix لتمييزه عن طلبات الخدمة العادية
        await creditNurseEarnings({
          requestId: `special-${id}`,
          nurseId: specialRequest.nurseId.toString(),
          beneficiaryId: specialRequest.beneficiaryId.toString(),
          amount: specialRequest.agreedPrice || 0,
          commission: specialRequest.commission || 0,
          nursePayout: specialRequest.nursePayout,
          paymentMethod: 'special_service',
        });
      } catch (e) {
        console.error('[SPECIAL REQUEST NURSE CREDIT ERROR]', e);
        // لا نريد إيقاف العملية إذا فشلت إضافة الأرباح
      }
    }

    // ── تسجيل النشاط ──
    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'complete_special_request',
      entity: 'SpecialServiceRequest',
      entityId: id,
      details: `إكمال تنفيذ الطلب #${specialRequest.orderNumber}`,
      request,
    });

    // ── إشعار للمستفيد ──
    try {
      const notifTitle = `تم تنفيذ خدمتك #${specialRequest.orderNumber}`;
      const notifBody = 'تم تنفيذ الخدمة بنجاح - يرجى تأكيد الاستلام وتقييم الخدمة';

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

    // ── إشعار للمدراء (إذا كان المنفذ ممرض) ──
    if (isNurse) {
      try {
        const admins = await User.find({ role: { $in: ['admin', 'subadmin'] }, isActive: { $ne: false } })
          .select('_id role')
          .lean();
        for (const admin of admins) {
          await Notification.create({
            userId: admin._id,
            userRole: (admin as any).role || 'admin',
            titleAr: `أكمل الممرض تنفيذ الطلب #${specialRequest.orderNumber}`,
            bodyAr: 'تم تنفيذ الخدمة - بانتظار تأكيد المستفيد',
            type: 'status_change',
            priority: 'medium',
            data: { requestId: id },
            actionUrl: `/admin/special-requests/${id}`,
            read: false,
          });
        }
      } catch {}
    }

    // ── إرسال أحداث Socket.IO فورية ──
    try {
      const eventPayload = {
        requestId: id,
        action: 'execution_completed',
        newStatus: specialRequest.status,
        completedAt: specialRequest.completedAt.toISOString(),
      };

      emitToUser(specialRequest.beneficiaryId.toString(), 'special_request_completed', eventPayload).catch(() => {});
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
      message: 'تم تنفيذ الخدمة بنجاح - بانتظار تأكيد المستفيد',
    });
  } catch (error) {
    console.error('[SPECIAL REQUEST COMPLETE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إكمال الخدمة', 500, 'INTERNAL_ERROR');
  }
}
