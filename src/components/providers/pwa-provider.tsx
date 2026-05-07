'use client';

import { useEffect, useState } from 'react';
import { registerServiceWorker, isServiceWorkerSupported } from '@/lib/pwa/register-sw';

export function PWAInitializer() {
  const [OfflineWrapper, setOfflineWrapper] = useState<React.ComponentType<{ children?: React.ReactNode }> | null>(null);

  useEffect(() => {
    if (isServiceWorkerSupported()) {
      registerServiceWorker();
    }

    // Dynamic imports for browser-only modules to avoid SSR issues
    Promise.all([
      import('@/lib/db/indexeddb'),
      import('@/lib/db/offline-queue'),
      import('@/components/common/offline-wrapper'),
    ]).then(([dbModule, queueModule, offlineModule]) => {
      const localDb = dbModule.localDb;
      const offlineQueue = queueModule.offlineQueue;
      const OfflineWrapperComponent = offlineModule.OfflineWrapper;

      localDb.init().catch((error: unknown) => {
        console.error('[PWA] IndexedDB initialization failed:', error);
      });

      offlineQueue.start(30000);

      if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
          if (event.data?.type === 'SYNC_REQUIRED') {
            import('@/lib/db/sync-manager').then(({ syncManager }) => {
              void syncManager.fullSync();
            });
          }
        });
      }

      setOfflineWrapper(() => OfflineWrapperComponent);

      return () => {
        offlineQueue.stop();
      };
    }).catch((error: unknown) => {
      console.error('[PWA] Failed to initialize offline modules:', error);
    });
  }, []);

  if (OfflineWrapper) {
    return <OfflineWrapper />;
  }

  return null;
}
