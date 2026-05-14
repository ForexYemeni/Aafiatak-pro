'use client';

import { cn } from '@/lib/utils';

type BadgeStatusVariant = 'active' | 'inactive' | 'pending' | 'assigned' | 'accepted' | 'suspended' | 'verified' | 'rejected' | 'completed' | 'cancelled' | 'in_progress' | 'dispatched' | 'unverified' | 'resolved' | 'awaiting_payment' | 'creator_selected' | 'admin_approved' | 'selected_by_creator' | 'payment_pending' | 'payment_submitted' | 'payment_verified';

interface BadgeStatusProps {
  status: BadgeStatusVariant | string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

interface StatusConfig {
  label: string;
  className: string;
  dotColor: string;
  pulse?: boolean;
}

const statusConfig: Record<BadgeStatusVariant, StatusConfig> = {
  active: {
    label: 'نشط',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-400 dark:ring-emerald-800/40',
    dotColor: 'bg-emerald-500',
    pulse: true,
  },
  inactive: {
    label: 'غير نشط',
    className: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:ring-slate-700/40',
    dotColor: 'bg-slate-400',
  },
  unverified: {
    label: 'غير موثق',
    className: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:ring-slate-700/40',
    dotColor: 'bg-slate-400',
  },
  pending: {
    label: 'معلق',
    className: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/25 dark:text-amber-400 dark:ring-amber-800/40',
    dotColor: 'bg-amber-500',
    pulse: true,
  },
  assigned: {
    label: 'تم التعيين',
    className: 'bg-violet-50 text-violet-700 ring-violet-200 dark:bg-violet-900/25 dark:text-violet-400 dark:ring-violet-800/40',
    dotColor: 'bg-violet-500',
  },
  accepted: {
    label: 'مقبول',
    className: 'bg-teal-50 text-teal-700 ring-teal-200 dark:bg-teal-900/25 dark:text-teal-400 dark:ring-teal-800/40',
    dotColor: 'bg-teal-500',
  },
  suspended: {
    label: 'موقوف',
    className: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/25 dark:text-red-400 dark:ring-red-800/40',
    dotColor: 'bg-red-500',
  },
  verified: {
    label: 'موثق',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-400 dark:ring-emerald-800/40',
    dotColor: 'bg-emerald-500',
  },
  rejected: {
    label: 'مرفوض',
    className: 'bg-red-50 text-red-700 ring-red-200 dark:bg-red-900/25 dark:text-red-400 dark:ring-red-800/40',
    dotColor: 'bg-red-500',
  },
  completed: {
    label: 'مكتمل',
    className: 'bg-blue-50 text-blue-700 ring-blue-200 dark:bg-blue-900/25 dark:text-blue-400 dark:ring-blue-800/40',
    dotColor: 'bg-blue-500',
  },
  cancelled: {
    label: 'ملغي',
    className: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:ring-slate-700/40',
    dotColor: 'bg-slate-400',
  },
  in_progress: {
    label: 'قيد التنفيذ',
    className: 'bg-sky-50 text-sky-700 ring-sky-200 dark:bg-sky-900/25 dark:text-sky-400 dark:ring-sky-800/40',
    dotColor: 'bg-sky-500',
    pulse: true,
  },
  dispatched: {
    label: 'تم الإرسال',
    className: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-900/25 dark:text-orange-400 dark:ring-orange-800/40',
    dotColor: 'bg-orange-500',
    pulse: true,
  },
  resolved: {
    label: 'تم الحل',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-400 dark:ring-emerald-800/40',
    dotColor: 'bg-emerald-500',
  },
  awaiting_payment: {
    label: 'بانتظار تأكيد الدفع',
    className: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-900/25 dark:text-orange-400 dark:ring-orange-800/40',
    dotColor: 'bg-orange-500',
    pulse: true,
  },
  creator_selected: {
    label: 'بانتظار الموافقة',
    className: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/25 dark:text-amber-400 dark:ring-amber-800/40',
    dotColor: 'bg-amber-500',
    pulse: true,
  },
  admin_approved: {
    label: 'موافقة الإدارة',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-400 dark:ring-emerald-800/40',
    dotColor: 'bg-emerald-500',
  },
  selected_by_creator: {
    label: 'تم اختياره',
    className: 'bg-amber-50 text-amber-700 ring-amber-200 dark:bg-amber-900/25 dark:text-amber-400 dark:ring-amber-800/40',
    dotColor: 'bg-amber-500',
  },
  payment_pending: {
    label: 'بانتظار الدفع',
    className: 'bg-orange-50 text-orange-700 ring-orange-200 dark:bg-orange-900/25 dark:text-orange-400 dark:ring-orange-800/40',
    dotColor: 'bg-orange-500',
    pulse: true,
  },
  payment_submitted: {
    label: 'تم تقديم الدفع',
    className: 'bg-yellow-50 text-yellow-700 ring-yellow-200 dark:bg-yellow-900/25 dark:text-yellow-400 dark:ring-yellow-800/40',
    dotColor: 'bg-yellow-500',
    pulse: true,
  },
  payment_verified: {
    label: 'تم التحقق',
    className: 'bg-emerald-50 text-emerald-700 ring-emerald-200 dark:bg-emerald-900/25 dark:text-emerald-400 dark:ring-emerald-800/40',
    dotColor: 'bg-emerald-500',
  },
};

export function BadgeStatus({ status, label, className, size = 'sm' }: BadgeStatusProps) {
  const safeStatus = status || 'pending';
  const config: StatusConfig = statusConfig[safeStatus as BadgeStatusVariant] ?? {
    label: safeStatus,
    className: 'bg-slate-100 text-slate-600 ring-slate-200 dark:bg-slate-800/50 dark:text-slate-400 dark:ring-slate-700/40',
    dotColor: 'bg-slate-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full font-medium ring-1 ring-inset',
        size === 'sm' ? 'px-2 py-0.5 text-[11px]' : 'px-2.5 py-1 text-xs',
        config.className,
        className
      )}
    >
      <span className="relative flex items-center justify-center w-1.5 h-1.5">
        {config.pulse && (
          <span className={cn('absolute inline-flex h-full w-full rounded-full opacity-60 animate-ping', config.dotColor)} />
        )}
        <span className={cn('relative inline-flex rounded-full w-1.5 h-1.5', config.dotColor)} />
      </span>
      {label ?? config.label}
    </span>
  );
}
