// GET/POST /api/beneficiary/orders - List/Create orders
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, Service, Beneficiary, AdminSettings, Transaction, Coupon, Notification } from '@/models/mongoose';
import { createErrorResponse } from '@/lib/auth';
import { requireAuth } from '@/lib/auth/middleware';
import { calculatePricing } from '@/lib/api/helpers';

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

    return Response.json({
      success: true,
      data: {
        orders: orders.map((o: any) => ({ ...o, id: o._id.toString() })),
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
    const { serviceId, scheduledAt, notes, address, lat, lng, isEmergency, paymentMethod, couponCode, loyaltyPointsToRedeem } = body;

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

    // Create the order
    const order = await ServiceRequest.create({
      serviceId,
      beneficiaryId: user.userId,
      status: 'pending',
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
      paymentStatus: 'pending',
      paymentMethod: paymentMethod || 'cash',
      couponId,
    });

    // Update coupon usage
    if (couponId) {
      await Coupon.findByIdAndUpdate(couponId, { $inc: { usedCount: 1 } });
    }

    // Update beneficiary order count
    await Beneficiary.findByIdAndUpdate(user.userId, { $inc: { orderCount: 1 } });

    return Response.json({
      success: true,
      data: { ...order.toObject(), id: order._id.toString() },
      message: 'تم إنشاء الطلب بنجاح',
    }, { status: 201 });
  } catch (error) {
    console.error('[BENEFICIARY ORDERS CREATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إنشاء الطلب', 500, 'INTERNAL_ERROR');
  }
}
