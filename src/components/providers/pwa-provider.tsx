'use client';

import { useEffect, useRef, useCallback, useState, type ReactNode } from 'react';
import dynamic from 'next/dynamic';
import { soundManagerV2 } from '@/lib/notifications/sound-manager-v2';
import { voiceManager } from '@/lib/notifications/voice-manager';
import { notificationManager } from '@/lib/notifications/notification-manager';
import { markSoundPlayed, clearPlayedSounds, isSoundPlayed } from '@/lib/notifications/sound-dedup';
import { notificationLogger } from '@/lib/notifications/notification-logger';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useNotificationStore } from '@/lib/stores/notification-store';
import { socketService as socketServiceV2 } from '@/lib/socket-v2';
import { getActiveChatId } from '@/components/providers/socket-provider';
import { useSocket } from '@/hooks/use-socket';

const OfflineWrapper = dynamic(
  () => import('@/components/common/offline-wrapper').then(mod => mod.OfflineWrapper),
  { ssr: false }
);

const NotificationPermissionBanner = dynamic(
  () => import('@/components/common/notification-permission-banner').then(mod => mod.NotificationPermissionBanner),
  { ssr: false }
);

// ============================================================================
// Sound mapping for notification types (SINGLE SOURCE OF TRUTH)
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
  deployment: 'notification',
  deployment_created: 'notification',
  deployment_applied: 'notification',
  deployment_selected: 'notification',
  deployment_approved: 'success',
  deployment_payment: 'notification',
  deployment_verified: 'success',
  deployment_completed: 'success',
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
// Notification Event Dedup - Prevents duplicate app-notification events
// ============================================================================
// Track which notification IDs have already dispatched app-notification events
// This prevents the same notification from showing multiple toasts when it
// arrives via multiple channels (push + poll + socket).

const dispatchedEventIds = new Set<string>();
const MAX_DISPATCHED_IDS = 300;

function dispatchNotificationEvent(detail: {
  id: string;
  title: string;
  body: string;
  type: string;
  priority: string;
  data: Record<string, unknown>;
  clickAction?: string;
}): void {
  // Dedup: skip if we already dispatched an event for this notification
  if (dispatchedEventIds.has(detail.id)) {
    notificationLogger.debug('notification', `Skipping duplicate event dispatch for ${detail.id}`);
    return;
  }

  dispatchedEventIds.add(detail.id);

  // Trim old entries
  if (dispatchedEventIds.size > MAX_DISPATCHED_IDS) {
    const iter = dispatchedEventIds.values();
    for (let i = 0; i < 100; i++) {
      const val = iter.next();
      if (val.done) break;
      dispatchedEventIds.delete(val.value);
    }
  }

  window.dispatchEvent(new CustomEvent('app-notification', { detail }));
  notificationLogger.logNotification('displayed', detail.id, {
    type: detail.type,
    priority: detail.priority,
  });
}

/** Play sound for a notification - uses shared dedup to prevent duplicates */
function playNotificationSound(type: string, priority: string, notifId: string): void {
  // Dedup: if this notification already played sound, skip
  if (markSoundPlayed(notifId)) {
    notificationLogger.logAudio('debounced', type, { notifId, reason: 'already-played' });
    return;
  }

  const soundName = SOUND_MAP[type] || 'notification';
  const isUrgent = priority === 'urgent';
  const isHigh = priority === 'high';

  soundManagerV2.forceUserInteracted();
  soundManagerV2.play(soundName, {
    priority: priority || 'medium',
    volume: isUrgent ? 1.0 : isHigh ? 0.9 : 0.8,
    vibrate: isUrgent || isHigh,
    repeat: isUrgent ? 2 : 1,
    notificationId: notifId,
  });

  // For emergency types, repeat after delay for maximum attention
  if (isUrgent && (type === 'emergency' || type === 'emergency_assigned')) {
    setTimeout(() => {
      soundManagerV2.playEmergency();
    }, 1500);
  }
}

// ============================================================================
// Notification Poller - Polls for new notifications every N seconds
// ============================================================================

const VOICE_POLL_URL = '/api/notifications/voice-pending';
const VOICE_PLAYED_URL = '/api/notifications/voice-played';

