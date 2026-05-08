// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Push Notification Setup
// ============================================================================
// Headless component that auto-subscribes authenticated users to push
// notifications after login. Placed in the app shell so it runs once.
// ============================================================================

'use client';

import { useEffect, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { usePushNotifications } from '@/hooks/use-push-notifications';

export function PushNotificationSetup() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const {
    isSupported,
    isSubscribed,
    subscribe,
    permission,
    isLoading,
  } = usePushNotifications();
  const hasAttempted = useRef(false);

  useEffect(() => {
    // Auto-subscribe after login if not already subscribed
    if (
      isAuthenticated &&
      user &&
      isSupported &&
      !isSubscribed &&
      !hasAttempted.current &&
      !isLoading
    ) {
      hasAttempted.current = true;

      // Small delay to ensure service worker is fully ready
      const timer = setTimeout(async () => {
        if (Notification.permission === 'default') {
          // First time — request permission and subscribe
          await subscribe();
        } else if (Notification.permission === 'granted') {
          // Permission already granted but not subscribed — subscribe now
          await subscribe();
        }
        // If denied, we respect the user's choice
      }, 2000);

      return () => clearTimeout(timer);
    }

    // Reset when user logs out
    if (!isAuthenticated) {
      hasAttempted.current = false;
    }
  }, [isAuthenticated, user, isSupported, isSubscribed, subscribe, isLoading]);

  // This is a headless component — renders nothing
  return null;
}
