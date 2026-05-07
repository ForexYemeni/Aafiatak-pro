// ============================================================================
// عافيتك Referral System Utility - Code Generation & Reward Calculation
// ============================================================================
// Referral system allowing beneficiaries to invite others and earn points.
// Code format: AF-XXXXXX (6 alphanumeric characters)
// ============================================================================

// ---- Types ----

export interface ReferralRewardConfig {
  referrerPoints: number; // Points the referrer earns
  referredPoints: number; // Points the new user earns
}

export interface ReferralRewardResult {
  referrerPoints: number;
  referredPoints: number;
}

// ---- Constants ----

export const DEFAULT_REFERRAL_CONFIG: ReferralRewardConfig = {
  referrerPoints: 50,
  referredPoints: 25,
};

const REFERRAL_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const REFERRAL_CODE_LENGTH = 6;
const REFERRAL_CODE_PREFIX = 'AF';

// ---- Code Generation ----

/**
 * Generate a unique referral code in AF-XXXXXX format.
 * Uses crypto.getRandomValues for secure randomness when available,
 * falls back to Math.random for SSR compatibility.
 */
export function generateReferralCode(): string {
  let code = '';

  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    const array = new Uint8Array(REFERRAL_CODE_LENGTH);
    crypto.getRandomValues(array);
    for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
      code += REFERRAL_CODE_CHARS[array[i] % REFERRAL_CODE_CHARS.length];
    }
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < REFERRAL_CODE_LENGTH; i++) {
      const randomIndex = Math.floor(Math.random() * REFERRAL_CODE_CHARS.length);
      code += REFERRAL_CODE_CHARS[randomIndex];
    }
  }

  return `${REFERRAL_CODE_PREFIX}-${code}`;
}

/**
 * Validate a referral code format.
 * Valid format: AF-XXXXXX where X is alphanumeric (excluding ambiguous chars).
 */
export function isValidReferralCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;

  const pattern = /^AF-[A-HJ-NP-Z2-9]{6}$/;
  return pattern.test(code.toUpperCase());
}

/**
 * Normalize a referral code to uppercase with proper formatting.
 */
export function normalizeReferralCode(code: string): string {
  const cleaned = code.trim().toUpperCase().replace(/\s/g, '');

  // If user typed without the hyphen, add it
  if (cleaned.startsWith('AF') && cleaned.length === 8 && !cleaned.includes('-')) {
    return `${cleaned.slice(0, 2)}-${cleaned.slice(2)}`;
  }

  return cleaned;
}

// ---- Reward Calculation ----

/**
 * Calculate referral rewards for both the referrer and the referred user.
 */
export function calculateReferralReward(
  config: ReferralRewardConfig = DEFAULT_REFERRAL_CONFIG
): ReferralRewardResult {
  return {
    referrerPoints: config.referrerPoints,
    referredPoints: config.referredPoints,
  };
}

/**
 * Calculate total reward points from a number of successful referrals.
 */
export function calculateTotalReferralRewards(
  successfulReferrals: number,
  config: ReferralRewardConfig = DEFAULT_REFERRAL_CONFIG
): {
  totalReferrerPoints: number;
  totalReferredPoints: number;
  totalPoints: number;
} {
  const totalReferrerPoints = successfulReferrals * config.referrerPoints;
  const totalReferredPoints = successfulReferrals * config.referredPoints;

  return {
    totalReferrerPoints,
    totalReferredPoints,
    totalPoints: totalReferrerPoints + totalReferredPoints,
  };
}

// ---- Link Generation ----

/**
 * Generate a referral link with the given code.
 */
export function generateReferralLink(code: string): string {
  if (typeof window !== 'undefined') {
    const baseUrl = window.location.origin;
    return `${baseUrl}/register?ref=${code}`;
  }
  // SSR fallback
  return `/register?ref=${code}`;
}

/**
 * Extract referral code from a URL or query string.
 */
export function extractReferralCode(urlOrQuery: string): string | null {
  if (!urlOrQuery) return null;

  // If it's a full URL
  try {
    const url = new URL(urlOrQuery);
    const ref = url.searchParams.get('ref');
    if (ref && isValidReferralCode(ref)) return ref;
    if (ref) return normalizeReferralCode(ref);
  } catch {
    // Not a full URL, might be a code directly
  }

  // If it's just a code
  const normalized = normalizeReferralCode(urlOrQuery);
  if (isValidReferralCode(normalized)) return normalized;

  return null;
}

// ---- Formatting ----

/**
 * Format a referral code for display with spacing.
 */
export function formatReferralCode(code: string): string {
  const normalized = normalizeReferralCode(code);
  // AF-XXXXXX → AF - XXXXXX for display
  return normalized.replace('-', ' - ');
}

/**
 * Get referral sharing text in Arabic.
 */
export function getReferralShareText(code: string): string {
  return `انضم إلى عافيتك - منصة الرعاية الصحية المنزلية في اليمن! 🏥\n\nاستخدم كود الإحالة: ${code}\nواحصل على نقاط مجانية عند التسجيل! 🎁`;
}

/**
 * Get WhatsApp sharing URL with referral text.
 */
export function getWhatsAppShareUrl(code: string, phone?: string): string {
  const text = encodeURIComponent(getReferralShareText(code));
  const phoneParam = phone ? phone : '';
  return `https://wa.me/${phoneParam}?text=${text}`;
}

/**
 * Get Telegram sharing URL with referral text.
 */
export function getTelegramShareUrl(code: string): string {
  const text = encodeURIComponent(getReferralShareText(code));
  return `https://t.me/share/url?url=${encodeURIComponent(generateReferralLink(code))}&text=${text}`;
}
