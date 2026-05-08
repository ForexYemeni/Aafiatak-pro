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
      // Step 1: Get GPS position ONLY — this is the only blocking step
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
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
        }, {
          enableHighAccuracy: true,
          timeout: 5000,
          maximumAge: 0, // Always get fresh position
        });
      });

      const { latitude, longitude, accuracy } = position.coords;

      // Step 2: Return IMMEDIATELY — no waiting for reverse geocoding
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
      // IMPORTANT: Set detecting to false RIGHT HERE so UI responds instantly
      setIsDetecting(false);

      // Step 3: Reverse geocode in background (fire-and-forget)
      // This will NOT block the UI or the return value
      const currentLat = latitude;
      const currentLng = longitude;
      
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
