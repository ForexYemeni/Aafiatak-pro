'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

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
}

function getVariantClasses(variant: StatCardVariant): {
  iconBg: string;
  iconText: string;
  trendUp: string;
  trendDown: string;
} {
  switch (variant) {
    case 'admin':
      return {
        iconBg: 'bg-admin/10',
        iconText: 'text-admin',
        trendUp: 'text-green-600',
        trendDown: 'text-red-500',
      };
    case 'nurse':
      return {
        iconBg: 'bg-nurse/10',
        iconText: 'text-nurse',
        trendUp: 'text-green-600',
        trendDown: 'text-red-500',
      };
    case 'beneficiary':
      return {
        iconBg: 'bg-beneficiary/10',
        iconText: 'text-beneficiary',
        trendUp: 'text-green-600',
        trendDown: 'text-red-500',
      };
    default:
      return {
        iconBg: 'bg-primary/10',
        iconText: 'text-primary',
        trendUp: 'text-green-600',
        trendDown: 'text-red-500',
      };
  }
}

export function StatCard({ icon, value, label, trend, variant = 'default', className }: StatCardProps) {
  const colors = getVariantClasses(variant);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        'glass rounded-2xl p-6 transition-all duration-200 hover:shadow-md',
        className
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <p className="text-sm text-muted-foreground mb-1">{label}</p>
          <p className="text-3xl font-bold tracking-tight">{value}</p>
          {trend && (
            <div className="flex items-center gap-1 mt-2">
              {trend.isPositive ? (
                <TrendingUp className={cn('w-4 h-4', colors.trendUp)} />
              ) : (
                <TrendingDown className={cn('w-4 h-4', colors.trendDown)} />
              )}
              <span
                className={cn(
                  'text-sm font-medium',
                  trend.isPositive ? colors.trendUp : colors.trendDown
                )}
              >
                {trend.isPositive ? '+' : ''}{trend.value}%
              </span>
              <span className="text-xs text-muted-foreground">من الشهر الماضي</span>
            </div>
          )}
        </div>
        <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', colors.iconBg, colors.iconText)}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
