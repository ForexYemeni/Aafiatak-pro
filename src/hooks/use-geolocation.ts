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
 * Reverse geocode with retry logic.
 * Tries Nominatim up to 3 times with increasing delay.
 */
async function reverseGeocode(lat: number, lng: number): Promise<{
  display_name: string;
  address: Record<string, string>;
} | null> {
  const maxRetries = 3;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar&addressdetails=1&zoom=18`,
        {
          headers: {
            'User-Agent': 'Aafiatak-Healthcare-Platform/1.0',
          },
        }
      );

      if (response.ok) {
        const data = await response.json();
        if (data && data.display_name) {
          return data;
        }
      }

      // Rate limit or error — wait before retry
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    } catch {
      if (attempt < maxRetries - 1) {
        await new Promise(r => setTimeout(r, 1000 * (attempt + 1)));
      }
    }
  }
  return null;
}

export function useGeolocation(): UseGeolocationReturn {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [isResolvingAddress, setIsResolvingAddress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enrichCallbackRef = useRef<((loc: LocationData) => void) | null>(null);

  // ─── Race condition guard ───
  // When Phase 3 (Nominatim) enriches the address, we store the enriched
  // address fields so Phase 2 (precise GPS) can merge coords without losing them.
  const enrichedRef = useRef<{
    address: string;
    governorate: string;
    governorateValue: string;
    district: string;
    city: string;
  } | null>(null);

  const onAddressEnriched = useCallback((callback: (loc: LocationData) => void) => {
    enrichCallbackRef.current = callback;
  }, []);

  const detectLocation = useCallback(async (): Promise<LocationData | null> => {
    setIsDetecting(true);
    setIsResolvingAddress(true);
    setError(null);

    // Reset enrichment for this cycle
    enrichedRef.current = null;

    try {
      // ────────────────────────────────────────────────
      // PHASE 1: Fast position using WiFi/cell towers
      // Returns almost instantly with approximate location.
      // We show coordinates as the address so the user gets instant feedback.
      // ────────────────────────────────────────────────
      const position = await getPosition({
        enableHighAccuracy: false,
        timeout: 8000,
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
        timeout: 15000,
        maximumAge: 0,
      })
        .then((precisePos) => {
          setLocation(prev => {
            if (!prev) return prev;
            // Merge precise coords but keep the current address
            // (whether it's still coordinates or already enriched by Phase 3)
            return {
              ...prev,
              latitude: precisePos.coords.latitude,
              longitude: precisePos.coords.longitude,
              accuracy: precisePos.coords.accuracy,
            };
          });
          // No enrichment callback here — we only updated coords, not address
        })
        .catch(() => {
          // Precise position failed — approximate position is fine
        });

      // ────────────────────────────────────────────────
      // PHASE 3: Reverse geocode via Nominatim (background)
      // Replaces the coordinates-only address with a real
      // human-readable Arabic address. Includes retry logic.
      // ────────────────────────────────────────────────
      reverseGeocode(currentLat, currentLng)
        .then((data) => {
          if (data) {
            const addr = data.address || {};
            const govMapping = mapGovernorate(addr.state || addr.region || addr.county || '');

            const enriched: LocationData = {
              latitude: currentLat,
              longitude: currentLng,
              accuracy,
              address: data.display_name,
              governorate: govMapping.label,
              governorateValue: govMapping.value,
              district: addr.city || addr.town || addr.village || addr.suburb || addr.district || addr.neighbourhood || '',
              city: addr.city || addr.town || addr.village || addr.county || '',
            };

            // Store enriched address fields for Phase 2 safety
            enrichedRef.current = {
              address: enriched.address,
              governorate: enriched.governorate,
              governorateValue: enriched.governorateValue,
              district: enriched.district,
              city: enriched.city,
            };

            setLocation(enriched);
            setIsResolvingAddress(false);

            if (enrichCallbackRef.current) {
              enrichCallbackRef.current(enriched);
            }
          } else {
            // Nominatim failed after all retries — keep coordinates as address
            setIsResolvingAddress(false);
            // Already have coordinates displayed, just stop loading state
          }
        })
        .catch(() => {
          // Unexpected error — keep coordinates as address
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
