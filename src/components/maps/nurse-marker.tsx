'use client';

/**
 * Nurse Location Marker for عافيتك (Aafiatak) Healthcare Platform
 *
 * Custom blue pulsing marker showing nurse location with:
 * - Nurse name in popup
 * - Online/offline status
 * - Direction indicator (heading)
 * - Speed indicator
 * - Last update time
 */

import { useEffect, useRef } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import { nurseIcon, createNurseHeadingIcon } from '@/lib/utils/leaflet-icons';
import { formatDistance, formatETA } from '@/lib/utils/location';
import type { LatLng } from '@/lib/utils/location';

export interface NurseLocationData {
  id: string;
  name: string;
  position: LatLng;
  isOnline: boolean;
  isAvailable: boolean;
  heading: number | null;
  speed: number | null; // km/h
  lastUpdate: Date | null;
  phone?: string;
  rating?: number;
  specializations?: string[];
}

interface NurseMarkerProps {
  nurse: NurseLocationData;
  destination?: LatLng | null;
  onClick?: (nurse: NurseLocationData) => void;
}

function formatRelativeTime(date: Date | null): string {
  if (!date) return 'غير معروف';
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'الآن';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  const diffHrs = Math.floor(diffMin / 60);
  return `منذ ${diffHrs} ساعة`;
}

export function NurseMarker({ nurse, destination, onClick }: NurseMarkerProps) {
  const map = useMap();
  const markerRef = useRef<L.Marker>(null);

  // Choose icon based on heading availability
  const icon = nurse.heading !== null
    ? createNurseHeadingIcon(nurse.heading)
    : nurseIcon;

  useEffect(() => {
    if (markerRef.current) {
      markerRef.current.openPopup();
    }
  }, []);

  const distanceToDestination = destination
    ? formatDistance(
        Math.sqrt(
          Math.pow(nurse.position.lat - destination.lat, 2) +
          Math.pow(nurse.position.lng - destination.lng, 2)
        ) * 111 // rough km per degree
      )
    : null;

  const etaToDestination = destination && nurse.speed && nurse.speed > 0
    ? formatETA(
        (Math.sqrt(
          Math.pow(nurse.position.lat - destination.lat, 2) +
          Math.pow(nurse.position.lng - destination.lng, 2)
        ) * 111) / nurse.speed * 60
      )
    : null;

  const handlePopupOpen = () => {
    if (onClick) onClick(nurse);
  };

  return (
    <Marker
      position={[nurse.position.lat, nurse.position.lng]}
      icon={icon}
      ref={markerRef}
      eventHandlers={{
        popupopen: handlePopupOpen,
        click: () => {
          map.setView([nurse.position.lat, nurse.position.lng], 16, { animate: true });
        },
      }}
    >
      <Popup maxWidth={280} className="nurse-popup" direction="top">
        <div style={{ direction: 'rtl', textAlign: 'right', fontFamily: 'inherit', padding: '4px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0ea5e9, #0284c7)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '16px',
              flexShrink: 0,
            }}>
              🩺
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
                {nurse.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                <div style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  background: nurse.isOnline ? '#22c55e' : '#94a3b8',
                  flexShrink: 0,
                }} />
                <span style={{
                  fontSize: '11px',
                  color: nurse.isOnline ? '#16a34a' : '#64748b',
                  fontWeight: 500,
                }}>
                  {nurse.isOnline
                    ? (nurse.isAvailable ? 'متاح الآن' : 'مشغول')
                    : 'غير متصل'}
                </span>
              </div>
            </div>
          </div>

          {/* Speed & Direction */}
          {(nurse.speed !== null && nurse.speed > 0) && (
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '6px',
              padding: '6px 8px',
              background: '#f0f9ff',
              borderRadius: '8px',
              fontSize: '12px',
            }}>
              <span>🏎️ {nurse.speed.toFixed(0)} كم/س</span>
              {nurse.heading !== null && (
                <span>🧭 {Math.round(nurse.heading)}°</span>
              )}
            </div>
          )}

          {/* Distance & ETA */}
          {distanceToDestination && (
            <div style={{
              display: 'flex',
              gap: '8px',
              marginBottom: '6px',
              padding: '6px 8px',
              background: '#f0f9ff',
              borderRadius: '8px',
              fontSize: '12px',
            }}>
              <span>📍 {distanceToDestination}</span>
              {etaToDestination && <span>⏱️ {etaToDestination}</span>}
            </div>
          )}

          {/* Rating */}
          {nurse.rating !== undefined && (
            <div style={{ fontSize: '12px', color: '#64748b', marginBottom: '4px' }}>
              ⭐ {nurse.rating.toFixed(1)}
            </div>
          )}

          {/* Last Update */}
          <div style={{ fontSize: '10px', color: '#94a3b8', borderTop: '1px solid #e2e8f0', paddingTop: '4px', marginTop: '4px' }}>
            آخر تحديث: {formatRelativeTime(nurse.lastUpdate)}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export default NurseMarker;
