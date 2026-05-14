'use client';

import { useEffect, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { soundManager } from '@/lib/notifications/sound-manager';
import { voiceManager } from '@/lib/notifications/voice-manager';
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

const NotificationPermissionBanner = dynamic(
  () => import('@/components/common/notification-permission-banner').then(mod => mod.NotificationPermissionBanner),
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

  // For emergency types, repeat after delay for maximum attention
  if (isUrgent && (type === 'emergency' || type === 'emergency_assigned')) {
    setTimeout(() => {
      soundManager.playEmergency();
    }, 1500);
  }
}

// ============================================================================
// Notification Poller - Polls for new notifications every N seconds
// Updates the store (UI) AND plays sounds/TTS for voice-pending notifications.
// This is the PRIMARY delivery mechanism on Vercel where Socket.IO is unavailable.
// ============================================================================

const POLL_INTERVAL = 30000; // 30 seconds for UI-only store refresh (increased from 15s to reduce load)
const VOICE_POLL_INTERVAL = 15000; // 15 seconds for voice-pending notifications (increased from 8s)
const VOICE_POLL_INTERVAL_VISIBLE = 15000; // 15 seconds when tab is visible (increased from 8s)
const VOICE_POLL_INTERVAL_HIDDEN = 60000; // 60 seconds when tab is hidden (increased from 30s)
const VOICE_POLL_URL = '/api/notifications/voice-pending';

function NotificationPoller() {
    const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
    const token = useAuthStore((s) => s.token);
    const hasHydrated = useAuthStore((s) => s._hasHydrated);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const isPollingRef = useRef(false);
    // Track IDs seen this session to detect NEW notifications on each poll
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
          // Seed seen IDs on first poll — no sounds for already-existing notifications
          isFirstPollRef.current = false;
          for (const n of notifications) seenIdsRef.current.add(n._id || n.id);
          useNotificationStore.getState().fetchNotifications();
        } else {
          // Detect NEW notifications not seen in previous polls
          const newNotifs = notifications.filter(
            (n: any) => !seenIdsRef.current.has(n._id || n.id)
          );

          if (newNotifs.length > 0) {
            useNotificationStore.getState().fetchNotifications();
            const { ttsEnabled } = useNotificationStore.getState();

            for (const notif of newNotifs) {
              const notifId = notif._id || notif.id;
              seenIdsRef.current.add(notifId);

              // Play sound (all priorities — not just high/urgent)
              playNotificationSound(
                notif.type || 'system',
                notif.priority || 'medium',
                `poll-${notifId}`
              );

              // TTS for voice-enabled notifications
              if (notif.voiceEnabled && ttsEnabled) {
                try {
                  const parsedData = typeof notif.data === 'string'
                    ? JSON.parse(notif.data || '{}') : (notif.data || {});
                  if (parsedData.voiceText) {
                    voiceManager.init();
                    voiceManager.speak(parsedData.voiceText, {
                      priority: notif.priority === 'urgent' ? 'urgent'
                        : notif.priority === 'high' ? 'high' : 'medium',
                      rate: 1.1,
                      volume: 1.0,
                    });
                  }
                } catch { /* ignore parse errors */ }
              }

              // Dispatch in-app event → shows toast popup
              window.dispatchEvent(new CustomEvent('app-notification', {
                detail: {
                  id: notifId,
                  title: notif.titleAr || notif.titleEn || '',
                  body: notif.bodyAr || notif.bodyEn || '',
                  type: notif.type,
                  priority: notif.priority,
                  data: typeof notif.data === 'string'
                    ? JSON.parse(notif.data || '{}') : (notif.data || {}),
                  clickAction: notif.actionUrl,
                },
              }));
            }

            // Trim seenIds to prevent memory leak
            if (seenIdsRef.current.size > 200) {
              seenIdsRef.current = new Set(Array.from(seenIdsRef.current).slice(-100));
            }
          } else {
            // No new notifications — silently sync unread count
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
        // Reset state on each new auth session
        seenIdsRef.current.clear();
        isFirstPollRef.current = true;

        // Immediate first poll
        pollForNotifications();

        // Poll every 15 seconds (was 30s) for faster notification delivery
        intervalRef.current = setInterval(pollForNotifications, 15000);
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
// Voice Notification Poller - FAST polling for voice-pending notifications
// This is the PRIMARY mechanism for delivering voice alerts on Vercel.
// Since Socket.IO server doesn't run on Vercel serverless, we poll every
// 2 seconds for voice-pending notifications and play sound + TTS immediately.
// After successful playback, we CONFIRM to the server via /voice-played endpoint.
// This prevents losing alerts if the browser tab is throttled or audio fails.
// ============================================================================

const VOICE_PLAYED_URL = '/api/notifications/voice-played';

function VoiceNotificationPoller() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const token = useAuthStore((s) => s.token);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isPollingRef = useRef(false);
  // Track IDs of notifications we've already processed in this session
  // to avoid replaying sounds for the same notification on every poll
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

      // Handle expired token: try to refresh once
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
              // Update the token in the auth store
              useAuthStore.getState().setTokens(refreshData.data.token, refreshData.data.refreshToken || refreshToken || '');
              // Retry with the new token
              response = await fetch(VOICE_POLL_URL, {
                headers: {
                  'Authorization': `Bearer ${refreshData.data.token}`,
                  'Content-Type': 'application/json',
                },
              });
            }
          }
        } catch {
          // Refresh failed — will retry on next poll
        }
      }

      if (!response.ok) {
        isPollingRef.current = false;
        return;
      }

      const data = await response.json();
      if (!data.success || !data.data?.notifications?.length) {
        isPollingRef.current = false;
        return;
      }

      // Filter out notifications we've already processed in this session
      const newNotifications = data.data.notifications.filter(
        (notif: any) => !processedIdsRef.current.has(notif.id)
      );

      if (newNotifications.length === 0) {
        isPollingRef.current = false;
        return;
      }

      // Process each NEW voice-pending notification
      const { ttsEnabled } = useNotificationStore.getState();
      const playedIds: string[] = [];

      for (const notif of newNotifications) {
        const notifId = `voice-poll-${notif.id}`;

        // Mark as processed in this session
        processedIdsRef.current.add(notif.id);

        // Play sound with dedup (won't replay if already played by push/socket)
        playNotificationSound(
          notif.type || 'system',
          notif.priority || 'medium',
          notifId
        );

        // Play TTS voice alert if voiceText is available
        const voiceText = notif.data?.voiceText;
        if (voiceText) {
          const voiceId = `voice-${notifId}`;
          if (!markSoundPlayed(voiceId) && ttsEnabled) {
            voiceManager.init();
            voiceManager.speak(voiceText, {
              priority: notif.priority === 'urgent' ? 'urgent' : notif.priority === 'high' ? 'high' : 'medium',
              rate: 1.1,
              volume: 1.0,
            });
          }
        }

        // Track this notification as played (will be confirmed to server below)
        playedIds.push(notif.id);

        // Dispatch custom event for UI (notification bell, toasts, etc.)
        window.dispatchEvent(new CustomEvent('app-notification', {
          detail: {
            id: notif.id,
            title: notif.title,
            body: notif.body,
            type: notif.type,
            priority: notif.priority,
            data: notif.data,
            clickAction: notif.actionUrl,
          },
        }));
      }

      // Confirm playback to the server AFTER processing all notifications
      // This ensures we don't lose voice alerts if playback fails
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
        } catch {
          // If confirmation fails, the notification will be returned again
          // on the next poll, and our session dedup (processedIdsRef) will
          // prevent replaying. The server will eventually mark it when we
          // successfully confirm.
        }
      }

      // Refresh notification store to update UI badge
      useNotificationStore.getState().fetchNotifications();

      // Trim processed IDs set to prevent memory leak (keep last 100)
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

    if (isAuthenticated && token) {
      // Reset processed IDs on new auth session
      processedIdsRef.current.clear();

      // Initial poll immediately on auth
      pollForVoiceNotifications();

      // Adaptive polling: faster when visible, slower when hidden
      const getInterval = () => document.hidden ? VOICE_POLL_INTERVAL_HIDDEN : VOICE_POLL_INTERVAL_VISIBLE;

      intervalRef.current = setInterval(pollForVoiceNotifications, getInterval());

      // Update interval when visibility changes
      const handleVisibilityForInterval = () => {
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          if (isAuthenticated && token) {
            intervalRef.current = setInterval(pollForVoiceNotifications, getInterval());
          }
        }
      };

      document.addEventListener('visibilitychange', handleVisibilityForInterval);
    } else {
      // Clear processed IDs on logout
      processedIdsRef.current.clear();
    }

    // Listen for visibility change — when user returns to the app from background,
    // immediately poll for any voice-pending notifications that may have arrived
    // while the app was in background (push notifications showed browser notification
    // but voice/TTS couldn't play in background)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isAuthenticated && token) {
        // Small delay to ensure app is fully focused
        setTimeout(() => {
          pollForVoiceNotifications();
        }, 300);
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
// - Push notifications are an additional source for sound playing
// ============================================================================

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Initialize sound, voice, and notification systems
    notificationManager.init();
    soundManager.init();
    voiceManager.init(); // Pre-load voices so TTS is ready immediately

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
              const notifId = payload.data?.notificationId || `push-${payload.type}-${Date.now()}`;

              playNotificationSound(
                payload.type || 'system',
                payload.priority || 'medium',
                notifId
              );

              // Voice alert for emergency notifications (TTS)
              if (payload.data?.voiceAlert && payload.data?.voiceText) {
                const voiceId = `voice-${notifId}`;
                if (!markSoundPlayed(voiceId)) {
                  const { ttsEnabled } = useNotificationStore.getState();
                  if (ttsEnabled) {
                    voiceManager.init();
                    voiceManager.speak(payload.data.voiceText, {
                      priority: payload.priority === 'urgent' ? 'urgent' : payload.priority === 'high' ? 'high' : 'medium',
                      rate: 1.1,
                      volume: 1.0,
                    });
                  }
                }
              }
            }

            // Dispatch custom event for UI (notification bell, toasts, etc.)
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
// Push Subscription Manager - Robust auto-subscribe for push notifications
// Ensures subscriptions are ALWAYS active and properly registered on the server.
// Re-subscribes on every login and validates the server-side subscription status.
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
        // 0. Clean up old inactive subscriptions on the server
        try {
          const deviceId = localStorage.getItem('aafiatak-device-id');
          await fetch('/api/push/cleanup', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`,
            },
            body: JSON.stringify({ keepDeviceId: deviceId || undefined }),
          });
        } catch {
          // Non-critical
        }

        // 1. Ensure service worker is ready
        const registration = await navigator.serviceWorker.ready;

        // 2. Send auth data to SW so it can re-subscribe on pushsubscriptionchange
        //    Also stores the CURRENT user ID so the SW can filter push notifications
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

        // 3. Request notification permission if not already granted
        if (Notification.permission === 'default') {
          const permission = await Notification.requestPermission();
          if (permission !== 'granted') {
            console.warn('[PUSH] Notification permission denied');
            return;
          }
        } else if (Notification.permission === 'denied') {
          console.warn('[PUSH] Notification permission denied — cannot send push');
          return;
        }

        // 4. Get existing subscription
        let subscription = await registration.pushManager.getSubscription();

        // 5. Validate subscription with server — check if it's still active
        //    CRITICAL: We check for BOTH the current user AND any other user.
        //    If the subscription belongs to another user (e.g., Admin logged in
        //    before Beneficiary on the same device), we must NOT destroy it.
        //    Instead, we register the SAME subscription for the current user too.
        let needsResubscribe = false;
        let belongsToOtherUser = false;

        if (subscription) {
          // Check if this subscription is registered on the server
          try {
            const checkResponse = await fetch('/api/push/check-subscription', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
              },
              body: JSON.stringify({ endpoint: subscription.endpoint }),
            });
            const checkData = await checkResponse.json();
            if (checkData.success && checkData.data) {
              if (checkData.data.isActive) {
                // Subscription is active for current user — perfect, no action needed
                needsResubscribe = false;
              } else if (checkData.data.belongsToOtherUser) {
                // Subscription exists for ANOTHER user on this device!
                // DO NOT unsubscribe it — just register it for the current user too
                belongsToOtherUser = true;
                needsResubscribe = false;
              } else {
                // Subscription not found for any user — create new one
                needsResubscribe = true;
              }
            } else {
              // API check failed — assume subscription is OK
              needsResubscribe = false;
            }
          } catch {
            // If check fails, assume subscription is OK (don't unnecessarily re-subscribe)
          }
        } else {
          needsResubscribe = true;
        }

        // 6. If no valid subscription, create one
        //    ONLY unsubscribe if the subscription doesn't belong to anyone
        if (needsResubscribe) {
          // Unsubscribe old one if exists and doesn't belong to another user
          if (subscription) {
            try { await subscription.unsubscribe(); } catch {}
          }

          const keyResponse = await fetch('/api/push/vapid-key');
          const keyData = await keyResponse.json();
          const publicKey = keyData.data?.publicKey;

          if (!publicKey) {
            console.error('[PUSH] No VAPID public key available');
            return;
          }

          const applicationServerKey = urlBase64ToUint8Array(publicKey);

          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey,
          });

          console.log('[PUSH] New push subscription created');
        } else if (belongsToOtherUser) {
          console.log('[PUSH] Reusing existing subscription from another user (multi-user device)');
        }

        // 7. Always register/update the subscription on the server
        //    This ensures the current user has a FCMToken record for this endpoint
        let deviceId = localStorage.getItem('aafiatak-device-id');
        if (!deviceId) {
          deviceId = `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
          localStorage.setItem('aafiatak-device-id', deviceId);
        }

        const subJSON = subscription.toJSON();
        const response = await fetch('/api/push/subscribe', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            endpoint: subscription.endpoint,
            keys: subJSON.keys,
            platform: 'web',
            deviceId,
          }),
        });

        if (response.ok) {
          console.log('[PUSH] Subscription registered/updated on server');
        } else {
          console.warn('[PUSH] Failed to register subscription on server');
        }
      } catch (error) {
        console.warn('[PUSH] Failed to subscribe:', error);
      }
    };

    // Subscribe after a short delay to allow SW to be fully ready
    const timeout = setTimeout(subscribeToPush, 2000);

    // Also re-validate subscription periodically (every 5 minutes)
    const interval = setInterval(subscribeToPush, 5 * 60 * 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
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
// Emergency Sound Player - Listens for Socket.IO emergency events
// Kept as an ADDITIONAL delivery channel alongside VoiceNotificationPoller.
// When Socket.IO is available (e.g., on-premise), this provides instant delivery.
// On Vercel serverless, VoiceNotificationPoller is the primary mechanism.
// ============================================================================

function EmergencySoundPlayer() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated || !isAuthenticated) return;

    // Listen for emergency dispatched events (admin assigned nurse)
    const unsubDispatched = socketService.onEmergencyDispatched((data) => {
      try {
        const notifId = `socket-dispatched-${data.emergencyRequestId}`;

        playNotificationSound('emergency_assigned', 'urgent', notifId);

        const voiceId = `voice-${notifId}`;
        if (!markSoundPlayed(voiceId)) {
          const { ttsEnabled } = useNotificationStore.getState();
          if (ttsEnabled) {
            voiceManager.init();
            voiceManager.speak(
              `تم تعيينك لحالة طوارئ، الممرض ${data.nurseName || ''}`,
              { priority: 'urgent', rate: 1.1, volume: 1.0 }
            );
          }
        }

        useNotificationStore.getState().fetchNotifications();
      } catch {
        // Silently fail
      }
    });

    // Listen for emergency alert events (new emergency created)
    const unsubAlert = socketService.onEmergencyAlert((data) => {
      try {
        const notifId = `socket-alert-${data.emergencyRequestId}`;

        playNotificationSound('emergency', 'urgent', notifId);

        const voiceId = `voice-${notifId}`;
        if (!markSoundPlayed(voiceId)) {
          const { ttsEnabled } = useNotificationStore.getState();
          if (ttsEnabled) {
            voiceManager.init();
            voiceManager.speak(
              `حالة طوارئ جديدة`,
              { priority: 'urgent', rate: 1.1, volume: 1.0 }
            );
          }
        }
      } catch {
        // Silently fail
      }
    });

    // Listen for emergency created events
    const unsubCreated = socketService.onEmergencyCreated((data) => {
      try {
        const notifId = `socket-created-${data.emergencyRequestId}`;
        playNotificationSound('emergency', 'urgent', notifId);

        const voiceId = `voice-${notifId}`;
        if (!markSoundPlayed(voiceId)) {
          const { ttsEnabled } = useNotificationStore.getState();
          if (ttsEnabled) {
            voiceManager.init();
            voiceManager.speak(
              `حالة طوارئ جديدة من ${data.beneficiaryName}`,
              { priority: 'urgent', rate: 1.1, volume: 1.0 }
            );
          }
        }
      } catch {
        // Silently fail
      }
    });

    // Listen for general socket notifications (fallback)
    const unsubNotification = socketService.onNotification((data) => {
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
              voiceManager.speak(data.data.voiceText, {
                priority: data.priority === 'urgent' ? 'urgent' : 'high',
                rate: 1.1,
                volume: 1.0,
              });
            }
          }
        }
      } catch {
        // Silently fail
      }
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

export function PWAInitializer() {
  return (
    <>
      <ServiceWorkerRegistrar />
      <EmergencySoundPlayer />
      <VoiceNotificationPoller />
      <ChatSoundPlayer />
      <NotificationPoller />
      <WelcomeBackPlayer />
      <PushSubscriptionManager />
      <NotificationPermissionBanner />
      <OfflineWrapper />
    </>
  );
}
