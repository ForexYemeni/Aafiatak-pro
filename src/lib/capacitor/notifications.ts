// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Capacitor Notifications Plugin v2
// ============================================================================
// Robust FCM token registration and push notification handling.
//
// v2 Changes:
// 1. Auto-retry token registration with exponential backoff
// 2. Sync token on app resume (visibility change)
// 3. Periodic token re-registration (every 6 hours)
// 4. Better error handling and logging
// 5. Force re-sync on login even if previously sent
// 6. Handle Capacitor PushNotifications foreground conflicts
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
let registerAttempts = 0;
let syncIntervalId: ReturnType<typeof setInterval> | null = null;

// Persist token in localStorage so it survives page reloads
const TOKEN_STORAGE_KEY = 'aafiatak-fcm-token';
const TOKEN_SENT_KEY = 'aafiatak-fcm-token-sent';
const TOKEN_TIMESTAMP_KEY = 'aafiatak-fcm-token-timestamp';

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
 * Includes exponential backoff retry logic.
 */
async function sendTokenToServer(token: string, attempt = 0): Promise<boolean> {
  try {
    const authToken = getAuthToken();

    if (!authToken) {
      console.warn('[Capacitor] No auth token — will send FCM token after login');
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
        localStorage.setItem(TOKEN_TIMESTAMP_KEY, String(Date.now()));
        registerAttempts = 0;
        console.log('[Capacitor] FCM token sent to server successfully');
        return true;
      }
    }

    console.warn('[Capacitor] Failed to send FCM token to server:', response.status);
    localStorage.setItem(TOKEN_SENT_KEY, 'failed');

    // Retry with exponential backoff (max 5 attempts)
    if (attempt < 5) {
      const delay = Math.min(1000 * Math.pow(2, attempt), 30000);
      console.log(`[Capacitor] Retrying token registration in ${delay}ms (attempt ${attempt + 1})`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendTokenToServer(token, attempt + 1);
    }

    return false;
  } catch (error) {
    console.error('[Capacitor] Error sending FCM token to server:', error);
    localStorage.setItem(TOKEN_SENT_KEY, 'failed');

    // Retry with exponential backoff
    if (attempt < 3) {
      const delay = Math.min(2000 * Math.pow(2, attempt), 30000);
      await new Promise(resolve => setTimeout(resolve, delay));
      return sendTokenToServer(token, attempt + 1);
    }

    return false;
  }
}

/**
 * Sync FCM token with server after login.
 * This is THE critical function for ensuring the server can send
 * push notifications to this device.
 *
 * v2: Always re-sync on login (even if previously sent) because
 * the server may have lost the token (DB reset, token invalidated, etc.)
 */
export async function syncFCMTokenWithServer(force = false): Promise<void> {
  // Check if we have an auth token now
  const authToken = getAuthToken();
  if (!authToken) return;

  // Skip if already sent recently (unless forced)
  if (!force && tokenSentToServer && localStorage.getItem(TOKEN_SENT_KEY) === 'true') {
    // But re-send if token was registered more than 6 hours ago
    const timestamp = parseInt(localStorage.getItem(TOKEN_TIMESTAMP_KEY) || '0');
    if (Date.now() - timestamp < 6 * 60 * 60 * 1000) {
      return;
    }
    console.log('[Capacitor] Token was sent >6h ago, re-syncing...');
  }

  // Try in-memory token first
  if (pushToken) {
    console.log('[Capacitor] Syncing in-memory FCM token with server...');
    const sent = await sendTokenToServer(pushToken);
    if (sent) return;
  }

  // Try localStorage cached token
  const cachedToken = localStorage.getItem(TOKEN_STORAGE_KEY);
  if (cachedToken) {
    console.log('[Capacitor] Syncing cached FCM token with server...');
    pushToken = cachedToken;
    const sent = await sendTokenToServer(cachedToken);
    if (sent) return;
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

        // Store in localStorage immediately
        localStorage.setItem(TOKEN_STORAGE_KEY, token.value);

        // Try to send token to server
        const sent = await sendTokenToServer(token.value);
        if (!sent) {
          console.info('[Capacitor] Token will be synced after login');
        }
      });

      PushNotifications.addListener('registrationError', (error: { error: string }) => {
        console.error('[Capacitor] Push registration error:', error.error);
        // Retry registration after delay
        registerAttempts++;
        if (registerAttempts < 5) {
          const delay = Math.min(3000 * registerAttempts, 30000);
          console.log(`[Capacitor] Retrying push registration in ${delay}ms (attempt ${registerAttempts})`);
          setTimeout(() => {
            PushNotifications.register().catch(() => {});
          }, delay);
        }
      });

      PushNotifications.addListener('pushNotificationReceived', (notification: PushNotification) => {
        console.log('[Capacitor] Push notification received in foreground:', notification);

        // Play vibration for foreground notifications
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

        // Navigate to the URL if present
        try {
          const data = action.notification?.data;
          if (data?.url) {
            window.location.href = data.url;
          }
        } catch {}

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

    // Set up periodic token re-registration (every 6 hours)
    if (!syncIntervalId) {
      syncIntervalId = setInterval(() => {
        syncFCMTokenWithServer(true).catch(() => {});
      }, 6 * 60 * 60 * 1000);
    }

    // Set up token sync on app resume (visibility change)
    setupVisibilitySync();

  } catch (error) {
    console.info('[Capacitor] Push notifications not available (web platform):', error);
  }
}

/**
 * Sync FCM token when app comes back to foreground.
 * This handles the case where the token changed while the app
 * was in the background.
 */
let visibilityHandlerSet = false;

function setupVisibilitySync() {
  if (visibilityHandlerSet || typeof document === 'undefined') return;
  visibilityHandlerSet = true;

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      // App came to foreground — re-sync token
      syncFCMTokenWithServer().catch(() => {});
    }
  });
}

/**
 * Get the current push notification token.
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
 */
export function onNotificationReceived(callback: NotificationReceivedCallback): () => void {
  notificationReceivedListeners.add(callback);
  return () => {
    notificationReceivedListeners.delete(callback);
  };
}

/**
 * Register a callback for when a push notification is clicked/tapped.
 */
export function onNotificationClicked(callback: NotificationClickedCallback): () => void {
  notificationClickedListeners.add(callback);
  return () => {
    notificationClickedListeners.delete(callback);
  };
}

/**
 * Request notification permissions from the user.
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
