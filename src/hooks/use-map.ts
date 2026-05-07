'use client';

/**
 * Map hooks for عافيتك (Aafiatak) Healthcare Platform
 * Provides geolocation, distance, ETA, geocoding, and map center utilities
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import {
  haversineDistance,
  formatDistance,
  formatETA,
  isValidCoordinates,
  DEFAULT_LOCATION,
  type LatLng,
} from '@/lib/utils/location';

// ============================================================================
// useGeolocation
// ============================================================================

interface GeolocationState {
  position: LatLng | null;
  accuracy: number | null;
  heading: number | null;
  speed: number | null;
  timestamp: number | null;
  error: string | null;
  isLoading: boolean;
}

interface UseGeolocationOptions {
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  watch?: boolean;
}

/**
 * Get user's current GPS position using the Geolocation API.
 * Optionally watches for continuous updates.
 */
export function useGeolocation(options: UseGeolocationOptions = {}): GeolocationState & {
  getCurrentPosition: () => void;
  startWatching: () => void;
  stopWatching: () => void;
} {
  const {
    enableHighAccuracy = true,
    timeout = 10000,
    maximumAge = 30000,
    watch = false,
  } = options;

  const [state, setState] = useState<GeolocationState>({
    position: null,
    accuracy: null,
    heading: null,
    speed: null,
    timestamp: null,
    error: null,
    isLoading: false,
  });

  const watchIdRef = useRef<number | null>(null);

  const geolocationOptions: PositionOptions = useMemo(() => ({
    enableHighAccuracy,
    timeout,
    maximumAge,
  }), [enableHighAccuracy, timeout, maximumAge]);

  const getCurrentPosition = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setState(prev => ({
        ...prev,
        error: 'المتصفح لا يدعم تحديد الموقع',
        isLoading: false,
      }));
      return;
    }
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setState({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
          error: null,
          isLoading: false,
        });
      },
      (err) => {
        const errorMessages: Record<number, string> = {
          1: 'تم رفض إذن الموقع. يرجى تفعيل خدمات الموقع.',
          2: 'غير متاح تحديد الموقع. تأكد من تفعيل GPS.',
          3: 'انتهت مهلة طلب الموقع. حاول مرة أخرى.',
        };
        setState(prev => ({
          ...prev,
          error: errorMessages[err.code] || 'حدث خطأ في تحديد الموقع',
          isLoading: false,
        }));
      },
      geolocationOptions
    );
  }, [geolocationOptions]);

  const stopWatching = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  const startWatching = useCallback(() => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return;
    // Clear any existing watch
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
    setState(prev => ({ ...prev, isLoading: true }));
    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
          accuracy: pos.coords.accuracy,
          heading: pos.coords.heading,
          speed: pos.coords.speed,
          timestamp: pos.timestamp,
          error: null,
          isLoading: false,
        });
      },
      (err) => {
        const errorMessages: Record<number, string> = {
          1: 'تم رفض إذن الموقع. يرجى تفعيل خدمات الموقع.',
          2: 'غير متاح تحديد الموقع. تأكد من تفعيل GPS.',
          3: 'انتهت مهلة طلب الموقع. حاول مرة أخرى.',
        };
        setState(prev => ({
          ...prev,
          error: errorMessages[err.code] || 'حدث خطأ في تحديد الموقع',
          isLoading: false,
        }));
      },
      geolocationOptions
    );
  }, [geolocationOptions]);

  useEffect(() => {
    if (watch && typeof navigator !== 'undefined' && navigator.geolocation) {
      watchIdRef.current = navigator.geolocation.watchPosition(
        (pos) => {
          setState({
            position: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            speed: pos.coords.speed,
            timestamp: pos.timestamp,
            error: null,
            isLoading: false,
          });
        },
        (err) => {
          const errorMessages: Record<number, string> = {
            1: 'تم رفض إذن الموقع. يرجى تفعيل خدمات الموقع.',
            2: 'غير متاح تحديد الموقع. تأكد من تفعيل GPS.',
            3: 'انتهت مهلة طلب الموقع. حاول مرة أخرى.',
          };
          setState(prev => ({
            ...prev,
            error: errorMessages[err.code] || 'حدث خطأ في تحديد الموقع',
            isLoading: false,
          }));
        },
        geolocationOptions
      );
    }
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [watch, geolocationOptions]);

  return {
    ...state,
    getCurrentPosition,
    startWatching,
    stopWatching,
  };
}

// ============================================================================
// useDistance
// ============================================================================

/**
 * Calculate distance between two points using Haversine formula.
 * Returns distance in km and formatted string.
 */