function NotificationPoller() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);
  const seenIdsRef = useRef<Set<string>>(new Set());
  const isFirstPollRef = useRef(true);

  const pollForNotifications = useCallback(async () => {
    if (!isAuthenticated || !token || isPollingRef.current) return;

    isPollingRef.current = true;
    try {
      const response = await fetch('/api/notifications?limit=20&unread=true', {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) { isPollingRef.current = false; return; }

      const data = await response.json();
      if (!data.success || !data.data?.notifications) { isPollingRef.current = false; return; }

      const notifications: any[] = data.data.notifications || [];

      if (isFirstPollRef.current) {
        isFirstPollRef.current = false;
        for (const n of notifications) seenIdsRef.current.add(n._id || n.id);
        useNotificationStore.getState().fetchNotifications();
        notificationLogger.info('notification', 'First poll completed, seeded seen IDs');
      } else {
        const newNotifs = notifications.filter(
          (n: any) => !seenIdsRef.current.has(n._id || n.id)
        );

        if (newNotifs.length > 0) {
          useNotificationStore.getState().fetchNotifications();
          const { ttsEnabled } = useNotificationStore.getState();

          for (const notif of newNotifs) {
            const notifId = notif._id || notif.id;
            seenIdsRef.current.add(notifId);

            playNotificationSound(notif.type || 'system', notif.priority || 'medium', `poll-${notifId}`);

            if (notif.voiceEnabled && ttsEnabled) {
              try {
                const parsedData = typeof notif.data === 'string'
                  ? JSON.parse(notif.data || '{}') : (notif.data || {});
                if (parsedData.voiceText) {
                  voiceManager.init();
                  voiceManager.speak(parsedData.voiceText, {
                    priority: notif.priority === 'urgent' ? 'urgent' : notif.priority === 'high' ? 'high' : 'medium',
                    rate: 1.1, volume: 1.0,
                  });
                }
              } catch { /* ignore parse errors */ }
            }

            dispatchNotificationEvent({
              id: notifId,
              title: notif.titleAr || notif.titleEn || '',
              body: notif.bodyAr || notif.bodyEn || '',
              type: notif.type,
              priority: notif.priority,
              data: typeof notif.data === 'string' ? JSON.parse(notif.data || '{}') : (notif.data || {}),
              clickAction: notif.actionUrl,
            });
          }

          if (seenIdsRef.current.size > 200) {
            seenIdsRef.current = new Set(Array.from(seenIdsRef.current).slice(-100));
          }
        } else {
          if (typeof data.data.unreadCount === 'number') {
            const store = useNotificationStore.getState();
            if (store.unreadCount !== data.data.unreadCount) store.fetchNotifications();
          }
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
      seenIdsRef.current.clear();
      isFirstPollRef.current = true;
      pollForNotifications();
      
      // Adaptive polling: reduce frequency when socket is connected
      const getPollInterval = () => {
        // If socket is connected, poll less frequently (45s) since real-time events handle most updates
        // If socket is disconnected, poll more frequently (15s) as fallback
        return socketServiceV2.isConnected ? 45000 : 15000;
      };
      
      intervalRef.current = setInterval(pollForNotifications, getPollInterval());
      
      // Adjust interval when socket connection state changes
      const handleConnectionChange = () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = setInterval(pollForNotifications, getPollInterval());
        }
      };
      
      const unsub = socketServiceV2.onConnectionStateChange(handleConnectionChange);
      
      return () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }
        unsub();
      };
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
// Voice Notification Poller
// ============================================================================

function VoiceNotificationPoller() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);
  const processedIdsRef = useRef<Set<string>>(new Set());

  const pollForVoiceNotifications = useCallback(async () => {
    if (!isAuthenticated || !token || isPollingRef.current) return;

    isPollingRef.current = true;
    try {
      let response = await fetch(VOICE_POLL_URL, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      if (response.status === 401) {
        try {
          const refreshToken = useAuthStore.getState().refreshToken;
          const refreshRes = await fetch('/api/auth/refresh', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ refreshToken }),
          });
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json();
            if (refreshData.success && refreshData.data?.token) {
              useAuthStore.getState().setTokens(refreshData.data.token, refreshData.data.refreshToken || refreshToken || '');
              response = await fetch(VOICE_POLL_URL, {
                headers: {
                  'Authorization': `Bearer ${refreshData.data.token}`,
                  'Content-Type': 'application/json',
                },
              });
            }
          }
        } catch { /* refresh failed */ }
      }

      if (!response.ok) { isPollingRef.current = false; return; }

      const data = await response.json();
      if (!data.success || !data.data?.notifications?.length) { isPollingRef.current = false; return; }

      const newNotifications = data.data.notifications.filter(
        (notif: any) => !processedIdsRef.current.has(notif.id)
      );

      if (newNotifications.length === 0) { isPollingRef.current = false; return; }

      const { ttsEnabled } = useNotificationStore.getState();
      const playedIds: string[] = [];

      for (const notif of newNotifications) {
        const notifId = `voice-poll-${notif.id}`;
        processedIdsRef.current.add(notif.id);

        playNotificationSound(notif.type || 'system', notif.priority || 'medium', notifId);

        const voiceText = notif.data?.voiceText;
        if (voiceText) {
          const voiceId = `voice-${notifId}`;
          if (!markSoundPlayed(voiceId) && ttsEnabled) {
            voiceManager.init();
            voiceManager.speak(voiceText, {
              priority: notif.priority === 'urgent' ? 'urgent' : notif.priority === 'high' ? 'high' : 'medium',
              rate: 1.1, volume: 1.0,
            });
          }
        }

        playedIds.push(notif.id);

        dispatchNotificationEvent({
          id: notif.id,
          title: notif.title,
          body: notif.body,
          type: notif.type,
          priority: notif.priority,
          data: notif.data || {},
          clickAction: notif.actionUrl,
        });
      }

      if (playedIds.length > 0) {
        try {
          await fetch(VOICE_PLAYED_URL, {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ notificationIds: playedIds }),
          });
        } catch { /* confirmation failed */ }
      }

      useNotificationStore.getState().fetchNotifications();

      if (processedIdsRef.current.size > 100) {
        const entries = Array.from(processedIdsRef.current);
        processedIdsRef.current = new Set(entries.slice(-50));
      }
    } catch {
      // Network error - ignore
    } finally {
      isPollingRef.current = false;
    }
  }, [isAuthenticated, token]);

  useEffect(() => {
    if (!hasHydrated) return;

    const getInterval = () => document.hidden ? 60000 : 15000;

    const handleVisibilityForInterval = () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        if (isAuthenticated && token) {
          intervalRef.current = setInterval(pollForVoiceNotifications, getInterval());
        }
      }
    };

    if (isAuthenticated && token) {
      processedIdsRef.current.clear();
      pollForVoiceNotifications();
      intervalRef.current = setInterval(pollForVoiceNotifications, getInterval());
      document.addEventListener('visibilitychange', handleVisibilityForInterval);
    } else {
      processedIdsRef.current.clear();
    }

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated && token) {
        setTimeout(() => { pollForVoiceNotifications(); }, 300);
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('visibilitychange', handleVisibilityForInterval);
    };
  }, [hasHydrated, isAuthenticated, token, pollForVoiceNotifications]);

  return null;
}

