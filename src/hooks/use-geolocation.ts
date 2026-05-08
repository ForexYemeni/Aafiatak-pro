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

export function useGeolocation(): UseGeolocationReturn {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const enrichCallbackRef = useRef<((loc: LocationData) => void) | null>(null);

  const onAddressEnriched = useCallback((callback: (loc: LocationData) => void) => {
    enrichCallbackRef.current = callback;
  }, []);

  const detectLocation = useCallback(async (): Promise<LocationData | null> => {
    setIsDetecting(true);
    setError(null);

    try {
      // PHASE 1: Fast position using WiFi/cell towers (~1-2 seconds)
      // This gives an approximate location almost instantly
      const position = await getPosition({
        enableHighAccuracy: false,  // Use WiFi/cell first - MUCH faster
        timeout: 8000,              // 8 second timeout
        maximumAge: 300000,         // Accept cached positions up to 5 minutes old
      });

      const { latitude, longitude, accuracy } = position.coords;

      // Return immediately with basic coordinates
      const basicLocation: LocationData = {
        latitude,
        longitude,
        accuracy,
        address: `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`,
        governorate: '',
        governorateValue: '',
        district: '',
        city: '',
      };

      setLocation(basicLocation);
      setIsDetecting(false);

      const currentLat = latitude;
      const currentLng = longitude;

      // PHASE 2: Try to get a more accurate position in the background
      // This is fire-and-forget - we already have a usable position
      getPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      })
        .then((precisePos) => {
          const preciseLocation: LocationData = {
            latitude: precisePos.coords.latitude,
            longitude: precisePos.coords.longitude,
            accuracy: precisePos.coords.accuracy,
            address: `${precisePos.coords.latitude.toFixed(6)}, ${precisePos.coords.longitude.toFixed(6)}`,
            governorate: '',
            governorateValue: '',
            district: '',
            city: '',
          };
          setLocation(preciseLocation);
          // Notify enrichment callback with precise coords
          if (enrichCallbackRef.current) {
            enrichCallbackRef.current(preciseLocation);
          }
        })
        .catch(() => {
          // Precise position failed - we already have approximate position, that's fine
        });

      // PHASE 3: Reverse geocode in background (fire-and-forget)
      fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${currentLat}&lon=${currentLng}&accept-language=ar&addressdetails=1`,
        {
          headers: {
            'User-Agent': 'Aafiatak-Healthcare-Platform/1.0',
          },
        }
      )
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (!data) return;
          const addr = data.address || {};
          const govMapping = mapGovernorate(addr.state || addr.region || addr.county || '');

          const enrichedLocation: LocationData = {
            latitude: currentLat,
            longitude: currentLng,
            accuracy,
            address: data.display_name || `${currentLat.toFixed(6)}, ${currentLng.toFixed(6)}`,
            governorate: govMapping.label,
            governorateValue: govMapping.value,
            district: addr.city || addr.town || addr.village || addr.suburb || addr.district || addr.neighbourhood || '',
            city: addr.city || addr.town || addr.village || addr.county || '',
          };

          // Update local state
          setLocation(enrichedLocation);

          // Notify the component that address was enriched
          if (enrichCallbackRef.current) {
            enrichCallbackRef.current(enrichedLocation);
          }
        })
        .catch(() => {
          // Reverse geocoding failed silently — we already have GPS coords
        });

      return basicLocation;

    } catch (err) {
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تحديد الموقع';
      setError(message);
      setIsDetecting(false);
      return null;
    }
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  return {
    location,
    isDetecting,
    error,
    detectLocation,
    onAddressEnriched,
    clearError,
  };
}
