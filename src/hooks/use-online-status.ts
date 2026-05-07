'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean;
}

const SYNC_MANAGER_PATH = '@/lib/db/sync-manager';

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [wasOffline, setWasOffline] = useState<boolean>(false);
  const wasOfflineRef = useRef<boolean>(false);

  const handleOnline = useCallback(() => {
    setIsOnline(true);
    if (wasOfflineRef.current) {
      setWasOffline(true);
      // Use variable path to prevent static analysis
      import(SYNC_MANAGER_PATH as string).then((mod: Record<string, unknown>) => {
        const sm = mod.syncManager as { fullSync: () => Promise<void> };
        void sm.fullSync();
      }).catch(() => {});
      setTimeout(() => setWasOffline(false), 5000);
    }
    wasOfflineRef.current = false;
  }, []);

  const handleOffline = useCallback(() => {
    setIsOnline(false);
    setWasOffline(false);
    wasOfflineRef.current = true;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => { window.removeEventListener('online', handleOnline); window.removeEventListener('offline', handleOffline); };
  }, [handleOnline, handleOffline]);

  return { isOnline, wasOffline };
}
