// POST /api/special-requests/[id]/respond-offer
// يسمح للمستفيد بقبول أو رفض عرض السعر

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SpecialServiceRequest, AdminSettings, Notification, User } from '@/models/mongoose';
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

    const body = await request.json();
    const { offerIndex, action } = body; // action: 'accept' | 'reject'

    if (!['accept', 'reject'].includes(action)) {
      return createErrorResponse('الإجراء يجب أن يكون accept أو reject', 400, 'VALIDATION_ERROR');
    }

    // البحث عن العرض
    const offer = specialRequest.offers.find(o => o.offerIndex === Number(offerIndex));
    if (!offer) {
      return createErrorResponse('العرض غير موجود', 404, 'OFFER_NOT_FOUND');
    }

    if (offer.status !== 'pending') {
      return createErrorResponse('تمت الاستجابة لهذا العرض مسبقاً', 400, 'OFFER_ALREADY_RESPONDED');
    }

    // تحديث حالة العرض
    offer.status = action === 'accept' ? 'accepted' : 'rejected';
    offer.respondedAt = new Date();

    // إضافة رسالة في المحادثة
    const decisionMessage = {
      senderId: user.userId,
      senderRole: 'beneficiary' as const,
      type: 'payment_decision' as const,
      content: action === 'accept'
        ? `تم قبول عرض السعر #${offer.offerIndex} - ${offer.price} ر.ي`
        : `تم رفض عرض السعر #${offer.offerIndex}`,
      offerData: {
        price: offer.price,
        duration: offer.duration,
        notes: offer.notes,
        status: offer.status,
        offerIndex: offer.offerIndex,
      },
      readBy: [user.userId],
      createdAt: new Date(),
    };
    specialRequest.messages.push(decisionMessage);

    // رفض باقي العروض المعلقة
    for (const o of specialRequest.offers) {
      if (o._id?.toString() !== (offer as any)._id?.toString() && o.status === 'pending') {
        o.status = 'expired';
      }
    }

    if (action === 'accept') {
      // ── عند القبول: تحديث الطلب إلى بانتظار الدفع ──
      specialRequest.agreedPrice = offer.price;
      specialRequest.agreedDuration = offer.duration;
      specialRequest.adminNotes = offer.notes;
      specialRequest.status = 'awaiting_payment';
      specialRequest.paymentStatus = 'pending';

      // حساب العمولة باستخدام النظام الموجود
      const settings = await AdminSettings.findOne().lean();
      const commissionRate = settings?.commissionRate ?? 15;
      const commission = Math.round(offer.price * (commissionRate / 100));
      const nursePayout = offer.price - commission;

      specialRequest.commissionRate = commissionRate;
      specialRequest.commission = commission;
      specialRequest.nursePayout = nursePayout;
    } else {
      // ── عند الرفض: البقاء في حالة التفاوض ──
      if (specialRequest.status === 'new') {
        specialRequest.status = 'negotiating';
      }
    }

    // تحديث آخر رسالة
    specialRequest.lastMessageAt = new Date();
    specialRequest.lastMessageContent = decisionMessage.content;
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
      action: action === 'accept' ? 'accept_special_request_offer' : 'reject_special_request_offer',
      entity: 'SpecialServiceRequest',
      entityId: id,
      details: `${action === 'accept' ? 'قبول' : 'رفض'} عرض السعر #${offer.offerIndex}`,
      request,
    });

    // ── إشعار للمدراء ──
    try {
      const notifTitle = action === 'accept'
        ? `تم قبول عرض السعر للطلب #${specialRequest.orderNumber}`
        : `تم رفض عرض السعر للطلب #${specialRequest.orderNumber}`;
      const notifBody = action === 'accept'
        ? `قبل المستفيد ${specialRequest.beneficiaryName} عرض السعر #${offer.offerIndex} بقيمة ${offer.price} ر.ي`
        : `رفض المستفيد ${specialRequest.beneficiaryName} عرض السعر #${offer.offerIndex}`;

      for (const admin of admins) {
        const adminRole = (admin as any).role || 'admin';
        await Notification.create({
          userId: admin._id,
          userRole: adminRole,
          titleAr: notifTitle,
          bodyAr: notifBody,
          type: action === 'accept' ? 'payment' : 'system',
          priority: 'high',
          data: { requestId: id, offerIndex, action, voiceAlert: 'true', voiceText: notifBody },
          actionUrl: `/admin/special-requests/${id}`,
          voiceEnabled: true,
          read: false,
        });
        sendPushToUser(admin._id.toString(), {
          title: notifTitle,
          body: notifBody,
          type: action === 'accept' ? 'payment' : 'system',
          priority: 'high',
          url: `/admin/special-requests/${id}`,
          userRole: adminRole,
          data: { requestId: id, offerIndex, action, voiceAlert: true, voiceText: notifBody },
        }).catch(() => {});
      }
    } catch {}

    // ── إرسال أحداث Socket.IO فورية ──
    try {
      const eventPayload = {
        requestId: id,
        offerIndex: offer.offerIndex,
        action,
        newStatus: specialRequest.status,
        price: offer.price,
        respondedAt: new Date().toISOString(),
      };

      emitToAdmins('special_request_offer_responded', eventPayload).catch(() => {});
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
        offerIndex: offer.offerIndex,
        action,
        newStatus: specialRequest.status,
        agreedPrice: specialRequest.agreedPrice,
      },
      message: action === 'accept'
        ? 'تم قبول عرض السعر بنجاح - يرجى إتمام الدفع'
        : 'تم رفض العرض - يمكنك انتظار عرض جديد من الإدارة',
    });
  } catch (error) {
    console.error('[SPECIAL REQUEST RESPOND OFFER ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء الاستجابة للعرض', 500, 'INTERNAL_ERROR');
  }
}
