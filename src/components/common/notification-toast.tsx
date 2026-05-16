'use client';

import { useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import type { NotificationType, NotificationPriority } from '@/types';
import { useAuthStore } from '@/lib/stores/auth-store';
import { notificationLogger } from '@/lib/notifications/notification-logger';

// ============================================================================
// Notification Toast Utilities
// ============================================================================

interface NotificationToastOptions {
  title: string;
  description?: string;
  type?: NotificationType;
  priority?: NotificationPriority;
  actionUrl?: string | null;
  duration?: number;
}

// Icon and color mapping for notification types
const NOTIFICATION_STYLE_MAP: Record<string, { emoji: string; bgClass: string }> = {
  emergency: { emoji: '🚨', bgClass: 'border-red-500 bg-red-50' },
  emergency_assigned: { emoji: '🚨', bgClass: 'border-red-500 bg-red-50' },
  emergency_accepted: { emoji: '🚑', bgClass: 'border-red-400 bg-red-50' },
  assignment: { emoji: '📋', bgClass: 'border-blue-500 bg-blue-50' },
  service_assigned: { emoji: '👨‍⚕️', bgClass: 'border-blue-500 bg-blue-50' },
  service_accepted: { emoji: '✅', bgClass: 'border-green-500 bg-green-50' },
  service_started: { emoji: '▶️', bgClass: 'border-blue-400 bg-blue-50' },
  service_completed: { emoji: '🎉', bgClass: 'border-green-500 bg-green-50' },
  service_cancelled: { emoji: '❌', bgClass: 'border-red-400 bg-red-50' },
  status_change: { emoji: '🔄', bgClass: 'border-amber-500 bg-amber-50' },
  payment: { emoji: '💰', bgClass: 'border-green-500 bg-green-50' },
  rating: { emoji: '⭐', bgClass: 'border-amber-500 bg-amber-50' },
  verification: { emoji: '✅', bgClass: 'border-green-500 bg-green-50' },
  withdrawal_approved: { emoji: '✅', bgClass: 'border-green-500 bg-green-50' },
  withdrawal_rejected: { emoji: '❌', bgClass: 'border-red-400 bg-red-50' },
  chat: { emoji: '💬', bgClass: 'border-blue-400 bg-blue-50' },
  system: { emoji: '🔔', bgClass: 'border-gray-400 bg-gray-50' },
  loyalty: { emoji: '🏆', bgClass: 'border-amber-500 bg-amber-50' },
  referral: { emoji: '🤝', bgClass: 'border-blue-400 bg-blue-50' },
  welcome_back: { emoji: '👋', bgClass: 'border-green-400 bg-green-50' },
};

function getToastStyle(type: NotificationType): 'success' | 'error' | 'warning' | 'info' {
  switch (type) {
    case 'payment':
    case 'rating':
    case 'service_accepted':
    case 'service_completed':
    case 'verification':
    case 'withdrawal_approved':
    case 'loyalty':
    case 'welcome_back':
      return 'success';
    case 'emergency':
    case 'emergency_assigned':
    case 'emergency_accepted':
    case 'service_cancelled':
    case 'withdrawal_rejected':
      return 'error';
    case 'reminder':
    case 'status_change':
    case 'assignment':
    case 'service_assigned':
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
  actionUrl,
  duration,
}: NotificationToastOptions) {
  const style = getToastStyle(type);
  const notifStyle = NOTIFICATION_STYLE_MAP[type] || NOTIFICATION_STYLE_MAP.system;
  const durationMs = duration ?? (priority === 'urgent' ? 12000 : priority === 'high' ? 8000 : 5000);

  // Prefix title with emoji for visual distinction
  const displayTitle = `${notifStyle.emoji} ${title}`;

  const toastOptions: any = {
    duration: durationMs,
    action: actionUrl ? {
      label: 'عرض',
      onClick: () => {
        // Navigation will be handled by the toast listener
      },
    } : undefined,
    className: `border-r-4 ${notifStyle.bgClass} text-right`,
  };

  switch (style) {
    case 'success':
      toast.success(displayTitle, { description, ...toastOptions });
      break;
    case 'error':
      toast.error(displayTitle, { description, ...toastOptions });
      break;
    case 'warning':
      toast.warning(displayTitle, { description, ...toastOptions });
      break;
    case 'info':
    default:
      toast.info(displayTitle, { description, ...toastOptions });
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

// ============================================================================
// Notification Toast Listener - Listens for app-notification events
// and displays Sonner toast popups with sound + visual feedback.
// This is the PRIMARY visual notification delivery component.
// ============================================================================

interface AppNotificationEvent {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  priority: NotificationPriority;
  data: Record<string, string>;
  clickAction?: string;
}

export function NotificationToastListener() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const lastToastIds = useRef<Set<string>>(new Set());

  const handleAppNotification = useCallback((event: Event) => {
    try {
      const customEvent = event as CustomEvent<AppNotificationEvent>;
      const notification = customEvent.detail;
      if (!notification) return;

      // Skip if we already showed a toast for this notification (dedup within component)
      if (lastToastIds.current.has(notification.id)) return;

      // Add to dedup set (keep max 50)
      lastToastIds.current.add(notification.id);
      if (lastToastIds.current.size > 50) {
        const entries = Array.from(lastToastIds.current);
        lastToastIds.current = new Set(entries.slice(-25));
      }

      // Determine the action URL for click navigation
      const actionUrl = notification.clickAction || notification.data?.actionUrl;

      // Show the toast popup
      showNotificationToast({
        title: notification.title,
        description: notification.body,
        type: notification.type,
        priority: notification.priority,
        actionUrl,
      });

      notificationLogger.logNotification('displayed', notification.id, {
        type: notification.type,
        priority: notification.priority,
        channel: 'toast',
      });

      // Also show a browser notification if the app is in the background
      if (typeof document !== 'undefined' && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
        try {
          const browserNotif = new Notification(notification.title, {
            body: notification.body,
            icon: '/icons/icon-192x192.png',
            tag: notification.id,
            data: { url: actionUrl },
          });
          browserNotif.onclick = () => {
            window.focus();
            if (actionUrl) {
              router.push(actionUrl);
            }
            browserNotif.close();
          };
        } catch {
          // Browser notification failed - ignore
        }
      }
    } catch (err) {
      console.error('[NotificationToast] Error:', err);
    }
  }, [router]);

  useEffect(() => {
    window.addEventListener('app-notification', handleAppNotification);
    return () => {
      window.removeEventListener('app-notification', handleAppNotification);
    };
  }, [handleAppNotification]);

  return null;
}
