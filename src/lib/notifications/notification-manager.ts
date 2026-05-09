// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Notification Manager (Simplified)
// ============================================================================
// Central notification management that coordinates browser notifications
// and in-app events. Sound playing is handled ONLY by the PWA provider
// (push notifications from Service Worker). This prevents duplicate sounds.
// ============================================================================

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

// ============================================================================
// NotificationManager Class
// ============================================================================

class NotificationManager {
  private initialized = false;

  /** Initialize the notification system */
  init(): void {
    if (this.initialized) return;
    if (typeof window === 'undefined') return;

    this.initialized = true;
  }

  /**
   * Process and display a notification.
   * *** Does NOT play sounds. Sounds are handled ONLY by the PWA provider. ***
   */
  notify(notification: AppNotification): void {
    if (typeof window === 'undefined') return;

    // Dispatch in-app event for UI components (toasts, badges, etc.)
    // NO sound playing here - sounds come from push/Socket events only
    const event = new CustomEvent('app-notification', {
      detail: notification,
    });
    window.dispatchEvent(event);
  }

  /** Show a browser notification (NO sound - sounds are from push events only) */
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
      silent: true, // We handle sound separately via push events
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

    if (notification.priority !== 'urgent') {
      setTimeout(() => browserNotif.close(), 5000);
    }
  }

  /** Clean up resources */
  destroy(): void {
    this.initialized = false;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const notificationManager = new NotificationManager();
export default notificationManager;
