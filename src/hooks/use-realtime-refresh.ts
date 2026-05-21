'use client';

// ============================================================================
// عافيتك (Aafiatak) - Universal Real-time Refresh Hook
// ============================================================================
// Provides instant data refresh for any page when Socket.IO events arrive.
// Replaces the old 15-second polling with event-driven + fallback polling.
//
// USAGE:
//   const { refresh } = useRealtimeRefresh({
//     entities: ['order', 'emergency'],  // Which entities to listen for
//     onRefresh: fetchOrders,            // Callback to refresh data
//     fallbackInterval: 30000,           // Fallback polling when socket disconnected (default: 30s)
//   });
// ============================================================================

import { useEffect, useCallback, useRef } from 'react';
import { socketService as socketServiceV2 } from '@/lib/socket-v2';
import type { DataChangeEvent } from '@/lib/socket-v2';
import { useAuthStore } from '@/lib/stores/auth-store';

interface UseRealtimeRefreshOptions {
  /** Which entity types to listen for changes */
  entities: Array<'order' | 'emergency' | 'deployment' | 'application' | 'payment' | 'user' | 'notification' | 'withdrawal' | 'transaction' | 'complaint'>;
  /** Callback function to refresh data */
  onRefresh: () => void | Promise<void>;
  /** Fallback polling interval in ms when socket is disconnected (default: 30000) */
  fallbackInterval?: number;
  /** Whether to also listen for specific entity events (order_created, etc.) in addition to data_change */
  listenSpecificEvents?: boolean;
}

interface UseRealtimeRefreshReturn {
  /** Manually trigger a refresh */
  refresh: () => void;
}

/**
 * Hook that provides instant data refresh when Socket.IO events arrive.
 *
 * This hook:
 * 1. Listens for `data_change` events matching the specified entities
 * 2. Calls `onRefresh` immediately when a matching event arrives
 * 3. Falls back to polling when socket is disconnected
 * 4. Deduplicates rapid refresh calls (debounces within 500ms)
 *
 * This replaces the old pattern of `setInterval(fetchData, 15000)`.
 */
export function useRealtimeRefresh(options: UseRealtimeRefreshOptions): UseRealtimeRefreshReturn {
  const {
    entities,
    onRefresh,
    fallbackInterval = 30000,
    listenSpecificEvents = true,
  } = options;

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const lastRefreshRef = useRef(0);
  const debounceMs = 500; // Minimum time between refresh calls
  const isConnectedRef = useRef(false);
  const fallbackTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  /** Debounced refresh - prevents rapid successive calls */
  const debouncedRefresh = useCallback(() => {
    const now = Date.now();
    const timeSinceLastRefresh = now - lastRefreshRef.current;

    if (timeSinceLastRefresh >= debounceMs) {
      lastRefreshRef.current = now;
      void onRefreshRef.current();
    } else {
      // Schedule a refresh after the debounce period
      const remainingMs = debounceMs - timeSinceLastRefresh;
      setTimeout(() => {
        const nowInner = Date.now();
        if (nowInner - lastRefreshRef.current >= debounceMs) {
          lastRefreshRef.current = nowInner;
          void onRefreshRef.current();
        }
      }, remainingMs);
    }
  }, []);

  /** Manual refresh */
  const refresh = useCallback(() => {
    lastRefreshRef.current = Date.now();
    void onRefreshRef.current();
  }, []);

  // ── Listen for generic data_change events ──
  useEffect(() => {
    const entitySet = new Set(entities);

    const unsub = socketServiceV2.onDataChange((data: DataChangeEvent) => {
      if (entitySet.has(data.entity as any)) {
        debouncedRefresh();
      }
    });

    return unsub;
  }, [entities, debouncedRefresh]);

  // ── Listen for specific entity events (more responsive) ──
  useEffect(() => {
    if (!listenSpecificEvents) return;

    const unsubs: (() => void)[] = [];

    // Order events
    if (entities.includes('order')) {
      unsubs.push(
        socketServiceV2.onOrderCreated(() => debouncedRefresh()),
        socketServiceV2.onOrderAssigned(() => debouncedRefresh()),
        socketServiceV2.onOrderStatusChanged(() => debouncedRefresh()),
        socketServiceV2.onOrderUpdate(() => debouncedRefresh()),
        socketServiceV2.onOrderCancelled(() => debouncedRefresh()),
      );
    }

    // Emergency events
    if (entities.includes('emergency')) {
      unsubs.push(
        socketServiceV2.onEmergencyCreated(() => debouncedRefresh()),
        socketServiceV2.onEmergencyDispatched(() => debouncedRefresh()),
        socketServiceV2.onEmergencyUpdate(() => debouncedRefresh()),
        socketServiceV2.onEmergencyResolved(() => debouncedRefresh()),
        socketServiceV2.onEmergencyCancelled(() => debouncedRefresh()),
      );
    }

    // Deployment events
    if (entities.includes('deployment') || entities.includes('application') || entities.includes('payment')) {
      unsubs.push(
        socketServiceV2.onDeploymentUpdated(() => debouncedRefresh()),
        socketServiceV2.onApplicationUpdated(() => debouncedRefresh()),
        socketServiceV2.onPaymentUpdated(() => debouncedRefresh()),
      );
    }

    return () => {
      for (const unsub of unsubs) {
        unsub();
      }
    };
  }, [entities, listenSpecificEvents, debouncedRefresh]);

  // ── Track socket connection state ──
  useEffect(() => {
    const unsub = socketServiceV2.onConnectionStateChange((state) => {
      const wasConnected = isConnectedRef.current;
      isConnectedRef.current = state === 'connected';

      // If we just reconnected, do an immediate refresh
      if (!wasConnected && state === 'connected') {
        debouncedRefresh();
      }
    });

    return unsub;
  }, [debouncedRefresh]);

  // ── Fallback polling when socket is disconnected ──
  useEffect(() => {
    const startFallbackPolling = () => {
      if (fallbackTimerRef.current) return; // Already polling

      fallbackTimerRef.current = setInterval(() => {
        if (!isConnectedRef.current) {
          // Socket not connected — use fallback polling
          void onRefreshRef.current();
        }
      }, fallbackInterval);
    };

    const stopFallbackPolling = () => {
      if (fallbackTimerRef.current) {
        clearInterval(fallbackTimerRef.current);
        fallbackTimerRef.current = null;
      }
    };

    // Start fallback polling
    startFallbackPolling();

    // Also listen for connection state to adjust polling
    const unsub = socketServiceV2.onConnectionStateChange((state) => {
      if (state === 'connected') {
        // Socket connected — no need for frequent fallback polling
        // But keep a slow fallback just in case (60s)
        stopFallbackPolling();
        fallbackTimerRef.current = setInterval(() => {
          void onRefreshRef.current();
        }, 60000);
      } else {
        // Socket disconnected — use more frequent fallback
        stopFallbackPolling();
        fallbackTimerRef.current = setInterval(() => {
          void onRefreshRef.current();
        }, fallbackInterval);
      }
    });

    return () => {
      stopFallbackPolling();
      unsub();
    };
  }, [fallbackInterval]);

  return { refresh };
}
