// POST /api/beneficiary/coupons/validate - Validate coupon code
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Coupon } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const { code, orderAmount } = await request.json();

    if (!code) {
      return createErrorResponse('رمز الكوبون مطلوب', 400, 'VALIDATION_ERROR');
    }

    const coupon = await Coupon.findOne({ code: code.toUpperCase() }).lean();

    if (!coupon) {
      return createErrorResponse('الكوبون غير موجود', 404, 'NOT_FOUND');
    }

    if (!coupon.isActive) {
      return createErrorResponse('الكوبون غير نشط', 400, 'COUPON_INACTIVE');
    }

    if (coupon.usedCount >= coupon.maxUses) {
      return createErrorResponse('تم استخدام الكوبون الحد الأقصى من المرات', 400, 'COUPON_EXHAUSTED');
    }

    if (new Date() > new Date(coupon.expiresAt)) {
      return createErrorResponse('الكوبون منتهي الصلاحية', 400, 'COUPON_EXPIRED');
    }

    if (orderAmount && orderAmount < coupon.minOrderAmount) {
      return createErrorResponse(`الحد الأدنى للطلب ${coupon.minOrderAmount} ريال`, 400, 'MIN_ORDER_NOT_MET');
    }

    const discountAmount = orderAmount
      ? Math.min(orderAmount * (coupon.discountPercent / 100), coupon.maxDiscountAmount || Infinity)
      : null;

    return Response.json({
      success: true,
      data: {
        valid: true,
        code: coupon.code,
        discountPercent: coupon.discountPercent,
        discountAmount,
        maxDiscountAmount: coupon.maxDiscountAmount,
        minOrderAmount: coupon.minOrderAmount,
        expiresAt: coupon.expiresAt,
      },
      message: 'الكوبون صالح',
    });
  } catch (error) {
    console.error('[BENEFICIARY COUPON VALIDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحقق من الكوبون', 500, 'INTERNAL_ERROR');
  }
}
