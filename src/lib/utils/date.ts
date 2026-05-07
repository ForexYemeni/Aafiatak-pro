// ============================================================================
// عافيتك Date Formatter Utility - Arabic Date & Time Formatting
// ============================================================================
// Provides Arabic-language date and time formatting for the Yemeni healthcare
// platform, including relative time, day/month names, and date comparisons.
// ============================================================================

import { toArabicNumerals } from './currency';

// ---- Arabic Month Names ----

const MONTHS_AR: readonly string[] = [
  'يناير',
  'فبراير',
  'مارس',
  'أبريل',
  'مايو',
  'يونيو',
  'يوليو',
  'أغسطس',
  'سبتمبر',
  'أكتوبر',
  'نوفمبر',
  'ديسمبر',
] as const;

// ---- Arabic Day Names ----

const DAYS_AR: readonly string[] = [
  'الأحد',
  'الإثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
  'السبت',
] as const;

// ---- Arabic Day Short Names ----

const DAYS_SHORT_AR: readonly string[] = [
  'أحد',
  'إثنين',
  'ثلاثاء',
  'أربعاء',
  'خميس',
  'جمعة',
  'سبت',
] as const;

// ---- Helper ----

function toDate(value: Date | string): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}

// ---- Date Formatting Functions ----

/**
 * Format a date in Arabic.
 * Example: "١٥ يناير ٢٠٢٤"
 */
export function formatDateAr(date: Date | string): string {
  const d = toDate(date);
  const day = toArabicNumerals(d.getDate());
  const month = MONTHS_AR[d.getMonth()] ?? '';
  const year = toArabicNumerals(d.getFullYear());
  return `${day} ${month} ${year}`;
}

/**
 * Format time in Arabic with 12-hour clock.
 * Example: "١٠:٣٠ ص"
 */
export function formatTimeAr(date: Date | string): string {
  const d = toDate(date);
  let hours = d.getHours();
  const minutes = d.getMinutes();
  const period = hours >= 12 ? 'م' : 'ص';

  hours = hours % 12;
  if (hours === 0) hours = 12;

  const hoursStr = toArabicNumerals(hours);
  const minutesStr = toArabicNumerals(minutes.toString().padStart(2, '0'));

  return `${hoursStr}:${minutesStr} ${period}`;
}

/**
 * Format time in Arabic with 24-hour clock.
 * Example: "٢٢:٣٠"
 */
export function formatTime24Ar(date: Date | string): string {
  const d = toDate(date);
  const hours = toArabicNumerals(d.getHours().toString().padStart(2, '0'));
  const minutes = toArabicNumerals(d.getMinutes().toString().padStart(2, '0'));
  return `${hours}:${minutes}`;
}

/**
 * Format relative time in Arabic.
 * Examples: "الآن" | "منذ ٥ دقائق" | "منذ ساعة" | "أمس" | "منذ ٣ أيام"
 */
export function formatRelativeTime(date: Date | string): string {
  const d = toDate(date);
  const now = new Date();
  const diffMs = now.getTime() - d.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  // Future
  if (diffMs < 0) {
    const absSeconds = Math.abs(diffSeconds);
    const absMinutes = Math.abs(diffMinutes);
    const absHours = Math.abs(diffHours);
    const absDays = Math.abs(diffDays);

    if (absSeconds < 60) return 'بعد لحظات';
    if (absMinutes < 60) {
      return absMinutes === 1
        ? 'بعد دقيقة'
        : `بعد ${toArabicNumerals(absMinutes)} دقائق`;
    }
    if (absHours < 24) {
      return absHours === 1
        ? 'بعد ساعة'
        : `بعد ${toArabicNumerals(absHours)} ساعات`;
    }
    if (absDays === 1) return 'غداً';
    if (absDays < 7) return `بعد ${toArabicNumerals(absDays)} أيام`;
    if (absDays < 30) {
      const weeks = Math.floor(absDays / 7);
      return weeks === 1 ? 'بعد أسبوع' : `بعد ${toArabicNumerals(weeks)} أسابيع`;
    }
    if (absDays < 365) {
      const months = Math.floor(absDays / 30);
      return months === 1 ? 'بعد شهر' : `بعد ${toArabicNumerals(months)} أشهر`;
    }
    const years = Math.floor(absDays / 365);
    return years === 1 ? 'بعد سنة' : `بعد ${toArabicNumerals(years)} سنوات`;
  }

  // Now
  if (diffSeconds < 10) return 'الآن';
  if (diffSeconds < 60) return 'منذ لحظات';

  // Minutes
  if (diffMinutes < 60) {
    if (diffMinutes === 1) return 'منذ دقيقة';
    if (diffMinutes === 2) return 'منذ دقيقتين';
    if (diffMinutes <= 10) return `منذ ${toArabicNumerals(diffMinutes)} دقائق`;
    return `منذ ${toArabicNumerals(diffMinutes)} دقيقة`;
  }

  // Hours
  if (diffHours < 24) {
    if (diffHours === 1) return 'منذ ساعة';
    if (diffHours === 2) return 'منذ ساعتين';
    if (diffHours <= 10) return `منذ ${toArabicNumerals(diffHours)} ساعات`;
    return `منذ ${toArabicNumerals(diffHours)} ساعة`;
  }

  // Days
  if (diffDays === 1) return 'أمس';
  if (diffDays === 2) return 'منذ يومين';
  if (diffDays < 7) return `منذ ${toArabicNumerals(diffDays)} أيام`;
  if (diffDays < 14) return 'منذ أسبوع';

  // Weeks
  if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7);
    if (weeks === 1) return 'منذ أسبوع';
    if (weeks === 2) return 'منذ أسبوعين';
    return `منذ ${toArabicNumerals(weeks)} أسابيع`;
  }

  // Months
  if (diffDays < 365) {
    const months = Math.floor(diffDays / 30);
    if (months === 1) return 'منذ شهر';
    if (months === 2) return 'منذ شهرين';
    return `منذ ${toArabicNumerals(months)} أشهر`;
  }

  // Years
  const years = Math.floor(diffDays / 365);
  if (years === 1) return 'منذ سنة';
  if (years === 2) return 'منذ سنتين';
  return `منذ ${toArabicNumerals(years)} سنوات`;
}

