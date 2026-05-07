'use client';

import { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';

// Dynamic import of OfflineWrapper with SSR disabled
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

    // Initialize offline modules using variable paths to prevent static analysis
    const dbPaths = {
      indexeddb: '@/lib/db/indexeddb',
      offlineQueue: '@/lib/db/offline-queue',
      syncManager: '@/lib/db/sync-manager',
    };

    import(dbPaths.indexeddb as string)
      .then(async (dbModule: Record<string, unknown>) => {
        const localDb = dbModule.localDb as { init: () => Promise<void> };
        await localDb.init().catch(() => {});

        const queueModule = await import(dbPaths.offlineQueue as string) as Record<string, unknown>;
        const offlineQueue = queueModule.offlineQueue as { start: (ms: number) => void; stop: () => void };
        offlineQueue.start(30000);

        if ('serviceWorker' in navigator) {
          navigator.serviceWorker.addEventListener('message', (event: MessageEvent) => {
            if (event.data?.type === 'SYNC_REQUIRED') {
              import(dbPaths.syncManager as string).then((syncMod: Record<string, unknown>) => {
                const sm = syncMod.syncManager as { fullSync: () => Promise<void> };
                void sm.fullSync();
              }).catch(() => {});
            }
          });
        }
      })
      .catch(() => {
        // Offline modules not available
      });

    return () => {
      import(dbPaths.offlineQueue as string).then((mod: Record<string, unknown>) => {
        const q = mod.offlineQueue as { stop: () => void };
        q.stop();
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
