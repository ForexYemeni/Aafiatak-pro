// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Firebase Cloud Messaging Service Worker
// ============================================================================
// Handles background push notifications, custom sounds, click actions,
// and offline caching strategies. This is a plain JavaScript file
// placed in the public directory for service worker registration.
// ============================================================================

/* eslint-disable no-restricted-globals */

// Firebase configuration (will be injected at build time or runtime)
const FIREBASE_CONFIG = {
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
};

// Import Firebase scripts
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.2/firebase-messaging-compat.js');

// Initialize Firebase in the service worker
firebase.initializeApp(FIREBASE_CONFIG);

const messaging = firebase.messaging();

// ============================================================================
// Background Notification Handler
// ============================================================================

messaging.onBackgroundMessage((payload) => {
  const title = payload.notification?.title || 'إشعار جديد من عافيتك';
  const body = payload.notification?.body || '';
  const icon = payload.notification?.icon || '/logo.svg';
  const image = payload.notification?.image || undefined;
  const clickAction = payload.data?.clickAction || payload.notification?.click_action || '';

  // Determine notification priority and type from data
  const priority = payload.data?.priority || 'medium';
  const type = payload.data?.type || 'system';

  // Build notification options
  const options = {
    body: body,
    icon: icon,
    badge: '/logo.svg',
    image: image,
    dir: 'rtl',
    lang: 'ar',
    tag: payload.data?.id || `notification-${Date.now()}`,
    requireInteraction: priority === 'urgent' || priority === 'high',
    silent: false,
    data: {
      ...payload.data,
      clickAction: clickAction,
      type: type,
      priority: priority,
      timestamp: Date.now(),
    },
    // Android-specific notification channel
    android: {
      channelId: priority === 'urgent' ? 'emergency' : 'default',
    },
    // Vibrate pattern based on priority
    vibrate: getVibratePattern(priority),
    // Actions based on type
    actions: getNotificationActions(type),
  };

  // Show the notification
  self.registration.showNotification(title, options);

  // Play custom sound via the service worker (limited support)
  playNotificationSound(priority);
});

// ============================================================================
// Notification Click Handler
// ============================================================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const clickAction = data.clickAction || '';
  const type = data.type || 'system';

  // Handle action button clicks
  if (event.action) {
    handleNotificationAction(event.action, data);
    return;
  }

  // Determine URL to open
  let targetUrl = clickAction;
  if (!targetUrl) {
    targetUrl = getDefaultUrlForType(type);
  }

  // Open or focus the app window
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Focus an existing window if available
      for (const client of clientList) {
        if (client.url.includes(self.location.origin) && 'focus' in client) {
          if (targetUrl) {
            client.navigate(targetUrl);
          }
          return client.focus();
        }
      }

      // Open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl || '/');
      }
    })
  );
});

// ============================================================================
// Notification Close Handler
// ============================================================================

self.addEventListener('notificationclose', (event) => {
  // Log notification dismissal (analytics)
  const data = event.notification.data || {};
  // Could send analytics here
});

// ============================================================================
// Push Event Handler (for non-FCM push)
// ============================================================================

self.addEventListener('push', (event) => {
  if (!event.data) return;

  // Let Firebase handle it if it's an FCM message
  // This handler is for custom push messages
  try {
    const data = event.data.json();
    if (data.firebaseMessaging) {
      // FCM message, let Firebase handle it
      return;
    }
  } catch {
    // Not JSON data, ignore
  }
});

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get vibration pattern based on notification priority
 */
function getVibratePattern(priority) {
  switch (priority) {
    case 'urgent':
      return [300, 100, 300, 100, 300, 100, 300];
    case 'high':
      return [200, 100, 200, 100, 200];
    case 'medium':
      return [100, 50, 100];
    case 'low':
      return [50];
    default:
      return [100, 50, 100];
  }
}

/**
 * Get notification actions based on type
 */
