'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { syncManager } from '@/lib/db/sync-manager';

interface OnlineStatus {
  isOnline: boolean;
  wasOffline: boolean;
}

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
      void syncManager.fullSync();
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
