'use client';

import type { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface EmptyStateProps {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  className?: string;
  variant?: 'default' | 'admin' | 'nurse' | 'beneficiary';
}

function getVariantClasses(variant: EmptyStateProps['variant']) {
  switch (variant) {
    case 'admin':
      return { iconBg: 'bg-admin/10', iconRing: 'ring-admin/20', iconText: 'text-admin', btn: 'bg-admin hover:bg-admin/90 text-admin-foreground' };
    case 'nurse':
      return { iconBg: 'bg-nurse/10', iconRing: 'ring-nurse/20', iconText: 'text-nurse', btn: 'bg-nurse hover:bg-nurse/90 text-nurse-foreground' };
    case 'beneficiary':
      return { iconBg: 'bg-beneficiary/10', iconRing: 'ring-beneficiary/20', iconText: 'text-beneficiary', btn: 'bg-beneficiary hover:bg-beneficiary/90 text-beneficiary-foreground' };
    default:
      return { iconBg: 'bg-muted', iconRing: 'ring-border', iconText: 'text-muted-foreground', btn: '' };
  }
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  secondaryAction,
  className,
  variant = 'default',
}: EmptyStateProps) {
  const colors = getVariantClasses(variant);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
      className={cn(
        'flex flex-col items-center justify-center py-16 px-6 text-center',
        className
      )}
    >
      {icon && (
        <motion.div
          initial={{ scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4, delay: 0.1, ease: 'easeOut' }}
          className={cn(
            'w-20 h-20 rounded-2xl flex items-center justify-center mb-5 ring-1 shadow-sm',
            colors.iconBg,
            colors.iconRing,
            colors.iconText
          )}
        >
          {icon}
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15 }}
        className="space-y-2 mb-6"
      >
        <h3 className="text-base font-semibold text-foreground">{title}</h3>
        {description && (
          <p className="text-sm text-muted-foreground max-w-xs mx-auto leading-relaxed">{description}</p>
        )}
      </motion.div>

      {(action || secondaryAction) && (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.25 }}
          className="flex flex-col sm:flex-row gap-2 items-center"
        >
          {action && (
            <Button
              onClick={action.onClick}
              className={cn('px-6', colors.btn || '')}
              size="sm"
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              onClick={secondaryAction.onClick}
              variant="outline"
              size="sm"
              className="px-6"
            >
              {secondaryAction.label}
            </Button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
