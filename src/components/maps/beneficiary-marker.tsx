'use client';

/**
 * Beneficiary Location Marker for عافيتك (Aafiatak) Healthcare Platform
 *
 * Custom purple marker showing beneficiary location with:
 * - Name and address in popup
 * - Service request info
 */

import { useRef } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import { beneficiaryIcon } from '@/lib/utils/leaflet-icons';
import type { LatLng } from '@/lib/utils/location';

export interface BeneficiaryLocationData {
  id: string;
  name: string;
  position: LatLng;
  address?: string;
  phone?: string;
  serviceRequestId?: string;
  serviceName?: string;
  serviceStatus?: string;
  notes?: string;
}

interface BeneficiaryMarkerProps {
  beneficiary: BeneficiaryLocationData;
  onClick?: (beneficiary: BeneficiaryLocationData) => void;
}

function formatServiceStatus(status: string | undefined): { label: string; color: string } {
  switch (status) {
    case 'pending':
      return { label: 'قيد الانتظار', color: '#f59e0b' };
    case 'assigned':
      return { label: 'تم التعيين', color: '#3b82f6' };
    case 'in_progress':
      return { label: 'جاري التنفيذ', color: '#0ea5e9' };
    case 'completed':
      return { label: 'مكتمل', color: '#22c55e' };
    case 'cancelled':
      return { label: 'ملغي', color: '#ef4444' };
    default:
      return { label: 'غير معروف', color: '#94a3b8' };
  }
}

export function BeneficiaryMarker({ beneficiary, onClick }: BeneficiaryMarkerProps) {
  const map = useMap();
  const markerRef = useRef(null);

  const statusInfo = formatServiceStatus(beneficiary.serviceStatus);

  return (
    <Marker
      position={[beneficiary.position.lat, beneficiary.position.lng]}
      icon={beneficiaryIcon}
      ref={markerRef}
      eventHandlers={{
        click: () => {
          map.setView([beneficiary.position.lat, beneficiary.position.lng], 16, { animate: true });
          if (onClick) onClick(beneficiary);
        },
      }}
    >
      <Popup maxWidth={280} className="beneficiary-popup" direction="top">
        <div style={{ direction: 'rtl', textAlign: 'right', fontFamily: 'inherit', padding: '4px' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #a855f7, #9333ea)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: '16px',
              flexShrink: 0,
            }}>
              👤
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#1e293b' }}>
                {beneficiary.name}
              </div>
              {beneficiary.address && (
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                  📍 {beneficiary.address}
                </div>
              )}
            </div>
          </div>

          {/* Service Info */}
          {beneficiary.serviceName && (
            <div style={{
              padding: '8px',
              background: '#faf5ff',
              borderRadius: '8px',
              marginBottom: '6px',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#7c3aed', marginBottom: '4px' }}>
                {beneficiary.serviceName}
              </div>
              {beneficiary.serviceStatus && (
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '2px 8px',
                  borderRadius: '12px',
                  background: `${statusInfo.color}15`,
                  color: statusInfo.color,
                  fontSize: '11px',
                  fontWeight: 500,
                }}>
                  <div style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    background: statusInfo.color,
                  }} />
                  {statusInfo.label}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          {beneficiary.notes && (
            <div style={{
              fontSize: '11px',
              color: '#64748b',
              padding: '6px 8px',
              background: '#f8fafc',
              borderRadius: '6px',
              marginBottom: '6px',
            }}>
              📝 {beneficiary.notes}
            </div>
          )}

          {/* Coordinates */}
          <div style={{
            fontSize: '10px',
            color: '#94a3b8',
            borderTop: '1px solid #e2e8f0',
            paddingTop: '4px',
          }}>
            {beneficiary.position.lat.toFixed(4)}, {beneficiary.position.lng.toFixed(4)}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export default BeneficiaryMarker;
