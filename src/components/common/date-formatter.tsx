'use client';

import { cn } from '@/lib/utils';

interface DateFormatterProps {
  date: Date | string;
  format?: 'relative' | 'full' | 'date' | 'time' | 'short';
  className?: string;
}

const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

function toArabicNum(num: number | string | undefined | null): string {
  if (num === undefined || num === null) return '٠';
  return String(num).replace(/\d/g, (d) => arabicNumerals[parseInt(d, 10)]);
}

const arabicMonths = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر',
];

const arabicDays = [
  'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت',
];

function getRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);

  if (diffSeconds < 60) {
    return 'منذ لحظات';
  } else if (diffMinutes < 60) {
    return `منذ ${toArabicNum(diffMinutes)} دقيق${diffMinutes === 1 ? 'ة' : diffMinutes <= 10 ? 'ات' : 'ة'}`;
  } else if (diffHours < 24) {
    return `منذ ${toArabicNum(diffHours)} ساع${diffHours === 1 ? 'ة' : diffHours <= 10 ? 'ات' : 'ة'}`;
  } else if (diffDays < 7) {
    return `منذ ${toArabicNum(diffDays)} يو${diffDays === 1 ? 'م' : diffDays <= 10 ? 'مياً' : 'ماً'}`;
  } else if (diffWeeks < 4) {
    return `منذ ${toArabicNum(diffWeeks)} أسبو${diffWeeks === 1 ? 'ع' : diffWeeks <= 10 ? 'عاً' : 'عاً'}`;
  } else {
    return `منذ ${toArabicNum(diffMonths)} شه${diffMonths === 1 ? 'ر' : diffMonths <= 10 ? 'وراً' : 'راً'}`;
  }
}

function formatFullDate(date: Date): string {
  const day = date.getDate();
  const month = arabicMonths[date.getMonth()];
  const year = date.getFullYear();
  const dayName = arabicDays[date.getDay()];
  return `${dayName}، ${toArabicNum(day)} ${month} ${toArabicNum(year)}`;
}

function formatDateOnly(date: Date): string {
  const day = date.getDate();
  const month = arabicMonths[date.getMonth()];
  const year = date.getFullYear();
  return `${toArabicNum(day)} ${month} ${toArabicNum(year)}`;
}

function formatTimeOnly(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const period = hours >= 12 ? 'م' : 'ص';
  const displayHours = hours % 12 || 12;
  return `${toArabicNum(displayHours)}:${toArabicNum(minutes.toString().padStart(2, '0'))} ${period}`;
}

function formatShortDate(date: Date): string {
  const day = date.getDate();
  const month = arabicMonths[date.getMonth()];
  return `${toArabicNum(day)} ${month}`;
}

export function DateFormatter({ date: dateProp, format = 'relative', className }: DateFormatterProps) {
  const date = typeof dateProp === 'string' ? new Date(dateProp) : dateProp;

  let formatted: string;
  switch (format) {
    case 'relative':
      formatted = getRelativeTime(date);
      break;
    case 'full':
      formatted = formatFullDate(date);
      break;
    case 'date':
      formatted = formatDateOnly(date);
      break;
    case 'time':
      formatted = formatTimeOnly(date);
      break;
    case 'short':
      formatted = formatShortDate(date);
      break;
    default:
      formatted = getRelativeTime(date);
  }

  return (
    <time
      dateTime={date.toISOString()}
      title={formatFullDate(date)}
      className={cn('text-sm', className)}
    >
      {formatted}
    </time>
  );
}

// Export utility functions for use outside React components
export { toArabicNum, getRelativeTime, formatFullDate, formatDateOnly, formatTimeOnly };