// ============================================================================
// Welcome Back Sound
// ============================================================================

function WelcomeBackPlayer() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const prevAuthRef = useRef(isAuthenticated);

  useEffect(() => {
    if (isAuthenticated && !prevAuthRef.current) {
      setTimeout(() => {
        soundManagerV2.forceUserInteracted();
        const wasLoggedOut = sessionStorage.getItem('aafiatak-logged-out');
        if (wasLoggedOut) {
          sessionStorage.removeItem('aafiatak-logged-out');
          soundManagerV2.play('success', { priority: 'medium', volume: 0.7, vibrate: false });
        }
      }, 500);
    }

    if (!isAuthenticated && prevAuthRef.current) {
      sessionStorage.setItem('aafiatak-logged-out', 'true');
      clearPlayedSounds();
      dispatchedEventIds.clear();
    }

    prevAuthRef.current = isAuthenticated;
  }, [isAuthenticated]);

  return null;
}

// ============================================================================
// Service Worker Registrar (FIXED - proper cleanup)
// ============================================================================

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initialize notification systems
    notificationManager.init();
    soundManagerV2.init();
    voiceManager.init();

    if (document.hasFocus()) {
      soundManagerV2.forceUserInteracted();
    }

    notificationLogger.logHydration('complete', 'ServiceWorkerRegistrar mounted');

    let swMessageHandler: ((event: MessageEvent) => void) | null = null;
    let offlineQueueStarted = false;

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').then(() => {
        notificationLogger.logServiceWorker('registered', 'sw.js');
      }).catch((err) => {
        notificationLogger.logServiceWorker('error', `SW registration failed: ${err.message}`);
      });

      // Listen for push notifications from Service Worker
      swMessageHandler = (event: MessageEvent) => {
        try {
          if (event.data?.type === 'PUSH_NOTIFICATION_RECEIVED') {
            const payload = event.data.payload;

            notificationLogger.logServiceWorker('push-received', payload.type, {
              notificationId: payload.data?.notificationId,
            });

            if (payload.sound !== false) {
              const notifId = payload.data?.notificationId || `push-${payload.type}-${Date.now()}`;
              playNotificationSound(payload.type || 'system', payload.priority || 'medium', notifId);

              if (payload.data?.voiceAlert && payload.data?.voiceText) {
                const voiceId = `voice-${notifId}`;
                if (!markSoundPlayed(voiceId)) {
                  const { ttsEnabled } = useNotificationStore.getState();
                  if (ttsEnabled) {
                    voiceManager.init();
                    voiceManager.speak(payload.data.voiceText, {
                      priority: payload.priority === 'urgent' ? 'urgent' : payload.priority === 'high' ? 'high' : 'medium',
                      rate: 1.1, volume: 1.0,
                    });
                  }
                }
              }
            }

            dispatchNotificationEvent({
              id: payload.data?.notificationId || `push-${Date.now()}`,
              title: payload.title,
              body: payload.body,
              type: payload.type,
              priority: payload.priority,
              data: payload.data || {},
            });
          }

          if (event.data?.type === 'SYNC_REQUIRED') {
            import('@/lib/db/sync-manager').then(({ syncManager }) => {
              void syncManager.fullSync();
            }).catch(() => {});
          }
        } catch (err) {
          notificationLogger.error('service-worker', 'Error handling SW message', { error: String(err) });
        }
      };

      navigator.serviceWorker.addEventListener('message', swMessageHandler);
    }

    // Initialize IndexedDB and offline queue
    Promise.all([
      import('@/lib/db/indexeddb').catch(() => null),
      import('@/lib/db/offline-queue').catch(() => null),
    ]).then(([dbModule, queueModule]) => {
      if (dbModule?.localDb) {
        void dbModule.localDb.init().catch(() => {});
      }
      if (queueModule?.offlineQueue) {
        offlineQueueStarted = true;
        queueModule.offlineQueue.start(30000);
      }
    }).catch(() => {});

    return () => {
      // Clean up SW message listener
      if (swMessageHandler && 'serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('message', swMessageHandler);
      }

      // Clean up offline queue
      if (offlineQueueStarted) {
        import('@/lib/db/offline-queue').then(({ offlineQueue }) => {
          offlineQueue.stop();
        }).catch(() => {});
      }
    };
  }, []);

  return null;
}

