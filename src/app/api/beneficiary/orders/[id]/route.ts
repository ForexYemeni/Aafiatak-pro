// GET/PATCH /api/beneficiary/orders/[id] - Get/cancel order
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, Beneficiary, Nurse, Service, Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

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
      serviceName: serviceData?.nameAr || 'خدمة طبية',
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

    // Notify nurse if assigned
    if (order.nurseId) {
      try {
        await Notification.create({
          userId: order.nurseId,
          userRole: 'nurse',
          titleAr: 'تم إلغاء الطلب',
          bodyAr: `تم إلغاء الطلب المُعيَّن لك`,
          type: 'status_change',
          priority: 'medium',
          data: { requestId: id, status: 'cancelled' },
          voiceEnabled: true,
        });
      } catch {
        // Non-critical
      }
    }

    return Response.json({
      success: true,
      data: { ...order.toObject(), id: order._id.toString() },
      message: 'تم إلغاء الطلب بنجاح',
    });
  } catch (error) {
    console.error('[BENEFICIARY ORDER CANCEL ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إلغاء الطلب', 500, 'INTERNAL_ERROR');
  }
}
