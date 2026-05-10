'use client';

import { ShieldCheck } from 'lucide-react';
import { cn } from '@/lib/utils';

interface VerifiedBadgeProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
  className?: string;
}

export function VerifiedBadge({ size = 'md', showText = false, className }: VerifiedBadgeProps) {
  const sizeClasses = {
    sm: 'w-3.5 h-3.5',
    md: 'w-4.5 h-4.5',
    lg: 'w-6 h-6',
  };
  
  const textSizes = {
    sm: 'text-[10px]',
    md: 'text-xs',
    lg: 'text-sm',
  };

  return (
    <span className={cn('inline-flex items-center gap-1', className)}>
      <ShieldCheck 
        className={cn(sizeClasses[size], 'text-emerald-500 fill-emerald-500/20')} 
      />
      {showText && (
        <span className={cn(textSizes[size], 'text-emerald-600 font-medium')}>
          موثّق
        </span>
      )}
    </span>
  );
}
