// GET /api/beneficiary/orders - List service requests
// POST /api/beneficiary/orders - Create service request

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireRole, successResponse, paginatedResponse, handleApiError,
  parsePagination, paginate, logActivity, validateRequired, calculatePricing,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(request, 'beneficiary');

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);
    const status = url.searchParams.get('status') ?? '';

    const where: Record<string, unknown> = { beneficiaryId: user.userId };
    if (status) where.status = status;

    const [orders, total] = await Promise.all([
      db.serviceRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          service: { select: { id: true, nameAr: true, nameEn: true, category: true, icon: true, basePrice: true, duration: true } },
          nurse: { select: { id: true, name: true, phone: true, rating: true, specialization: true } },
          rating: true,
        },
      }),
      db.serviceRequest.count({ where }),
    ]);

    const pagination = paginate({ page, limit, total });
    return paginatedResponse(orders, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, 'beneficiary');

    const body = await request.json();
    const validationError = validateRequired(body, ['serviceId', 'address', 'lat', 'lng']);
    if (validationError) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: validationError }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Get service
    const service = await db.service.findUnique({ where: { id: body.serviceId } });
    if (!service || !service.isActive) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'الخدمة غير متاحة' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Get settings for pricing
    let settings = await db.adminSettings.findFirst();
    if (!settings) {
      settings = await db.adminSettings.create({ data: {} });
    }

    // Calculate pricing
    const scheduledAt = body.scheduledAt ? new Date(body.scheduledAt) : new Date();
    const hour = scheduledAt.getHours();
    const dayOfWeek = scheduledAt.getDay();
    const isNightService = hour >= settings.nightStartHour || hour < settings.nightEndHour;
    const isFridayService = dayOfWeek === 5; // Friday in most Arab countries

    // Apply coupon if provided
    let couponDiscount = 0;
    let couponId: string | null = null;
    if (body.couponCode) {
      const coupon = await db.coupon.findUnique({ where: { code: body.couponCode } });
      if (coupon && coupon.isActive && coupon.usedCount < coupon.maxUses && new Date(coupon.expiresAt) > new Date() && service.basePrice >= coupon.minOrderAmount) {
        couponDiscount = service.basePrice * (coupon.discountPercent / 100);
        if (coupon.maxDiscountAmount && couponDiscount > coupon.maxDiscountAmount) {
          couponDiscount = coupon.maxDiscountAmount;
        }
        couponId = coupon.id;
      }
    }

    // Apply loyalty points if requested
    let loyaltyDiscount = 0;
    if (body.loyaltyPointsToRedeem && body.loyaltyPointsToRedeem > 0) {
      const beneficiary = await db.beneficiary.findUnique({ where: { id: user.userId } });
      if (beneficiary && beneficiary.loyaltyPoints >= body.loyaltyPointsToRedeem && body.loyaltyPointsToRedeem >= (settings.loyaltyRedemptionThreshold)) {
        loyaltyDiscount = body.loyaltyPointsToRedeem; // 1 point = 1 ر.ي
      }
    }

    const pricing = calculatePricing({
      basePrice: service.basePrice,
      isEmergency: body.isEmergency ?? false,
      isNightService,
      isFridayService,
      commissionRate: settings.commissionRate,
      emergencyFee: settings.emergencyFee,
      nightFeePercent: settings.nightFeePercent,
      fridayFeePercent: settings.fridayFeePercent,
      loyaltyDiscount,
      couponDiscount,
    });

    const serviceRequest = await db.serviceRequest.create({
      data: {
        serviceId: body.serviceId,
        beneficiaryId: user.userId,
        status: 'pending',
        basePrice: pricing.basePrice,
        nightFee: pricing.nightFee,
        fridayFee: pricing.fridayFee,
        emergencyFee: pricing.emergencyFee,
        discount: pricing.discount,
        loyaltyDiscount: pricing.loyaltyDiscount,
        couponDiscount: pricing.couponDiscount,
        totalPrice: pricing.totalPrice,
        commission: pricing.commission,
        nursePayout: pricing.nursePayout,
        beneficiaryLat: body.lat,
        beneficiaryLng: body.lng,
        beneficiaryAddress: body.address,
        notes: body.notes ?? null,
        scheduledAt,
        isEmergency: body.isEmergency ?? false,
        isNightService,
        isFridayService,
        paymentMethod: body.paymentMethod ?? null,
        paymentStatus: 'pending',
        couponId,
      },
    });

    // Deduct loyalty points if used
    if (loyaltyDiscount > 0 && body.loyaltyPointsToRedeem) {
      await db.beneficiary.update({
        where: { id: user.userId },
        data: { loyaltyPoints: { decrement: body.loyaltyPointsToRedeem } },
      });
      await db.loyaltyTransaction.create({
        data: {
          beneficiaryId: user.userId,
          points: body.loyaltyPointsToRedeem,
          type: 'redeem',
          referenceId: serviceRequest.id,
          description: `استخدام نقاط الولاء للطلب ${serviceRequest.id}`,
        },
      });
    }

    // Increment coupon usage
    if (couponId) {
      await db.coupon.update({
        where: { id: couponId },
        data: { usedCount: { increment: 1 } },
      });
    }

    await logActivity({
      userId: user.userId,
      userRole: 'beneficiary',
      action: 'create_order',
      entity: 'ServiceRequest',
      entityId: serviceRequest.id,
      details: `تم إنشاء طلب خدمة جديد: ${service.nameAr}`,
      request,
    });

    return successResponse(serviceRequest, 'تم إنشاء طلب الخدمة بنجاح', 201);
  } catch (error) {
    return handleApiError(error);
  }
}
