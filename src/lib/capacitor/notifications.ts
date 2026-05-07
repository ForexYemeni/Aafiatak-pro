// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Capacitor Notifications Plugin
// ============================================================================
// Wrapper for Capacitor Push Notifications plugin.
// Gracefully degrades when not running in a native environment.
// ============================================================================

/** Push notification data received from the server */
export interface PushNotification {
  id: string;
  title?: string;
  body?: string;
  data?: Record<string, string>;
}

/** Action taken on a push notification (tap/click) */
export interface PushNotificationAction {
  notification: PushNotification;
  actionId: string;
  inputValue?: string;
}

/** Callback type for notification received events */
type NotificationReceivedCallback = (notification: PushNotification) => void;

/** Callback type for notification clicked events */
type NotificationClickedCallback = (action: PushNotificationAction) => void;

// ---- Listener Storage ----

const notificationReceivedListeners: Set<NotificationReceivedCallback> = new Set();
const notificationClickedListeners: Set<NotificationClickedCallback> = new Set();
let pushToken: string | null = null;
let listenersRegistered = false;

/**
 * Register for push notifications.
 * On native platforms, this requests permission and registers the device token.
 * On web, it does nothing.
 */
export async function registerPushNotifications(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Register event listeners once
    if (!listenersRegistered) {
      PushNotifications.addListener('registration', (token: { value: string }) => {
        pushToken = token.value;
        console.info('[Capacitor] Push token received:', token.value.substring(0, 10) + '...');
      });

      PushNotifications.addListener('registrationError', (error: { error: string }) => {
        console.error('[Capacitor] Push registration error:', error.error);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotification) => {
        for (const callback of notificationReceivedListeners) {
          try {
            callback(notification);
          } catch (err) {
            console.error('[Capacitor] Notification received callback error:', err);
          }
        }
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action: PushNotificationAction) => {
        for (const callback of notificationClickedListeners) {
          try {
            callback(action);
          } catch (err) {
            console.error('[Capacitor] Notification clicked callback error:', err);
          }
        }
      });

      listenersRegistered = true;
    }

    // Register the device for push notifications
    await PushNotifications.register();
  } catch (error) {
    console.info('[Capacitor] Push notifications not available:', error);
  }
}

/**
 * Get the current push notification token.
 * Returns null if not registered or not on a native platform.
 */
export async function getPushToken(): Promise<string | null> {
  if (typeof window === 'undefined') return null;

  // Return cached token if available
  if (pushToken) return pushToken;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const result = await PushNotifications.getToken();
    pushToken = result.token ?? null;
    return pushToken;
  } catch {
    return null;
  }
}

/**
 * Register a callback for when a push notification is received while
 * the app is in the foreground.
 * Returns an unsubscribe function.
 */
export function onNotificationReceived(callback: NotificationReceivedCallback): () => void {
  notificationReceivedListeners.add(callback);
  return () => {
    notificationReceivedListeners.delete(callback);
  };
}

/**
 * Register a callback for when a push notification is clicked/tapped.
 * Returns an unsubscribe function.
 */
export function onNotificationClicked(callback: NotificationClickedCallback): () => void {
  notificationClickedListeners.add(callback);
  return () => {
    notificationClickedListeners.delete(callback);
  };
}

/**
 * Request notification permissions from the user.
 * Returns true if granted, false if denied.
 * On web, uses the browser Notification API.
 */
export async function requestNotificationPermissions(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const result = await PushNotifications.requestPermissions();
    return result.receive === 'granted';
  } catch {
    // Fallback to browser Notification API
    if ('Notification' in window) {
      const permission = await Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }
}
