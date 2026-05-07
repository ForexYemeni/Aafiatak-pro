// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Notification Client (MongoDB Only)
// ============================================================================
// Client-side notification system using MongoDB - NO Firebase.
// Handles browser notification permission, in-app notifications,
// voice notifications from database, and polling for new notifications.
// ============================================================================

/** Callback type for notification events */
type NotificationCallback = (notification: AppNotification) => void;

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

/** Notification permission status */
type NotificationPermissionStatus = 'default' | 'granted' | 'denied';

// ============================================================================
// NotificationClient Class (MongoDB Only)
// ============================================================================

class NotificationClient {
  private permission: NotificationPermissionStatus = 'default';
  private callbacks: Set<NotificationCallback> = new Set();
  private pollingInterval: ReturnType<typeof setInterval> | null = null;
  private lastCheckTime: string = new Date().toISOString();
  private initialized = false;
  private userId: string | null = null;

  // ---- Initialization ----

  /** Initialize the notification system */
  async init(userId?: string): Promise<void> {
    if (this.initialized) return;
    if (typeof window === 'undefined') return;

    this.userId = userId || null;

    // Check current permission state
    if ('Notification' in window) {
      this.permission = Notification.permission as NotificationPermissionStatus;
    }

    // Start polling for new notifications from MongoDB
    if (this.userId) {
      this.startPolling();
    }

    this.initialized = true;
  }

  /** Set the current user ID and start polling */
  setUserId(userId: string): void {
    this.userId = userId;
    if (this.initialized && !this.pollingInterval) {
      this.startPolling();
    }
  }

  // ---- Permission Management ----

  /** Request browser notification permission */
  async requestPermission(): Promise<NotificationPermissionStatus> {
    if (typeof window === 'undefined') return 'denied';
    if (!('Notification' in window)) return 'denied';

    if (this.permission === 'granted') return 'granted';

    try {
      const result = await Notification.requestPermission();
      this.permission = result as NotificationPermissionStatus;
      return this.permission;
    } catch {
      return 'denied';
    }
  }

  /** Get the current notification permission status */
  getPermissionStatus(): NotificationPermissionStatus {
    return this.permission;
  }

  /** Check if browser notifications are supported */
  isBrowserNotificationSupported(): boolean {
    if (typeof window === 'undefined') return false;
    return 'Notification' in window;
  }

  // ---- Polling for New Notifications from MongoDB ----

  /** Start polling for new notifications */
  private startPolling(): void {
    if (typeof window === 'undefined') return;
    if (this.pollingInterval) return;

    // Poll every 15 seconds for new notifications
    this.pollingInterval = setInterval(async () => {
      await this.pollNotifications();
    }, 15000);

    // Also poll immediately
    this.pollNotifications();
  }

  /** Stop polling for notifications */
  stopPolling(): void {
    if (this.pollingInterval) {
      clearInterval(this.pollingInterval);
      this.pollingInterval = null;
    }
  }

  /** Poll the server for new notifications since last check */
  private async pollNotifications(): Promise<void> {
    if (!this.userId) return;

    try {
      const response = await fetch(`/api/notifications?since=${encodeURIComponent(this.lastCheckTime)}&limit=10`);
      if (!response.ok) return;

      const data = await response.json();
      if (!data.success || !data.data?.notifications) return;

      const notifications: AppNotification[] = data.data.notifications;

      if (notifications.length > 0) {
        // Update last check time to the most recent notification
        this.lastCheckTime = new Date().toISOString();

        // Process each new notification
        for (const notification of notifications) {
          this.processNotification(notification);
        }
      }
    } catch (error) {
      // Silently fail - will retry on next poll
    }
  }

  /** Process a notification received from the server */
  private processNotification(notification: AppNotification): void {
    // Notify all registered callbacks
    for (const callback of this.callbacks) {
      try {
        callback(notification);
      } catch (error) {
        console.error('[NotificationClient] Callback error:', error);
      }
    }

    // Show browser notification
    this.showBrowserNotification(notification);
  }

  // ---- Browser Notification ----

  /** Show a browser notification */
  showBrowserNotification(notification: AppNotification): void {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (this.permission !== 'granted') return;

    const options: NotificationOptions = {
      body: notification.body,
      icon: '/logo.svg',
      badge: '/logo.svg',
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

    const browserNotification = new Notification(notification.title, options);

    browserNotification.onclick = () => {
      window.focus();
      const clickAction = notification.clickAction || notification.data?.clickAction;
      if (clickAction) {
        window.location.href = clickAction;
      }
      browserNotification.close();
    };

    // Auto-close for non-urgent notifications after 5 seconds
    if (notification.priority !== 'urgent') {
      setTimeout(() => {
        browserNotification.close();
      }, 5000);
    }
  }

  // ---- Callback Registration ----

  /** Register a callback for new notifications */
  onNotification(callback: NotificationCallback): () => void {
    this.callbacks.add(callback);
    return () => {
      this.callbacks.delete(callback);
    };
  }

  // ---- Cleanup ----

  /** Clean up all resources */
  destroy(): void {
    this.stopPolling();
    this.callbacks.clear();
    this.userId = null;
    this.initialized = false;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/** Global NotificationClient instance - MongoDB only, NO Firebase */
export const notificationClient = new NotificationClient();

export default notificationClient;
