// ============================================================================
// عافيتك Loyalty System Utility - Points, Tiers & Redemption
// ============================================================================
// Loyalty system for beneficiaries with tiered progression:
// برونزي (Bronze) → فضي (Silver) → ذهبي (Gold) → ماسي (Platinum)
// ============================================================================

import { toArabicNumerals } from './currency';

// ---- Types ----

export interface LoyaltyConfig {
  pointsPerOrder: number;
  redemptionThreshold: number;
  pointsValue: number; // How much each point is worth in YER
  maxRedemptionPercent: number; // Max discount from loyalty (%)
}

export interface LoyaltyTierInfo {
  key: LoyaltyTierKey;
  nameAr: string;
  minPoints: number;
  maxPoints: number;
  color: string;
  icon: string;
}

export type LoyaltyTierKey = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface TierProgress {
  current: LoyaltyTierInfo;
  next: LoyaltyTierInfo | null;
  pointsInCurrentTier: number;
  pointsToNextTier: number;
  percent: number;
}

// ---- Constants ----

export const DEFAULT_LOYALTY_CONFIG: LoyaltyConfig = {
  pointsPerOrder: 10,
  redemptionThreshold: 100,
  pointsValue: 5, // 5 YER per point
  maxRedemptionPercent: 20, // Max 20% discount from loyalty
};

export const LOYALTY_TIERS: readonly LoyaltyTierInfo[] = [
  {
    key: 'bronze',
    nameAr: 'برونزي',
    minPoints: 0,
    maxPoints: 99,
    color: '#CD7F32',
    icon: '🥉',
  },
  {
    key: 'silver',
    nameAr: 'فضي',
    minPoints: 100,
    maxPoints: 499,
    color: '#C0C0C0',
    icon: '🥈',
  },
  {
    key: 'gold',
    nameAr: 'ذهبي',
    minPoints: 500,
    maxPoints: 999,
    color: '#FFD700',
    icon: '🥇',
  },
  {
    key: 'platinum',
    nameAr: 'ماسي',
    minPoints: 1000,
    maxPoints: Infinity,
    color: '#E5E4E2',
    icon: '💎',
  },
] as const;

// ---- Tier Functions ----

/**
 * Get the loyalty tier name in Arabic for a given point count.
 * 0-99: برونزي (Bronze)
 * 100-499: فضي (Silver)
 * 500-999: ذهبي (Gold)
 * 1000+: ماسي (Platinum)
 */
export function getLoyaltyTier(points: number): string {
  if (points >= 1000) return 'ماسي';
  if (points >= 500) return 'ذهبي';
  if (points >= 100) return 'فضي';
  return 'برونزي';
}

/**
 * Get the loyalty tier key for a given point count.
 */
export function getLoyaltyTierKey(points: number): LoyaltyTierKey {
  if (points >= 1000) return 'platinum';
  if (points >= 500) return 'gold';
  if (points >= 100) return 'silver';
  return 'bronze';
}

/**
 * Get the full tier info object for a given point count.
 */
export function getLoyaltyTierInfo(points: number): LoyaltyTierInfo {
  const key = getLoyaltyTierKey(points);
  const tier = LOYALTY_TIERS.find((t) => t.key === key);
  return tier ?? LOYALTY_TIERS[0];
}

/**
 * Get progress from current tier to the next tier.
 */
export function getTierProgress(points: number): TierProgress {
  const currentTierIndex = LOYALTY_TIERS.findIndex(
    (tier) => points >= tier.minPoints && points <= tier.maxPoints
  );
  const effectiveIndex = currentTierIndex >= 0 ? currentTierIndex : 0;
  const current = LOYALTY_TIERS[effectiveIndex];
  const next = effectiveIndex < LOYALTY_TIERS.length - 1
    ? LOYALTY_TIERS[effectiveIndex + 1]
    : null;

  const pointsInCurrentTier = points - current.minPoints;
  const tierRange = current.maxPoints - current.minPoints + 1;
  const pointsToNextTier = next ? next.minPoints - points : 0;

  // Calculate percentage within current tier
  let percent = 0;
  if (next) {
    percent = Math.min(100, Math.round((pointsInCurrentTier / tierRange) * 100));
  } else {
    percent = 100; // Already at max tier
  }

  return {
    current,
    next,
    pointsInCurrentTier,
    pointsToNextTier,
    percent,
  };
}

// ---- Points Calculation Functions ----

/**
 * Calculate earned points for an order.
 * Points can be based on order amount or a flat rate per order.
 */
export function calculateEarnedPoints(
  orderAmount: number,
  config: LoyaltyConfig = DEFAULT_LOYALTY_CONFIG
): number {
  // Base points per order
  const basePoints = config.pointsPerOrder;

  // Bonus points for higher-value orders
  // Every 5000 YER earns 1 additional point
  const bonusPoints = Math.floor(orderAmount / 5000);

  return basePoints + bonusPoints;
}

/**
 * Calculate the monetary value of a given number of loyalty points.
 */
export function calculateRedemptionValue(
  points: number,
  config: LoyaltyConfig = DEFAULT_LOYALTY_CONFIG
): number {
  return points * config.pointsValue;
}

/**
 * Check if the user has enough points to redeem.
 */
export function canRedeem(
  points: number,
  config: LoyaltyConfig = DEFAULT_LOYALTY_CONFIG
): boolean {
  return points >= config.redemptionThreshold;
}

/**
 * Calculate how many points to redeem for a given discount amount.
 */
export function pointsForDiscount(
  discountAmount: number,
  config: LoyaltyConfig = DEFAULT_LOYALTY_CONFIG
): number {
  if (config.pointsValue <= 0) return 0;
  return Math.ceil(discountAmount / config.pointsValue);
}

// ---- Formatting Functions ----

/**
 * Format points count in Arabic with Arabic-Indic numerals.
 */
export function formatPoints(points: number): string {
  return `${toArabicNumerals(points)} نقطة`;
}

/**
 * Format the redemption value in YER.
 */
export function formatRedemptionValue(
  points: number,
  config: LoyaltyConfig = DEFAULT_LOYALTY_CONFIG
): string {
  const value = calculateRedemptionValue(points, config);
  return `${toArabicNumerals(value)} ر.ي`;
}

/**
 * Get a summary of the loyalty tier benefits in Arabic.
 */
export function getTierBenefits(tier: LoyaltyTierKey): string[] {
  switch (tier) {
    case 'bronze':
      return [
        'كسب نقاط على كل طلب',
        'استبدال النقاط عند بلوغ الحد الأدنى',
      ];
    case 'silver':
      return [
        'كسب ١.٥x نقاط على كل طلب',
        'خصم ٥% عند استبدال النقاط',
        'أولوية في الطلبات العاجلة',
      ];
    case 'gold':
      return [
        'كسب ٢x نقاط على كل طلب',
        'خصم ١٠% عند استبدال النقاط',
        'أولوية عالية في الطلبات',
        'دعم عملاء متميز',
      ];
    case 'platinum':
      return [
        'كسب ٣x نقاط على كل طلب',
        'خصم ١٥% عند استبدال النقاط',
        'أعلى أولوية في الطلبات',
        'دعم عملاء VIP',
        'عروض حصرية',
      ];
  }
}

/**
 * Calculate points needed to reach a specific tier.
 */
export function pointsToReachTier(targetTier: LoyaltyTierKey): number {
  const tier = LOYALTY_TIERS.find((t) => t.key === targetTier);
  return tier?.minPoints ?? 0;
}
