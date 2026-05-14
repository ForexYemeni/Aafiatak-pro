'use client';

import type { ReactNode } from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';

type StatCardVariant = 'default' | 'admin' | 'nurse' | 'beneficiary';

interface StatCardProps {
  icon: ReactNode;
  value: string | number;
  label: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  variant?: StatCardVariant;
  className?: string;
  sublabel?: string;
}

function getVariantClasses(variant: StatCardVariant) {
  switch (variant) {
    case 'admin':
      return {
        iconBg: 'from-admin/20 to-admin/5',
        iconText: 'text-admin',
        iconRing: 'ring-admin/20',
        cardAccent: 'before:from-admin/8 before:to-transparent',
        trendUp: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
        trendDown: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
      };
    case 'nurse':
      return {
        iconBg: 'from-nurse/20 to-nurse/5',
        iconText: 'text-nurse',
        iconRing: 'ring-nurse/20',
        cardAccent: 'before:from-nurse/8 before:to-transparent',
        trendUp: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
        trendDown: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
      };
    case 'beneficiary':
      return {
        iconBg: 'from-beneficiary/20 to-beneficiary/5',
        iconText: 'text-beneficiary',
        iconRing: 'ring-beneficiary/20',
        cardAccent: 'before:from-beneficiary/8 before:to-transparent',
        trendUp: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
        trendDown: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
      };
    default:
      return {
        iconBg: 'from-primary/20 to-primary/5',
        iconText: 'text-primary',
        iconRing: 'ring-primary/20',
        cardAccent: 'before:from-primary/8 before:to-transparent',
        trendUp: 'text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-900/20',
        trendDown: 'text-red-500 dark:text-red-400 bg-red-50 dark:bg-red-900/20',
      };
  }
}

export function StatCard({ icon, value, label, trend, variant = 'default', className, sublabel }: StatCardProps) {
  const colors = getVariantClasses(variant);

  return (
    <div
      className={cn(
        'relative rounded-2xl p-5 overflow-hidden',
        'bg-card border border-border/60',
        'shadow-sm hover:shadow-md transition-all duration-250 hover:-translate-y-0.5',
        className
      )}
    >
      {/* Subtle top-right gradient decoration */}
      <div className={cn(
        'absolute top-0 left-0 w-32 h-32 rounded-full -translate-x-8 -translate-y-8 opacity-50',
        `bg-gradient-to-br ${colors.iconBg}`
      )} />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-muted-foreground font-medium mb-1.5 truncate">{label}</p>
          <p className="text-[2rem] font-bold tracking-tight leading-none text-foreground">{value}</p>
          {sublabel && (
            <p className="text-xs text-muted-foreground mt-1 truncate">{sublabel}</p>
          )}
          {trend && (
            <div className={cn(
              'inline-flex items-center gap-1 mt-2.5 px-2 py-0.5 rounded-full text-xs font-semibold',
              trend.isPositive ? colors.trendUp : colors.trendDown
            )}>
              {trend.isPositive ? (
                <TrendingUp className="w-3 h-3" />
              ) : (
                <TrendingDown className="w-3 h-3" />
              )}
              <span>{trend.isPositive ? '+' : ''}{trend.value}%</span>
              <span className="font-normal opacity-70">هذا الشهر</span>
            </div>
          )}
        </div>

        {/* Icon container */}
        <div className={cn(
          'w-12 h-12 rounded-2xl flex items-center justify-center shrink-0',
          'bg-gradient-to-br ring-1 shadow-sm',
          colors.iconBg,
          colors.iconRing,
          colors.iconText
        )}>
          {icon}
        </div>
      </div>
    </div>
  );
}
