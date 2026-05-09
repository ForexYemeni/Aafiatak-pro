'use client';

import { useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { soundManager } from '@/lib/notifications/sound-manager';
import { notificationManager } from '@/lib/notifications/notification-manager';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useNotificationStore } from '@/lib/stores/notification-store';

const OfflineWrapper = dynamic(
  () => import('@/components/common/offline-wrapper').then(mod => mod.OfflineWrapper),
  { ssr: false }
);

// Sound mapping for push notifications received from Service Worker
const SOUND_MAP: Record<string, string> = {
  assignment: 'notification',
  service_request: 'notification',
  service_assigned: 'notification',
  service_accepted: 'success',
  service_started: 'notification',
  service_completed: 'success',
  service_cancelled: 'error',
  status_change: 'notification',
  emergency: 'emergency',
  emergency_assigned: 'emergency',
  payment: 'success',
  withdrawal: 'notification',
  withdrawal_approved: 'success',
  withdrawal_rejected: 'error',
  chat: 'chat',
  rating: 'success',
  verification: 'notification',
  system: 'notification',
  loyalty: 'success',
  referral: 'notification',
  promotion: 'notification',
  welcome_back: 'success',
};

// ============================================================================
// Notification Poller - Polls for new notifications every N seconds
// This is the PRIMARY mechanism for detecting new notifications in foreground
// since Socket.IO doesn't work on Vercel (serverless).
// ============================================================================

const POLL_INTERVAL = 8000; // 8 seconds - fast enough for "instant" feel
const POLL_URL = '/api/notifications?limit=5&unread=true';

function NotificationPoller() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const lastSeenIdRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);

  const pollForNotifications = useCallback(async () => {
    if (!isAuthenticated || !token || isPollingRef.current) return;

    isPollingRef.current = true;
    try {
      const response = await fetch(POLL_URL, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        isPollingRef.current = false;
        return;
      }

      const data = await response.json();
      if (!data.success || !data.data?.notifications) {
        isPollingRef.current = false;
        return;
      }

      const notifications = data.data.notifications;

      // Check for new notifications we haven't seen yet
      if (notifications.length > 0) {
        const latestId = notifications[0]?.id || notifications[0]?._id?.toString();

        // If we have a previous lastSeenId and found a new one, play sound
        if (lastSeenIdRef.current && latestId && latestId !== lastSeenIdRef.current) {
          // Find ALL new notifications since last seen
          const newNotifications = [];
          for (const n of notifications) {
            const nId = n.id || n._id?.toString();
            if (nId === lastSeenIdRef.current) break;
            newNotifications.push(n);
          }

          // Play sound for each NEW notification (limit to 3 to avoid spam)
          const toProcess = newNotifications.slice(0, 3);
          for (const n of toProcess) {
            const notifType = n.type || 'system';
            const notifPriority = n.priority || 'medium';
            const soundName = SOUND_MAP[notifType] || 'notification';
            const isUrgent = notifPriority === 'urgent';
            const isHigh = notifPriority === 'high';

            // Force user interacted - they're using the app
            soundManager.forceUserInteracted();

            soundManager.play(soundName, {
              priority: notifPriority,
              volume: isUrgent ? 1.0 : isHigh ? 0.9 : 0.8,
              vibrate: isUrgent || isHigh,
              repeat: isUrgent ? 2 : 1,
            });

            // Dispatch custom event for UI
            window.dispatchEvent(new CustomEvent('app-notification', {
              detail: {
                id: nId || `poll-${Date.now()}`,
                title: n.titleAr || n.title || n.titleEn || '',
                body: n.bodyAr || n.body || n.bodyEn || '',
                type: notifType,
                priority: notifPriority,
                data: n.data || {},
              },
            }));
          }
        }

        // Update last seen ID
        if (latestId) {
          lastSeenIdRef.current = latestId;
        }
      }

      // Update the unread count in notification store
      if (typeof data.data.unreadCount === 'number') {
        const store = useNotificationStore.getState();
        // Only update if count changed
        if (store.unreadCount !== data.data.unreadCount && data.data.unreadCount > 0) {
          // If there are new unread notifications, refresh the full list
          store.fetchNotifications();
        }
      }
    } catch {
      // Network error - ignore, will retry next poll
    } finally {
      isPollingRef.current = false;
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!hasHydrated) return;

    // Start polling when authenticated
    if (isAuthenticated && token) {
      // Initial fetch
      const store = useNotificationStore.getState();
      store.fetchNotifications().then(() => {
        // Set the last seen ID from current notifications
        const currentNotifs = useNotificationStore.getState().notifications;
        if (currentNotifs.length > 0) {
          lastSeenIdRef.current = currentNotifs[0].id;
        }
      });

      // Start polling interval
      intervalRef.current = setInterval(pollForNotifications, POLL_INTERVAL);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [hasHydrated, isAuthenticated, token, pollForNotifications]);

  return null;
}

// ============================================================================
// Welcome Back Sound - Plays when user logs in after a previous logout
// ============================================================================

function WelcomeBackPlayer() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const prevAuthRef = useRef(isAuthenticated);

  useEffect(() => {
    // Detect transition from not authenticated → authenticated (welcome back)
    if (isAuthenticated && !prevAuthRef.current) {
      // Small delay to ensure audio system is ready
      setTimeout(() => {
        soundManager.forceUserInteracted();

        // Check if this is a "welcome back" (returning user, not first login)
        const wasLoggedOut = sessionStorage.getItem('aafiatak-logged-out');
        if (wasLoggedOut) {
          sessionStorage.removeItem('aafiatak-logged-out');
          soundManager.play('success', {
            priority: 'medium',
            volume: 0.7,
            vibrate: false,
          });
        }
      }, 500);
    }

    // Track logout
    if (!isAuthenticated && prevAuthRef.current) {
      sessionStorage.setItem('aafiatak-logged-out', 'true');
    }

    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  return null;
}

// ============================================================================
// Service Worker Registrar
// ============================================================================

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // ===== CRITICAL: Initialize the sound and notification systems =====
    // This MUST be done early so sounds are ready when notifications arrive
    notificationManager.init();
    soundManager.init();

    // Also force user interaction unlock immediately for better reliability
    // The user has already loaded the page, so they've interacted
    if (document.hasFocus()) {
      soundManager.forceUserInteracted();
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Service worker not available
      });

      // Listen for push notifications from Service Worker
      const handleSWMessage = (event: MessageEvent) => {
        try {
          if (event.data?.type === 'PUSH_NOTIFICATION_RECEIVED') {
            const payload = event.data.payload;

            // Ensure sound system is ready
            soundManager.init();

            if (payload.sound !== false) {
              const soundName = SOUND_MAP[payload.type] || 'notification';
              const isUrgent = payload.priority === 'urgent';
              const isHigh = payload.priority === 'high';

              // Force user interacted since we're receiving a notification
              // and the user must have interacted with the app before
              soundManager.forceUserInteracted();

              soundManager.play(soundName, {
                priority: payload.priority || 'medium',
                volume: isUrgent ? 1.0 : isHigh ? 0.9 : 0.8,
                vibrate: isUrgent || isHigh,
                repeat: isUrgent ? 2 : 1,
              });

              if (isUrgent && payload.type === 'emergency') {
                setTimeout(() => {
                  soundManager.playEmergency();
                }, 1500);
              }
            }

            // Dispatch custom event for app UI (notification bell, toasts, etc.)
            window.dispatchEvent(new CustomEvent('app-notification', {
              detail: {
                id: `push-${Date.now()}`,
                title: payload.title,
                body: payload.body,
                type: payload.type,
                priority: payload.priority,
                data: payload.data,
              },
            }));
          }

          if (event.data?.type === 'SYNC_REQUIRED') {
            import('@/lib/db/sync-manager').then(({ syncManager }) => {
              void syncManager.fullSync();
            }).catch(() => {});
          }
        } catch (err) {
          console.error('[PWA] Error handling SW message:', err);
        }
      };

      navigator.serviceWorker.addEventListener('message', handleSWMessage);

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      };
    }

    // Initialize IndexedDB and offline queue (only if SW not available)
    Promise.all([
      import('@/lib/db/indexeddb').catch(() => null),
      import('@/lib/db/offline-queue').catch(() => null),
    ]).then(([dbModule, queueModule]) => {
      if (dbModule?.localDb) {
        void dbModule.localDb.init().catch(() => {});
      }
      if (queueModule?.offlineQueue) {
        queueModule.offlineQueue.start(30000);
      }
    }).catch(() => {});

    return () => {
      import('@/lib/db/offline-queue').then(({ offlineQueue }) => {
        offlineQueue.stop();
      }).catch(() => {});
    };
  }, []);

  return null;
}

