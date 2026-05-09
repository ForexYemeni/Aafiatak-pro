// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Notification Manager (Simplified)
// ============================================================================
// Central notification management that coordinates sound, browser notifications,
// and in-app events. Simplified for 100% reliability.
// ============================================================================

import { soundManager } from './sound-manager';

/** Application-level notification interface */
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
  voiceEnabled?: boolean;
  voicePlayedAt?: string | null;
}

/** Sound mapping by notification type */
const SOUND_MAP: Record<string, string> = {
  assignment: 'notification',
  service_request: 'notification',
  service_assigned: 'notification',
  service_accepted: 'success',
  service_started: 'notification',
  service_completed: 'success',
  service_cancelled: 'error',
  status_change: 'notification',
  emergency: 'emergency',
  emergency_assigned: 'emergency',
  payment: 'success',
  withdrawal: 'notification',
  withdrawal_approved: 'success',
  withdrawal_rejected: 'error',
  chat: 'chat',
  rating: 'success',
  verification: 'notification',
  system: 'notification',
  loyalty: 'success',
  referral: 'notification',
  promotion: 'notification',
  appointment: 'notification',
  reminder: 'notification',
};

// ============================================================================
// NotificationManager Class
// ============================================================================

class NotificationManager {
  private initialized = false;

  /** Initialize the notification system */
  init(): void {
    if (this.initialized) return;
    if (typeof window === 'undefined') return;

    // Initialize sound manager
    soundManager.init();

    this.initialized = true;
  }

  /**
   * Process and display a notification with sound.
   * This is the main entry point for all notifications.
   */
  notify(notification: AppNotification): void {
    if (typeof window === 'undefined') return;

    // 1. Play sound immediately
    this.playSoundForNotification(notification);

    // 2. Dispatch in-app event for UI components (toasts, badges, etc.)
    const event = new CustomEvent('app-notification', {
      detail: notification,
    });
    window.dispatchEvent(event);
  }

  /** Play the appropriate sound for a notification */
  private playSoundForNotification(notification: AppNotification): void {
    const soundName = SOUND_MAP[notification.type] || 'notification';
    const isUrgent = notification.priority === 'urgent';
    const isHigh = notification.priority === 'high';

    soundManager.play(soundName, {
      priority: notification.priority,
      volume: isUrgent ? 1.0 : isHigh ? 0.9 : 0.8,
      vibrate: isUrgent || isHigh,
      repeat: isUrgent ? 2 : 1,
    });

    // For emergency, repeat after delay
    if (isUrgent && notification.type === 'emergency') {
      setTimeout(() => {
        soundManager.playEmergency();
      }, 1500);
    }
  }

  /** Show a browser notification with sound */
  async showBrowserNotification(notification: AppNotification): Promise<void> {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    const options: NotificationOptions = {
      body: notification.body,
      icon: '/icons/icon-192x192.png',
      badge: '/icons/icon-72x72.png',
      tag: notification.id,
      dir: 'rtl',
      lang: 'ar',
      requireInteraction: notification.priority === 'urgent' || notification.priority === 'high',
      silent: false,
      data: {
        ...notification.data,
        clickAction: notification.clickAction ?? '',
        type: notification.type,
        priority: notification.priority,
      },
    };

    if (notification.imageUrl) {
      options.image = notification.imageUrl;
    }

    const browserNotif = new Notification(notification.title, options);

    browserNotif.onclick = () => {
      window.focus();
      const clickAction = notification.clickAction || notification.data?.clickAction;
      if (clickAction) {
        window.location.href = clickAction;
      }
      browserNotif.close();
    };

    // Also play sound
    this.playSoundForNotification(notification);

    if (notification.priority !== 'urgent') {
      setTimeout(() => browserNotif.close(), 5000);
    }
  }

  /** Clean up resources */
  destroy(): void {
    soundManager.destroy();
    this.initialized = false;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const notificationManager = new NotificationManager();
export default notificationManager;
