// ============================================================================
// عافيتك Phone Validation Utility - Yemen Phone Number Validation & Formatting
// ============================================================================
// Validates and formats Yemeni phone numbers for the healthcare platform.
// Yemen country code: +967
// Mobile formats: 7XXXXXXXX (9 digits after country code)
// ============================================================================

// ---- Constants ----

const YEMEN_COUNTRY_CODE = '+967';
const YEMEN_MOBILE_PREFIX = '7';
const YEMEN_MOBILE_LENGTH = 9; // 7 + 8 digits

// ---- Validation Functions ----

/**
 * Validate a Yemen phone number.
 * Accepts formats:
 * - 7XXXXXXXX (local format, 9 digits)
 * - +9677XXXXXXXXX (international format)
 * - 9677XXXXXXXXX (international without +)
 * - 07XXXXXXXX (with leading 0)
 */
export function isValidYemenPhone(phone: string): boolean {
  if (!phone || typeof phone !== 'string') return false;

  const cleaned = cleanPhone(phone);

  // Must be 9 digits starting with 7
  if (cleaned.length !== YEMEN_MOBILE_LENGTH) return false;
  if (!cleaned.startsWith(YEMEN_MOBILE_PREFIX)) return false;

  // All characters must be digits
  return /^\d{9}$/.test(cleaned);
}

/**
 * Check if the phone number is a Yemen mobile number.
 * This is an alias for isValidYemenPhone since Yemen only has mobile numbers
 * in the format we support.
 */
export function isYemenMobile(phone: string): boolean {
  return isValidYemenPhone(phone);
}

// ---- Formatting Functions ----

/**
 * Clean a phone number by removing all non-digit characters,
 * then stripping country code and leading zeros.
 * Returns the 9-digit local format: 7XXXXXXXX
 */
export function cleanPhone(phone: string): string {
  if (!phone) return '';

  // Remove all non-digit characters
  let digits = phone.replace(/[^\d]/g, '');

  // Remove country code 967
  if (digits.startsWith('967')) {
    digits = digits.slice(3);
  }

  // Remove leading 0
  if (digits.startsWith('0')) {
    digits = digits.slice(1);
  }

  return digits;
}

/**
 * Format a Yemen phone number in international format.
 * Example: +967-7XX-XXXXXX
 */
export function formatYemenPhone(phone: string): string {
  const cleaned = cleanPhone(phone);
  if (cleaned.length !== YEMEN_MOBILE_LENGTH) return phone; // Return as-is if invalid

  const prefix = cleaned.slice(0, 3); // 7XX
  const number = cleaned.slice(3); // XXXXXX

  return `${YEMEN_COUNTRY_CODE}-${prefix}-${number}`;
}

/**
 * Format a Yemen phone number for display.
 * Example: 7XX XXX XXX
 */
export function displayPhone(phone: string): string {
  const cleaned = cleanPhone(phone);
  if (cleaned.length !== YEMEN_MOBILE_LENGTH) return phone; // Return as-is if invalid

  const part1 = cleaned.slice(0, 3); // 7XX
  const part2 = cleaned.slice(3, 6); // XXX
  const part3 = cleaned.slice(6, 9); // XXX

  return `${part1} ${part2} ${part3}`;
}

/**
 * Format a Yemen phone number for international dialing.
 * Example: +9677XXXXXXXX
 */
export function internationalFormat(phone: string): string {
  const cleaned = cleanPhone(phone);
  if (cleaned.length !== YEMEN_MOBILE_LENGTH) return phone;

  return `+967${cleaned}`;
}

/**
 * Format a Yemen phone number for WhatsApp URL.
 * Example: 9677XXXXXXXX (no + sign)
 */
export function whatsappFormat(phone: string): string {
  const cleaned = cleanPhone(phone);
  if (cleaned.length !== YEMEN_MOBILE_LENGTH) return phone;

  return `967${cleaned}`;
}

// ---- Phone Utility Functions ----

/**
 * Get a tel: href for click-to-call.
 * Example: tel:+9677XXXXXXXX
 */
export function getTelHref(phone: string): string {
  const formatted = internationalFormat(phone);
  return `tel:${formatted}`;
}

/**
 * Get a WhatsApp chat URL for a phone number.
 * Example: https://wa.me/9677XXXXXXXX
 */
export function getWhatsAppUrl(phone: string, message?: string): string {
  const formatted = whatsappFormat(phone);
  const baseUrl = `https://wa.me/${formatted}`;
  if (message) {
    return `${baseUrl}?text=${encodeURIComponent(message)}`;
  }
  return baseUrl;
}

/**
 * Mask a phone number for privacy display.
 * Example: 7XX XXX X59 → 7XX *** *59
 */
export function maskPhone(phone: string): string {
  const cleaned = cleanPhone(phone);
  if (cleaned.length !== YEMEN_MOBILE_LENGTH) return phone;

  const prefix = cleaned.slice(0, 3);
  const lastTwo = cleaned.slice(-2);

  return `${prefix} *** **${lastTwo}`;
}
