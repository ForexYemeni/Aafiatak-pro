// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Capacitor Notifications Plugin
// ============================================================================
// Wrapper for Capacitor Push Notifications plugin.
// Registers FCM token with server for push notification delivery.
// Gracefully degrades when not running in a native environment.
//
// CRITICAL FIX: Robust token registration flow:
// 1. On app start: Register for push notifications
// 2. On FCM token received: Try to send to server (may fail if not logged in)
// 3. On login: Sync any pending FCM token to server
// 4. On page reload: Re-register and re-sync token
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
let tokenSentToServer = false;

// Persist token in localStorage so it survives page reloads
const TOKEN_STORAGE_KEY = 'aafiatak-fcm-token';
const TOKEN_SENT_KEY = 'aafiatak-fcm-token-sent';

/**
 * Get or generate a persistent device ID.
 */
function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  const key = 'aafiatak-device-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = 'capacitor-' + Date.now() + '-' + Math.random().toString(36).substring(2);
    localStorage.setItem(key, id);
  }
  return id;
}

/**
 * Get auth token from localStorage.
 */
function getAuthToken(): string | null {
  try {
    const authStorage = localStorage.getItem('auth-storage');
    if (authStorage) {
      const parsed = JSON.parse(authStorage);
      return parsed?.state?.token || null;
    }
  } catch {}
  return null;
}

/**
 * Send FCM token to the server so it can send push notifications.
 * Returns true if successfully sent, false otherwise.
 */
async function sendTokenToServer(token: string): Promise<boolean> {
  try {
    const authToken = getAuthToken();

    if (!authToken) {
      console.warn('[Capacitor] No auth token — will send FCM token after login');
      // Store the token so we can send it after login
      localStorage.setItem(TOKEN_STORAGE_KEY, token);
      localStorage.setItem(TOKEN_SENT_KEY, 'pending');
      return false;
    }

    const response = await fetch('/api/notifications/register-token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`,
      },
      body: JSON.stringify({
        fcmToken: token,
        platform: 'android',
        deviceId: getDeviceId(),
      }),
    });

    if (response.ok) {
      const data = await response.json();
      if (data.success) {
        tokenSentToServer = true;
        localStorage.setItem(TOKEN_SENT_KEY, 'true');
        localStorage.setItem(TOKEN_STORAGE_KEY, token);
        console.log('[Capacitor] ✅ FCM token sent to server successfully');
        return true;
      }
    }

    console.warn('[Capacitor] Failed to send FCM token to server:', response.status);
    localStorage.setItem(TOKEN_SENT_KEY, 'failed');
    return false;
  } catch (error) {
    console.error('[Capacitor] Error sending FCM token to server:', error);
    localStorage.setItem(TOKEN_SENT_KEY, 'failed');
    return false;
  }
}

/**
 * Sync FCM token with server after login.
 * This is THE critical function for ensuring the server can send
 * push notifications to this device.
 *
 * Called from:
 * 1. CapacitorNativeInitializer after auth state changes
 * 2. PWAInitializer on mount
 * 3. After login success
 */
export async function syncFCMTokenWithServer(): Promise<void> {
  // If already sent, skip (unless page reloaded)
  if (tokenSentToServer && localStorage.getItem(TOKEN_SENT_KEY) === 'true') return;

  // Check if we have an auth token now
  const authToken = getAuthToken();
  if (!authToken) return;

  // Try in-memory token first
  if (pushToken) {
    console.log('[Capacitor] Syncing in-memory FCM token with server...');
    await sendTokenToServer(pushToken);
    return;
  }

  // Try localStorage cached token
  const cachedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (cachedToken && localStorage.getItem(TOKEN_SENT_KEY) !== 'true') {
    console.log('[Capacitor] Syncing cached FCM token with server...');
    pushToken = cachedToken;
    await sendTokenToServer(cachedToken);
    return;
  }

  // Try to get token from Capacitor plugin directly
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');
    const result = await PushNotifications.getToken();
    if (result.token) {
      console.log('[Capacitor] Got FCM token from plugin, syncing...');
      pushToken = result.token;
      await sendTokenToServer(result.token);
    }
  } catch (error) {
    console.info('[Capacitor] Could not get FCM token from plugin:', error);
  }
}

/**
 * Register for push notifications.
 * On native platforms, this requests permission, registers for FCM,
 * and sends the FCM token to the server.
 * On web, it does nothing (web uses Web Push via service worker).
 */
export async function registerPushNotifications(): Promise<void> {
  if (typeof window === 'undefined') return;

  try {
    const { PushNotifications } = await import('@capacitor/push-notifications');

    // Register event listeners once
    if (!listenersRegistered) {
      PushNotifications.addListener('registration', async (token: { value: string }) => {
        pushToken = token.value;
        console.info('[Capacitor] FCM token received:', token.value.substring(0, 20) + '...');

        // Immediately try to send token to server
        const sent = await sendTokenToServer(token.value);
        if (!sent) {
          // Will be retried by syncFCMTokenWithServer after login
          console.info('[Capacitor] Token will be synced after login');
        }
      });

      PushNotifications.addListener('registrationError', (error: { error: string }) => {
        console.error('[Capacitor] Push registration error:', error.error);
      });

      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotification) => {
        console.log('[Capacitor] Push notification received in foreground:', notification);

        // Play sound/vibration for foreground notifications
        try {
          if (navigator.vibrate) {
            navigator.vibrate([200, 100, 200]);
          }
        } catch {}

        for (const callback of notificationReceivedListeners) {
          try {
            callback(notification);
          } catch (err) {
            console.error('[Capacitor] Notification received callback error:', err);
          }
        }
      });

      PushNotifications.addListener('pushNotificationActionPerformed', (action: PushNotificationAction) => {
        console.log('[Capacitor] Push notification clicked:', action);

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

    // Request permission first
    const permResult = await PushNotifications.requestPermissions();
    if (permResult.receive !== 'granted') {
      console.warn('[Capacitor] Push notification permission not granted');
      return;
    }

    // Register the device for push notifications (triggers FCM token)
    await PushNotifications.register();
    console.log('[Capacitor] Push notifications registered');
  } catch (error) {
    console.info('[Capacitor] Push notifications not available (web platform):', error);
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

  // Try localStorage
  const cachedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (cachedToken) {
    pushToken = cachedToken;
    return pushToken;
  }

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
