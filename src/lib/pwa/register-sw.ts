/**
 * Service Worker registration utilities for PWA support.
 */

/**
 * Check if service workers are supported in the current browser.
 */
export function isServiceWorkerSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator
  );
}

/**
 * Register the service worker for the application.
 */
export function registerServiceWorker(): void {
  if (!isServiceWorkerSupported()) {
    console.warn('[SW] Service workers are not supported in this browser');
    return;
  }

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
      });

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;

        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'activated') {
            console.log('[SW] New service worker activated');
          }
        });
      });

      console.log('[SW] Service worker registered successfully');
    } catch (error) {
      console.error('[SW] Service worker registration failed:', error);
    }
  });
}

/**
 * Unregister the service worker.
 */
export async function unregisterServiceWorker(): Promise<void> {
  if (!isServiceWorkerSupported()) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.unregister();
      console.log('[SW] Service worker unregistered');
    }
  } catch (error) {
    console.error('[SW] Service worker unregistration failed:', error);
  }
}

/**
 * Check for service worker updates.
 */
export async function checkForUpdates(): Promise<void> {
  if (!isServiceWorkerSupported()) return;

  try {
    const registration = await navigator.serviceWorker.getRegistration();
    if (registration) {
      await registration.update();
      console.log('[SW] Checked for updates');
    }
  } catch (error) {
    console.error('[SW] Update check failed:', error);
  }
}