// ============================================================================
// Push Subscription Manager
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
        // Clean up old inactive subscriptions
        try {
          const deviceId = localStorage.getItem('aafiatak-device-id');
          await fetch('/api/push/cleanup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ keepDeviceId: deviceId || undefined }),
          });
        } catch { /* non-critical */ }

        const registration = await navigator.serviceWorker.ready;

        // Send auth data to SW
        if (registration.active) {
          let deviceId = localStorage.getItem('aafiatak-device-id');
          if (!deviceId) {
            deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
            localStorage.setItem('aafiatak-device-id', deviceId);
          }
          registration.active.postMessage({
            type: 'STORE_AUTH_DATA',
            payload: { token, userId: user.id, deviceId, userRole: user.role },
          });
        }

        // Request permission
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          notificationLogger.logPermission(permission === 'granted' ? 'granted' : permission === 'denied' ? 'denied' : 'dismissed', 'push-subscription');
          if (permission !== 'granted') return;
        } else if (Notification.permission === 'denied') {
          return;
        }

        // Get/validate subscription
        let subscription = await registration.pushManager.getSubscription();
        let needsResubscribe = false;
        let belongsToOtherUser = false;

        if (subscription) {
          try {
            const checkResponse = await fetch('/api/push/check-subscription', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
              body: JSON.stringify({ endpoint: subscription.endpoint }),
            });
            const checkData = await checkResponse.json();
            if (checkData.success && checkData.data) {
              if (checkData.data.isActive) {
                needsResubscribe = false;
              } else if (checkData.data.belongsToOtherUser) {
                belongsToOtherUser = true;
                needsResubscribe = false;
              } else {
                needsResubscribe = true;
              }
            } else {
              needsResubscribe = false;
            }
          } catch {
            needsResubscribe = false;
          }
        } else {
          needsResubscribe = true;
        }

        if (needsResubscribe) {
          if (subscription) {
            try { await subscription.unsubscribe(); } catch {}
          }

          const keyResponse = await fetch('/api/push/vapid-key');
          const keyData = await keyResponse.json();
          const publicKey = keyData.data?.publicKey;
          if (!publicKey) return;

          const applicationServerKey = urlBase64ToUint8Array(publicKey);
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });

          notificationLogger.info('push', 'New push subscription created');
        }

        // Register subscription on server
        let deviceId = localStorage.getItem('aafiatak-device-id');
        if (!deviceId) {
          deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          localStorage.setItem('aafiatak-device-id', deviceId);
        }

        const subJSON = subscription!.toJSON();
        await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
          body: JSON.stringify({ endpoint: subscription!.endpoint, keys: subJSON.keys, platform: 'web', deviceId }),
        });
      } catch (error) {
        notificationLogger.warn('push', `Failed to subscribe: ${error}`);
      }
    };

    const timeout = setTimeout(subscribeToPush, 2000);
    const interval = setInterval(subscribeToPush, 5 * 60 * 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [hasHydrated, isAuthenticated, token, user]);

  return null;
}

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
// Chat Sound Player
// ============================================================================

