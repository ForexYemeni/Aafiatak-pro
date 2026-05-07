// POST /api/beneficiary/coupons/validate - Validate coupon code

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireRole, successResponse, handleApiError, validateRequired, safeJsonParse,
} from '@/lib/api/helpers';

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, 'beneficiary');

    const body = await request.json();
    const validationError = validateRequired(body, ['code']);
    if (validationError) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: validationError }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const coupon = await db.coupon.findUnique({
      where: { code: body.code },
    });

    if (!coupon) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'كوبون الخصم غير صالح' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Check if coupon is valid
    const now = new Date();
    const isValid = coupon.isActive
      && coupon.usedCount < coupon.maxUses
      && new Date(coupon.expiresAt) > now
      && (!body.orderAmount || body.orderAmount >= coupon.minOrderAmount);

    // Check applicable categories
    let categoryMatch = true;
    if (body.serviceCategory) {
      const applicableCategories = safeJsonParse<string[]>(coupon.applicableCategories, []);
      if (applicableCategories.length > 0) {
        categoryMatch = applicableCategories.includes(body.serviceCategory);
      }
    }

    const discountAmount = isValid && categoryMatch && body.orderAmount
      ? Math.min(
          body.orderAmount * (coupon.discountPercent / 100),
          coupon.maxDiscountAmount ?? Infinity
        )
      : 0;

    if (!isValid) {
      const reasons: string[] = [];
      if (!coupon.isActive) reasons.push('الكوبون غير نشط');
      if (coupon.usedCount >= coupon.maxUses) reasons.push('تم استخدام الكوبون للحد الأقصى');
      if (new Date(coupon.expiresAt) <= now) reasons.push('انتهت صلاحية الكوبون');
      if (body.orderAmount && body.orderAmount < coupon.minOrderAmount) reasons.push(`الحد الأدنى للطلب ${coupon.minOrderAmount} ر.ي`);

      return successResponse({
        valid: false,
        reasons,
        code: coupon.code,
      }, 'كوبون الخصم غير صالح');
    }

    if (!categoryMatch) {
      return successResponse({
        valid: false,
        reasons: ['الكوبون لا ينطبق على هذه الفئة'],
        code: coupon.code,
      }, 'كوبون الخصم لا ينطبق');
    }

    return successResponse({
      valid: true,
      code: coupon.code,
      discountPercent: coupon.discountPercent,
      discountAmount: Math.round(discountAmount),
      maxDiscountAmount: coupon.maxDiscountAmount,
      minOrderAmount: coupon.minOrderAmount,
      applicableCategories: safeJsonParse<string[]>(coupon.applicableCategories, []),
    }, 'كوبون الخصم صالح');
  } catch (error) {
    return handleApiError(error);
  }
}