/**
 * Format date and time together in Arabic.
 * Example: "١٥ يناير ٢٠٢٤ - ١٠:٣٠ ص"
 */
export function formatDateTimeAr(date: Date | string): string {
  const d = toDate(date);
  return `${formatDateAr(d)} - ${formatTimeAr(d)}`;
}

/**
 * Format a date with the day name in Arabic.
 * Example: "الإثنين، ١٥ يناير ٢٠٢٤"
 */
export function formatDateFullAr(date: Date | string): string {
  const d = toDate(date);
  const dayName = getDayNameAr(d);
  return `${dayName}، ${formatDateAr(d)}`;
}

// ---- Day & Month Name Functions ----

/**
 * Get the Arabic name of the day of the week.
 * Example: "الأحد", "الإثنين", etc.
 */
export function getDayNameAr(date: Date): string {
  const dayIndex = date.getDay();
  return DAYS_AR[dayIndex] ?? '';
}

/**
 * Get the short Arabic name of the day of the week.
 * Example: "أحد", "إثنين", etc.
 */
export function getDayShortNameAr(date: Date): string {
  const dayIndex = date.getDay();
  return DAYS_SHORT_AR[dayIndex] ?? '';
}

/**
 * Get the Arabic name of the month.
 * Example: "يناير", "فبراير", etc.
 */
export function getMonthNameAr(date: Date): string {
  const monthIndex = date.getMonth();
  return MONTHS_AR[monthIndex] ?? '';
}

/**
 * Get the Arabic name of a month by its index (0-11).
 */
export function getMonthNameByIndexAr(monthIndex: number): string {
  if (monthIndex < 0 || monthIndex > 11) return '';
  return MONTHS_AR[monthIndex] ?? '';
}

// ---- Date Comparison Functions ----

/**
 * Check if two dates are on the same calendar day.
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Check if a date is today.
 */
export function isToday(date: Date): boolean {
  return isSameDay(date, new Date());
}

/**
 * Check if a date is yesterday.
 */
export function isYesterday(date: Date): boolean {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return isSameDay(date, yesterday);
}

/**
 * Check if a date is tomorrow.
 */
export function isTomorrow(date: Date): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameDay(date, tomorrow);
}

/**
 * Check if a date is within the current week (Sunday to Saturday).
 */
export function isThisWeek(date: Date): boolean {
  const now = new Date();
  const startOfWeek = new Date(now);
  startOfWeek.setDate(now.getDate() - now.getDay());
  startOfWeek.setHours(0, 0, 0, 0);

  const endOfWeek = new Date(startOfWeek);
  endOfWeek.setDate(startOfWeek.getDate() + 7);

  return date >= startOfWeek && date < endOfWeek;
}

// ---- Date Boundary Functions ----

/**
 * Get the start of a day (midnight 00:00:00.000).
 */
export function startOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the end of a day (23:59:59.999).
 */
export function endOfDay(date: Date): Date {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Get the start of the current week (Sunday midnight).
 */
export function startOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setDate(date.getDate() - date.getDay());
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the end of the current week (Saturday 23:59:59.999).
 */
export function endOfWeek(date: Date): Date {
  const result = new Date(date);
  result.setDate(date.getDate() + (6 - date.getDay()));
  result.setHours(23, 59, 59, 999);
  return result;
}

/**
 * Get the start of the current month.
 */
export function startOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setDate(1);
  result.setHours(0, 0, 0, 0);
  return result;
}

/**
 * Get the end of the current month.
 */
export function endOfMonth(date: Date): Date {
  const result = new Date(date);
  result.setMonth(date.getMonth() + 1, 0);
  result.setHours(23, 59, 59, 999);
  return result;
}

// ---- Date Grouping ----

/**
 * Get the date group label in Arabic for grouping lists by date.
 * Returns: "اليوم" | "أمس" | day name for this week | full date for older
 */
export function getDateGroupLabel(date: Date | string): string {
  const d = toDate(date);

  if (isToday(d)) return 'اليوم';
  if (isYesterday(d)) return 'أمس';
  if (isThisWeek(d)) return getDayNameAr(d);

  return formatDateAr(d);
}

/**
 * Format a duration in minutes to Arabic text.
 * Example: 90 → "ساعة و ٣٠ دقيقة"
 */
export function formatDurationAr(minutes: number): string {
  if (minutes <= 0) return '٠ دقيقة';

  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  if (hours === 0) {
    return `${toArabicNumerals(mins)} دقيقة`;
  }

  if (mins === 0) {
    return hours === 1 ? 'ساعة' : `${toArabicNumerals(hours)} ساعة`;
  }

  const hoursText = hours === 1 ? 'ساعة' : `${toArabicNumerals(hours)} ساعة`;
  return `${hoursText} و ${toArabicNumerals(mins)} دقيقة`;
}
