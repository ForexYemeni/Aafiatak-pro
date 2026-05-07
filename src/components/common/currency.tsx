'use client';

import { cn } from '@/lib/utils';

interface CurrencyProps {
  amount: number;
  className?: string;
  showDecimals?: boolean;
}

/**
 * Formats a number as Yemeni Rial currency with Arabic-Indic numerals.
 * Example: 1234 → "١,٢٣٤ ر.ي"
 */
export function Currency({ amount, className, showDecimals = false }: CurrencyProps) {
  const formatted = formatYemeniRial(amount, showDecimals);

  return (
    <span className={cn('font-semibold tabular-nums', className)}>
      {formatted}
    </span>
  );
}

/**
 * Format a number as Yemeni Rial currency string.
 */
export function formatYemeniRial(amount: number, showDecimals = false): string {
  const toArabicNumerals = (num: string): string => {
    const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    return num.replace(/\d/g, (d) => arabicNumerals[parseInt(d, 10)]);
  };

  const formatted = showDecimals
    ? amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : Math.round(amount).toLocaleString('en-US');

  return `${toArabicNumerals(formatted)} ر.ي`;
}

/**
 * Format a number as a simple Arabic numeral string.
 */
export function toArabicNumerals(num: number | string): string {
  const arabicNumerals = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
  return String(num).replace(/\d/g, (d) => arabicNumerals[parseInt(d, 10)]);
}
