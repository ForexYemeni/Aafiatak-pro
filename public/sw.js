// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Service Worker
// ============================================================================
// Handles push notifications, caching, and offline support.
// Pure Web Push Protocol — NO Firebase dependency.
// ============================================================================

const CACHE_NAME = 'aafiatak-v5';
const STATIC_CACHE = 'aafiatak-static-v5';
const API_CACHE_NAME = 'aafiatak-api-v5';
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

  if (request.mode === 'navigate') {
    event.respondWith(navigationHandler(request));
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

async function navigationHandler(request) {
  try {
    const networkResponse = await fetch(request);
    return networkResponse;
  } catch {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) return cachedResponse;

    const offlinePage = await caches.match('/offline.html');
    if (offlinePage) return offlinePage;

    return new Response('غير متصل بالإنترنت', { status: 503 });
  }
}

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

  // ── KEY FIX: Send message to ALL open app windows ──
  // This allows the foreground app to play the notification sound
  event.waitUntil(
    (async () => {
      // 1. Send message to all open windows so they can play sound
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

      // 2. Show browser notification (this handles the case when app is in background/closed)
      //    With silent: false, the OS will play its default notification sound
      const options = {
        body: payload.body,
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
          timestamp: Date.now(),
        },
        dir: 'rtl',
        lang: 'ar',
        requireInteraction: priority === 'urgent' || priority === 'high',
        silent: false,  // Important: lets the OS play default notification sound
        actions: getNotificationActions(payload.type, priority),
      };

      await self.registration.showNotification(payload.title, options);
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

self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      try {
        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: undefined,
        });

        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: subscription.toJSON().keys,
          }),
        });
      } catch (error) {
        console.error('[SW] Failed to resubscribe:', error);
      }
    })()
  );
});

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

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});
