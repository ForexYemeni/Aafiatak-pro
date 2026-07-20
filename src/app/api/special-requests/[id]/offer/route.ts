// POST /api/special-requests/[id]/offer
// يسمح للإدارة بإرسال عرض سعر للمستفيد داخل المحادثة

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SpecialServiceRequest, Notification } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';
import { emitToUser, emitToAdmins } from '@/lib/notifications/socket-client';
import { sendPushToUser } from '@/lib/notifications/push-service';
import { serializeDoc } from '@/lib/mongoose/serialize';

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

    // التحقق من الحالة - لا يمكن إرسال عرض إذا كان الطلب مكتمل أو ملغي أو مرفوض
    if (['completed', 'cancelled', 'rejected', 'in_progress', 'paid', 'awaiting_nurse'].includes(specialRequest.status)) {
      return createErrorResponse(`لا يمكن إرسال عرض سعر في الحالة الحالية (${specialRequest.status})`, 400, 'INVALID_STATUS');
    }

    const body = await request.json();
    const { price, duration, notes } = body;

    // التحقق من الحقول المطلوبة
    if (typeof price !== 'number' || price <= 0) {
      return createErrorResponse('السعر يجب أن يكون رقماً موجباً', 400, 'VALIDATION_ERROR');
    }
    if (!duration || typeof duration !== 'string' || duration.trim().length === 0) {
      return createErrorResponse('مدة التنفيذ مطلوبة', 400, 'VALIDATION_ERROR');
    }

    // إنشاء عرض جديد
    const offerIndex = specialRequest.offers.length + 1;
    const newOffer = {
      offerIndex,
      price,
      duration: duration.trim(),
      notes: notes?.trim() || undefined,
      status: 'pending' as const,
      sentBy: user.userId as any,
      sentByRole: user.role as 'admin' | 'subadmin',
      sentAt: new Date(),
    };

    specialRequest.offers.push(newOffer);
    specialRequest.currentOfferId = (specialRequest.offers[specialRequest.offers.length - 1] as any)._id;

    // إضافة رسالة في المحادثة بنوع "offer"
    const offerMessage = {
      senderId: user.userId,
      senderRole: user.role,
      type: 'offer' as const,
      content: `عرض سعر جديد #${offerIndex}: ${price} ر.ي - المدة: ${duration.trim()}`,
      offerData: {
        price,
        duration: duration.trim(),
        notes: notes?.trim() || undefined,
        status: 'pending' as const,
        offerIndex,
      },
      readBy: [user.userId],
      createdAt: new Date(),
    };
    specialRequest.messages.push(offerMessage);

    // تحديث آخر رسالة
    specialRequest.lastMessageAt = new Date();
    specialRequest.lastMessageContent = `عرض سعر جديد #${offerIndex}: ${price} ر.ي`;
    specialRequest.lastMessageSender = user.role;

    // زيادة عداد غير المقروء للمستفيد
    if (!specialRequest.unreadCount) {
      (specialRequest as any).unreadCount = new Map();
    }
    const beneficiaryIdStr = specialRequest.beneficiaryId.toString();
    const current = (specialRequest.unreadCount as Map<string, number>).get(beneficiaryIdStr) || 0;
    (specialRequest.unreadCount as Map<string, number>).set(beneficiaryIdStr, current + 1);

    // تحديث الحالة
    if (specialRequest.status === 'new') {
      specialRequest.status = 'negotiating';
    }

    await specialRequest.save();

    // ── تسجيل النشاط ──
    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'send_special_request_offer',
      entity: 'SpecialServiceRequest',
      entityId: id,
      details: `إرسال عرض سعر #${offerIndex} بقيمة ${price} ر.ي`,
      request,
    });

    // ── إشعار للمستفيد ──
    try {
      const notifTitle = `عرض سعر جديد لطلبك #${specialRequest.orderNumber}`;
      const notifBody = `السعر: ${price} ر.ي - المدة: ${duration.trim()}. يرجى المراجعة والقبول أو الرفض.`;

      await Notification.create({
        userId: specialRequest.beneficiaryId,
        userRole: 'beneficiary',
        titleAr: notifTitle,
        bodyAr: notifBody,
        type: 'offer',
        priority: 'high',
        data: {
          requestId: id,
          offerIndex,
          price,
          duration,
          voiceAlert: 'true',
          voiceText: `وصلك عرض سعر جديد بقيمة ${price} ريال`,
        },
        actionUrl: `/beneficiary/special-requests/${id}`,
        voiceEnabled: true,
        read: false,
      });

      sendPushToUser(specialRequest.beneficiaryId.toString(), {
        title: notifTitle,
        body: notifBody,
        type: 'offer',
        priority: 'high',
        url: `/beneficiary/special-requests/${id}`,
        userRole: 'beneficiary',
        data: { requestId: id, offerIndex, voiceAlert: true, voiceText: `وصلك عرض سعر جديد بقيمة ${price} ريال` },
      }).catch(() => {});
    } catch {}

    // ── إرسال أحداث Socket.IO فورية ──
    try {
      const eventPayload = {
        requestId: id,
        offerIndex,
        price,
        duration: duration.trim(),
        notes: notes?.trim() || null,
        sentBy: user.userId,
        sentByRole: user.role,
        createdAt: new Date().toISOString(),
      };

      // إشعار المستفيد بعرض سعر جديد
      emitToUser(specialRequest.beneficiaryId.toString(), 'special_request_offer', eventPayload).catch(() => {});

      // إشعار data_change عام
      emitToAdmins('data_change', {
        entity: 'special_request',
        entityId: id,
        action: 'updated',
        changedBy: user.userId,
        changedByRole: user.role,
        timestamp: new Date().toISOString(),
        data: { requestId: id, action: 'offer_sent', offerIndex, price },
      }).catch(() => {});
    } catch {}

    return Response.json({
      success: true,
      data: {
        requestId: id,
        offerIndex,
        price,
        duration: duration.trim(),
        notes: notes?.trim() || null,
        status: 'pending',
      },
      message: 'تم إرسال عرض السعر بنجاح',
    }, { status: 201 });
  } catch (error) {
    console.error('[SPECIAL REQUEST OFFER ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إرسال عرض السعر', 500, 'INTERNAL_ERROR');
  }
}
