// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Notification Manager
// ============================================================================
// Central notification management system that coordinates voice (TTS),
// sound, browser notifications, and in-app notifications.
// Includes deduplication, priority handling, and FCM integration.
// ============================================================================

import { voiceManager } from './voice-manager';
import { soundManager } from './sound-manager';
import type { NotificationType, NotificationPriority } from '@/types';

// ============================================================================
// Types
// ============================================================================

/** Application-level notification interface */
export interface AppNotification {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  priority: NotificationPriority;
  data?: Record<string, string>;
  imageUrl?: string;
  clickAction?: string;
}

/** Firebase message payload for background notifications */
export interface FirebaseMessagePayload {
  data?: Record<string, string>;
  notification?: {
    title?: string;
    body?: string;
    icon?: string;
    image?: string;
    click_action?: string;
  };
}

/** Notification permission status */
type NotificationPermissionStatus = 'default' | 'granted' | 'denied';

/** Arabic TTS messages mapped by notification type */
const TTS_MESSAGES: Record<NotificationType, (notification: AppNotification) => string> = {
  assignment: (n) => `لديك طلب خدمة جديد: ${n.title}`,
  payment: (n) => `إشعار دفعة: ${n.title}`,
  emergency: (n) => `تنبيه طوارئ! ${n.body}`,
  reminder: (n) => `تذكير: ${n.title}`,
  chat: (n) => `رسالة جديدة: ${n.title}`,
  status_change: (n) => `تحديث حالة: ${n.title}`,
  appointment: (n) => `تذكير موعد: ${n.title}`,
  rating: (n) => `تقييم جديد: ${n.title}`,
  system: (n) => n.title,
};

/** Sound names mapped by notification type */
const SOUND_MAP: Record<NotificationType, string> = {
  assignment: 'notification',
  payment: 'success',
  emergency: 'emergency',
  reminder: 'notification',
  chat: 'chat',
  status_change: 'notification',
  appointment: 'notification',
  rating: 'success',
  system: 'notification',
};

/** Deduplication cache entry */
interface DeduplicationEntry {
  hash: string;
  timestamp: number;
}

// ============================================================================
// NotificationManager Class
// ============================================================================

class NotificationManager {
  private permission: NotificationPermissionStatus = 'default';
  private fcmToken: string | null = null;
  private deduplicationSet: Map<string, DeduplicationEntry> = new Map();
  private maxDeduplicationSize = 100;
  private deduplicationWindowMs = 5000; // 5 seconds
  private initialized = false;

  // ---- Initialization ----

  /** Initialize the notification system */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (typeof window === 'undefined') return;

    // Check current permission state
    if ('Notification' in window) {
      this.permission = Notification.permission as NotificationPermissionStatus;
    }

    // Initialize sub-managers
    voiceManager.init();
    soundManager.init();

    // Start periodic deduplication cleanup
    this.startDeduplicationCleanup();

    this.initialized = true;
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

  // ---- In-App Notification ----

  /** Show an in-app notification (toast-style) */
  showInApp(notification: AppNotification): void {
    // Dispatch custom event that UI components can listen to
    if (typeof window === 'undefined') return;

    const event = new CustomEvent('app-notification', {
      detail: notification,
    });
    window.dispatchEvent(event);
  }

  // ---- Browser Notification ----

  /** Show a browser notification */
  showBrowser(notification: AppNotification): void {
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

    // Add image if provided (rich notification)
    if (notification.imageUrl) {
      options.image = notification.imageUrl;
    }

    const browserNotification = new Notification(notification.title, options);

    browserNotification.onclick = () => {
      this.handleNotificationClick(browserNotification);
      browserNotification.close();
    };

    // Auto-close for non-urgent notifications after 5 seconds
    if (notification.priority !== 'urgent') {
      setTimeout(() => {
        browserNotification.close();
      }, 5000);
    }
  }

  // ---- Combined Notification ----

  /** Show a notification with sound and optional TTS */
  notify(notification: AppNotification): void {
    // Check deduplication
    if (this.isDuplicate(notification)) {
      return;
    }

    // Add to deduplication cache
    this.addToDeduplicationCache(notification);

    // Show in-app notification
    this.showInApp(notification);

    // Show browser notification
    this.showBrowser(notification);

    // Play sound
    const soundName = this.getSoundByType(notification.type);
    const soundOptions = {
      priority: notification.priority,
      vibrate: notification.priority === 'high' || notification.priority === 'urgent',
      volume: notification.priority === 'urgent' ? 1.0 : notification.priority === 'high' ? 0.8 : undefined,
    };
    soundManager.play(soundName, soundOptions);

    // Emergency: repeat sound
    if (notification.priority === 'urgent' && notification.type === 'emergency') {
      setTimeout(() => {
        soundManager.playEmergency();
      }, 1500);
    }

    // TTS for high and urgent priority
    if (notification.priority === 'high' || notification.priority === 'urgent') {
      const ttsMessage = this.getTTSMessage(notification);
      voiceManager.speak(ttsMessage, {
        priority: notification.priority,
        rate: notification.priority === 'urgent' ? 1.1 : 1,
      });
    }
  }

  // ---- FCM Token Management ----

