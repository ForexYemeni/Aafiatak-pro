'use client';

import { useEffect } from 'react';
import { registerServiceWorker, isServiceWorkerSupported } from '@/lib/pwa/register-sw';
import { localDb } from '@/lib/db/indexeddb';
import { offlineQueue } from '@/lib/db/offline-queue';
import { OfflineWrapper } from '@/components/common/offline-wrapper';

export function PWAInitializer() {
  useEffect(() => {
    if (isServiceWorkerSupported()) {
      registerServiceWorker();
    }

    localDb.init().catch((error) => {
      console.error('[PWA] IndexedDB initialization failed:', error);
    });

    offlineQueue.start(30000);

    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data?.type === 'SYNC_REQUIRED') {
          import('@/lib/db/sync-manager').then(({ syncManager }) => {
            void syncManager.fullSync();
          });
        }
      });
    }

    return () => {
      offlineQueue.stop();
    };
  }, []);

  return <OfflineWrapper />;
}
