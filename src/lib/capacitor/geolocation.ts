// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Capacitor Geolocation Plugin
// ============================================================================
// Wrapper for Capacitor Geolocation plugin.
// Gracefully degrades to the browser Geolocation API when not on native.
// ============================================================================

/** Position data with coordinates and metadata */
export interface Position {
  latitude: number;
  longitude: number;
  accuracy: number;
  altitude: number | null;
  speed: number | null;
  heading: number | null;
  timestamp: number;
}

/** Geolocation error types */
export interface GeolocationPositionError {
  code: number;
  message: string;
}

// ---- Watch tracking ----

const activeWatches: Map<string, number> = new Map();
let backgroundWatchId: string | null = null;

/**
 * Convert browser GeolocationPosition to our Position type
 */
function fromBrowserPosition(pos: GeolocationPosition): Position {
  return {
    latitude: pos.coords.latitude,
    longitude: pos.coords.longitude,
    accuracy: pos.coords.accuracy,
    altitude: pos.coords.altitude,
    speed: pos.coords.speed,
    heading: pos.coords.heading,
    timestamp: pos.timestamp,
  };
}

/**
 * Get the current device position.
 * Uses Capacitor Geolocation on native, browser API on web.
 */
export async function getCurrentPosition(): Promise<Position> {
  if (typeof window === 'undefined') {
    throw new Error('Geolocation is not available on the server');
  }

  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000,
    });

    return {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      altitude: position.coords.altitude,
      speed: position.coords.speed,
      heading: position.coords.heading,
      timestamp: position.timestamp,
    };
  } catch {
    // Fallback to browser Geolocation API
    return new Promise<Position>((resolve, reject) => {
      if (!('geolocation' in navigator)) {
        reject(new Error('Geolocation is not supported by this browser'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (pos) => resolve(fromBrowserPosition(pos)),
        (err) => {
          const error: GeolocationPositionError = {
            code: err.code,
            message: err.message,
          };
          reject(error);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 60000,
        }
      );
    });
  }
}

/**
 * Watch position continuously for real-time tracking.
 * Returns a watch ID that can be used to stop the watch.
 * Uses Capacitor Geolocation on native, browser API on web.
 */
export function watchPosition(
  callback: (position: Position) => void,
  errorCallback?: (error: GeolocationPositionError) => void
): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const watchId = `watch_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

  // Try Capacitor Geolocation first
  (async () => {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const capacitorWatch = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 10000 },
        (position: { coords: { latitude: number; longitude: number; accuracy: number; altitude: number | null; speed: number | null; heading: number | null }; timestamp: number } | null, err?: { message: string }) => {
          if (err) {
            if (errorCallback) {
              errorCallback({ code: 1, message: err.message });
            }
            return;
          }

          if (position) {
            callback({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: position.coords.accuracy,
              altitude: position.coords.altitude,
              speed: position.coords.speed,
              heading: position.coords.heading,
              timestamp: position.timestamp,
            });
          }
        }
      );

      activeWatches.set(watchId, capacitorWatch as unknown as number);
    } catch {
      // Fallback to browser API
      if ('geolocation' in navigator) {
        const browserWatchId = navigator.geolocation.watchPosition(
          (pos) => callback(fromBrowserPosition(pos)),
          (err) => {
            if (errorCallback) {
              errorCallback({ code: err.code, message: err.message });
            }
          },
          {
            enableHighAccuracy: true,
            timeout: 10000,
            maximumAge: 30000,
          }
        );
        activeWatches.set(watchId, browserWatchId);
      }
    }
  })();

  return watchId;
}

/**
 * Clear (stop) a position watch by its ID.
 */
export function clearWatch(watchId: string): void {
  if (typeof window === 'undefined') return;

  const browserWatchId = activeWatches.get(watchId);
  if (browserWatchId !== undefined) {
    // Try Capacitor first
    (async () => {
      try {
        const { Geolocation } = await import('@capacitor/geolocation');
        await Geolocation.clearWatch({ id: String(browserWatchId) });
      } catch {
        // Fallback to browser API
        if ('geolocation' in navigator) {
          navigator.geolocation.clearWatch(browserWatchId);
        }
      }
    })();

    activeWatches.delete(watchId);
  }
}

/**
 * Request location permissions from the user.
 * Returns true if granted, false if denied.
 */
export async function requestLocationPermissions(): Promise<boolean> {
  if (typeof window === 'undefined') return false;

  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    const result = await Geolocation.requestPermissions();
    return result.location === 'granted' || result.coarseLocation === 'granted';
  } catch {
    // On web, try to get current position to trigger the browser permission prompt
    try {
      await getCurrentPosition();
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Start background location tracking for nurse navigation.
 * Only works on native platforms with proper background mode configuration.
 * On web, this falls back to regular watchPosition.
 */
export async function startBackgroundTracking(): Promise<void> {
  if (typeof window === 'undefined') return;

  if (backgroundWatchId) {
    console.info('[Capacitor] Background tracking already active');
    return;
  }

  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    backgroundWatchId = await Geolocation.watchPosition(
      {
        enableHighAccuracy: true,
        timeout: 30000,
      },
      () => {
        // Background position updates are handled by the native plugin
        // and forwarded to the server via the nurse location API
      }
    );
    console.info('[Capacitor] Background tracking started');
  } catch {
    // Fallback to regular watch on web
    backgroundWatchId = watchPosition(
      () => {
        // Position updates handled by the app
      },
      (error) => {
        console.warn('[Capacitor] Background tracking error:', error.message);
      }
    );
    console.info('[Capacitor] Background tracking started (web fallback)');
  }
}

/**
 * Stop background location tracking.
 */
export async function stopBackgroundTracking(): Promise<void> {
  if (!backgroundWatchId) return;

  try {
    const { Geolocation } = await import('@capacitor/geolocation');
    await Geolocation.clearWatch({ id: backgroundWatchId });
  } catch {
    if (backgroundWatchId.startsWith('watch_')) {
      clearWatch(backgroundWatchId);
    }
  }

  backgroundWatchId = null;
  console.info('[Capacitor] Background tracking stopped');
}
