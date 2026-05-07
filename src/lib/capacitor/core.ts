// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Capacitor Core
// ============================================================================
// Core utilities for detecting and initializing the Capacitor native runtime.
// ============================================================================

/**
 * Check if running in a Capacitor native environment (iOS/Android).
 * Returns false when running in a regular web browser.
 */
export function isNative(): boolean {
  if (typeof window === 'undefined') return false;

  // Capacitor injects the Capacitor object onto the global window
  const win = window as Window & { Capacitor?: { isNativePlatform?: () => boolean; isNative?: boolean } };
  if (win.Capacitor) {
    if (typeof win.Capacitor.isNativePlatform === 'function') {
      return win.Capacitor.isNativePlatform();
    }
    return win.Capacitor.isNative ?? false;
  }

  return false;
}

/**
 * Initialize all Capacitor plugins.
 * Should be called once when the app starts in a native environment.
 * Does nothing when running in a web browser.
 */
export async function initCapacitor(): Promise<void> {
  if (!isNative()) {
    return;
  }

  try {
    // Dynamically import notification setup
    const { registerPushNotifications, requestNotificationPermissions } = await import('./notifications');

    // Request notification permissions
    const granted = await requestNotificationPermissions();
    if (granted) {
      // Register for push notifications
      await registerPushNotifications();
    }

    // Set default status bar style
    const { setStatusBarStyle, setStatusBarColor } = await import('./status-bar');
    setStatusBarStyle('dark');
    setStatusBarColor('#ffffff');

    console.info('[Capacitor] Native plugins initialized successfully');
  } catch (error) {
    console.warn('[Capacitor] Failed to initialize native plugins:', error);
  }
}
