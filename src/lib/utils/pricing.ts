// ============================================================================
// عافيتك Dynamic Pricing Utility - Service Pricing Calculation Engine
// ============================================================================
// Comprehensive pricing calculation for healthcare service requests including
// night fees, Friday fees, emergency fees, commission, loyalty/coupon discounts.
// Currency: Yemeni Rial (ر.ي)
// ============================================================================

import type { Coupon, ServiceCategory } from '@/types';
import { formatCurrency } from './currency';

// ---- Types ----

export interface PricingInput {
  basePrice: number;
  scheduledAt?: Date;
  isEmergency: boolean;
  couponCode?: string;
  loyaltyPoints?: number;
  referralCode?: string;
}

export interface PricingBreakdown {
  basePrice: number;
  nightFee: number;
  nightFeePercent: number;
  fridayFee: number;
  fridayFeePercent: number;
  emergencyFee: number;
  subtotal: number;
  discount: number;
  discountPercent: number;
  loyaltyDiscount: number;
  total: number;
  commission: number;
  commissionPercent: number;
  nurseEarnings: number;
  currency: string;
}

export interface PricingSettings {
  commissionRate: number;
  emergencyFee: number;
  nightFeePercent: number;
  fridayFeePercent: number;
  nightStartHour: number;
  nightEndHour: number;
}

// ---- Default Settings ----

export const DEFAULT_PRICING_SETTINGS: PricingSettings = {
  commissionRate: 15,
  emergencyFee: 5000,
  nightFeePercent: 20,
  fridayFeePercent: 15,
  nightStartHour: 22, // 10 PM
  nightEndHour: 6, // 6 AM
};

// ---- Helper Functions ----

/**
 * Check if a given date falls within night hours.
 * Night hours: 22:00 (10 PM) → 06:00 (6 AM)
 */
export function isNightTime(date: Date, nightStart: number, nightEnd: number): boolean {
  const hour = date.getHours();
  if (nightStart > nightEnd) {
    // Night spans midnight (e.g., 22 → 6)
    return hour >= nightStart || hour < nightEnd;
  }
  // Night does not span midnight (e.g., 0 → 6)
  return hour >= nightStart && hour < nightEnd;
}

/**
 * Check if a given date is Friday (Islamic weekend in Yemen).
 * JavaScript getDay() returns 5 for Friday.
 */
export function isFriday(date: Date): boolean {
  return date.getDay() === 5;
}

/**
 * Calculate coupon discount based on coupon rules.
 */
export function calculateCouponDiscount(
  total: number,
  coupon: Coupon
): number {
  if (!coupon.isActive) return 0;
  if (coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses) return 0;
  if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) return 0;
  if (total < coupon.minOrderAmount) return 0;

  const discount = total * (coupon.discountPercent / 100);

  // Cap discount at maxDiscountAmount if set
  if (coupon.maxDiscountAmount !== null && coupon.maxDiscountAmount > 0) {
    return Math.min(discount, coupon.maxDiscountAmount);
  }

  return discount;
}

/**
 * Check if coupon is applicable to a specific service category.
 */
export function isCouponApplicableToCategory(
  coupon: Coupon,
  category: ServiceCategory
): boolean {
  if (!coupon.applicableCategories || coupon.applicableCategories.length === 0) {
    return true; // No restriction = applicable to all
  }
  return coupon.applicableCategories.includes(category);
}

/**
 * Calculate loyalty discount based on points redeemed.
 * Each point has a value, with max discount percentage cap.
 */
export function calculateLoyaltyDiscount(
  points: number,
  pointsValue: number,
  maxDiscountPercent: number,
  orderTotal: number
): number {
  if (points <= 0) return 0;

  const rawDiscount = points * pointsValue;
  const maxAllowed = orderTotal * (maxDiscountPercent / 100);

  return Math.min(rawDiscount, maxAllowed);
}

// ---- Main Pricing Function ----

/**
 * Calculate the full pricing breakdown for a service request.
 *
 * Pricing structure:
 * 1. Base price
 * 2. + Night fee (percentage of base price if scheduled during night hours)
 * 3. + Friday fee (percentage of base price if scheduled on Friday)
 * 4. + Emergency fee (flat fee if emergency request)
 * 5. = Subtotal
 * 6. - Coupon discount
 * 7. - Loyalty discount
 * 8. = Total
 * 9. Commission = Total × commissionRate%
 * 10. Nurse earnings = Total - Commission
 */