function ChatSoundPlayer() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;

    const unsubMessage = socketServiceV2.onMessage((data) => {
      try {
        const currentUserId = useAuthStore.getState().user?.id;
        if (data.message.senderId === currentUserId) return;

        const activeChatId = getActiveChatId();
        if (activeChatId === data.chatId) return;

        const soundId = `chat-global-${data.message.id}`;
        if (markSoundPlayed(soundId)) return;

        soundManagerV2.forceUserInteracted();
        soundManagerV2.playChat();
      } catch { /* silently fail */ }
    });

    return unsubMessage;
  }, [hasHydrated, isAuthenticated]);

  return null;
}

// ============================================================================
// Emergency Sound Player
// ============================================================================

function EmergencySoundPlayer() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;

    const unsubDispatched = socketServiceV2.onEmergencyDispatched((data) => {
      try {
        const notifId = `socket-dispatched-${data.emergencyRequestId}`;
        playNotificationSound('emergency_assigned', 'urgent', notifId);

        const voiceId = `voice-${notifId}`;
        if (!markSoundPlayed(voiceId)) {
          const { ttsEnabled } = useNotificationStore.getState();
          if (ttsEnabled) {
            voiceManager.init();
            voiceManager.speak(`تم تعيينك لحالة طوارئ، الممرض ${data.nurseName || ''}`, { priority: 'urgent', rate: 1.1, volume: 1.0 });
          }
        }
        useNotificationStore.getState().fetchNotifications();
      } catch { /* silently fail */ }
    });

    const unsubAlert = socketServiceV2.onEmergencyAlert((data) => {
      try {
        const notifId = `socket-alert-${data.emergencyRequestId}`;
        playNotificationSound('emergency', 'urgent', notifId);

        const voiceId = `voice-${notifId}`;
        if (!markSoundPlayed(voiceId)) {
          const { ttsEnabled } = useNotificationStore.getState();
          if (ttsEnabled) {
            voiceManager.init();
            voiceManager.speak('حالة طوارئ جديدة', { priority: 'urgent', rate: 1.1, volume: 1.0 });
          }
        }
      } catch { /* silently fail */ }
    });

    const unsubCreated = socketServiceV2.onEmergencyCreated((data) => {
      try {
        const notifId = `socket-created-${data.emergencyRequestId}`;
        playNotificationSound('emergency', 'urgent', notifId);

        const voiceId = `voice-${notifId}`;
        if (!markSoundPlayed(voiceId)) {
          const { ttsEnabled } = useNotificationStore.getState();
          if (ttsEnabled) {
            voiceManager.init();
            voiceManager.speak(`حالة طوارئ جديدة من ${data.beneficiaryName}`, { priority: 'urgent', rate: 1.1, volume: 1.0 });
          }
        }
      } catch { /* silently fail */ }
    });

    const unsubNotification = socketServiceV2.onNotification((data) => {
      try {
        const emergencyTypes = ['emergency', 'emergency_assigned'];
        if (!emergencyTypes.includes(data.type)) return;

        const notifId = `socket-notif-${data.id}`;
        playNotificationSound(data.type, data.priority, notifId);

        if (data.type === 'emergency_assigned' && data.data?.voiceText) {
          const voiceId = `voice-${notifId}`;
          if (!markSoundPlayed(voiceId)) {
            const { ttsEnabled } = useNotificationStore.getState();
            if (ttsEnabled) {
              voiceManager.init();
              voiceManager.speak(data.data.voiceText as string, {
                priority: data.priority === 'urgent' ? 'urgent' : 'high',
                rate: 1.1, volume: 1.0,
              });
            }
          }
        }
      } catch { /* silently fail */ }
    });

    return () => {
      unsubDispatched();
      unsubAlert();
      unsubCreated();
      unsubNotification();
    };
  }, [hasHydrated, isAuthenticated]);

  return null;
}

