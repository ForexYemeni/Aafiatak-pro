// POST /api/special-requests/[id]/rate
// يسمح للمستفيد بتقييم الخدمة والممرض بعد الإكمال

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SpecialServiceRequest, Rating, Nurse, Notification, User } from '@/models/mongoose';
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

    if (!specialRequest.beneficiaryConfirmedAt) {
      return createErrorResponse('يجب تأكيد الاستلام قبل التقييم', 400, 'INVALID_STATUS');
    }

    if (specialRequest.serviceRating || specialRequest.nurseRating) {
      return createErrorResponse('تم التقييم مسبقاً', 400, 'ALREADY_RATED');
    }

    const body = await request.json();
    const { serviceRating, nurseRating, comment } = body;

    // التحقق من الحقول
    if (typeof serviceRating !== 'number' || serviceRating < 1 || serviceRating > 5) {
      return createErrorResponse('تقييم الخدمة يجب أن يكون بين 1 و 5', 400, 'VALIDATION_ERROR');
    }
    if (specialRequest.nurseId && (typeof nurseRating !== 'number' || nurseRating < 1 || nurseRating > 5)) {
      return createErrorResponse('تقييم الممرض يجب أن يكون بين 1 و 5', 400, 'VALIDATION_ERROR');
    }

    // ── حفظ التقييم في الطلب ──
    specialRequest.serviceRating = serviceRating;
    specialRequest.nurseRating = specialRequest.nurseId ? nurseRating : undefined;
    specialRequest.ratingComment = comment?.trim() || undefined;
    specialRequest.ratedAt = new Date();

    // إضافة رسالة نظام
    specialRequest.messages.push({
      senderId: user.userId,
      senderRole: 'beneficiary',
      type: 'system',
      content: `تم تقييم الخدمة: ${serviceRating}/5${specialRequest.nurseId ? ` - تقييم الممرض: ${nurseRating}/5` : ''}`,
      readBy: [user.userId],
      createdAt: new Date(),
    });

    specialRequest.lastMessageAt = new Date();
    specialRequest.lastMessageContent = 'تم إضافة تقييم للخدمة';
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

    // ── إنشاء سجل تقييم في مجموعة Rating (إذا كان هناك ممرض) ──
    if (specialRequest.nurseId) {
      try {
        await Rating.create({
          requestId: id,
          requestType: 'special_service',
          beneficiaryId: user.userId,
          nurseId: specialRequest.nurseId,
          rating: nurseRating,
          comment: comment?.trim() || '',
          isSpecialService: true,
        });

        // ── تحديث متوسط تقييم الممرض ──
        const nurseRatings = await Rating.find({ nurseId: specialRequest.nurseId }).lean();
        if (nurseRatings.length > 0) {
          const avg = nurseRatings.reduce((sum, r) => sum + (r.rating || 0), 0) / nurseRatings.length;
          await Nurse.findByIdAndUpdate(specialRequest.nurseId, {
            rating: Math.round(avg * 10) / 10,
            ratingCount: nurseRatings.length,
          });
        }
      } catch (e) {
        console.error('[SPECIAL REQUEST RATING RECORD ERROR]', e);
        // لا نوقف العملية إذا فشل تحديث التقييم
      }
    }

    // ── تسجيل النشاط ──
    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'rate_special_request',
      entity: 'SpecialServiceRequest',
      entityId: id,
      details: `تقييم الخدمة: ${serviceRating}/5 للطلب #${specialRequest.orderNumber}`,
      request,
    });

    // ── إشعار للممرض ──
    if (specialRequest.nurseId) {
      try {
        await Notification.create({
          userId: specialRequest.nurseId,
          userRole: 'nurse',
          titleAr: `تقييم جديد من ${specialRequest.beneficiaryName}`,
          bodyAr: `حصلت على تقييم ${nurseRating}/5${comment ? ` - ${comment.substring(0, 80)}` : ''}`,
          type: 'rating',
          priority: 'medium',
          data: { requestId: id, rating: nurseRating },
          actionUrl: '/nurse/ratings',
          read: false,
        });
        sendPushToUser(specialRequest.nurseId.toString(), {
          title: 'تقييم جديد',
          body: `حصلت على تقييم ${nurseRating}/5`,
          type: 'rating',
          priority: 'medium',
          url: '/nurse/ratings',
          userRole: 'nurse',
          data: { requestId: id, rating: nurseRating },
        }).catch(() => {});
      } catch {}
    }

    // ── إشعار للمدراء ──
    try {
      for (const admin of admins) {
        await Notification.create({
          userId: admin._id,
          userRole: (admin as any).role || 'admin',
          titleAr: `تقييم جديد للطلب #${specialRequest.orderNumber}`,
          bodyAr: `قيّم المستفيد الخدمة بـ ${serviceRating}/5`,
          type: 'rating',
          priority: 'low',
          data: { requestId: id, rating: serviceRating },
          actionUrl: `/admin/special-requests/${id}`,
          read: false,
        });
      }
    } catch {}

    // ── إرسال أحداث Socket.IO فورية ──
    try {
      const eventPayload = {
        requestId: id,
        action: 'rated',
        serviceRating,
        nurseRating: specialRequest.nurseId ? nurseRating : undefined,
        ratedAt: specialRequest.ratedAt.toISOString(),
      };

      if (specialRequest.nurseId) {
        emitToUser(specialRequest.nurseId.toString(), 'special_request_rated', eventPayload).catch(() => {});
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
      data: { requestId: id, serviceRating, nurseRating },
      message: 'تم إرسال التقييم بنجاح - شكراً لك',
    });
  } catch (error) {
    console.error('[SPECIAL REQUEST RATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إرسال التقييم', 500, 'INTERNAL_ERROR');
  }
}