  /** Register an FCM token for push notifications */
  async registerFCMToken(token: string, platform: string, deviceId: string): Promise<void> {
    this.fcmToken = token;

    try {
      const response = await fetch('/api/notifications/register-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, platform, deviceId }),
      });

      if (!response.ok) {
        console.warn('[NotificationManager] Failed to register FCM token');
      }
    } catch (error) {
      console.warn('[NotificationManager] FCM token registration error:', error);
    }
  }

  /** Get the current FCM token */
  getFCMToken(): string | null {
    return this.fcmToken;
  }

  // ---- Deduplication ----

  /** Check if a notification is a duplicate within the deduplication window */
  private isDuplicate(notification: AppNotification): boolean {
    const hash = this.computeNotificationHash(notification);
    const entry = this.deduplicationSet.get(hash);

    if (!entry) return false;

    const elapsed = Date.now() - entry.timestamp;
    if (elapsed < this.deduplicationWindowMs) {
      return true;
    }

    // Entry has expired, remove it
    this.deduplicationSet.delete(hash);
    return false;
  }

  /** Add a notification to the deduplication cache */
  private addToDeduplicationCache(notification: AppNotification): void {
    const hash = this.computeNotificationHash(notification);
    this.deduplicationSet.set(hash, { hash, timestamp: Date.now() });

    // Enforce max size
    if (this.deduplicationSet.size > this.maxDeduplicationSize) {
      this.pruneDeduplicationCache();
    }
  }

  /** Compute a hash for a notification based on type, title, body, and data */
  private computeNotificationHash(notification: AppNotification): string {
    const dataStr = notification.data
      ? Object.entries(notification.data)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => `${k}=${v}`)
          .join('&')
      : '';

    return `${notification.type}:${notification.title}:${notification.body}:${dataStr}`;
  }

  /** Prune old entries from the deduplication cache */
  private pruneDeduplicationCache(): void {
    const now = Date.now();
    const entriesToDelete: string[] = [];

    for (const [hash, entry] of this.deduplicationSet.entries()) {
      if (now - entry.timestamp > this.deduplicationWindowMs) {
        entriesToDelete.push(hash);
      }
    }

    for (const hash of entriesToDelete) {
      this.deduplicationSet.delete(hash);
    }

    // If still too large, remove oldest entries
    if (this.deduplicationSet.size > this.maxDeduplicationSize) {
      const sorted = [...this.deduplicationSet.entries()].sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      );
      const toRemove = sorted.slice(0, this.deduplicationSet.size - this.maxDeduplicationSize);
      for (const [hash] of toRemove) {
        this.deduplicationSet.delete(hash);
      }
    }
  }

  /** Start periodic cleanup of deduplication cache */
  private startDeduplicationCleanup(): void {
    if (typeof window === 'undefined') return;

    setInterval(() => {
      this.pruneDeduplicationCache();
    }, 30000); // Clean up every 30 seconds
  }

  // ---- Sound & TTS Helpers ----

  /** Get the appropriate sound name for a notification type */
  private getSoundByType(type: NotificationType): string {
    return SOUND_MAP[type] ?? 'notification';
  }

  /** Get the TTS message for a notification in Arabic */
  private getTTSMessage(notification: AppNotification): string {
    const generator = TTS_MESSAGES[notification.type];
    if (generator) {
      return generator(notification);
    }
    return notification.title;
  }

  // ---- Background Notification Handler ----

  /** Handle a background notification (from service worker / FCM) */
  handleBackgroundNotification(payload: FirebaseMessagePayload): void {
    const notification: AppNotification = {
      id: payload.data?.id ?? crypto.randomUUID(),
      title: payload.notification?.title ?? payload.data?.title ?? 'إشعار جديد',
      body: payload.notification?.body ?? payload.data?.body ?? '',
      type: (payload.data?.type as NotificationType) ?? 'system',
      priority: (payload.data?.priority as NotificationPriority) ?? 'medium',
      data: payload.data ?? {},
      imageUrl: payload.notification?.image,
      clickAction: payload.notification?.click_action ?? payload.data?.clickAction,
    };

    // Even in background, we should show it if the app is visible
    if (document.visibilityState === 'visible') {
      this.notify(notification);
    }
  }

  // ---- Notification Click Handler ----

  /** Handle a notification click event */
  handleNotificationClick(notification: Notification): void {
    const data = notification.data as Record<string, string> | undefined;
    const clickAction = data?.clickAction;
    const type = data?.type as NotificationType | undefined;

    // Focus the window
    window.focus();

    // Navigate based on click action or type
    if (clickAction) {
      window.location.href = clickAction;
      return;
    }

    // Default navigation based on notification type
    const typeRoutes: Partial<Record<NotificationType, string>> = {
      assignment: '/nurse',
      payment: '/nurse/earnings',
      emergency: '/beneficiary/emergency',
      chat: '/chat',
      appointment: '/nurse/schedule',
      rating: '/nurse/ratings',
    };

    const route = type ? typeRoutes[type] : undefined;
    if (route) {
      window.location.href = route;
    }
  }

  // ---- Cleanup ----

  /** Clean up all resources */
  destroy(): void {
    voiceManager.destroy();
    soundManager.destroy();
    this.deduplicationSet.clear();
    this.fcmToken = null;
    this.initialized = false;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/** Global NotificationManager instance */
export const notificationManager = new NotificationManager();

export default notificationManager;
