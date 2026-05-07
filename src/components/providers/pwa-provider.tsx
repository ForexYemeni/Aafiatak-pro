'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import of OfflineWrapper with SSR disabled to avoid
// importing browser-only modules (IndexedDB, etc.) during build
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
        // SW registration failed silently
      });
    }

    // Initialize IndexedDB and offline queue (browser only)
    const initPromise = import('@/lib/db/indexeddb').then(async ({ localDb }) => {
      await localDb.init().catch(() => {});
      const { offlineQueue } = await import('@/lib/db/offline-queue');
      offlineQueue.start(30000);

      // Listen for sync messages from service worker
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
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
    }).catch(() => {
      // Offline modules not available
    });

    return () => {
      initPromise.then(cleanup => {
        if (typeof cleanup === 'function') cleanup();
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
