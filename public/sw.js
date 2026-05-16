// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Service Worker
// ============================================================================
// Handles push notifications, caching, and offline support.
// Pure Web Push Protocol — NO Firebase dependency.
// ============================================================================

const CACHE_NAME = 'aafiatak-v8';
const STATIC_CACHE = 'aafiatak-static-v8';
const API_CACHE_NAME = 'aafiatak-api-v8';
const API_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Assets to pre-cache
const PRECACHE_URLS = [
  '/',
  '/offline.html',
  '/icons/icon-192x192.png',
  '/icons/icon-512x512.png',
  '/manifest.json',
  '/sounds/notification.mp3',
  '/sounds/emergency.mp3',
  '/sounds/chat.mp3',
  '/sounds/success.mp3',
  '/sounds/error.mp3',
];

// ============================================================================
// INSTALL & ACTIVATE
// ============================================================================

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(PRECACHE_URLS).catch(() => {
        // Some assets may not exist yet, that's OK
      });
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== STATIC_CACHE && name !== API_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  self.clients.claim();
});

// ============================================================================
// FETCH STRATEGIES
// ============================================================================

self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  if (request.method !== 'GET') return;
  if (!url.protocol.startsWith('http')) return;

  if (url.pathname.startsWith('/api/')) {
    event.respondWith(networkFirstWithCache(request));
    return;
  }

  // Do NOT intercept navigation requests.
  // Previously, the navigationHandler would cache redirect responses
  // which caused infinite refresh loops when the server redirected
  // between / and /admin (or other protected pages).
  // Let the browser handle navigation requests natively.
  if (request.mode === 'navigate') {
    return;
  }

  event.respondWith(cacheFirstWithNetwork(request));
});

async function networkFirstWithCache(request) {
  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(API_CACHE_NAME);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    return new Response(
      JSON.stringify({ success: false, error: 'لا يوجد اتصال بالإنترنت', offline: true }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// navigationHandler removed — navigation requests are no longer intercepted
// by the service worker. This prevents caching of redirect responses
// which caused infinite refresh loops.

async function cacheFirstWithNetwork(request) {
  const cachedResponse = await caches.match(request);
  if (cachedResponse) return cachedResponse;

  try {
    const networkResponse = await fetch(request);
    if (networkResponse.ok) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }
    return networkResponse;
  } catch {
    if (request.destination === 'image') {
      return new Response(
        '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100"><rect fill="#f3f4f6" width="100" height="100"/><text fill="#9ca3af" font-size="12" text-anchor="middle" x="50" y="55">غير متاح</text></svg>',
        { headers: { 'Content-Type': 'image/svg+xml' } }
      );
    }
    return new Response('', { status: 404 });
  }
}

// ============================================================================
// PUSH NOTIFICATION HANDLING
// ============================================================================

const VIBRATIONS = {
  urgent: [500, 200, 500, 200, 500, 200, 500],
  high: [300, 100, 300, 100, 300],
  medium: [200, 100, 200],
  low: [100],
};

const ROUTE_MAP = {
  service_request: '/nurse',
  service_assigned: '/nurse',
  assignment: '/nurse',
  deployment: '/admin/deployments',
  deployment_created: '/admin/deployments',
  deployment_applied: '/nurse/deployments',
  deployment_selected: '/nurse/deployments',
  deployment_approved: '/nurse/deployments',
  deployment_payment: '/admin/deployments',
  deployment_verified: '/nurse/deployments',
  deployment_completed: '/nurse/deployments',
  service_accepted: '/beneficiary/orders',
  service_started: '/beneficiary/orders',
  service_completed: '/beneficiary/orders',
  service_cancelled: '/beneficiary/orders',
  status_change: '/beneficiary/orders',
  emergency: '/nurse',
  emergency_assigned: '/nurse',
  payment: '/nurse/earnings',
  withdrawal: '/nurse/earnings',
  withdrawal_approved: '/nurse/earnings',
  withdrawal_rejected: '/nurse/earnings',
  chat: '/chat',
  rating: '/nurse/ratings',
  verification: '/nurse/profile',
  system: '/',
  loyalty: '/beneficiary/loyalty',
  referral: '/beneficiary/referral',
  promotion: '/beneficiary',
};

function getNotificationUrl(data) {
  if (data?.url) return data.url;
  if (data?.type) {
    const basePath = ROUTE_MAP[data.type] || '/';
    if (data.userRole === 'nurse' && !basePath.startsWith('/nurse')) {
      return '/nurse' + basePath;
    }
    if (data.userRole === 'beneficiary' && !basePath.startsWith('/beneficiary')) {
      return '/beneficiary' + basePath;
    }
    return basePath;
  }
  return '/';
}

function getNotificationActions(type, priority) {
  switch (type) {
    case 'service_request':
    case 'service_assigned':
    case 'assignment':
      return [
        { action: 'accept', title: 'قبول' },
        { action: 'reject', title: 'رفض' },
      ];
    case 'emergency':
      return [
        { action: 'respond', title: 'استجابة' },
        { action: 'view', title: 'عرض' },
      ];
    case 'chat':
      return [
        { action: 'reply', title: 'رد' },
        { action: 'view', title: 'عرض' },
      ];
    default:
      if (priority === 'urgent' || priority === 'high') {
        return [{ action: 'view', title: 'عرض الآن' }];
      }
      return [];
  }
}

/**
 * Push event handler — fires even when the app is closed (background push).
 * IMPORTANT: This shows the browser notification AND sends a message to
 * any open app windows so they can play the notification sound.
 *
 * MULTI-USER DEVICE SUPPORT:
 * When multiple users share the same browser (e.g., Admin logs out, Beneficiary
 * logs in), the same push subscription may be registered for multiple users.
 * We need to:
 * 1. Always show the browser notification (so the user sees it even when logged out)
 * 2. Only send foreground sound/TTS to the app if the notification is for the
 *    CURRENTLY logged-in user (to avoid playing sounds for wrong user)
 */
self.addEventListener('push', (event) => {
  let payload = {
    title: 'عافيتك',
    body: 'لديك إشعار جديد',
    icon: '/icons/icon-192x192.png',
    badge: '/icons/icon-72x72.png',
    type: 'system',
    priority: 'medium',
    sound: true,
    tag: undefined,
    data: {},
  };

  try {
    if (event.data) {
      const data = event.data.json();
      payload = { ...payload, ...data };
    }
  } catch (e) {
    console.error('[SW] Failed to parse push data:', e);
  }

  const priority = payload.priority || 'medium';
  const vibrate = VIBRATIONS[priority] || VIBRATIONS.medium;

  event.waitUntil(
    (async () => {
      // ── MULTI-USER FILTERING ──
      // Determine if this push notification is for the currently logged-in user.
      // The auth data is stored by PushSubscriptionManager via STORE_AUTH_DATA message.
      const authData = self._authData || null;
      const currentUserId = authData?.userId || null;
      const notificationTargetUserId = payload.data?.targetUserId || null;

      // If we know who's logged in AND the notification has a target user,
      // check if they match. If they don't match, this notification is for
      // a user who logged out (or a different user on this device).
      const isForCurrentUser = !notificationTargetUserId || !currentUserId || notificationTargetUserId === currentUserId;

      // 1. Send message to all open windows so they can play sound
      //    BUT only if this notification is for the currently logged-in user
      if (isForCurrentUser) {
        const allClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        for (const client of allClients) {
          client.postMessage({
            type: 'PUSH_NOTIFICATION_RECEIVED',
            payload: {
              title: payload.title,
              body: payload.body,
              type: payload.type,
              priority: priority,
              sound: payload.sound !== false,
              data: payload.data,
            },
          });
        }
      }

      // 2. ALWAYS show browser notification — even if it's for a different user.
      //    This is crucial for the case where the Admin is logged out but
      //    still needs to see notifications on this device.
      //    When a different user is logged in, we add a visual indicator.
      const displayTitle = isForCurrentUser ? payload.title : `[${payload.title}]`;
      const displayBody = isForCurrentUser ? payload.body : `إشعار لحساب آخر - ${payload.body}`;

      const options = {
        body: displayBody,
        icon: payload.icon,
        badge: payload.badge,
        image: payload.image,
        vibrate,
        tag: payload.tag || `aafiatak-${payload.type}-${Date.now()}`,
        data: {
          ...payload.data,
          type: payload.type,
          priority,
          url: getNotificationUrl(payload.data || {}),
          userRole: payload.data?.userRole || payload.userRole,
          targetUserId: notificationTargetUserId,
          isForCurrentUser,
          timestamp: Date.now(),
        },
        dir: 'rtl',
        lang: 'ar',
        requireInteraction: priority === 'urgent' || priority === 'high',
        silent: false,  // Important: lets the OS play default notification sound
        actions: getNotificationActions(payload.type, priority),
      };

      await self.registration.showNotification(displayTitle, options);
    })()
  );
});

// ============================================================================
// NOTIFICATION CLICK HANDLER
// ============================================================================

self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const data = event.notification.data || {};
  const action = event.action;
  const url = data.url || '/';

  if (action === 'accept' || action === 'respond') {
    event.waitUntil(clients.openWindow(url + '?action=' + action));
    return;
  }

  if (action === 'reject') {
    return;
  }

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((windowClients) => {
        for (const client of windowClients) {
          if (
            client.url.includes(self.location.origin) &&
            'focus' in client
          ) {
            client.navigate(url);
            return client.focus();
          }
        }
        return clients.openWindow(url);
      })
  );
});

