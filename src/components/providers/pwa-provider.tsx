'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { soundManager } from '@/lib/notifications/sound-manager';

const OfflineWrapper = dynamic(
  () => import('@/components/common/offline-wrapper').then(mod => mod.OfflineWrapper),
  { ssr: false }
);

// Sound mapping for push notifications
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
};

function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (typeof window === 'undefined') return;

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

            if (payload.sound !== false) {
              const soundName = SOUND_MAP[payload.type] || 'notification';
              const isUrgent = payload.priority === 'urgent';
              const isHigh = payload.priority === 'high';

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

            // Dispatch custom event for app UI
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
        } catch {
          // Silently ignore SW message errors
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

export function PWAInitializer() {
  return (
    <>
      <ServiceWorkerRegistrar />
      <OfflineWrapper />
    </>
  );
}
