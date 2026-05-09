// GET/POST /api/beneficiary/orders - List/Create orders
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, Service, Beneficiary, Nurse, AdminSettings, Transaction, Coupon, Notification } from '@/models/mongoose';
import { createErrorResponse } from '@/lib/auth';
import { requireAuth } from '@/lib/auth/middleware';
import { calculatePricing } from '@/lib/api/helpers';
import { sendPushToUser } from '@/lib/notifications/push-service';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const countsOnly = searchParams.get('counts') === 'true';

    // If countsOnly, return counts for all tabs at once
    if (countsOnly) {
      const [activeCount, completedCount, cancelledCount] = await Promise.all([
        ServiceRequest.countDocuments({ beneficiaryId: user.userId, status: { $in: ['pending', 'assigned', 'accepted', 'in_progress', 'awaiting_payment'] } }),
        ServiceRequest.countDocuments({ beneficiaryId: user.userId, status: 'completed' }),
        ServiceRequest.countDocuments({ beneficiaryId: user.userId, status: { $in: ['cancelled', 'rejected'] } }),
      ]);
      return Response.json({
        success: true,
        data: { active: activeCount, completed: completedCount, cancelled: cancelledCount },
      });
    }

    const filter: any = { beneficiaryId: user.userId };
    if (status) {
      // Support comma-separated status values for filtering multiple statuses
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }

    const [orders, total] = await Promise.all([
      ServiceRequest.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      ServiceRequest.countDocuments(filter),
    ]);

    // Collect unique nurseIds and serviceIds for batch lookup
    const nurseIds = [...new Set(orders.map((o: any) => o.nurseId?.toString()).filter(Boolean))];
    const serviceIds = [...new Set(orders.map((o: any) => o.serviceId?.toString()).filter(Boolean))];

    // Batch fetch nurse and service data
    const [nurses, services] = await Promise.all([
      nurseIds.length > 0
        ? Nurse.find({ _id: { $in: nurseIds } }).select('name phone rating isOnline').lean()
        : [],
      serviceIds.length > 0
        ? Service.find({ _id: { $in: serviceIds } }).select('nameAr category basePrice').lean()
        : [],
    ]);

    // Create lookup maps
    const nurseMap = new Map(nurses.map((n: any) => [n._id.toString(), n]));
    const serviceMap = new Map(services.map((s: any) => [s._id.toString(), s]));

    const enrichedOrders = orders.map((o: any) => {
      const nurse = nurseMap.get(o.nurseId?.toString());
      const service = serviceMap.get(o.serviceId?.toString());
      return {
        ...o,
        id: o._id.toString(),
        nurseName: nurse?.name || null,
        nursePhone: nurse?.phone || null,
        nurseRating: nurse?.rating || 0,
        nurseIsOnline: nurse?.isOnline || false,
        serviceName: service?.nameAr || null,
        // Wrap flat pricing fields into pricing object for frontend compatibility
        pricing: {
          basePrice: o.basePrice || 0,
          nightFee: o.nightFee || 0,
          fridayFee: o.fridayFee || 0,
          emergencyFee: o.emergencyFee || 0,
          discount: o.discount || 0,
          totalPrice: o.totalPrice || 0,
          couponDiscount: o.discount || 0,
        },
      };
    });

    return Response.json({
      success: true,
      data: {
        orders: enrichedOrders,
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[BENEFICIARY ORDERS LIST ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب الطلبات', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    const { serviceId, scheduledAt, notes, address, lat, lng, isEmergency, paymentMethod, paymentMethodId, couponCode, loyaltyPointsToRedeem, hasPaymentProof, paymentProofData } = body;

    if (!serviceId) {
      return createErrorResponse('معرف الخدمة مطلوب', 400, 'VALIDATION_ERROR');
    }

    // Get service details
    const service = await Service.findById(serviceId).lean();
    if (!service) return createErrorResponse('الخدمة غير موجودة', 404, 'NOT_FOUND');
    if (!service.isActive) return createErrorResponse('الخدمة غير متاحة', 400, 'SERVICE_INACTIVE');

    // Get settings for pricing
    let settings = await AdminSettings.findOne().lean();
    if (!settings) settings = await AdminSettings.create({});

    // Calculate pricing
    const now = new Date();
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : now;
    const hour = scheduledDate.getHours();
    const isNightService = hour >= settings.nightStartHour || hour < settings.nightEndHour;
    const isFridayService = scheduledDate.getDay() === 5;

    // Coupon discount
    let couponDiscount = 0;
    let couponId: string | undefined;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true, expiresAt: { $gt: now } });
      if (coupon && coupon.usedCount < coupon.maxUses && service.basePrice >= coupon.minOrderAmount) {
        couponDiscount = Math.min(
          service.basePrice * (coupon.discountPercent / 100),
          coupon.maxDiscountAmount || Infinity
        );
        couponId = coupon._id.toString();
      }
    }

    const pricing = calculatePricing({
      basePrice: service.basePrice,
      isEmergency: isEmergency || false,
      isNightService,
      isFridayService,
      commissionRate: settings.commissionRate,
      emergencyFee: settings.emergencyFee,
      nightFeePercent: settings.nightFeePercent,
      fridayFeePercent: settings.fridayFeePercent,
      couponDiscount,
    });

    // Determine order status based on payment method
    // Cash: pending, Non-cash (wallet/bank): awaiting_payment
    const isCashPayment = paymentMethod === 'cash';
    const orderStatus = isCashPayment ? 'pending' : 'awaiting_payment';

    // Create the order
    const order = await ServiceRequest.create({
      serviceId,
      beneficiaryId: user.userId,
      status: orderStatus,
      basePrice: pricing.basePrice,
      nightFee: pricing.nightFee,
      fridayFee: pricing.fridayFee,
      emergencyFee: pricing.emergencyFee,
      discount: pricing.discount,
      totalPrice: pricing.totalPrice,
      commission: pricing.commission,
      nursePayout: pricing.nursePayout,
      beneficiaryLat: lat,
      beneficiaryLng: lng,
      beneficiaryAddress: address,
      notes,
      scheduledAt: scheduledDate,
      isEmergency: isEmergency || false,
      isNightService,
      isFridayService,
      paymentStatus: isCashPayment ? 'pending' : 'awaiting_confirmation',
      paymentMethod: paymentMethod || 'cash',
      paymentMethodId: paymentMethodId || null,
      hasPaymentProof: hasPaymentProof || false,
      paymentProofData: paymentProofData || null,
      couponId,
    });

    // Update coupon usage
    if (couponId) {
      await Coupon.findByIdAndUpdate(couponId, { $inc: { usedCount: 1 } });
    }

    // Update beneficiary order count
    await Beneficiary.findByIdAndUpdate(user.userId, { $inc: { orderCount: 1 } });

    // ── Notifications for ALL parties ──
    try {
      const beneficiary = await Beneficiary.findById(user.userId).select('name phone').lean();
      const beneficiaryName = beneficiary?.name || 'مستفيد';
      const serviceName = service.nameAr;
      const orderId = order._id.toString();

      // 1️⃣ Notify BENEFICIARY: Confirmation that their order was created
      await Notification.create({
        userId: user.userId,
        userRole: 'beneficiary',
        titleAr: isEmergency ? 'تم استلام طلب الطوارئ' : 'تم استلام طلبك',
        bodyAr: isEmergency
          ? `تم استلام طلب الطوارئ لخدمة ${serviceName} وسيتم التعامل معه بأولوية عالية`
          : `تم استلام طلبك لخدمة ${serviceName} بنجاح${isCashPayment ? '' : ' - يرجى إرسال إثبات الدفع'}`,
        type: isEmergency ? 'emergency' : 'system',
        priority: isEmergency ? 'urgent' : 'medium',
        data: { orderId, serviceId },
        actionUrl: `/beneficiary/orders/${orderId}`,
        read: false,
      });

      sendPushToUser(user.userId, {
        title: isEmergency ? 'تم استلام طلب الطوارئ' : 'تم استلام طلبك',
        body: isEmergency
          ? `تم استلام طلب الطوارئ لخدمة ${serviceName} وسيتم التعامل معه بأولوية عالية`
          : `تم استلام طلبك لخدمة ${serviceName} بنجاح`,
        type: isEmergency ? 'emergency' : 'system',
        priority: isEmergency ? 'urgent' : 'medium',
        url: `/beneficiary/orders/${orderId}`,
        userRole: 'beneficiary',
        data: { orderId, serviceId },
      }).catch(() => {});

      // 2️⃣ Notify ADMIN: New order received
      const adminMsg = isCashPayment
        ? `طلب خدمة جديد: ${serviceName} من ${beneficiaryName} - ${pricing.totalPrice} ر.ي`
        : `طلب جديد بانتظار تأكيد الدفع: ${serviceName} من ${beneficiaryName} - ${pricing.totalPrice} ر.ي`;

      const { User } = await import('@/models/mongoose');
      const admins = await User.find({ role: 'admin' }).select('_id').lean();
      for (const admin of admins) {
        await Notification.create({
          userId: admin._id,
          userRole: 'admin',
          titleAr: isCashPayment ? 'طلب خدمة جديد' : 'طلب جديد بانتظار تأكيد الدفع',
          bodyAr: adminMsg,
          type: isEmergency ? 'emergency' : 'assignment',
          priority: isEmergency ? 'urgent' : 'high',
          data: { orderId, serviceId },
          actionUrl: '/admin/orders',
          read: false,
        });

        sendPushToUser(admin._id.toString(), {
          title: isCashPayment ? 'طلب خدمة جديد' : 'طلب جديد بانتظار تأكيد الدفع',
          body: adminMsg,
          type: isEmergency ? 'emergency' : 'service_request',
          priority: isEmergency ? 'urgent' : 'high',
          url: '/admin/orders',
          userRole: 'admin',
          data: { orderId, serviceId },
        }).catch(() => {});
      }
    } catch {
      // Notification creation should not block order creation
    }

    return Response.json({
      success: true,
      data: { ...order.toObject(), id: order._id.toString() },
      message: isCashPayment ? 'تم إنشاء الطلب بنجاح' : 'تم إنشاء الطلب - يرجى إرسال إثبات الدفع عبر الواتساب',
    }, { status: 201 });
  } catch (error) {
    console.error('[BENEFICIARY ORDERS CREATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إنشاء الطلب', 500, 'INTERNAL_ERROR');
  }
}