// ============================================================================
// PUSH SUBSCRIPTION CHANGE
// ============================================================================

// VAPID public key for push subscription (must match server-side key)
const VAPID_PUBLIC_KEY = 'BN36yGFOlkT2JcWmoW_vDsUBxD9icwAisjLwRZ9imYkWfExWulyeGjd0ANwWP7uZOr26p6trG3RjhJ1CxNGVtrU';

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = self.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const applicationServerKey = urlBase64ToUint8Array(VAPID_PUBLIC_KEY);
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

        // Get stored auth data for the subscribe API
        const authData = await getStoredAuthData();

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authData ? { 'Authorization': `Bearer ${authData.token}` } : {}),
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: subscription.toJSON().keys,
            platform: 'web',
            deviceId: authData?.deviceId || `device-${Date.now()}`,
          }),
        });

        console.log('[SW] Push subscription renewed successfully');
      } catch (error) {
        console.error('[SW] Failed to resubscribe:', error);
      }
    })()
  );
});

// Store auth data for push subscription renewal
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'STORE_AUTH_DATA') {
    try {
      // Store in SW's global scope for re-subscription
      self._authData = event.data.payload;
    } catch (e) {
      console.error('[SW] Failed to store auth data:', e);
    }
  }
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

async function getStoredAuthData() {
  return self._authData || null;
}

// ============================================================================
// BACKGROUND SYNC
// ============================================================================

self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-offline-queue') {
    event.waitUntil(syncOfflineQueue());
  }
});

async function syncOfflineQueue() {
  const allClients = await self.clients.matchAll();
  allClients.forEach((client) => {
    client.postMessage({ type: 'SYNC_REQUIRED' });
  });
}

// ============================================================================
// MESSAGE HANDLER
// ============================================================================

// (message handler moved above to combine with STORE_AUTH_DATA)
