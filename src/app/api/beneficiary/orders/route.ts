// GET/POST /api/beneficiary/orders - List/Create orders
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// Supports both single serviceId and array of serviceIds for multi-service orders

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, Service, Beneficiary, Nurse, AdminSettings, Transaction, Coupon, Notification } from '@/models/mongoose';
import { createErrorResponse } from '@/lib/auth';
import { requireAuth } from '@/lib/auth/middleware';
import { calculatePricing } from '@/lib/api/helpers';
import { sendPushToUser } from '@/lib/notifications/push-service';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
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

    // Also collect service IDs from unified orders' services[] arrays
    for (const o of orders) {
      if (Array.isArray(o.services)) {
        for (const s of o.services) {
          const sid = s.serviceId?.toString();
          if (sid) serviceIds.push(sid);
        }
      }
    }
    const uniqueServiceIds = [...new Set(serviceIds)];

    // Batch fetch nurse and service data
    const [nurses, services] = await Promise.all([
      nurseIds.length > 0
        ? Nurse.find({ _id: { $in: nurseIds } }).select('name phone rating isOnline').lean()
        : [],
      uniqueServiceIds.length > 0
        ? Service.find({ _id: { $in: uniqueServiceIds } }).select('nameAr category basePrice').lean()
        : [],
    ]);

    // Create lookup maps
    const nurseMap = new Map(nurses.map((n: any) => [n._id.toString(), n]));
    const serviceMap = new Map(services.map((s: any) => [s._id.toString(), s]));

    const enrichedOrders = orders.map((o: any) => {
      const nurse = nurseMap.get(o.nurseId?.toString());
      const isUnified = Array.isArray(o.services) && o.services.length > 0;

      // For unified orders, build serviceName from services[] snapshot names
      // For legacy orders, look up from serviceMap
      let serviceName: string | null;
      if (isUnified) {
        serviceName = o.services.map((s: any) => s.nameAr).filter(Boolean).join('، ') || null;
      } else {
        const service = serviceMap.get(o.serviceId?.toString());
        serviceName = service?.nameAr || null;
      }

      return {
        ...o,
        id: o._id.toString(),
        nurseName: nurse?.name || null,
        nursePhone: nurse?.phone || null,
        nurseRating: nurse?.rating || 0,
        nurseIsOnline: nurse?.isOnline || false,
        serviceName,
        isUnifiedOrder: isUnified,
        services: isUnified ? o.services : undefined,
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

    // ── التحقق من أن الخدمات العامة مفعّلة ──
    const generalSettings = await AdminSettings.findOne().lean().select('generalServicesEnabled');
    if (generalSettings && generalSettings.generalServicesEnabled === false) {
      return createErrorResponse('الخدمات العامة غير متاحة حالياً. يرجى المحاولة لاحقاً', 403, 'SERVICES_DISABLED');
    }

    const body = await request.json();
    const { serviceId, serviceIds, scheduledAt, notes, address, lat, lng, isEmergency, paymentMethod, paymentMethodId, couponCode, loyaltyPointsToRedeem, hasPaymentProof, paymentProofData } = body;

    // Support both single serviceId and array of serviceIds
    const ids: string[] = serviceIds && Array.isArray(serviceIds) && serviceIds.length > 0
      ? serviceIds
      : serviceId
        ? [serviceId]
        : [];

    if (ids.length === 0) {
      return createErrorResponse('معرف الخدمة مطلوب', 400, 'VALIDATION_ERROR');
    }

    // Get all service details
    const services = await Service.find({ _id: { $in: ids } }).lean();
    if (services.length === 0) {
      return createErrorResponse('الخدمات غير موجودة', 404, 'NOT_FOUND');
    }

    // Check all services are active
    const inactiveService = services.find((s: any) => !s.isActive);
    if (inactiveService) {
      return createErrorResponse(`الخدمة "${inactiveService.nameAr}" غير متاحة`, 400, 'SERVICE_INACTIVE');
    }

    // If some IDs not found, error
    if (services.length !== ids.length) {
      return createErrorResponse('بعض الخدمات المحددة غير موجودة', 404, 'NOT_FOUND');
    }

    // Get settings for pricing
    let settings = await AdminSettings.findOne().lean();
    if (!settings) settings = await AdminSettings.create({});

    // Calculate pricing — respect nightFeeEnabled and fridayFeeEnabled toggles
    const now = new Date();
    const scheduledDate = scheduledAt ? new Date(scheduledAt) : now;
    const hour = scheduledDate.getHours();
    const isNightService = settings.nightFeeEnabled
      ? (settings.nightStartHour > settings.nightEndHour
          ? (hour >= settings.nightStartHour || hour < settings.nightEndHour)
          : (hour >= settings.nightStartHour && hour < settings.nightEndHour))
      : false;
    const isFridayService = settings.fridayFeeEnabled && scheduledDate.getDay() === 5;

    // Determine order status based on payment method
    const isCashPayment = paymentMethod === 'cash';
    const orderStatus = isCashPayment ? 'pending' : 'awaiting_payment';

    // Calculate total base price for coupon validation
    const totalBasePrice = services.reduce((sum: number, s: any) => sum + s.basePrice, 0);

    // Coupon discount - applied at the order level
    let couponDiscount = 0;
    let couponId: string | undefined;
    if (couponCode) {
      const coupon = await Coupon.findOne({ code: couponCode.toUpperCase(), isActive: true, expiresAt: { $gt: now } });
      if (coupon && coupon.usedCount < coupon.maxUses && totalBasePrice >= coupon.minOrderAmount) {
        couponDiscount = Math.min(
          totalBasePrice * (coupon.discountPercent / 100),
          coupon.maxDiscountAmount || Infinity
        );
        couponId = coupon._id.toString();
      }
    }

    // ── Create ONE unified ServiceRequest with all services ──
    // Build the services[] array with snapshots of each service's details
    const orderServices = services.map((s: any) => ({
      serviceId: s._id,
      nameAr: s.nameAr,
      basePrice: s.basePrice,
      quantity: 1,
      duration: s.duration || 0,
    }));

    // Calculate pricing ONCE at the order level
    const pricing = calculatePricing({
      basePrice: totalBasePrice,
      isEmergency: isEmergency || false,
      isNightService,
      isFridayService,
      commissionRate: settings.commissionRate,
      emergencyFee: settings.emergencyFee,
      nightFeePercent: settings.nightFeePercent,
      fridayFeePercent: settings.fridayFeePercent,
      couponDiscount,
    });

    // Set serviceId to the FIRST service's ID for backward compatibility
    const firstServiceId = services[0]._id;

    const order = await ServiceRequest.create({
      serviceId: firstServiceId,
      services: orderServices,
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

    // Update beneficiary order count (1 order, not N services)
    await Beneficiary.findByIdAndUpdate(user.userId, { $inc: { orderCount: 1 } });

    // ── Notifications for ALL parties ──
    try {
      const beneficiary = await Beneficiary.findById(user.userId).select('name phone').lean();
      const beneficiaryName = beneficiary?.name || 'مستفيد';
      const serviceNames = services.map((s: any) => s.nameAr).join('، ');
      const orderId = order._id.toString();
      const totalAmount = order.totalPrice;

      // 1️⃣ Notify BENEFICIARY (confirmation only — low priority, no loud voice alert)
      await Notification.create({
        userId: user.userId,
        userRole: 'beneficiary',
        titleAr: isEmergency ? 'تم استلام طلب الطوارئ' : 'تم استلام طلبك',
        bodyAr: isEmergency
          ? `تم استلام طلب الطوارئ لخدمة ${serviceNames} وسيتم التعامل معه بأولوية عالية`
          : `تم استلام طلبك لخدمة ${serviceNames} بنجاح${isCashPayment ? '' : ' - يرجى إرسال إثبات الدفع'}`,
        type: isEmergency ? 'emergency' : 'system',
        priority: isEmergency ? 'medium' : 'low',
        data: { orderId, serviceIds: ids, voiceAlert: isEmergency ? 'true' : 'false', voiceText: isEmergency ? 'تم استلام طلب الطوارئ وسيتم التعامل معه بأولوية عالية' : '' },
        actionUrl: `/beneficiary/orders/${orderId}`,
        voiceEnabled: isEmergency ? true : false,
        read: false,
      });

      sendPushToUser(user.userId, {
        title: isEmergency ? 'تم استلام طلب الطوارئ' : 'تم استلام طلبك',
        body: isEmergency
          ? `تم استلام طلب الطوارئ لخدمة ${serviceNames} وسيتم التعامل معه بأولوية عالية`
          : `تم استلام طلبك لخدمة ${serviceNames} بنجاح`,
        type: isEmergency ? 'emergency' : 'system',
        priority: isEmergency ? 'medium' : 'low',
        url: `/beneficiary/orders/${orderId}`,
        userRole: 'beneficiary',
        data: { orderId, serviceIds: ids, voiceAlert: isEmergency ? true : false, voiceText: isEmergency ? 'تم استلام طلب الطوارئ وسيتم التعامل معه بأولوية عالية' : '' },
      }).catch(() => {});

      // 2️⃣ Notify ADMIN
      const adminMsg = isCashPayment
        ? `طلب خدمة جديد: ${serviceNames} من ${beneficiaryName} - ${totalAmount} ر.ي`
        : `طلب جديد بانتظار تأكيد الدفع: ${serviceNames} من ${beneficiaryName} - ${totalAmount} ر.ي`;

      const { User } = await import('@/models/mongoose');
      const admins = await User.find({ role: { $in: ['admin', 'subadmin'] } }).select('_id role').lean();
      for (const admin of admins) {
        const adminRole = (admin as any).role || 'admin';
        await Notification.create({
          userId: admin._id,
          userRole: adminRole,
          titleAr: isCashPayment ? 'طلب خدمة جديد' : 'طلب جديد بانتظار تأكيد الدفع',
          bodyAr: adminMsg,
          type: isEmergency ? 'emergency' : 'assignment',
          priority: isEmergency ? 'urgent' : 'high',
          data: { orderId, serviceIds: ids, voiceAlert: 'true', voiceText: isEmergency ? `طلب طوارئ من ${beneficiaryName}` : `طلب خدمة جديد من ${beneficiaryName} - ${totalAmount} ريال` },
          actionUrl: '/admin/orders',
          voiceEnabled: true,
          read: false,
        });

        sendPushToUser(admin._id.toString(), {
          title: isCashPayment ? 'طلب خدمة جديد' : 'طلب جديد بانتظار تأكيد الدفع',
          body: adminMsg,
          type: isEmergency ? 'emergency' : 'service_request',
          priority: isEmergency ? 'urgent' : 'high',
          url: '/admin/orders',
          userRole: adminRole,
          data: { orderId, serviceIds: ids, voiceAlert: true, voiceText: isEmergency ? `طلب طوارئ من ${beneficiaryName}` : `طلب خدمة جديد من ${beneficiaryName} - ${totalAmount} ريال` },
        }).catch(() => {});
      }
    } catch {
      // Notification creation should not block order creation
    }

    // ── Emit real-time socket event ──
    try {
      const { emitRealtimeEvent } = await import('@/lib/notifications/emit-realtime-event');
      emitRealtimeEvent.orderCreated({
        requestId: order._id.toString(),
        beneficiaryId: user.userId,
        status: orderStatus,
        paymentStatus: isCashPayment ? 'pending' : 'awaiting_confirmation',
      }, { changedBy: user.userId, changedByRole: user.role });
    } catch {}

    // Return the unified order
    return Response.json({
      success: true,
      data: {
        ...serializeDoc(order.toObject()),
        serviceCount: orderServices.length,
        totalAmount: order.totalPrice,
        isUnifiedOrder: true,
      },
      message: isCashPayment
        ? 'تم إنشاء الطلب بنجاح'
        : 'تم إنشاء الطلب - يرجى إرسال إثبات الدفع عبر الواتساب',
    }, { status: 201 });
  } catch (error) {
    console.error('[BENEFICIARY ORDERS CREATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إنشاء الطلب', 500, 'INTERNAL_ERROR');
  }
}
