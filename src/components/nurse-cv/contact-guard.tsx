'use client';

import { motion } from 'framer-motion';
import { Lock, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface ContactGuardProps {
  message?: string;
  onAction?: () => void;
  actionLabel?: string;
}

export function ContactGuard({
  message = 'بيانات التواصل متاحة بعد اعتماد الدفع',
  onAction,
  actionLabel = 'طلب خدمة',
}: ContactGuardProps) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative rounded-2xl overflow-hidden"
    >
      {/* Blurred content behind */}
      <div className="filter blur-[6px] pointer-events-none select-none opacity-50" aria-hidden="true">
        <div className="p-6 space-y-3">
          <div className="h-4 bg-muted rounded w-3/4" />
          <div className="h-4 bg-muted rounded w-1/2" />
          <div className="h-4 bg-muted rounded w-2/3" />
        </div>
      </div>

      {/* Overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/70 backdrop-blur-sm p-6 text-center">
        <div className={cn(
          'w-14 h-14 rounded-2xl flex items-center justify-center mb-3',
          'bg-nurse/15 ring-1 ring-nurse/20'
        )}>
          <Lock className="w-7 h-7 text-nurse" />
        </div>
        <p className="text-sm font-medium mb-1">{message}</p>
        <p className="text-xs text-muted-foreground mb-4">
          يمكنك التواصل مع الممرض بعد تقديم طلب خدمة معتمد
        </p>
        {onAction && (
          <Button
            className="bg-nurse hover:bg-nurse/90 gap-2"
            onClick={onAction}
          >
            <ShieldCheck className="w-4 h-4" />
            {actionLabel}
          </Button>
        )}
      </div>
    </motion.div>
  );
}
