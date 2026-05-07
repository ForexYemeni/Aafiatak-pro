'use client';

import { type ReactNode, useEffect, useState, useCallback } from 'react';
import { WifiOff, Wifi, RefreshCw, CloudOff, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useOnlineStatus } from '@/hooks/use-online-status';
import { syncManager } from '@/lib/db/sync-manager';
import { offlineQueue } from '@/lib/db/offline-queue';

interface OfflineWrapperProps {
  children: ReactNode;
}

interface QueueStatus {
  pending: number;
  processing: number;
  failed: number;
}

export function OfflineWrapper({ children }: OfflineWrapperProps) {
  const { isOnline, wasOffline } = useOnlineStatus();
  const [queueStatus, setQueueStatus] = useState<QueueStatus>({
    pending: 0,
    processing: 0,
    failed: 0,
  });
  const [isSyncing, setIsSyncing] = useState(false);
  const [showBackOnline, setShowBackOnline] = useState(false);

  // Update queue status periodically
  const updateQueueStatus = useCallback(async () => {
    try {
      const status = await offlineQueue.getStatus();
      setQueueStatus(status);
    } catch {
      // IndexedDB might not be available
    }
  }, []);

  useEffect(() => {
    void updateQueueStatus();
    const interval = setInterval(() => {
      void updateQueueStatus();
    }, 10000);

    return () => clearInterval(interval);
  }, [updateQueueStatus]);

  // Show "back online" notification
  useEffect(() => {
    if (wasOffline) {
      setShowBackOnline(true);
      setIsSyncing(true);

      // Simulate sync completion after a delay
      const syncTimeout = setTimeout(() => {
        setIsSyncing(false);
      }, 3000);

      const hideTimeout = setTimeout(() => {
        setShowBackOnline(false);
      }, 4000);

      return () => {
        clearTimeout(syncTimeout);
        clearTimeout(hideTimeout);
      };
    }
  }, [wasOffline]);

  // Manual retry for failed operations
  const handleRetry = useCallback(async () => {
    setIsSyncing(true);
    try {
      await offlineQueue.retryFailed();
      await syncManager.fullSync();
    } finally {
      setIsSyncing(false);
      await updateQueueStatus();
    }
  }, [updateQueueStatus]);

  const hasPendingWork = queueStatus.pending > 0 || queueStatus.failed > 0;

  return (
    <>
      {children}

      {/* Offline Banner */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center"
          >
            <div className="w-full bg-gradient-to-l from-amber-600 to-orange-600 text-white px-4 py-2.5 shadow-lg">
              <div className="flex items-center justify-center gap-2 text-sm font-medium">
                <WifiOff className="h-4 w-4 shrink-0" />
                <span>لا يوجد اتصال بالإنترنت</span>
                <span className="text-white/70">•</span>
                <span className="text-white/80 text-xs">
                  {hasPendingWork
                    ? `${queueStatus.pending + queueStatus.failed} عملية معلقة`
                    : 'يتم حفظ البيانات محلياً'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Back Online Banner */}
      <AnimatePresence>
        {showBackOnline && isOnline && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed top-0 left-0 right-0 z-[100] flex items-center justify-center"
          >
            <div className="w-full bg-gradient-to-l from-emerald-600 to-green-600 text-white px-4 py-2.5 shadow-lg">
              <div className="flex items-center justify-center gap-2 text-sm font-medium">
                {isSyncing ? (
                  <>
                    <RefreshCw className="h-4 w-4 shrink-0 animate-spin" />
                    <span>جاري مزامنة البيانات...</span>
                  </>
                ) : (
                  <>
                    <Check className="h-4 w-4 shrink-0" />
                    <span>تم الاتصال بالإنترنت</span>
                    {hasPendingWork && (
                      <>
                        <span className="text-white/70">•</span>
                        <button
                          type="button"
                          onClick={handleRetry}
                          className="text-white/90 underline underline-offset-2 hover:text-white transition-colors"
                        >
                          مزامنة {queueStatus.pending + queueStatus.failed} عملية
                        </button>
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Pending Operations Indicator (shown when online but has pending work) */}
      <AnimatePresence>
        {isOnline && !showBackOnline && hasPendingWork && (
          <motion.div
            initial={{ y: -60, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -60, opacity: 0 }}
            className="fixed top-0 left-0 right-0 z-[99]"
          >
            <div className="bg-blue-50 dark:bg-blue-950 border-b border-blue-200 dark:border-blue-800 px-4 py-1.5">
              <div className="flex items-center justify-center gap-2 text-xs text-blue-700 dark:text-blue-300">
                {isSyncing ? (
                  <RefreshCw className="h-3 w-3 shrink-0 animate-spin" />
                ) : (
                  <CloudOff className="h-3 w-3 shrink-0" />
                )}
                <span>
                  {queueStatus.failed > 0
                    ? `${queueStatus.failed} عملية فشلت، ${queueStatus.pending} معلقة`
                    : `${queueStatus.pending} عملية في الانتظار`}
                </span>
                <button
                  type="button"
                  onClick={handleRetry}
                  className="text-blue-600 dark:text-blue-400 underline underline-offset-2 hover:text-blue-800 dark:hover:text-blue-200 font-medium"
                >
                  مزامنة الآن
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Offline mode bottom indicator */}
      <AnimatePresence>
        {!isOnline && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            className="fixed bottom-4 left-4 right-4 z-[100] flex justify-center pointer-events-none"
          >
            <div className="bg-amber-600/90 backdrop-blur-sm text-white rounded-full px-4 py-2 shadow-lg flex items-center gap-2 text-xs pointer-events-auto">
              <Wifi className="h-3.5 w-3.5" />
              <span>وضع عدم الاتصال</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
