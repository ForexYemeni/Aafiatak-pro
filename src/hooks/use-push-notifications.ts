// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Web Push Notifications Hook
// ============================================================================
// Client-side hook for managing Web Push subscription using VAPID keys.
// NO Firebase — pure Web Push API with Service Worker integration.
// ============================================================================

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useAuthFetch } from '@/hooks/use-auth';

// ── Types ──────────────────────────────────────────────────────────

interface PushNotificationState {
  /** Whether the browser supports service workers and Push API */
  isSupported: boolean;
  /** Whether the user is currently subscribed to push notifications */
  isSubscribed: boolean;
  /** Current notification permission status */
  permission: NotificationPermission | 'default';
  /** Whether a subscribe/unsubscribe operation is in progress */
  isLoading: boolean;
  /** Last error message, if any */
  error: string | null;
}

// ── Helpers ────────────────────────────────────────────────────────

/**
 * Convert a VAPID public key from base64url to Uint8Array.
 * Required by the Push API for subscription.
 */
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

/**
 * Generate or retrieve a persistent device ID stored in localStorage.
 * This ensures we don't create duplicate subscriptions for the same device.
 */
function getDeviceId(): string {
  if (typeof window === 'undefined') return 'server';
  const key = 'aafiatak-device-id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = 'device-' + Date.now() + '-' + Math.random().toString(36).substring(2);
    localStorage.setItem(key, id);
  }
  return id;
}

// ── Hook ───────────────────────────────────────────────────────────

export function usePushNotifications() {
  const [state, setState] = useState<PushNotificationState>({
    isSupported: false,
    isSubscribed: false,
    permission: 'default',
    isLoading: false,
    error: null,
  });

  const authFetch = useAuthFetch();
  const user = useAuthStore((s) => s.user);
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null);

  // Check support and current subscription state on mount
  useEffect(() => {
    const isSupported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window;
    const permission = isSupported ? Notification.permission : 'denied';

    setState((prev) => ({ ...prev, isSupported, permission }));

    if (isSupported) {
      checkSubscription();
    }
  }, []);

  /**
   * Check if there's an active push subscription.
   */
  const checkSubscription = useCallback(async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      registrationRef.current = registration;
      const subscription = await registration.pushManager.getSubscription();

      setState((prev) => ({
        ...prev,
        isSubscribed: !!subscription,
        permission: Notification.permission,
      }));
    } catch (error) {
      console.error('[Push] Error checking subscription:', error);
    }
  }, []);

  /**
   * Request notification permission from the user.
   * Returns true if permission was granted.
   */
  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported) return false;

    try {
      const permission = await Notification.requestPermission();
      setState((prev) => ({ ...prev, permission }));
      return permission === 'granted';
    } catch (error) {
      console.error('[Push] Error requesting permission:', error);
      return false;
    }
  }, [state.isSupported]);

  /**
   * Subscribe the user to Web Push notifications.
   * 1. Requests permission
   * 2. Fetches the VAPID public key
   * 3. Creates a push subscription via the service worker
   * 4. Sends the subscription to the server
   */
  const subscribe = useCallback(async (): Promise<boolean> => {
    if (!state.isSupported || !user) return false;

    setState((prev) => ({ ...prev, isLoading: true, error: null }));

    try {
      // Step 1: Request permission
      const hasPermission = await requestPermission();
      if (!hasPermission) {
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error: 'تم رفض إذن الإشعارات',
        }));
        return false;
      }

      // Step 2: Get VAPID public key from server
      const vapidRes = await fetch('/api/push/vapid-key');
      const vapidData = await vapidRes.json();
      if (!vapidData.success || !vapidData.data?.publicKey) {
        throw new Error('فشل جلب مفتاح الإشعارات');
      }

      const publicKey = vapidData.data.publicKey;
      const applicationServerKey = urlBase64ToUint8Array(publicKey);

      // Step 3: Ensure service worker is ready
      const registration = await navigator.serviceWorker.ready;
      registrationRef.current = registration;

      // Step 4: Subscribe to push
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // Step 5: Send subscription to server
      const subJSON = subscription.toJSON();
      const res = await authFetch('/api/push/subscribe', {
        method: 'POST',
        body: JSON.stringify({
          endpoint: subscription.endpoint,
          keys: subJSON.keys,
          platform: 'web',
          deviceId: getDeviceId(),
        }),
      });

      const data = await res.json();
      if (!data.success) {
        throw new Error(data.message || 'فشل تسجيل الاشتراك');
      }

      setState((prev) => ({
        ...prev,
        isSubscribed: true,
        isLoading: false,
      }));
      console.log('[Push] Successfully subscribed');
      return true;
    } catch (error: any) {
      console.error('[Push] Error subscribing:', error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error.message || 'فشل الاشتراك في الإشعارات',
      }));
      return false;
    }
  }, [state.isSupported, user, authFetch, requestPermission]);

  /**
   * Unsubscribe the user from Web Push notifications.
   */
  const unsubscribe = useCallback(async (): Promise<boolean> => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await subscription.unsubscribe();

        // Notify server
        await authFetch('/api/push/subscribe', {
          method: 'DELETE',
          body: JSON.stringify({ endpoint: subscription.endpoint }),
        });
      }

      setState((prev) => ({ ...prev, isSubscribed: false }));
      console.log('[Push] Successfully unsubscribed');
      return true;
    } catch (error) {
      console.error('[Push] Error unsubscribing:', error);
      return false;
    }
  }, [authFetch]);

  return {
    ...state,
    subscribe,
    unsubscribe,
    requestPermission,
    checkSubscription,
  };
}
