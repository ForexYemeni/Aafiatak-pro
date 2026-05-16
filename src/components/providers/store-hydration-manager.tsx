'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useNotificationStore } from '@/lib/stores/notification-store';
import { useAppStore } from '@/lib/stores/app-store';
import { useNurseStore } from '@/lib/stores/nurse-store';

// ============================================================================
// Store Hydration Manager (Fix for React Error #300)
// ============================================================================
// PROBLEM:
// Zustand's `persist` middleware reads from localStorage synchronously
// during store creation on the client. This means the initial client
// render has different state than the server render (which has no
// localStorage access). React detects this mismatch and throws
// Error #300 (hydration mismatch).
//
// SOLUTION:
// 1. All stores use `skipHydration: true` to prevent automatic rehydration
// 2. This component manually triggers rehydration inside a `useEffect`,
//    which runs AFTER the initial render has completed and matched the
//    server output
// 3. After rehydration, the stores update their state, and React
//    re-renders with the correct client-side state (no mismatch)
// ============================================================================

let _hydrationAttempted = false;

export function StoreHydrationManager() {
  useEffect(() => {
    // Only hydrate once per session (prevents StrictMode double-fire)
    if (_hydrationAttempted) return;
    _hydrationAttempted = true;

    const hydrateStores = async () => {
      try {
        // Hydrate all stores in parallel
        const authPersist = useAuthStore.persist;
        const notifPersist = useNotificationStore.persist;
        const appPersist = useAppStore.persist;
        const nursePersist = useNurseStore.persist;

        // Check if stores have not been hydrated yet
        const authNeedsHydration = !useAuthStore.getState()._hasHydrated;
        const notifNeedsHydration = !notifPersist.hasHydrated();
        const appNeedsHydration = !appPersist.hasHydrated();
        const nurseNeedsHydration = !nursePersist.hasHydrated();

        // Rehydrate auth store (most critical — drives UI state)
        if (authNeedsHydration && authPersist.rehydrate) {
          await authPersist.rehydrate();
        }

        // Rehydrate other stores in parallel
        const otherHydrations: Promise<void>[] = [];

        if (notifNeedsHydration && notifPersist.rehydrate) {
          otherHydrations.push(notifPersist.rehydrate());
        }

        if (appNeedsHydration && appPersist.rehydrate) {
          otherHydrations.push(appPersist.rehydrate());
        }

        if (nurseNeedsHydration && nursePersist.rehydrate) {
          otherHydrations.push(nursePersist.rehydrate());
        }

        await Promise.all(otherHydrations);

        // Update navigator.onLine status after hydration
        if (typeof navigator !== 'undefined') {
          useAppStore.getState().setOnlineStatus(navigator.onLine);
        }
      } catch (error) {
        console.error('[StoreHydrationManager] Rehydration failed:', error);

        // Mark auth as hydrated even on failure so the app doesn't stay stuck
        if (!useAuthStore.getState()._hasHydrated) {
          useAuthStore.setState({ _hasHydrated: true });
        }
      }
    };

    // Use requestAnimationFrame to ensure the initial render has completed
    // and the DOM has been painted before we update store state
    requestAnimationFrame(() => {
      hydrateStores();
    });
  }, []);

  return null;
}
