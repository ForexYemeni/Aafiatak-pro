// ============================================================================
// عافيتك Currency Formatter Utility - Yemeni Rial (ر.ي) Formatting
// ============================================================================
// Formats monetary values in Yemeni Rial with Arabic-Indic numerals,
// Western numerals, and short formats for large numbers.
// ============================================================================

// ---- Arabic-Indic Numeral Mapping ----

const WESTERN_TO_ARABIC: Record<string, string> = {
  '0': '٠',
  '1': '١',
  '2': '٢',
  '3': '٣',
  '4': '٤',
  '5': '٥',
  '6': '٦',
  '7': '٧',
  '8': '٨',
  '9': '٩',
};

const ARABIC_TO_WESTERN: Record<string, string> = {
  '٠': '0',
  '١': '1',
  '٢': '2',
  '٣': '3',
  '٤': '4',
  '٥': '5',
  '٦': '6',
  '٧': '7',
  '٨': '8',
  '٩': '9',
};

// ---- Numeral Conversion ----

/**
 * Convert a number or numeric string to Arabic-Indic numerals.
 * Example: 1234 → "١٢٣٤"
 */
export function toArabicNumerals(num: number | string): string {
  const str = String(num);
  return str.replace(/[0-9]/g, (digit) => WESTERN_TO_ARABIC[digit] ?? digit);
}

/**
 * Convert Arabic-Indic numerals back to Western numerals.
 * Example: "١٢٣٤" → "1234"
 */
export function fromArabicNumerals(str: string): string {
  return str.replace(/[٠-٩]/g, (digit) => ARABIC_TO_WESTERN[digit] ?? digit);
}

// ---- Currency Formatting ----

/**
 * Format an amount in Yemeni Rial with Arabic-Indic numerals.
 * Example: 1234 → "١,٢٣٤ ر.ي"
 */
export function formatCurrency(amount: number): string {
  const formatted = formatNumberWithCommas(Math.round(amount));
  const arabicFormatted = toArabicNumerals(formatted);
  return `${arabicFormatted} ر.ي`;
}

/**
 * Format an amount in Yemeni Rial with Western numerals.
 * Example: 1234 → "1,234 ر.ي"
 */
export function formatCurrencyEN(amount: number): string {
  const formatted = formatNumberWithCommas(Math.round(amount));
  return `${formatted} ر.ي`;
}

/**
 * Parse a currency string back to a number.
 * Handles both Arabic and Western numeral formats.
 * Example: "١,٢٣٤ ر.ي" → 1234, "1,234 ر.ي" → 1234
 */
export function parseCurrency(value: string): number {
  if (!value) return 0;

  // Remove currency symbol and spaces
  let cleaned = value.replace(/ر\.ي/g, '').replace(/ر.ي/g, '').trim();

  // Convert Arabic numerals to Western
  cleaned = fromArabicNumerals(cleaned);

  // Remove commas
  cleaned = cleaned.replace(/,/g, '');

  // Remove any remaining non-numeric characters (except minus and decimal)
  cleaned = cleaned.replace(/[^0-9.\-]/g, '');

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Short format for large numbers in Arabic.
 * Example: 1200 → "١.٢ ألف ر.ي", 1500000 → "١.٥ مليون ر.ي"
 */
export function formatCurrencyShort(amount: number): string {
  const absAmount = Math.abs(amount);

  if (absAmount >= 1_000_000) {
    const millions = amount / 1_000_000;
    const formatted = millions % 1 === 0
      ? toArabicNumerals(millions.toFixed(0))
      : toArabicNumerals(millions.toFixed(1));
    return `${formatted} مليون ر.ي`;
  }

  if (absAmount >= 1_000) {
    const thousands = amount / 1_000;
    const formatted = thousands % 1 === 0
      ? toArabicNumerals(thousands.toFixed(0))
      : toArabicNumerals(thousands.toFixed(1));
    return `${formatted} ألف ر.ي`;
  }

  return formatCurrency(amount);
}

// ---- Number Formatting Helpers ----

/**
 * Format a number with comma separators for thousands.
 * Example: 1234567 → "1,234,567"
 */
function formatNumberWithCommas(num: number): string {
  const parts = Math.abs(num).toString().split('.');
  const intPart = parts[0] ?? '0';
  const decPart = parts[1];

  // Add commas every 3 digits from right
  const withCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const sign = num < 0 ? '-' : '';
  if (decPart) {
    return `${sign}${withCommas}.${decPart}`;
  }
  return `${sign}${withCommas}`;
}

/**
 * Format a number as a percentage with Arabic numerals.
 * Example: 15.5 → "١٥.٥٪"
 */
export function formatPercent(value: number): string {
  const formatted = value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
  return `${toArabicNumerals(formatted)}٪`;
}

/**
 * Format amount without the currency symbol (just the number with Arabic numerals).
 * Example: 1234 → "١,٢٣٤"
 */
export function formatAmount(amount: number): string {
  const formatted = formatNumberWithCommas(Math.round(amount));
  return toArabicNumerals(formatted);
}

/**
 * Format amount without the currency symbol (Western numerals).
 * Example: 1234 → "1,234"
 */
export function formatAmountEN(amount: number): string {
  return formatNumberWithCommas(Math.round(amount));
}
