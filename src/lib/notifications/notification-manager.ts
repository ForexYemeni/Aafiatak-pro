// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Notification Manager
// ============================================================================
// Central notification management system that coordinates voice (TTS),
// sound, browser notifications, and in-app notifications.
// ALL notifications come from MongoDB database - NO Firebase.
// ============================================================================

import { voiceManager } from './voice-manager';
import { soundManager } from './sound-manager';
import { notificationClient, type AppNotification } from './firebase-client';

// Re-export AppNotification for convenience
export type { AppNotification };

/** Notification permission status */
type NotificationPermissionStatus = 'default' | 'granted' | 'denied';

/** Arabic TTS messages mapped by notification type */
const TTS_MESSAGES: Record<string, (notification: AppNotification) => string> = {
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
const SOUND_MAP: Record<string, string> = {
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
// NotificationManager Class (MongoDB Only - No Firebase)
// ============================================================================

class NotificationManager {
  private permission: NotificationPermissionStatus = 'default';
  private deduplicationSet: Map<string, DeduplicationEntry> = new Map();
  private maxDeduplicationSize = 100;
  private deduplicationWindowMs = 5000; // 5 seconds
  private initialized = false;

  // ---- Initialization ----

  /** Initialize the notification system */
  async init(userId?: string): Promise<void> {
    if (this.initialized) return;
    if (typeof window === 'undefined') return;

    // Check current permission state
    if ('Notification' in window) {
      this.permission = Notification.permission as NotificationPermissionStatus;
    }

    // Initialize sub-managers
    voiceManager.init();
    soundManager.init();

    // Initialize MongoDB notification client
    await notificationClient.init(userId);

    // Register callback for new notifications from MongoDB
    notificationClient.onNotification((notification) => {
      this.notify(notification);
    });

    // Start periodic deduplication cleanup
    this.startDeduplicationCleanup();

    this.initialized = true;
  }

  /** Set the current user for notification polling */
  setUserId(userId: string): void {
    notificationClient.setUserId(userId);
  }

  // ---- Permission Management ----

  /** Request browser notification permission */
  async requestPermission(): Promise<NotificationPermissionStatus> {
    return notificationClient.requestPermission();
  }

  /** Get the current notification permission status */
  getPermissionStatus(): NotificationPermissionStatus {
    return notificationClient.getPermissionStatus();
  }

  /** Check if browser notifications are supported */
  isBrowserNotificationSupported(): boolean {
    return notificationClient.isBrowserNotificationSupported();
  }

  // ---- In-App Notification ----

  /** Show an in-app notification (toast-style) */
  showInApp(notification: AppNotification): void {
    if (typeof window === 'undefined') return;

    const event = new CustomEvent('app-notification', {
      detail: notification,
    });
    window.dispatchEvent(event);
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
    notificationClient.showBrowserNotification(notification);

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

    // TTS for high and urgent priority (voice notifications from MongoDB data)
    if (notification.priority === 'high' || notification.priority === 'urgent') {
      const ttsMessage = this.getTTSMessage(notification);
      voiceManager.speak(ttsMessage, {
        priority: notification.priority,
        rate: notification.priority === 'urgent' ? 1.1 : 1,
      });
    }

    // Mark voice as played on the server
    if (notification.voiceEnabled && notification.id) {
      fetch(`/api/notifications/${notification.id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ voicePlayed: true }),
      }).catch(() => {});
    }
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

    this.deduplicationSet.delete(hash);
    return false;
  }

  /** Add a notification to the deduplication cache */
  private addToDeduplicationCache(notification: AppNotification): void {
    const hash = this.computeNotificationHash(notification);
    this.deduplicationSet.set(hash, { hash, timestamp: Date.now() });

    if (this.deduplicationSet.size > this.maxDeduplicationSize) {
      this.pruneDeduplicationCache();
    }
  }

  /** Compute a hash for a notification */
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
  }

  /** Start periodic cleanup of deduplication cache */
  private startDeduplicationCleanup(): void {
    if (typeof window === 'undefined') return;

    setInterval(() => {
      this.pruneDeduplicationCache();
    }, 30000);
  }

  // ---- Sound & TTS Helpers ----

  /** Get the appropriate sound name for a notification type */
  private getSoundByType(type: string): string {
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

  // ---- Notification Click Handler ----

  /** Handle a notification click event */
  handleNotificationClick(browserNotification: Notification): void {
    const data = browserNotification.data as Record<string, string> | undefined;
    const clickAction = data?.clickAction;
    const type = data?.type as string | undefined;

    window.focus();

    if (clickAction) {
      window.location.href = clickAction;
      return;
    }

    const typeRoutes: Record<string, string> = {
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
    notificationClient.destroy();
    this.deduplicationSet.clear();
    this.initialized = false;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/** Global NotificationManager instance - MongoDB only, NO Firebase */
export const notificationManager = new NotificationManager();

export default notificationManager;