function getNotificationActions(type) {
  switch (type) {
    case 'assignment':
      return [
        { action: 'accept', title: 'قبول' },
        { action: 'reject', title: 'رفض' },
      ];
    case 'emergency':
      return [
        { action: 'respond', title: 'استجابة' },
        { action: 'view', title: 'عرض التفاصيل' },
      ];
    case 'chat':
      return [
        { action: 'reply', title: 'رد' },
        { action: 'view', title: 'عرض المحادثة' },
      ];
    case 'appointment':
      return [
        { action: 'confirm', title: 'تأكيد' },
        { action: 'cancel', title: 'إلغاء' },
      ];
    default:
      return [
        { action: 'view', title: 'عرض' },
      ];
  }
}

/**
 * Get default URL for a notification type
 */
function getDefaultUrlForType(type) {
  switch (type) {
    case 'assignment':
      return '/nurse';
    case 'payment':
      return '/nurse/earnings';
    case 'emergency':
      return '/beneficiary/emergency';
    case 'chat':
      return '/chat';
    case 'appointment':
      return '/nurse/schedule';
    case 'rating':
      return '/nurse/ratings';
    case 'status_change':
      return '/nurse';
    default:
      return '/';
  }
}

/**
 * Handle notification action button clicks
 */
function handleNotificationAction(action, data) {
  const type = data.type || 'system';

  let targetUrl = '';
  switch (action) {
    case 'accept':
      targetUrl = `/nurse/assignments/${data.requestId || ''}?action=accept`;
      break;
    case 'reject':
      targetUrl = `/nurse/assignments/${data.requestId || ''}?action=reject`;
      break;
    case 'respond':
      targetUrl = `/beneficiary/emergency?id=${data.emergencyRequestId || ''}`;
      break;
    case 'reply':
      targetUrl = `/chat/${data.chatId || ''}`;
      break;
    case 'confirm':
      targetUrl = `/nurse/schedule?action=confirm&id=${data.appointmentId || ''}`;
      break;
    case 'cancel':
      targetUrl = `/nurse/schedule?action=cancel&id=${data.appointmentId || ''}`;
      break;
    case 'view':
    default:
      targetUrl = getDefaultUrlForType(type);
      break;
  }

  if (targetUrl) {
    clients.openWindow(targetUrl);
  }
}

/**
 * Play a notification sound from the service worker
 * Note: Service workers have limited audio capabilities.
 * This uses the AudioWorklet or falls back to silent notification.
 */
function playNotificationSound(priority) {
  // Service workers cannot directly play audio.
  // The notification sound will be handled by:
  // 1. The browser's default notification sound (via `silent: false`)
  // 2. The Android notification channel sound (via channelId)
  // 3. The app's foreground sound manager when the user opens the app

  // For Android, set the appropriate notification channel
  if (priority === 'urgent' || priority === 'high') {
    // These notifications should use a louder/more urgent channel
    // The channel is set in the notification options above
  }
}

// ============================================================================
// Cache Strategies for Offline Support
// ============================================================================

const CACHE_NAME = 'aafiatak-v1';
const STATIC_ASSETS = [
  '/',
  '/logo.svg',
  '/sounds/notification.mp3',
  '/sounds/emergency.mp3',
  '/sounds/chat.mp3',
  '/sounds/success.mp3',
  '/sounds/error.mp3',
];

// Install event - cache static assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(STATIC_ASSETS).catch(() => {
        // Some assets may not exist yet, that's OK
      });
    })
  );
  self.skipWaiting();
});

// Activate event - clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// Fetch event - network first, cache fallback
self.addEventListener('fetch', (event) => {
  // Skip non-GET requests
  if (event.request.method !== 'GET') return;

  // Skip cross-origin requests
  if (!event.request.url.startsWith(self.location.origin)) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        // Cache successful responses
        if (response.ok) {
          const responseClone = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseClone);
          });
        }
        return response;
      })
      .catch(() => {
        // Fallback to cache
        return caches.match(event.request).then((cachedResponse) => {
          if (cachedResponse) {
            return cachedResponse;
          }

          // Return offline page for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/');
          }

          return new Response('Offline', {
            status: 503,
            statusText: 'Service Unavailable',
          });
        });
      })
  );
});

// ============================================================================
// Offline Page Handler
// ============================================================================

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
