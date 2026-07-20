'use client';

// ============================================================================
// عافيتك (Aafiatak) - Universal Real-time Refresh Hook
// ============================================================================
// Provides instant data refresh for any page when Socket.IO events arrive.
// ALWAYS polls at the specified interval as a baseline, with Socket.IO events
// providing instant (sub-second) refresh when the socket server is running.
//
// USAGE:
//   const { refresh } = useRealtimeRefresh({
//     entities: ['order', 'emergency'],  // Which entities to listen for
//     onRefresh: fetchOrders,            // Callback to refresh data
//     fallbackInterval: 5000,           // Always polls every 5s (default: 5s)
//   });
// ============================================================================

import { useEffect, useCallback, useRef } from 'react';
import { socketService as socketServiceV2 } from '@/lib/socket-v2';
import type { DataChangeEvent } from '@/lib/socket-v2';

interface UseRealtimeRefreshOptions {
  /** Which entity types to listen for changes */
  entities: Array<'order' | 'emergency' | 'deployment' | 'application' | 'payment' | 'user' | 'notification' | 'withdrawal' | 'transaction' | 'complaint' | 'chat' | 'location' | 'rating' | 'special_request' | 'settings'>;
  /** Callback function to refresh data */
  onRefresh: () => void | Promise<void>;
  /** Polling interval in ms - ALWAYS polls at this rate (default: 5000) */
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
 * 1. ALWAYS polls at the specified interval (5s default) as a reliable baseline
 * 2. Listens for `data_change` events for instant (sub-second) updates when socket works
 * 3. Deduplicates rapid refresh calls (debounces within 50ms)
 *
 * The polling NEVER stops — it ensures data is always fresh even when
 * the socket server is down (e.g., on Vercel serverless deployment).
 */
export function useRealtimeRefresh(options: UseRealtimeRefreshOptions): UseRealtimeRefreshReturn {
  const {
    entities,
    onRefresh,
    fallbackInterval = 5000,
    listenSpecificEvents = true,
  } = options;

  const onRefreshRef = useRef(onRefresh);
  onRefreshRef.current = onRefresh;

  const lastRefreshRef = useRef(0);
  const debounceMs = 50; // Near-instant: 50ms debounce
  const pollingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

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

  // ── Listen for generic data_change events (instant when socket works) ──
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

  // ── ALWAYS poll at the specified interval ──
  // This is the reliable baseline - Socket.IO events provide instant bonus when available,
  // but polling ensures data is ALWAYS fresh regardless of socket status.
  useEffect(() => {
    // Start polling immediately
    pollingTimerRef.current = setInterval(() => {
      void onRefreshRef.current();
    }, fallbackInterval);

    // Refresh on socket reconnection (bonus instant refresh)
    const unsub = socketServiceV2.onConnectionStateChange((state) => {
      if (state === 'connected') {
        debouncedRefresh();
      }
    });

    return () => {
      if (pollingTimerRef.current) {
        clearInterval(pollingTimerRef.current);
        pollingTimerRef.current = null;
      }
      unsub();
    };
  }, [fallbackInterval, debouncedRefresh]);

  return { refresh };
}
