'use client';

import { useState, useCallback, useRef } from 'react';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  address: string;
  governorate: string;
  governorateValue: string;
  district: string;
  city: string;
}

export interface UseGeolocationReturn {
  location: LocationData | null;
  isDetecting: boolean;
  /** True while reverse geocoding is in progress */
  isResolvingAddress: boolean;
  error: string | null;
  detectLocation: () => Promise<LocationData | null>;
  /** Listen for background address enrichment */
  onAddressEnriched: (callback: (loc: LocationData) => void) => void;
  clearError: () => void;
}

// Map English governorate names from Nominatim to Arabic label
const GOVERNORATE_MAP: Record<string, string> = {
  'Amanat Al Asimah': 'أمانة العاصمة',
  'Amanah': 'أمانة العاصمة',
  'Sanaa': 'صنعاء',
  "Sana'a": 'صنعاء',
  'Aden': 'عدن',
  'Taiz': 'تعز',
  "Ta'izz": 'تعز',
  'Hudaydah': 'الحديدة',
  'Al Hudaydah': 'الحديدة',
  'Ibb': 'إب',
  'Dhamar': 'ذمار',
  'Hajjah': 'حجة',
  'Hadramaut': 'حضرموت',
  'Hadhramaut': 'حضرموت',
  'Mukalla': 'المكلا',
  'Al Mukalla': 'المكلا',
  'Marib': 'مأرب',
  "Ma'rib": 'مأرب',
  'Saada': 'صعدة',
  "Sa'dah": 'صعدة',
  'Al Bayda': 'البيضاء',
  "Al Bayda'": 'البيضاء',
  'Lahij': 'لحج',
  'Abyan': 'أبين',
  'Shabwah': 'شبوة',
  'Al Mahrah': 'المهرة',
  'Al Jawf': 'الجوف',
  'Raymah': 'ريمة',
  'Socotra': 'سقطرى',
  'Amran': 'عمران',
  "'Amran": 'عمران',
  'Al Mahwit': 'المحويت',
  'Al Dhale': 'الضالع',
  "Ad Dali'": 'الضالع',
  'Damret': 'ذمار',
};

const ARABIC_TO_VALUE_MAP: Record<string, string> = {
  'أمانة العاصمة': 'sanaa_city',
  'صنعاء': 'sanaa',
  'عدن': 'aden',
  'تعز': 'taiz',
  'الحديدة': 'hudaydah',
  'إب': 'ibb',
  'حضرموت': 'hadhramaut',
  'ذمار': 'dhamar',
  'مأرب': 'marib',
  'عمران': 'amran',
  'حجة': 'hajjah',
  'البيضاء': 'al_bayda',
  'المحويت': 'al_mahwit',
  'أبين': 'abyan',
  'شبوة': 'shabwah',
  'لحج': 'lahij',
  'الضالع': 'al_dhale',
  'ريمة': 'raymah',
  'سقطرى': 'socotra',
  'المهرة': 'al_mahrah',
  'صعدة': 'saada',
  'الجوف': 'al_jawf',
};

function mapGovernorate(englishName: string): { label: string; value: string } {
  const mapped = GOVERNORATE_MAP[englishName];
  if (mapped) {
    const value = ARABIC_TO_VALUE_MAP[mapped] || '';
    return { label: mapped, value };
  }
  for (const [key, arabicLabel] of Object.entries(GOVERNORATE_MAP)) {
    if (englishName.toLowerCase().includes(key.toLowerCase()) ||
        key.toLowerCase().includes(englishName.toLowerCase())) {
      const value = ARABIC_TO_VALUE_MAP[arabicLabel] || '';
      return { label: arabicLabel, value };
    }
  }
  return { label: englishName, value: '' };
}

/** Check if an address string is just raw coordinates (e.g. "15.369400, 44.191000") */
export function isRawCoordinates(address: string): boolean {
  if (!address) return false;
  const trimmed = address.trim();
  return /^-?\d+\.?\d*\s*,\s*-?\d+\.?\d*$/.test(trimmed);
}

/** Format coordinates as a human-readable string */
function formatCoords(lat: number, lng: number): string {
  return `${lat.toFixed(6)}, ${lng.toFixed(6)}`;
}

