'use client';

import type { ReactNode, HTMLAttributes } from 'react';
import { cn } from '@/lib/utils';

type GlassCardVariant = 'default' | 'admin' | 'nurse' | 'beneficiary';

interface GlassCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: GlassCardVariant;
  children: ReactNode;
  noPadding?: boolean;
  hoverable?: boolean;
}

const variantClasses: Record<GlassCardVariant, string> = {
  default: 'glass',
  admin: 'glass-admin',
  nurse: 'glass-nurse',
  beneficiary: 'glass-beneficiary',
};

export function GlassCard({
  variant = 'default',
  children,
  noPadding = false,
  hoverable = false,
  className,
  ...props
}: GlassCardProps) {
  return (
    <div
      className={cn(
        'rounded-2xl shadow-sm transition-all duration-200',
        variantClasses[variant],
        !noPadding && 'p-5',
        hoverable && 'hover:shadow-md hover:-translate-y-0.5 cursor-pointer',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

interface GlassCardHeaderProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function GlassCardHeader({ children, className, ...props }: GlassCardHeaderProps) {
  return (
    <div className={cn('mb-4', className)} {...props}>
      {children}
    </div>
  );
}

interface GlassCardTitleProps extends HTMLAttributes<HTMLHeadingElement> {
  children: ReactNode;
}

export function GlassCardTitle({ children, className, ...props }: GlassCardTitleProps) {
  return (
    <h3 className={cn('text-base font-semibold leading-tight', className)} {...props}>
      {children}
    </h3>
  );
}

interface GlassCardContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
}

export function GlassCardContent({ children, className, ...props }: GlassCardContentProps) {
  return (
    <div className={cn('', className)} {...props}>
      {children}
    </div>
  );
}
