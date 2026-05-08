'use client';

import { useState, useCallback, useRef } from 'react';

export interface LocationData {
  latitude: number;
  longitude: number;
  accuracy: number;
  address: string;        // Full Arabic address
  governorate: string;    // Yemen governorate name in Arabic
  governorateValue: string; // Yemen governorate value for select (e.g., 'sanaa_city')
  district: string;       // District/neighborhood in Arabic
  city: string;           // City name in Arabic
}

export interface UseGeolocationReturn {
  location: LocationData | null;
  isDetecting: boolean;
  error: string | null;
  detectLocation: () => Promise<LocationData | null>;
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

// Map Arabic governorate label to the select value used in YEMEN_GOVERNORATES
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
  // Try direct map first
  const mapped = GOVERNORATE_MAP[englishName];
  if (mapped) {
    const value = ARABIC_TO_VALUE_MAP[mapped] || '';
    return { label: mapped, value };
  }
  
  // Try partial match
  for (const [key, arabicLabel] of Object.entries(GOVERNORATE_MAP)) {
    if (englishName.toLowerCase().includes(key.toLowerCase()) || 
        key.toLowerCase().includes(englishName.toLowerCase())) {
      const value = ARABIC_TO_VALUE_MAP[arabicLabel] || '';
      return { label: arabicLabel, value };
    }
  }
  
  // Return the original if no mapping found
  return { label: englishName, value: '' };
}

export function useGeolocation(): UseGeolocationReturn {
  const [location, setLocation] = useState<LocationData | null>(null);
  const [isDetecting, setIsDetecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const detectLocation = useCallback(async (): Promise<LocationData | null> => {
    // Cancel any previous request
    if (abortRef.current) {
      abortRef.current.abort();
    }
    const abortController = new AbortController();
    abortRef.current = abortController;

    setIsDetecting(true);
    setError(null);

    try {
      // Step 1: Get GPS position (fast - usually 1-3 seconds)
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
          timeout: 8000,   // Reduced from 15s to 8s
          maximumAge: 30000, // Reduced from 60s to 30s for fresher data
        });
      });

      // Check if aborted
      if (abortController.signal.aborted) return null;

      const { latitude, longitude, accuracy } = position.coords;

      // Step 2: Return basic location IMMEDIATELY with coords as address
      // This makes the detection feel instant - user sees results right away
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

      // Step 3: Do reverse geocoding in background (non-blocking)
      // This enriches the location data without blocking the user
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&accept-language=ar&addressdetails=1`,
          {
            headers: {
              'User-Agent': 'Aafiatak-Healthcare-Platform/1.0',
            },
            signal: abortController.signal,
          }
        );

        if (response.ok && !abortController.signal.aborted) {
          const data = await response.json();
          const addr = data.address || {};
          
          const govMapping = mapGovernorate(addr.state || addr.region || addr.county || '');

          const enrichedLocation: LocationData = {
            latitude,
            longitude,
            accuracy,
            address: data.display_name || basicLocation.address,
            governorate: govMapping.label,
            governorateValue: govMapping.value,
            district: addr.city || addr.town || addr.village || addr.suburb || addr.district || addr.neighbourhood || '',
            city: addr.city || addr.town || addr.village || addr.county || '',
          };

          setLocation(enrichedLocation);
          return enrichedLocation;
        }
      } catch (geoErr: any) {
        // If it's an abort, silently ignore
        if (geoErr?.name === 'AbortError') return null;
        // Reverse geocoding failed - we already have basic location with coords
      }

      return basicLocation;
    } catch (err) {
      if (abortController.signal.aborted) return null;
      const message = err instanceof Error ? err.message : 'حدث خطأ أثناء تحديد الموقع';
      setError(message);
      return null;
    } finally {
      if (!abortController.signal.aborted) {
        setIsDetecting(false);
      }
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
    clearError,
  };
}
