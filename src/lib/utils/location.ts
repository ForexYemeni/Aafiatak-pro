/**
 * Location utility functions for عافيتك (Aafiatak) Healthcare Platform
 * Handles distance calculations, bearing, formatting in Arabic
 */

export interface LatLng {
  lat: number;
  lng: number;
}

/**
 * Calculate the distance between two geographic points using the Haversine formula.
 * Returns distance in kilometers.
 */
export function haversineDistance(from: LatLng, to: LatLng): number {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(to.lat - from.lat);
  const dLng = toRad(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(from.lat)) *
      Math.cos(toRad(to.lat)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Calculate the bearing (direction) from one point to another.
 * Returns bearing in degrees (0-360).
 */
export function bearing(from: LatLng, to: LatLng): number {
  const dLng = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);

  const y = Math.sin(dLng) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);

  const brng = toDeg(Math.atan2(y, x));
  return (brng + 360) % 360;
}

/**
 * Calculate the destination point given a start, bearing, and distance.
 * @param start - Starting coordinates
 * @param brng - Bearing in degrees
 * @param distance - Distance in kilometers
 */
export function destinationPoint(start: LatLng, brng: number, distance: number): LatLng {
  const R = 6371; // Earth's radius in km
  const d = distance;
  const brngRad = toRad(brng);
  const lat1 = toRad(start.lat);
  const lng1 = toRad(start.lng);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(d / R) +
      Math.cos(lat1) * Math.sin(d / R) * Math.cos(brngRad)
  );

  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(brngRad) * Math.sin(d / R) * Math.cos(lat1),
      Math.cos(d / R) - Math.sin(lat1) * Math.sin(lat2)
    );

  return {
    lat: toDeg(lat2),
    lng: toDeg(lng2),
  };
}

/**
 * Format distance in Arabic.
 * Shows meters for distances under 1km, kilometers otherwise.
 */
export function formatDistance(km: number): string {
  if (km < 1) {
    const meters = Math.round(km * 1000);
    return `${meters} م`;
  }
  if (km < 10) {
    return `${km.toFixed(1)} كم`;
  }
  return `${Math.round(km)} كم`;
}

/**
 * Format ETA in Arabic.
 * Shows minutes for ETAs under 60, hours and minutes otherwise.
 */
export function formatETA(minutes: number): string {
  if (minutes < 1) {
    return 'أقل من دقيقة';
  }
  if (minutes < 60) {
    const mins = Math.round(minutes);
    return `${mins} دقيقة`;
  }
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (mins === 0) {
    return `${hours} ساعة`;
  }
  return `${hours} ساعة ${mins} دقيقة`;
}

/**
 * Validate that coordinates are within reasonable bounds.
 * Latitude: -90 to 90, Longitude: -180 to 180
 */
export function isValidCoordinates(lat: number, lng: number): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    !isNaN(lat) &&
    !isNaN(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Get compass direction name in Arabic from bearing degrees.
 */
export function compassDirection(brng: number): string {
  const directions = [
    'شمال',       // N
    'شمال شرقي',  // NE
    'شرق',        // E
    'جنوب شرقي',  // SE
    'جنوب',       // S
    'جنوب غربي',  // SW
    'غرب',        // W
    'شمال غربي',  // NW
  ];
  const index = Math.round(brng / 45) % 8;
  return directions[index];
}

/**
 * Default location: Sana'a, Yemen
 */
export const DEFAULT_LOCATION: LatLng = {
  lat: 15.3694,
  lng: 44.1910,
};

/**
 * Calculate speed in km/h from distance (km) and time (seconds).
 */
export function calculateSpeed(distanceKm: number, timeSeconds: number): number {
  if (timeSeconds <= 0) return 0;
  return (distanceKm / timeSeconds) * 3600;
}

// ---- Helpers ----

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function toDeg(rad: number): number {
  return (rad * 180) / Math.PI;
}