// Helper to get geolocation position with specified options
function getPosition(options: PositionOptions): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('المتصفح لا يدعم تحديد الموقع الجغرافي'));
      return;
    }

    navigator.geolocation.getCurrentPosition(resolve, (err) => {
      switch (err.code) {
        case err.PERMISSION_DENIED:
          reject(new Error('تم رفض إذن تحديد الموقع. يرجى تفعيل خدمات الموقع'));
          break;
        case err.POSITION_UNAVAILABLE:
          reject(new Error('معلومات الموقع غير متوفرة'));
          break;
        case err.TIMEOUT:
          reject(new Error('انتهت مهلة تحديد الموقع. يرجى المحاولة مرة أخرى'));
          break;
        default:
          reject(new Error('حدث خطأ أثناء تحديد الموقع'));
      }
    }, options);
  });
}

/**
 * Reverse geocode via our server API (which proxies to Nominatim).
 * This avoids CORS issues and browser network restrictions.
 */
async function reverseGeocodeViaServer(lat: number, lng: number): Promise<{
  display_name: string;
  road: string;
  neighbourhood: string;
  suburb: string;
  city: string;
  district: string;
  state: string;
  county: string;
  country: string;
} | null> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout

    const response = await fetch('/api/geocode/reverse', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lat, lng }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return null;

    const result = await response.json();
    if (result.success && result.data) {
      return result.data;
    }
    return null;
  } catch {
    return null;
  }
}

export function useGeolocation(): UseGeolocationReturn {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enrichCallbackRef = useRef<((loc: LocationData) => void) | null>(null);

  const onAddressEnriched = useCallback((callback: (loc: LocationData) => void) => {
    enrichCallbackRef.current = callback;
  }, []);

  const detectLocation = useCallback(async (): Promise<LocationData | null> => {
    setIsDetecting(true);
    setIsResolvingAddress(true);
    setError(null);

    try {
      // ────────────────────────────────────────────────
      // PHASE 1: Fast position using WiFi/cell towers
      // Returns almost instantly with approximate location.
      // ────────────────────────────────────────────────
      const position = await getPosition({
        enableHighAccuracy: false,
        timeout: 20000, // 20s - generous timeout for slow GPS devices
        maximumAge: 300000,
      });

      const { latitude, longitude, accuracy } = position.coords;
      const coordsAddress = formatCoords(latitude, longitude);

      const basicLocation: LocationData = {
        latitude,
        longitude,
        accuracy,
        address: coordsAddress,
        governorate: '',
        governorateValue: '',
        district: '',
        city: '',
      };

      setLocation(basicLocation);
      setIsDetecting(false);

      const currentLat = latitude;
      const currentLng = longitude;

      // ────────────────────────────────────────────────
      // PHASE 2: More accurate GPS position (background)
      // CRITICAL: Only updates lat/lng/accuracy. NEVER touches
      // the address field so it can't overwrite Phase 3's data.
      // ────────────────────────────────────────────────
      getPosition({
        enableHighAccuracy: true,
        timeout: 30000, // 30s for high-accuracy GPS
        maximumAge: 0,
      })
        .then((precisePos) => {
          setLocation(prev => {
            if (!prev) return prev;
            return {
              ...prev,
              latitude: precisePos.coords.latitude,
              longitude: precisePos.coords.longitude,
              accuracy: precisePos.coords.accuracy,
            };
          });
        })
        .catch(() => {});

      // ────────────────────────────────────────────────
      // PHASE 3: Reverse geocode via our server API (background)
      // The server proxies to Nominatim, avoiding CORS/browser issues.
      // Replaces coordinates with a real human-readable Arabic address.
      // ────────────────────────────────────────────────
      reverseGeocodeViaServer(currentLat, currentLng)
        .then((data) => {
          if (data && data.display_name) {
            const govMapping = mapGovernorate(data.state || data.county || '');

            const enriched: LocationData = {
              latitude: currentLat,
              longitude: currentLng,
              accuracy,
              address: data.display_name,
              governorate: govMapping.label,
              governorateValue: govMapping.value,
              district: data.city || data.suburb || data.district || data.neighbourhood || '',
              city: data.city || data.county || '',
            };

            setLocation(enriched);
            setIsResolvingAddress(false);

            // Notify enrichment callback (updates parent components)
            if (enrichCallbackRef.current) {
              enrichCallbackRef.current(enriched);
            }
          } else {
            // Server geocoding failed — keep coordinates, stop loading
            setIsResolvingAddress(false);
          }
        })
        .catch(() => {
          // Unexpected error — keep coordinates, stop loading
          setIsResolvingAddress(false);
        });

      return basicLocation;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تحديد الموقع';
      setError(message);
      setIsDetecting(false);
      setIsResolvingAddress(false);
      return null;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    location,
    isDetecting,
    isResolvingAddress,
    error,
    detectLocation,
    onAddressEnriched,
    clearError,
  };
}