export function calculatePricing(
  input: PricingInput,
  settings: PricingSettings = DEFAULT_PRICING_SETTINGS,
  coupon?: Coupon | null,
  loyaltyConfig?: { pointsValue: number; maxDiscountPercent: number } | null
): PricingBreakdown {
  const {
    basePrice,
    scheduledAt,
    isEmergency,
    loyaltyPoints,
  } = input;

  const effectiveSettings = { ...DEFAULT_PRICING_SETTINGS, ...settings };

  // Step 1: Base price
  const effectiveBasePrice = Math.max(0, basePrice);

  // Step 2: Night fee
  const scheduledDate = scheduledAt ?? new Date();
  const isNight = isNightTime(
    scheduledDate,
    effectiveSettings.nightStartHour,
    effectiveSettings.nightEndHour
  );
  const nightFee = isNight
    ? Math.round(effectiveBasePrice * (effectiveSettings.nightFeePercent / 100))
    : 0;

  // Step 3: Friday fee
  const isFridayService = isFriday(scheduledDate);
  const fridayFee = isFridayService
    ? Math.round(effectiveBasePrice * (effectiveSettings.fridayFeePercent / 100))
    : 0;

  // Step 4: Emergency fee
  const emergencyFee = isEmergency ? effectiveSettings.emergencyFee : 0;

  // Step 5: Subtotal
  const subtotal = effectiveBasePrice + nightFee + fridayFee + emergencyFee;

  // Step 6: Coupon discount
  const couponDiscount = coupon
    ? Math.round(calculateCouponDiscount(subtotal, coupon))
    : 0;

  // Step 7: Loyalty discount
  const loyaltyDiscount =
    loyaltyPoints && loyaltyPoints > 0 && loyaltyConfig
      ? Math.round(
          calculateLoyaltyDiscount(
            loyaltyPoints,
            loyaltyConfig.pointsValue,
            loyaltyConfig.maxDiscountPercent,
            subtotal - couponDiscount
          )
        )
      : 0;

  // Step 8: Total
  const totalDiscount = couponDiscount + loyaltyDiscount;
  const total = Math.max(0, Math.round(subtotal - totalDiscount));
  const discountPercent = subtotal > 0 ? Math.round((totalDiscount / subtotal) * 100) : 0;

  // Step 9: Commission
  const commission = Math.round(total * (effectiveSettings.commissionRate / 100));

  // Step 10: Nurse earnings
  const nurseEarnings = total - commission;

  return {
    basePrice: effectiveBasePrice,
    nightFee,
    nightFeePercent: isNight ? effectiveSettings.nightFeePercent : 0,
    fridayFee,
    fridayFeePercent: isFridayService ? effectiveSettings.fridayFeePercent : 0,
    emergencyFee,
    subtotal,
    discount: totalDiscount,
    discountPercent,
    loyaltyDiscount,
    total,
    commission,
    commissionPercent: effectiveSettings.commissionRate,
    nurseEarnings,
    currency: 'ر.ي',
  };
}

/**
 * Format a pricing breakdown as a human-readable Arabic string.
 */
export function formatPricingBreakdown(breakdown: PricingBreakdown): string {
  const lines: string[] = [
    `السعر الأساسي: ${formatCurrency(breakdown.basePrice)}`,
  ];

  if (breakdown.nightFee > 0) {
    lines.push(`رسوم الخدمة الليلية (${breakdown.nightFeePercent}%): ${formatCurrency(breakdown.nightFee)}`);
  }

  if (breakdown.fridayFee > 0) {
    lines.push(`رسوم يوم الجمعة (${breakdown.fridayFeePercent}%): ${formatCurrency(breakdown.fridayFee)}`);
  }

  if (breakdown.emergencyFee > 0) {
    lines.push(`رسوم الطوارئ: ${formatCurrency(breakdown.emergencyFee)}`);
  }

  lines.push(`المجموع الفرعي: ${formatCurrency(breakdown.subtotal)}`);

  if (breakdown.discount > 0) {
    lines.push(`الخصم (${breakdown.discountPercent}%): -${formatCurrency(breakdown.discount)}`);
  }

  if (breakdown.loyaltyDiscount > 0) {
    lines.push(`خصم نقاط الولاء: -${formatCurrency(breakdown.loyaltyDiscount)}`);
  }

  lines.push(`الإجمالي: ${formatCurrency(breakdown.total)}`);
  lines.push(`عمولة المنصة (${breakdown.commissionPercent}%): ${formatCurrency(breakdown.commission)}`);
  lines.push(`أرباح الممرض/ـة: ${formatCurrency(breakdown.nurseEarnings)}`);

  return lines.join('\n');
}

/**
 * Get a quick pricing estimate without a full breakdown.
 */
export function estimateTotal(
  basePrice: number,
  options?: {
    scheduledAt?: Date;
    isEmergency?: boolean;
    discountPercent?: number;
  }
): number {
  const settings = DEFAULT_PRICING_SETTINGS;
  const date = options?.scheduledAt ?? new Date();

  let total = basePrice;

  // Night fee
  if (isNightTime(date, settings.nightStartHour, settings.nightEndHour)) {
    total += basePrice * (settings.nightFeePercent / 100);
  }

  // Friday fee
  if (isFriday(date)) {
    total += basePrice * (settings.fridayFeePercent / 100);
  }

  // Emergency fee
  if (options?.isEmergency) {
    total += settings.emergencyFee;
  }

  // Discount
  if (options?.discountPercent && options.discountPercent > 0) {
    total -= total * (options.discountPercent / 100);
  }

  return Math.max(0, Math.round(total));
}
