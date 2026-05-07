// ============================================================================
// عافيتك Coupon Validation Utility - Coupon Code Validation & Discount
// ============================================================================
// Validates coupon codes for service requests, checking expiry, usage limits,
// minimum order amounts, and applicable service categories.
// ============================================================================

import type { Coupon, ServiceCategory } from '@/types';

// ---- Types ----

export interface CouponValidation {
  isValid: boolean;
  error?: string;
  discount?: number;
  discountPercent?: number;
}

// ---- Validation Functions ----

/**
 * Check if a coupon has expired.
 */
export function isCouponExpired(coupon: Coupon): boolean {
  if (!coupon.expiresAt) return false;
  return new Date(coupon.expiresAt) < new Date();
}

/**
 * Check if a coupon has reached its maximum usage limit.
 */
export function isCouponMaxedOut(coupon: Coupon): boolean {
  if (coupon.maxUses <= 0) return false; // 0 = unlimited
  return coupon.usedCount >= coupon.maxUses;
}

/**
 * Check if a coupon applies to a specific service category.
 */
export function isCouponApplicable(coupon: Coupon, category: ServiceCategory): boolean {
  if (!coupon.applicableCategories || coupon.applicableCategories.length === 0) {
    return true; // No restriction means applicable to all categories
  }
  return coupon.applicableCategories.includes(category);
}

/**
 * Check if the order amount meets the coupon's minimum order requirement.
 */
export function meetsMinOrderAmount(coupon: Coupon, orderAmount: number): boolean {
  return orderAmount >= coupon.minOrderAmount;
}

/**
 * Calculate the discount amount for a given order total using a coupon.
 */
export function calculateDiscount(coupon: Coupon, orderAmount: number): number {
  const rawDiscount = orderAmount * (coupon.discountPercent / 100);

  // Cap at maxDiscountAmount if set
  if (coupon.maxDiscountAmount !== null && coupon.maxDiscountAmount > 0) {
    return Math.min(rawDiscount, coupon.maxDiscountAmount);
  }

  return rawDiscount;
}

/**
 * Full validation of a coupon against an order.
 * Returns a CouponValidation object with isValid, error message (in Arabic),
 * and the calculated discount if valid.
 */
export function validateCoupon(
  coupon: Coupon | null,
  orderAmount: number,
  serviceCategory?: ServiceCategory
): CouponValidation {
  // Null check
  if (!coupon) {
    return {
      isValid: false,
      error: 'كوبون غير صالح',
    };
  }

  // Active check
  if (!coupon.isActive) {
    return {
      isValid: false,
      error: 'هذا الكوبون غير مفعّل',
    };
  }

  // Expiry check
  if (isCouponExpired(coupon)) {
    return {
      isValid: false,
      error: 'انتهت صلاحية هذا الكوبون',
    };
  }

  // Usage limit check
  if (isCouponMaxedOut(coupon)) {
    return {
      isValid: false,
      error: 'تم استخدام هذا الكوبون بالحد الأقصى',
    };
  }

  // Minimum order amount check
  if (!meetsMinOrderAmount(coupon, orderAmount)) {
    return {
      isValid: false,
      error: `الحد الأدنى للطلب ${coupon.minOrderAmount} ر.ي`,
    };
  }

  // Service category check
  if (serviceCategory && !isCouponApplicable(coupon, serviceCategory)) {
    return {
      isValid: false,
      error: 'هذا الكوبون لا ينطبق على هذه الخدمة',
    };
  }

  // Calculate discount
  const discount = calculateDiscount(coupon, orderAmount);

  return {
    isValid: true,
    discount: Math.round(discount),
    discountPercent: coupon.discountPercent,
  };
}

/**
 * Validate only the coupon code format.
 * Coupon codes should be alphanumeric, 3-20 characters.
 */
export function isValidCouponCodeFormat(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  return /^[A-Za-z0-9]{3,20}$/.test(code.trim());
}

/**
 * Get a user-friendly Arabic description of a coupon's terms.
 */
export function getCouponTermsAr(coupon: Coupon): string[] {
  const terms: string[] = [];

  terms.push(`خصم ${coupon.discountPercent}%`);

  if (coupon.maxDiscountAmount !== null && coupon.maxDiscountAmount > 0) {
    terms.push(`الحد الأقصى للخصم: ${coupon.maxDiscountAmount} ر.ي`);
  }

  if (coupon.minOrderAmount > 0) {
    terms.push(`الحد الأدنى للطلب: ${coupon.minOrderAmount} ر.ي`);
  }

  if (coupon.maxUses > 0) {
    terms.push(`الحد الأقصى للاستخدام: ${coupon.maxUses} مرة`);
  }

  if (coupon.expiresAt) {
    const expiryDate = new Date(coupon.expiresAt);
    terms.push(`صالح حتى: ${expiryDate.toLocaleDateString('ar-YE')}`);
  }

  if (coupon.applicableCategories && coupon.applicableCategories.length > 0) {
    const categoriesAr = coupon.applicableCategories.map((cat) => {
      const categoryNames: Record<string, string> = {
        medical: 'طبية',
        nursing: 'تمريض',
        physiotherapy: 'علاج طبيعي',
        elderly_care: 'رعاية المسنين',
        pediatric: 'أطفال',
        post_surgery: 'بعد الجراحة',
        lab: 'مختبرات',
        emergency: 'طوارئ',
      };
      return categoryNames[cat] ?? cat;
    });
    terms.push(`ينطبق على: ${categoriesAr.join('، ')}`);
  }

  return terms;
}
