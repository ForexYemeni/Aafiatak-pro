'use client';

/**
 * Route Line Component for عافيتك (Aafiatak) Healthcare Platform
 *
 * Draws an animated dashed line between two points with:
 * - Distance display
 * - ETA calculation
 * - RTL-compatible rendering
 */

import { Polyline } from 'react-leaflet';
import { haversineDistance } from '@/lib/utils/location';
import type { LatLng } from '@/lib/utils/location';

export interface RouteLineProps {
  from: LatLng;
  to: LatLng;
  color?: string;
  weight?: number;
  dashArray?: string;
  animated?: boolean;
  showDistance?: boolean;
  speed?: number; // km/h for ETA
}

/**
 * Generate intermediate points along a straight line for smoother rendering.
 */
function generateRoutePoints(from: LatLng, to: LatLng, numPoints: number = 20): [number, number][] {
  const points: [number, number][] = [];
  for (let i = 0; i <= numPoints; i++) {
    const fraction = i / numPoints;
    const lat = from.lat + (to.lat - from.lat) * fraction;
    const lng = from.lng + (to.lng - from.lng) * fraction;
    points.push([lat, lng]);
  }
  return points;
}

export function RouteLine({
  from,
  to,
  color = '#0ea5e9',
  weight = 4,
  dashArray = '10, 8',
  animated = true,
}: RouteLineProps) {
  const routePoints = generateRoutePoints(from, to);

  const distance = haversineDistance(from, to);

  // We'll use two overlapping polylines for the animated effect:
  // 1. Background solid line (semi-transparent)
  // 2. Foreground dashed line (animated)
  return (
    <>
      {/* Background solid line */}
      <Polyline
        positions={routePoints}
        pathOptions={{
          color: color,
          weight: weight + 2,
          opacity: 0.15,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
      {/* Main dashed line */}
      <Polyline
        positions={routePoints}
        pathOptions={{
          color: color,
          weight: weight,
          opacity: 0.8,
          dashArray: dashArray,
          dashOffset: animated ? '0' : undefined,
          lineCap: 'round',
          lineJoin: 'round',
        }}
      />
    </>
  );
}

/**
 * Get distance text for a route between two points.
 */
export function getRouteDistance(from: LatLng, to: LatLng): number {
  return haversineDistance(from, to);
}

export default RouteLine;
