'use client';

/**
 * Tracking Map Component for عافيتك (Aafiatak) Healthcare Platform
 *
 * Main map component using react-leaflet with OpenStreetMap tiles.
 * Features:
 * - Default center: Sana'a, Yemen (15.3694, 44.1910)
 * - RTL support
 * - Custom markers for nurse, beneficiary, emergency
 * - Real-time location updates
 * - Route line between nurse and beneficiary
 * - Auto-fit bounds to show all markers
 * - Zoom controls
 * - Loading and error states
 */

import { useEffect, useState, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { Loader2, MapPin, AlertTriangle, RefreshCw, Navigation, Expand, Shrink } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistance, formatETA, haversineDistance, DEFAULT_LOCATION } from '@/lib/utils/location';
import type { LatLng } from '@/lib/utils/location';
import type { NurseLocationData } from '@/components/maps/nurse-marker';
import type { BeneficiaryLocationData } from '@/components/maps/beneficiary-marker';
import type { EmergencyLocationData } from '@/components/maps/emergency-marker';

// ============================================================================
// Auto-Fit Bounds Inner Component
// ============================================================================

function FitBoundsOnLoad({ positions }: { positions: LatLng[] }) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { useMap } = require('react-leaflet') as { useMap: () => LMap };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const L = require('leaflet') as typeof import('leaflet');
  const map = useMap();

  useEffect(() => {
    if (positions.length > 0) {
      const bounds = L.latLngBounds(positions.map(p => [p.lat, p.lng] as [number, number]));
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    }
  }, [positions, map, L]);

  return null;
}

type LMap = L.Map;

// ============================================================================
// Map Inner Component (must be child of MapContainer)
// ============================================================================

