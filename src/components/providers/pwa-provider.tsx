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

// Sound mapping for notification types
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
// GLOBAL: Track which notification IDs have already had sounds played
// This prevents the SAME notification from playing sound multiple times
// from different sources (push, poll, store, etc.)
// ============================================================================

// Use a module-level Set that persists across component re-renders
const playedSoundIds = new Set<string>();

/** Check if a notification has already had its sound played, and mark it as played */
function markSoundPlayed(id: string): boolean {
  if (playedSoundIds.has(id)) return true; // already played
  playedSoundIds.add(id);
  return false; // first time
}

/** Play sound for a notification type - SINGLE ENTRY POINT for all sounds */
function playNotificationSound(type: string, priority: string): void {
  const soundName = SOUND_MAP[type] || 'notification';
  const isUrgent = priority === 'urgent';
  const isHigh = priority === 'high';

  soundManager.forceUserInteracted();
  soundManager.play(soundName, {
    priority: priority || 'medium',
    volume: isUrgent ? 1.0 : isHigh ? 0.9 : 0.8,
    vibrate: isUrgent || isHigh,
    repeat: isUrgent ? 2 : 1,
  });

  // For emergency, repeat after delay
  if (isUrgent && type === 'emergency') {
    setTimeout(() => {
      soundManager.playEmergency();
    }, 1500);
  }
}

// ============================================================================
// Notification Poller - Polls for new notifications every N seconds
// ONLY updates the store, does NOT play sounds directly.
// The store's addNotification will handle sounds for truly new ones.
// ============================================================================

const POLL_INTERVAL = 10000; // 10 seconds
const POLL_URL = '/api/notifications?limit=5&unread=true';

function NotificationPoller() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const lastSeenIdRef = useRef<string | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);
  const isFirstPollRef = useRef(true);

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

      if (notifications.length > 0) {
        const latestId = notifications[0]?.id || notifications[0]?._id?.toString();

        // Only play sounds if this is NOT the first poll (first poll just sets baseline)
        if (!isFirstPollRef.current && lastSeenIdRef.current && latestId && latestId !== lastSeenIdRef.current) {
          // Find truly new notifications since last seen
          const newNotifications = [];
          for (const n of notifications) {
            const nId = n.id || n._id?.toString();
            if (nId === lastSeenIdRef.current) break;
            newNotifications.push(n);
          }

          // Play sound for ONLY the FIRST new notification (avoid spam)
          // Mark each as played so other sources don't repeat
          for (const n of newNotifications) {
            const nId = n.id || n._id?.toString();
            if (nId && !markSoundPlayed(nId)) {
              // First notification gets sound
              playNotificationSound(n.type || 'system', n.priority || 'medium');
              break; // Only play ONE sound per poll cycle
            }
          }
        }

        // Update last seen ID
        if (latestId) {
          lastSeenIdRef.current = latestId;
        }
      }

      // Mark first poll as done
      isFirstPollRef.current = false;

      // Silently update the store (no sounds) if unread count changed
      if (typeof data.data.unreadCount === 'number') {
        const store = useNotificationStore.getState();
        if (store.unreadCount !== data.data.unreadCount) {
          // Refresh the list silently (fetchNotifications won't play sounds anymore)
          store.fetchNotifications();
        }
      }
    } catch {
      // Network error - ignore
    } finally {
      isPollingRef.current = false;
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!hasHydrated) return;

    if (isAuthenticated && token) {
      // Initial fetch - just set baseline, NO sounds
      const store = useNotificationStore.getState();
      store.fetchNotifications().then(() => {
        const currentNotifs = useNotificationStore.getState().notifications;
        if (currentNotifs.length > 0) {
          lastSeenIdRef.current = currentNotifs[0].id;
        }
        isFirstPollRef.current = false;
      });

      // Start polling
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
    if (isAuthenticated && !prevAuthRef.current) {
      setTimeout(() => {
        soundManager.forceUserInteracted();

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

    if (!isAuthenticated && prevAuthRef.current) {
      sessionStorage.setItem('aafiatak-logged-out', 'true');
      // Clear played sound tracking on logout
      playedSoundIds.clear();
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

    // Initialize sound and notification systems
    notificationManager.init();
    soundManager.init();

    if (document.hasFocus()) {
      soundManager.forceUserInteracted();
    }

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});

      // Listen for push notifications from Service Worker
      const handleSWMessage = (event: MessageEvent) => {
        try {
          if (event.data?.type === 'PUSH_NOTIFICATION_RECEIVED') {
            const payload = event.data.payload;

            if (payload.sound !== false) {
              // Use a unique ID to prevent duplicate sounds
              const notifId = payload.data?.notificationId || `push-${payload.type}-${Date.now()}`;

              if (!markSoundPlayed(notifId)) {
                playNotificationSound(
                  payload.type || 'system',
                  payload.priority || 'medium'
                );
              }
            }

            // Dispatch custom event for UI (notification bell, toasts, etc.)
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
        const registration = await navigator.serviceWorker.ready;
        const existingSubscription = await registration.pushManager.getSubscription();

        if (existingSubscription) return;

        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return;

        const keyResponse = await fetch('/api/push/vapid-key');
        const keyData = await keyResponse.json();
        const publicKey = keyData.data?.publicKey;

        if (!publicKey) return;

        const applicationServerKey = urlBase64ToUint8Array(publicKey);

        const subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey,
        });

        let deviceId = localStorage.getItem('aafiatak-device-id');
        if (!deviceId) {
          deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          localStorage.setItem('aafiatak-device-id', deviceId);
        }

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
      } catch (error) {
        console.warn('[PUSH] Failed to subscribe:', error);
      }
    };

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
