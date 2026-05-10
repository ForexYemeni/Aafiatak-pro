'use client';

import { cn } from '@/lib/utils';

type BadgeStatusVariant = 'active' | 'inactive' | 'pending' | 'assigned' | 'accepted' | 'suspended' | 'verified' | 'rejected' | 'completed' | 'cancelled' | 'in_progress' | 'dispatched' | 'unverified' | 'resolved' | 'awaiting_payment' | 'creator_selected' | 'admin_approved' | 'selected_by_creator' | 'payment_pending' | 'payment_submitted' | 'payment_verified';

interface BadgeStatusProps {
  status: BadgeStatusVariant | string;
  label?: string;
  className?: string;
  size?: 'sm' | 'md';
}

const statusConfig: Record<BadgeStatusVariant, { label: string; className: string }> = {
  active: {
    label: 'نشط',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  inactive: {
    label: 'غير نشط',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
  },
  unverified: {
    label: 'غير موثق',
    className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400',
  },
  pending: {
    label: 'معلق',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  assigned: {
    label: 'تم التعيين',
    className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  },
  accepted: {
    label: 'مقبول',
    className: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-400',
  },
  suspended: {
    label: 'موقوف',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
  verified: {
    label: 'موثق',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  rejected: {
    label: 'مرفوض',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
  completed: {
    label: 'مكتمل',
    className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  },
  cancelled: {
    label: 'ملغي',
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
  },
  in_progress: {
    label: 'قيد التنفيذ',
    className: 'bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-400',
  },
  dispatched: {
    label: 'تم الإرسال',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  },
  resolved: {
    label: 'تم الحل',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  awaiting_payment: {
    label: 'بانتظار تأكيد الدفع',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  },
  creator_selected: {
    label: 'بانتظار الموافقة',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  admin_approved: {
    label: 'موافقة الإدارة',
    className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
  },
  selected_by_creator: {
    label: 'تم اختياره',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
  payment_pending: {
    label: 'بانتظار الدفع',
    className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  },
  payment_submitted: {
    label: 'تم تقديم الدفع',
    className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  },
  payment_verified: {
    label: 'تم التحقق',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
};

export function BadgeStatus({ status, label, className, size = 'sm' }: BadgeStatusProps) {
  // Prevent "undefined" from being displayed as text
  const safeStatus = status || 'pending';
  const config = statusConfig[safeStatus as BadgeStatusVariant] ?? {
    label: safeStatus,
    className: 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full font-medium',
        size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-3 py-1 text-sm',
        config.className,
        className
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full me-1.5',
          config.className.includes('green') ? 'bg-green-500' :
          config.className.includes('yellow') ? 'bg-yellow-500' :
          config.className.includes('red') ? 'bg-red-500' :
          config.className.includes('blue') ? 'bg-blue-500' :
          config.className.includes('sky') ? 'bg-sky-500' :
          config.className.includes('orange') ? 'bg-orange-500' :
          config.className.includes('amber') ? 'bg-amber-500' :
          config.className.includes('emerald') ? 'bg-emerald-500' :
          'bg-gray-500'
        )}
      />
      {label ?? config.label}
    </span>
  );
}