// ============================================================================
// Socket Connector — ensures socketServiceV2 is always connected
// ============================================================================

function SocketConnector() {
  const token = useAuthStore((s) => s.token);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (isAuthenticated && token) {
      socketServiceV2.connect(token);
    } else {
      socketServiceV2.disconnect();
    }
  }, [isAuthenticated, token]);

  return null;
}

// ============================================================================
// Deferred Component Loader
// ============================================================================

function DeferredComponent({ children, delayMs }: { children: ReactNode; delayMs: number }) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const scheduleRender = () => {
      const timer = setTimeout(() => setShow(true), delayMs);
      return () => clearTimeout(timer);
    };

    if (document.visibilityState === 'visible') {
      return scheduleRender();
    }

    const handleVisible = () => {
      if (document.visibilityState === 'visible') {
        document.removeEventListener('visibilitychange', handleVisible);
        scheduleRender();
      }
    };
    document.addEventListener('visibilitychange', handleVisible);
    return () => document.removeEventListener('visibilitychange', handleVisible);
  }, [delayMs]);

  if (!show) return null;
  return <>{children}</>;
}

// ============================================================================
// Capacitor Native Initializer
// ============================================================================

function CapacitorNativeInitializer() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated || typeof window === 'undefined') return;
    import('@/lib/capacitor').then(({ initCapacitor }) => {
      initCapacitor().catch((err: any) => {
        notificationLogger.warn('capacitor', `Init failed: ${err?.message}`);
      });
    }).catch(() => {});
  }, [hasHydrated]);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated || typeof window === 'undefined') return;
    import('@/lib/capacitor').then(({ syncFCMTokenWithServer }) => {
      syncFCMTokenWithServer().catch(() => {});
    }).catch(() => {});
  }, [hasHydrated, isAuthenticated]);

  return null;
}

// ============================================================================
// Audio Context Warmer - Plays a silent buffer to unlock audio on first interaction
// ============================================================================

function AudioContextWarmer() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const unlock = () => {
      soundManagerV2.forceUserInteracted();
      // Remove after first successful unlock
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };

    window.addEventListener('click', unlock, { once: true, passive: true });
    window.addEventListener('touchstart', unlock, { once: true, passive: true });
    window.addEventListener('keydown', unlock, { once: true, passive: true });

    return () => {
      window.removeEventListener('click', unlock);
      window.removeEventListener('touchstart', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, []);

  return null;
}

// ============================================================================
// PWA Initializer - Main entry point
// ============================================================================

export function PWAInitializer() {
  return (
    <>
      {/* CRITICAL (0ms) — Audio context unlock */}
      <AudioContextWarmer />

      {/* CRITICAL (0ms) — Socket connection for real-time features */}
      <SocketConnector />

      {/* CRITICAL (0ms) — Emergency sounds must be ready immediately */}
      <EmergencySoundPlayer />

      {/* HIGH (1s) — Capacitor native init */}
      <DeferredComponent delayMs={1000}>
        <CapacitorNativeInitializer />
      </DeferredComponent>

      {/* HIGH (1.5s) — Service worker registration */}
      <DeferredComponent delayMs={1500}>
        <ServiceWorkerRegistrar />
      </DeferredComponent>

      {/* HIGH (2s) — Notification polling */}
      <DeferredComponent delayMs={2000}>
        <NotificationPoller />
      </DeferredComponent>

      {/* HIGH (2s) — Chat sound player */}
      <DeferredComponent delayMs={2000}>
        <ChatSoundPlayer />
      </DeferredComponent>

      {/* HIGH (2.5s) — Welcome back sound */}
      <DeferredComponent delayMs={2500}>
        <WelcomeBackPlayer />
      </DeferredComponent>

      {/* HIGH (3s) — Voice notification poller (reduced from 5s) */}
      <DeferredComponent delayMs={3000}>
        <VoiceNotificationPoller />
      </DeferredComponent>

      {/* LOW (6s) — Push subscription */}
      <DeferredComponent delayMs={6000}>
        <PushSubscriptionManager />
      </DeferredComponent>

      {/* LOW (7s) — Permission banner and offline wrapper */}
      <DeferredComponent delayMs={7000}>
        <NotificationPermissionBanner />
        <OfflineWrapper />
      </DeferredComponent>
    </>
  );
}
