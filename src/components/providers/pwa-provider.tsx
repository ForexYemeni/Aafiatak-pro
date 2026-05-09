'use client';

import { useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { soundManager } from '@/lib/notifications/sound-manager';
import { notificationManager } from '@/lib/notifications/notification-manager';
import { markSoundPlayed, clearPlayedSounds } from '@/lib/notifications/sound-dedup';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useNotificationStore } from '@/lib/stores/notification-store';
import { socketService } from '@/lib/socket';
import { getActiveChatId } from '@/components/providers/socket-provider';

const OfflineWrapper = dynamic(
  () => import('@/components/common/offline-wrapper').then(mod => mod.OfflineWrapper),
  { ssr: false }
);

// ============================================================================
// Sound mapping for notification types
// ============================================================================

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

/** Play sound for a notification - uses shared dedup to prevent duplicates */
function playNotificationSound(type: string, priority: string, notifId: string): void {
  // Dedup: if this notification already played sound, skip
  if (markSoundPlayed(notifId)) return;

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
// *** ONLY updates the store (UI). Does NOT play sounds. ***
// Sounds are ONLY triggered by real-time events: Push + Socket.
// ============================================================================

const POLL_INTERVAL = 15000; // 15 seconds - only for UI updates
const POLL_URL = '/api/notifications?limit=5&unread=true';

function NotificationPoller() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
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

      // Silently update the store if unread count changed
      // This ONLY updates the UI (bell badge, notification list)
      // It does NOT play any sounds
      if (typeof data.data.unreadCount === 'number') {
        const store = useNotificationStore.getState();
        if (store.unreadCount !== data.data.unreadCount) {
          store.fetchNotifications(); // Silent refresh - no sounds
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
      // Initial fetch - just populate the store, NO sounds
      const store = useNotificationStore.getState();
      store.fetchNotifications();

      // Start polling (UI-only, no sounds)
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
      clearPlayedSounds();
    }

    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  return null;
}

// ============================================================================
// Service Worker Registrar
// - Registers SW and listens for push notifications
// - Push notifications are the PRIMARY source for sound playing
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
      // This is one of TWO places where sounds are triggered (the other is socket events)
      const handleSWMessage = (event: MessageEvent) => {
        try {
          if (event.data?.type === 'PUSH_NOTIFICATION_RECEIVED') {
            const payload = event.data.payload;

            if (payload.sound !== false) {
              // Use the notification's real ID for dedup, or generate one
              const notifId = payload.data?.notificationId || `push-${payload.type}-${Date.now()}`;

              // Play sound with shared dedup - prevents duplicate with socket
              playNotificationSound(
                payload.type || 'system',
                payload.priority || 'medium',
                notifId
              );

              // Voice alert for emergency notifications (TTS)
              if (payload.data?.voiceAlert && payload.data?.voiceText) {
                try {
                  const { voiceManager } = await import('@/lib/notifications/voice-manager');
                  voiceManager.init();
                  voiceManager.speak(payload.data.voiceText, {
                    priority: 'urgent',
                    rate: 1.1,
                    volume: 1.0,
                  });
                } catch {
                  // TTS not available
                }
              }
            }

            // Dispatch custom event for UI (notification bell, toasts, etc.)
            // NO sound playing from listeners of this event!
            window.dispatchEvent(new CustomEvent('app-notification', {
              detail: {
                id: payload.data?.notificationId || `push-${Date.now()}`,
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

// ============================================================================
// Global Chat Message Sound Player
// Plays chat sound when a new message arrives and the user is NOT
// currently viewing that specific chat page.
// Uses socketService (the actual socket used by chat pages).
// ============================================================================

function ChatSoundPlayer() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;

    const unsubMessage = socketService.onMessage((data) => {
      try {
        const currentUserId = useAuthStore.getState().user?.id;
        // Don't play sound for own messages
        if (data.message.senderId === currentUserId) return;

        // If user is currently viewing THIS chat, don't play sound
        // (the chat page handles its own feedback)
        const activeChatId = getActiveChatId();
        if (activeChatId === data.chatId) return;

        // Use dedup to prevent duplicate sounds from multiple sources
        const soundId = `chat-global-${data.message.id}`;
        if (markSoundPlayed(soundId)) return; // Already played

        // Play the chat notification sound
        soundManager.forceUserInteracted();
        soundManager.playChat();
      } catch {
        // Silently fail
      }
    });

    return unsubMessage;
  }, [hasHydrated, isAuthenticated]);

  return null;
}

// ============================================================================
// PWA Initializer - Main Export
// ============================================================================

export function PWAInitializer() {
  return (
    <>
      <ServiceWorkerRegistrar />
      <ChatSoundPlayer />
      <NotificationPoller />
      <WelcomeBackPlayer />
      <PushSubscriptionManager />
      <OfflineWrapper />
    </>
  );
}