export function useDistance(from: LatLng | null, to: LatLng | null): {
  distance: number;
  formatted: string;
} {
  if (!from || !to || !isValidCoordinates(from.lat, from.lng) || !isValidCoordinates(to.lat, to.lng)) {
    return { distance: 0, formatted: '٠ كم' };
  }

  const distance = haversineDistance(from, to);
  return {
    distance,
    formatted: formatDistance(distance),
  };
}

// ============================================================================
// useETA
// ============================================================================

/**
 * Estimate arrival time given a distance and optional speed.
 * Default walking speed: 5 km/h, driving: 40 km/h
 */
export function useETA(distance: number, speed: number = 40): {
  minutes: number;
  formatted: string;
} {
  if (distance <= 0 || speed <= 0) {
    return { minutes: 0, formatted: '٠ دقيقة' };
  }

  const hours = distance / speed;
  const minutes = hours * 60;
  return {
    minutes,
    formatted: formatETA(minutes),
  };
}

// ============================================================================
// useReverseGeocode
// ============================================================================

interface ReverseGeocodeResult {
  address: string;
  city: string | null;
  country: string | null;
  isLoading: boolean;
  error: string | null;
}

/**
 * Convert coordinates to address using OpenStreetMap Nominatim API.
 * Free but rate-limited - use responsibly.
 */
export function useReverseGeocode(lat: number, lng: number): ReverseGeocodeResult {
  const [result, setResult] = useState<ReverseGeocodeResult>({
    address: '',
    city: null,
    country: null,
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!isValidCoordinates(lat, lng)) {
      setResult({
        address: '',
        city: null,
        country: null,
        isLoading: false,
        error: 'إحداثيات غير صالحة',
      });
      return;
    }

    let cancelled = false;
    setResult(prev => ({ ...prev, isLoading: true, error: null }));

    const fetchAddress = async () => {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar`,
          {
            headers: {
              'User-Agent': 'AafiatakHealthcareApp/1.0',
            },
          }
        );

        if (!response.ok) {
          throw new Error('فشل في جلب العنوان');
        }

        const data = await response.json();

        if (cancelled) return;

        setResult({
          address: data.display_name || 'عنوان غير معروف',
          city: data.address?.city || data.address?.town || data.address?.village || null,
          country: data.address?.country || null,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setResult({
          address: '',
          city: null,
          country: null,
          isLoading: false,
          error: err instanceof Error ? err.message : 'حدث خطأ في جلب العنوان',
        });
      }
    };

    fetchAddress();
    return () => {
      cancelled = true;
    };
  }, [lat, lng]);

  return result;
}

// ============================================================================
// useForwardGeocode
// ============================================================================

interface ForwardGeocodeResult {
  results: Array<{
    lat: number;
    lng: number;
    display_name: string;
  }>;
  isLoading: boolean;
  error: string | null;
}

/**
 * Convert address to coordinates using OpenStreetMap Nominatim API.
 * Free but rate-limited - use responsibly.
 */
export function useForwardGeocode(address: string): ForwardGeocodeResult {
  const [result, setResult] = useState<ForwardGeocodeResult>({
    results: [],
    isLoading: false,
    error: null,
  });

  useEffect(() => {
    if (!address || address.trim().length < 3) {
      setResult({ results: [], isLoading: false, error: null });
      return;
    }

    let cancelled = false;
    const timeoutId = setTimeout(async () => {
      setResult(prev => ({ ...prev, isLoading: true, error: null }));

      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&countrycodes=ye&accept-language=ar&limit=5`,
          {
            headers: {
              'User-Agent': 'AafiatakHealthcareApp/1.0',
            },
          }
        );

        if (!response.ok) {
          throw new Error('فشل في البحث عن العنوان');
        }

        const data = await response.json();

        if (cancelled) return;

        setResult({
          results: data.map((item: { lat: string; lon: string; display_name: string }) => ({
            lat: parseFloat(item.lat),
            lng: parseFloat(item.lon),
            display_name: item.display_name,
          })),
          isLoading: false,
          error: null,
        });
      } catch (err) {
        if (cancelled) return;
        setResult({
          results: [],
          isLoading: false,
          error: err instanceof Error ? err.message : 'حدث خطأ في البحث',
        });
      }
    }, 500); // Debounce 500ms

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [address]);

  return result;
}

// ============================================================================
// useMapCenter
// ============================================================================

/**
 * Manage map center position with getter and setter.
 * Defaults to Sana'a, Yemen.
 */
export function useMapCenter(initialCenter?: LatLng): {
  center: LatLng;
  setCenter: (center: LatLng) => void;
  resetCenter: () => void;
} {
  const [center, setCenter] = useState<LatLng>(initialCenter || DEFAULT_LOCATION);

  const resetCenter = useCallback(() => {
    setCenter(initialCenter || DEFAULT_LOCATION);
  }, [initialCenter]);

  return { center, setCenter, resetCenter };
}
