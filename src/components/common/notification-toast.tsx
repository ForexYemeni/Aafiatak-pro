'use client';

import { useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import type { NotificationType, NotificationPriority } from '@/types';

// ============================================================================
// Notification Toast Utilities
// ============================================================================

interface NotificationToastOptions {
  title: string;
  description?: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  action?: {
    label: string;
    onClick: () => void;
  };
  duration?: number;
}

function getToastStyle(type: NotificationType): 'success' | 'error' | 'warning' | 'info' {
  switch (type) {
    case 'payment':
    case 'rating':
      return 'success';
    case 'emergency':
      return 'error';
    case 'reminder':
    case 'status_change':
      return 'warning';
    default:
      return 'info';
  }
}

/**
 * Show a notification toast with Arabic text and appropriate styling.
 */
export function showNotificationToast({
  title,
  description,
  type = 'system',
  priority = 'medium',
  action,
  duration,
}: NotificationToastOptions) {
  const style = getToastStyle(type);

  const durationMs = duration ?? (priority === 'urgent' ? 10000 : priority === 'high' ? 7000 : 5000);

  const toastOptions = {
    duration: durationMs,
    action: action
      ? {
          label: action.label,
          onClick: action.onClick,
        }
      : undefined,
  };

  switch (style) {
    case 'success':
      toast.success(title, { description, ...toastOptions });
      break;
    case 'error':
      toast.error(title, { description, ...toastOptions });
      break;
    case 'warning':
      toast.warning(title, { description, ...toastOptions });
      break;
    case 'info':
    default:
      toast.info(title, { description, ...toastOptions });
      break;
  }
}

/**
 * Hook for showing notification toasts.
 */
export function useNotificationToast() {
  return {
    success: (title: string, description?: string) => {
      toast.success(title, { description });
    },
    error: (title: string, description?: string) => {
      toast.error(title, { description });
    },
    warning: (title: string, description?: string) => {
      toast.warning(title, { description });
    },
    info: (title: string, description?: string) => {
      toast.info(title, { description });
    },
    notify: showNotificationToast,
  };
}

/**
 * Component that listens for socket notifications and displays them.
 */
export function NotificationToastListener() {
  // This would normally connect to the socket and listen for notifications
  // For now, it's a placeholder that can be extended
  return null;
}