function MapInner({
  nurses,
  beneficiaries,
  emergencies,
  showRoutes,
  autoFit,
}: {
  nurses: NurseLocationData[];
  beneficiaries: BeneficiaryLocationData[];
  emergencies: EmergencyLocationData[];
  showRoutes: boolean;
  autoFit: boolean;
}) {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TileLayer, Marker, Popup, Polyline } = require('react-leaflet') as {
    TileLayer: React.ComponentType<{ attribution: string; url: string }>;
    Marker: React.ComponentType<{ position: [number, number]; icon: L.Icon<L.IconOptions>; eventHandlers?: Record<string, () => void> }>;
    Popup: React.ComponentType<{ maxWidth: number; className: string; direction: string; children: React.ReactNode }>;
    Polyline: React.ComponentType<{ positions: [number, number][]; pathOptions: Record<string, unknown> }>;
  };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { nurseIcon, beneficiaryIcon, emergencyIcon } = require('@/lib/utils/leaflet-icons') as {
    nurseIcon: L.Icon<L.IconOptions>;
    beneficiaryIcon: L.Icon<L.IconOptions>;
    emergencyIcon: L.Icon<L.IconOptions>;
  };

  const allPositions: LatLng[] = useMemo(() => {
    const positions: LatLng[] = [];
    nurses.forEach(n => positions.push(n.position));
    beneficiaries.forEach(b => positions.push(b.position));
    emergencies.forEach(e => positions.push(e.position));
    return positions;
  }, [nurses, beneficiaries, emergencies]);

  // Generate route points
  const routeLines = useMemo(() => {
    if (!showRoutes) return [];
    const lines: { from: LatLng; to: LatLng; key: string }[] = [];
    nurses.forEach(nurse => {
      beneficiaries.forEach(beneficiary => {
        lines.push({
          from: nurse.position,
          to: beneficiary.position,
          key: `route-${nurse.id}-${beneficiary.id}`,
        });
      });
    });
    return lines;
  }, [nurses, beneficiaries, showRoutes]);

  function generateRoutePoints(from: LatLng, to: LatLng): [number, number][] {
    const points: [number, number][] = [];
    const numPoints = 20;
    for (let i = 0; i <= numPoints; i++) {
      const fraction = i / numPoints;
      const lat = from.lat + (to.lat - from.lat) * fraction;
      const lng = from.lng + (to.lng - from.lng) * fraction;
      points.push([lat, lng]);
    }
    return points;
  }

  return (
    <>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {/* Nurse Markers */}
      {nurses.map((nurse: NurseLocationData) => (
        <Marker
          key={nurse.id}
          position={[nurse.position.lat, nurse.position.lng]}
          icon={nurseIcon}
        >
          <Popup maxWidth={280} className="nurse-popup" direction="top">
            <div style={{ direction: 'rtl', textAlign: 'right', fontFamily: 'inherit', padding: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '16px', flexShrink: 0,
                }}>🩺</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>{nurse.name}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: nurse.isOnline ? '#22c55e' : '#94a3b8', flexShrink: 0,
                    }} />
                    <span style={{ fontSize: '11px', color: nurse.isOnline ? '#16a34a' : '#64748b', fontWeight: 500 }}>
                      {nurse.isOnline ? (nurse.isAvailable ? 'متاح الآن' : 'مشغول') : 'غير متصل'}
                    </span>
                  </div>
                </div>
              </div>
              {nurse.speed !== null && nurse.speed > 0 && (
                <div style={{ display: 'flex', gap: '8px', marginBottom: '6px', padding: '6px 8px', background: '#f0f9ff', borderRadius: '8px', fontSize: '12px' }}>
                  <span>🏎️ {nurse.speed.toFixed(0)} كم/س</span>
                  {nurse.heading !== null && <span>🧭 {Math.round(nurse.heading)}°</span>}
                </div>
              )}
              {nurse.rating !== undefined && (
                <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>⭐ {nurse.rating.toFixed(1)}</div>
              )}
              <div style={{ fontSize: '10px', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: '4px', marginTop: '4px' }}>
                آخر تحديث: {nurse.lastUpdate ? new Date(nurse.lastUpdate).toLocaleTimeString('ar') : 'غير معروف'}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Beneficiary Markers */}
      {beneficiaries.map((beneficiary: BeneficiaryLocationData) => (
        <Marker
          key={beneficiary.id}
          position={[beneficiary.position.lat, beneficiary.position.lng]}
          icon={beneficiaryIcon}
        >
          <Popup maxWidth={280} className="beneficiary-popup" direction="top">
            <div style={{ direction: 'rtl', textAlign: 'right', fontFamily: 'inherit', padding: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #a855f7, #9333ea)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: 'white', fontSize: '16px', flexShrink: 0,
                }}>👤</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>{beneficiary.name}</div>
                  {beneficiary.address && (
                    <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>📍 {beneficiary.address}</div>
                  )}
                </div>
              </div>
              {beneficiary.serviceName && (
                <div style={{ padding: '8px', background: '#faf5ff', borderRadius: '8px', marginBottom: '6px' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#7c3aed' }}>{beneficiary.serviceName}</div>
                </div>
              )}
              <div style={{ fontSize: '10px', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: '4px' }}>
                {beneficiary.position.lat.toFixed(4)}, {beneficiary.position.lng.toFixed(4)}
              </div>
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Emergency Markers */}
      {emergencies.map((emergency: EmergencyLocationData) => (
        <Marker
          key={emergency.id}
          position={[emergency.position.lat, emergency.position.lng]}
          icon={emergencyIcon}
        >
          <Popup maxWidth={300} className="emergency-popup" direction="top">
            <div style={{ direction: 'rtl', textAlign: 'right', fontFamily: 'inherit', padding: '4px' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px',
                padding: '6px', background: '#fef2f2', borderRadius: '8px', border: '1px solid #fecaca',
              }}>
                <div style={{
                  width: '36px', height: '36px', borderRadius: '50%',
                  background: 'linear-gradient(135deg, #ef4444, #dc2626)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '18px', flexShrink: 0,
                }}>🚨</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: '14px', color: '#991b1b' }}>
                    حالة طوارئ
                  </div>
                  <div style={{ fontSize: '11px', color: '#dc2626', fontWeight: 500 }}>
                    أولوية: {emergency.priority === 'critical' ? 'حرجة' : emergency.priority === 'high' ? 'عالية' : emergency.priority === 'medium' ? 'متوسطة' : 'منخفضة'}
                  </div>
                </div>
              </div>
              {emergency.description && (
                <div style={{ fontSize: '12px', color: '#64748b', padding: '6px 8px', background: '#fff7ed', borderRadius: '6px', marginBottom: '6px' }}>
                  📝 {emergency.description}
                </div>
              )}
              {emergency.assignedNurseName && (
                <div style={{ fontSize: '12px', padding: '6px 8px', background: '#f0f9ff', borderRadius: '6px', marginBottom: '6px' }}>
                  🩺 الممرض: <strong>{emergency.assignedNurseName}</strong>
                </div>
              )}
              {emergency.estimatedArrival !== undefined && emergency.estimatedArrival > 0 && (
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#0ea5e9', marginBottom: '6px' }}>
                  ⏱️ الوصول المتوقع: {emergency.estimatedArrival} دقيقة
                </div>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Route Lines */}
      {routeLines.map(route => (
        <div key={route.key}>
          <Polyline
            positions={generateRoutePoints(route.from, route.to)}
            pathOptions={{
              color: '#0ea5e9',
              weight: 6,
              opacity: 0.15,
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
          <Polyline
            positions={generateRoutePoints(route.from, route.to)}
            pathOptions={{
              color: '#0ea5e9',
              weight: 4,
              opacity: 0.8,
              dashArray: '10, 8',
              lineCap: 'round',
              lineJoin: 'round',
            }}
          />
        </div>
      ))}

      {/* Auto-fit bounds */}
      {autoFit && allPositions.length > 0 && <FitBoundsOnLoad positions={allPositions} />}
    </>
  );
}

// ============================================================================
// Map Stats Overlay
// ============================================================================

interface MapStatsProps {
  nurses: NurseLocationData[];
  beneficiaries: BeneficiaryLocationData[];
  emergencies: EmergencyLocationData[];
}

function MapStatsOverlay({ nurses, beneficiaries, emergencies }: MapStatsProps) {
  const distanceInfo = useMemo(() => {
    if (nurses.length > 0 && beneficiaries.length > 0) {
      const dist = haversineDistance(nurses[0].position, beneficiaries[0].position);
      const speed = nurses[0].speed ?? 40;
      const etaMinutes = (dist / speed) * 60;
      return {
        distance: formatDistance(dist),
        eta: formatETA(etaMinutes),
      };
    }
    return null;
  }, [nurses, beneficiaries]);

  if (!distanceInfo) return null;

  return (
    <div className="absolute bottom-4 left-4 right-4 z-[1000] pointer-events-none">
      <div className="glass-strong rounded-xl p-3 flex items-center justify-around max-w-sm mx-auto">
        <div className="text-center">
          <div className="text-xs text-muted-foreground">المسافة</div>
          <div className="text-sm font-bold text-nurse">{distanceInfo.distance}</div>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="text-center">
          <div className="text-xs text-muted-foreground">الوصول المتوقع</div>
          <div className="text-sm font-bold text-nurse">{distanceInfo.eta}</div>
        </div>
        <div className="w-px h-8 bg-border" />
        <div className="text-center">
          <div className="text-xs text-muted-foreground">الممرضون</div>
          <div className="text-sm font-bold text-nurse">{nurses.filter(n => n.isOnline).length}/{nurses.length}</div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Legend Component
// ============================================================================

function MapLegend() {
  return (
    <div className="absolute top-4 left-4 z-[1000]">
      <div className="glass-strong rounded-xl p-3 space-y-2">
        <div className="text-xs font-semibold text-foreground mb-1">دليل الخريطة</div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-sky-500" />
          <span className="text-xs text-muted-foreground">ممرض</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-purple-500" />
          <span className="text-xs text-muted-foreground">مستفيد</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
          <span className="text-xs text-muted-foreground">طوارئ</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-6 h-0.5 border-t-2 border-dashed border-sky-500" />
          <span className="text-xs text-muted-foreground">المسار</span>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Main TrackingMap Component
// ============================================================================

export interface TrackingMapProps {
  nurses?: NurseLocationData[];
  beneficiaries?: BeneficiaryLocationData[];
  emergencies?: EmergencyLocationData[];
  center?: LatLng;
  zoom?: number;
  showRoutes?: boolean;
  autoFit?: boolean;
  showLegend?: boolean;
  showStats?: boolean;
  className?: string;
  onMarkerClick?: (type: 'nurse' | 'beneficiary' | 'emergency', id: string) => void;
}

export function TrackingMap({
  nurses = [],
  beneficiaries = [],
  emergencies = [],
  center = DEFAULT_LOCATION,
  zoom = 13,
  showRoutes = true,
  autoFit = true,
  showLegend = true,
  showStats = true,
  className,
}: TrackingMapProps) {
  const [isClient, setIsClient] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [MapContainerComponent, setMapContainerComponent] = useState<React.ComponentType<Record<string, unknown>> | null>(null);

  // Ensure client-side only
  useEffect(() => {
    setIsClient(true);

    // Load Leaflet and icon fix
    Promise.all([
      import('react-leaflet'),
      import('@/lib/utils/leaflet-icons'),
    ])
      .then(([leafletMod]) => {
        // Set the MapContainer component
        setMapContainerComponent(() => leafletMod.MapContainer as React.ComponentType<Record<string, unknown>>);
        setMapReady(true);
      })
      .catch(() => {
        setMapError('فشل في تحميل مكتبة الخرائط');
      });
  }, []);

  const toggleFullscreen = useCallback(() => {
    setIsFullscreen(prev => !prev);
  }, []);

  // Error state
  if (mapError) {
    return (
      <div className={cn('flex items-center justify-center bg-muted/30 rounded-xl', className)} style={{ minHeight: '400px' }}>
        <div className="text-center p-6">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-3" />
          <h3 className="font-semibold text-lg mb-1">خطأ في تحميل الخريطة</h3>
          <p className="text-sm text-muted-foreground">{mapError}</p>
          <button
            type="button"
            onClick={() => {
              setMapError(null);
              setMapReady(false);
              setTimeout(() => window.location.reload(), 100);
            }}
            className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className="w-4 h-4 inline ml-1" />
            إعادة المحاولة
          </button>
        </div>
      </div>
    );
  }

  // Loading state
  if (!isClient || !mapReady || !MapContainerComponent) {
    return (
      <div className={cn('flex items-center justify-center bg-muted/30 rounded-xl', className)} style={{ minHeight: '400px' }}>
        <div className="text-center p-6">
          <Loader2 className="w-10 h-10 text-nurse animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">جاري تحميل الخريطة...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden',
        isFullscreen && 'fixed inset-0 z-50 rounded-none',
        className
      )}
      style={{ minHeight: isFullscreen ? '100vh' : '400px' }}
    >
      {/* Fullscreen toggle button */}
      <button
        type="button"
        onClick={toggleFullscreen}
        className="absolute top-4 right-4 z-[1000] glass-strong rounded-lg p-2 hover:bg-muted/50 transition-colors"
        aria-label={isFullscreen ? 'تصغير الخريطة' : 'تكبير الخريطة'}
      >
        {isFullscreen ? (
          <Shrink className="w-5 h-5 text-foreground" />
        ) : (
          <Expand className="w-5 h-5 text-foreground" />
        )}
      </button>

      {/* Location indicator */}
      <div className="absolute top-4 right-16 z-[1000]">
        <div className="glass-strong rounded-lg px-3 py-1.5 flex items-center gap-2">
          <MapPin className="w-3.5 h-3.5 text-nurse" />
          <span className="text-xs font-medium text-foreground">
            {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
          </span>
        </div>
      </div>

      {/* Legend */}
      {showLegend && <MapLegend />}

      {/* The Leaflet Map */}
      <MapContainerComponent
        center={[center.lat, center.lng]}
        zoom={zoom}
        scrollWheelZoom={true}
        zoomControl={true}
        attributionControl={true}
        style={{ width: '100%', height: isFullscreen ? '100vh' : '100%', minHeight: '400px' }}
        className="leaflet-map"
        dir="rtl"
      >
        <MapInner
          nurses={nurses}
          beneficiaries={beneficiaries}
          emergencies={emergencies}
          showRoutes={showRoutes}
          autoFit={autoFit}
        />
      </MapContainerComponent>

      {/* Stats overlay */}
      {showStats && <MapStatsOverlay nurses={nurses} beneficiaries={beneficiaries} emergencies={emergencies} />}

      {/* Emergency count badge */}
      {emergencies.length > 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[1000]">
          <div className="bg-red-500 text-white px-3 py-1.5 rounded-full text-xs font-bold flex items-center gap-1.5 animate-pulse shadow-lg shadow-red-500/30">
            <Navigation className="w-3.5 h-3.5" />
            {emergencies.length} حالة طوارئ نشطة
          </div>
        </div>
      )}
    </div>
  );
}

export default TrackingMap;
