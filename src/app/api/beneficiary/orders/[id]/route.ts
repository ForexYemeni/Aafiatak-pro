// GET/PATCH /api/beneficiary/orders/[id] - Get/cancel order
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, Beneficiary, Nurse, Service, Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { sendPushToUser } from '@/lib/notifications/push-service';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const { id } = await params;
    const order = await ServiceRequest.findOne({ _id: id, beneficiaryId: user.userId }).lean();
    if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

    // Populate nurse details
    let nurseData: any = null;
    if (order.nurseId) {
      nurseData = await Nurse.findById(order.nurseId)
        .select('name phone rating specialization isOnline')
        .lean();
    }

    // Populate service details
    const serviceData = await Service.findById(order.serviceId)
      .select('nameAr category basePrice duration')
      .lean();

    // Determine if this is a unified order
    const isUnified = Array.isArray((order as any).services) && (order as any).services.length > 0;

    // For unified orders, build serviceName from services[] snapshots
    let serviceName: string;
    if (isUnified) {
      serviceName = (order as any).services.map((s: any) => s.nameAr).filter(Boolean).join('، ') || 'خدمة طبية';
    } else {
      serviceName = serviceData?.nameAr || 'خدمة طبية';
    }

    const result: any = {
      ...order,
      id: order._id.toString(),
      // Nurse details for beneficiary view
      nurseName: nurseData?.name || null,
      nursePhone: nurseData?.phone || null,
      nurseRating: nurseData?.rating || 0,
      nurseSpecialization: nurseData?.specialization?.map((s: string) => {
        const labels: Record<string, string> = {
          general_nursing: 'تمريض عام',
          critical_care: 'رعاية حرجة',
          pediatric: 'أطفال',
          elderly_care: 'مسنين',
          physiotherapy: 'علاج طبيعي',
          wound_care: 'جروح',
          iv_therapy: 'علاج وريدي',
          mental_health: 'صحة نفسية',
          post_surgery: 'بعد الجراحة',
          emergency: 'طوارئ',
        };
        return labels[s] || s;
      }).join(' • ') || null,
      nurseIsOnline: nurseData?.isOnline || false,
      // Service details
      serviceName,
      isUnifiedOrder: isUnified,
      services: isUnified ? (order as any).services : undefined,
      // Pricing for compatibility
      pricing: {
        basePrice: order.basePrice,
        nightFee: order.nightFee,
        fridayFee: order.fridayFee,
        emergencyFee: order.emergencyFee,
        discount: order.discount,
        totalPrice: order.totalPrice,
        couponDiscount: order.discount,
      },
    };

    return Response.json({ success: true, data: result });
  } catch (error) {
    console.error('[BENEFICIARY ORDER DETAIL ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const { id } = await params;
    const body = await request.json();

    // Beneficiary can only cancel their orders
    if (body.status !== 'cancelled') {
      return createErrorResponse('يمكنك فقط إلغاء الطلب', 400, 'INVALID_ACTION');
    }

    const order = await ServiceRequest.findOne({ _id: id, beneficiaryId: user.userId });
    if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

    // Allow cancellation for pending, assigned, and accepted statuses
    if (!['pending', 'assigned', 'accepted'].includes(order.status)) {
      return createErrorResponse('لا يمكن إلغاء الطلب في حالته الحالية', 400, 'INVALID_STATUS');
    }

    order.status = 'cancelled';
    order.cancelledAt = new Date();
    order.cancelReason = body.cancelReason || 'إلغاء بواسطة المستفيد';
    await order.save();

    const cancelReason = body.cancelReason || 'إلغاء بواسطة المستفيد';

    // ── Notifications for ALL parties ──
    try {
      // 1️⃣ Notify BENEFICIARY: Order cancelled successfully
      await Notification.create({
        userId: user.userId,
        userRole: 'beneficiary',
        titleAr: 'تم إلغاء الطلب',
        bodyAr: `تم إلغاء طلبك بنجاح${cancelReason !== 'إلغاء بواسطة المستفيد' ? ` - السبب: ${cancelReason}` : ''}`,
        type: 'status_change',
        priority: 'medium',
        data: { requestId: id, status: 'cancelled' },
        actionUrl: '/beneficiary/orders',
        voiceEnabled: true,
      });

      sendPushToUser(user.userId, {
        title: 'تم إلغاء الطلب',
        body: 'تم إلغاء طلبك بنجاح',
        type: 'service_cancelled',
        priority: 'medium',
        url: '/beneficiary/orders',
        userRole: 'beneficiary',
        data: { requestId: id, status: 'cancelled' },
      }).catch(() => {});

      // 2️⃣ Notify NURSE if assigned: Order has been cancelled
      if (order.nurseId) {
        await Notification.create({
          userId: order.nurseId,
          userRole: 'nurse',
          titleAr: 'تم إلغاء الطلب',
          bodyAr: 'تم إلغاء الطلب المُعيَّن لك من قبل المستفيد',
          type: 'status_change',
          priority: 'high',
          data: { requestId: id, status: 'cancelled' },
          actionUrl: '/nurse',
          voiceEnabled: true,
        });

        sendPushToUser(order.nurseId.toString(), {
          title: 'تم إلغاء الطلب',
          body: 'تم إلغاء الطلب المُعيَّن لك من قبل المستفيد',
          type: 'service_cancelled',
          priority: 'high',
          url: '/nurse',
          userRole: 'nurse',
          data: { requestId: id, status: 'cancelled' },
        }).catch(() => {});
      }

      // 3️⃣ Notify ADMIN: Order cancelled by beneficiary
      const { User } = await import('@/models/mongoose');
      const admins = await User.find({ role: { $in: ['admin', 'subadmin'] } }).select('_id role').lean();
      for (const admin of admins) {
        const adminRole = (admin as any).role || 'admin';
        await Notification.create({
          userId: admin._id,
          userRole: adminRole,
          titleAr: 'إلغاء طلب بواسطة المستفيد',
          bodyAr: `تم إلغاء الطلب #${id.slice(-6)} بواسطة المستفيد`,
          type: 'status_change',
          priority: 'medium',
          data: { requestId: id, status: 'cancelled' },
          actionUrl: '/admin/orders',
          read: false,
        });

        sendPushToUser(admin._id.toString(), {
          title: 'إلغاء طلب بواسطة المستفيد',
          body: `تم إلغاء الطلب #${id.slice(-6)} بواسطة المستفيد`,
          type: 'service_cancelled',
          priority: 'medium',
          url: '/admin/orders',
          userRole: adminRole,
          data: { requestId: id, status: 'cancelled' },
        }).catch(() => {});
      }
    } catch {
      // Non-critical
    }

    return Response.json({
      success: true,
      data: serializeDoc(order.toObject()),
      message: 'تم إلغاء الطلب بنجاح',
    });
  } catch (error) {
    console.error('[BENEFICIARY ORDER CANCEL ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إلغاء الطلب', 500, 'INTERNAL_ERROR');
  }
}
