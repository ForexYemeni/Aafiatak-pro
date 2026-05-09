'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';

const OfflineWrapper = dynamic(
  () => import('@/components/common/offline-wrapper').then(mod => mod.OfflineWrapper),
  { ssr: false }
);

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Register service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Service worker not available
      });

      // ── KEY FIX: Listen for push notifications from Service Worker ──
      // When the SW receives a push and the app is in the foreground,
      // it sends a message to all windows. We listen here and play sound.
      const handleSWMessage = (event: MessageEvent) => {
        if (event.data?.type === 'PUSH_NOTIFICATION_RECEIVED') {
          const { soundManager } = require('@/lib/notifications/sound-manager');
          const payload = event.data.payload;

          if (payload.sound !== false) {
            // Map notification type to sound name
            const soundMap: Record<string, string> = {
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
            };

            const soundName = soundMap[payload.type] || 'notification';
            const isUrgent = payload.priority === 'urgent';
            const isHigh = payload.priority === 'high';

            soundManager.play(soundName, {
              priority: payload.priority || 'medium',
              volume: isUrgent ? 1.0 : isHigh ? 0.9 : 0.8,
              vibrate: isUrgent || isHigh,
              repeat: isUrgent ? 2 : 1,
            });

            // For emergency, play a second sound after delay
            if (isUrgent && payload.type === 'emergency') {
              setTimeout(() => {
                soundManager.playEmergency();
              }, 1500);
            }
          }

          // Dispatch a custom event so the app UI can react (show toast, update badge, etc.)
          const appEvent = new CustomEvent('app-notification', {
            detail: {
              id: `push-${Date.now()}`,
              title: payload.title,
              body: payload.body,
              type: payload.type,
              priority: payload.priority,
              data: payload.data,
            },
          });
          window.dispatchEvent(appEvent);
        }

        if (event.data?.type === 'SYNC_REQUIRED') {
          import('@/lib/db/sync-manager').then(({ syncManager }) => {
            void syncManager.fullSync();
          }).catch(() => {});
        }
      };

      navigator.serviceWorker.addEventListener('message', handleSWMessage);

      return () => {
        navigator.serviceWorker.removeEventListener('message', handleSWMessage);
      };
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

export function PWAInitializer() {
  return (
    <>
      <ServiceWorkerRegistrar />
      <OfflineWrapper />
    </>
  );
}
