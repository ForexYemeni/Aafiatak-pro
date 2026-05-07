// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Capacitor Haptics Plugin
// ============================================================================
// Wrapper for Capacitor Haptics plugin.
// Provides tactile feedback on native platforms; no-op on web.
// ============================================================================

/**
 * Trigger a light haptic impact feedback.
 * Used for subtle UI interactions (button taps, toggles).
 */
export function hapticLight(): void {
  if (typeof window === 'undefined') return;

  (async () => {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // Haptics not available on web; silently ignore
    }
  })();
}

/**
 * Trigger a medium haptic impact feedback.
 * Used for moderate interactions (card selections, confirmations).
 */
export function hapticMedium(): void {
  if (typeof window === 'undefined') return;

  (async () => {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({ style: ImpactStyle.Medium });
    } catch {
      // Haptics not available on web; silently ignore
    }
  })();
}

/**
 * Trigger a heavy haptic impact feedback.
 * Used for significant interactions (emergency alerts, long-press actions).
 */
export function hapticHeavy(): void {
  if (typeof window === 'undefined') return;

  (async () => {
    try {
      const { Haptics, ImpactStyle } = await import('@capacitor/haptics');
      await Haptics.impact({ style: ImpactStyle.Heavy });
    } catch {
      // Haptics not available on web; silently ignore
    }
  })();
}

/**
 * Trigger a notification haptic feedback with a specific type.
 * @param type - The type of notification haptic: success, warning, or error
 */
export function hapticNotification(type: 'success' | 'warning' | 'error'): void {
  if (typeof window === 'undefined') return;

  (async () => {
    try {
      const { Haptics, NotificationType } = await import('@capacitor/haptics');
      const notificationTypeMap: Record<string, typeof NotificationType.Success> = {
        success: NotificationType.Success,
        warning: NotificationType.Warning,
        error: NotificationType.Error,
      };
      const notificationType = notificationTypeMap[type] ?? NotificationType.Success;
      await Haptics.notification({ type: notificationType });
    } catch {
      // Haptics not available on web; silently ignore
    }
  })();
}

/**
 * Trigger a vibration with an optional duration.
 * On native, uses the Vibration API via Capacitor.
 * On web, uses the browser Vibration API if available.
 * @param duration - Duration in milliseconds (default: 100)
 */
export function vibrate(duration?: number): void {
  if (typeof window === 'undefined') return;

  const vibrateDuration = duration ?? 100;

  // Try browser Vibration API first (works on Android Chrome too)
  if ('vibrate' in navigator) {
    try {
      navigator.vibrate(vibrateDuration);
      return;
    } catch {
      // Fall through to Capacitor
    }
  }

  // Try Capacitor Haptics as fallback
  (async () => {
    try {
      const { Haptics } = await import('@capacitor/haptics');
      await Haptics.vibrate({ duration: vibrateDuration });
    } catch {
      // Vibration not available; silently ignore
    }
  })();
}