// ============================================================================
// Push Subscription Manager - Auto-subscribes to push notifications
// ============================================================================

function PushSubscriptionManager() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || !token || !user) return;
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    const subscribeToPush = async () => {
      try {
        // Check if already subscribed
        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();

        if (existingSubscription) {
          // Already subscribed, just make sure it's saved on server
          return;
        }

        // Request notification permission
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        // Get VAPID public key
        const keyResponse = await fetch('/api/push/vapid-key');
        const keyData = await keyResponse.json();
        const publicKey = keyData.data?.publicKey;

        if (!publicKey) {
          console.warn('[PUSH] No VAPID public key available');
          return;
        }

        // Convert base64 to Uint8Array
        const applicationServerKey = urlBase64ToUint8Array(publicKey);

        // Subscribe
        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

        // Get or create device ID
        let deviceId = localStorage.getItem('aafiatak-device-id');
        if (!deviceId) {
          deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          localStorage.setItem('aafiatak-device-id', deviceId);
        }

        // Send subscription to server
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: subscription.toJSON().keys,
            platform: 'web',
            deviceId,
          }),
        });

        console.log('[PUSH] Successfully subscribed to push notifications');
      } catch (error) {
        console.warn('[PUSH] Failed to subscribe:', error);
      }
    };

    // Small delay to let SW registration complete
    const timeout = setTimeout(subscribeToPush, 3000);

    return () => clearTimeout(timeout);
  }, [hasHydrated, isAuthenticated, token, user]);

  return null;
}

/** Convert base64 VAPID key to Uint8Array */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// ============================================================================
// PWA Initializer - Main Export
// ============================================================================

export function PWAInitializer() {
  return (
    <>
      <ServiceWorkerRegistrar />
      <NotificationPoller />
      <WelcomeBackPlayer />
      <PushSubscriptionManager />
      <OfflineWrapper />
    </>
  );
}
