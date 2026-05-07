'use client';

import { useEffect, useState } from 'react';
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
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    // Initialize IndexedDB and offline queue
    Promise.all([
      import('@/lib/db/indexeddb'),
      import('@/lib/db/offline-queue'),
    ]).then(([dbModule, queueModule]) => {
      void dbModule.localDb.init().catch(() => {});
      queueModule.offlineQueue.start(30000);

      // Listen for sync messages from service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
          if (event.data?.type === 'SYNC_REQUIRED') {
            import('@/lib/db/sync-manager').then(({ syncManager }) => {
              void syncManager.fullSync();
            }).catch(() => {});
          }
        });
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
