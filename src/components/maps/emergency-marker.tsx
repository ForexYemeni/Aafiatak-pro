'use client';

/**
 * Emergency Marker for عافيتك (Aafiatak) Healthcare Platform
 *
 * Red pulsing marker for emergencies with:
 * - Emergency type icon
 * - Alert animation
 * - Click to show emergency details
 */

import { useRef } from 'react';
import { Marker, Popup, useMap } from 'react-leaflet';
import { emergencyIcon } from '@/lib/utils/leaflet-icons';
import type { LatLng } from '@/lib/utils/location';

export type EmergencyType =
  | 'general_medical'
  | 'injury'
  | 'breathing'
  | 'heart'
  | 'fall'
  | 'other';

export interface EmergencyLocationData {
  id: string;
  position: LatLng;
  type: EmergencyType;
  priority: 'low' | 'medium' | 'high' | 'critical';
  description?: string;
  beneficiaryName?: string;
  beneficiaryPhone?: string;
  createdAt: Date;
  status: 'pending' | 'dispatched' | 'in_progress' | 'resolved' | 'cancelled';
  assignedNurseName?: string;
  estimatedArrival?: number; // minutes
}

interface EmergencyMarkerProps {
  emergency: EmergencyLocationData;
  onClick?: (emergency: EmergencyLocationData) => void;
}

function getEmergencyTypeInfo(type: EmergencyType): { icon: string; label: string; color: string } {
  switch (type) {
    case 'general_medical':
      return { icon: '🏥', label: 'طوارئ طبية عامة', color: '#ef4444' };
    case 'injury':
      return { icon: '🩸', label: 'إصابة', color: '#dc2626' };
    case 'breathing':
      return { icon: '🫁', label: 'مشكلة تنفس', color: '#f97316' };
    case 'heart':
      return { icon: '❤️‍🔥', label: 'مشكلة قلب', color: '#b91c1c' };
    case 'fall':
      return { icon: '⚠️', label: 'سقوط', color: '#ea580c' };
    case 'other':
      return { icon: '🚨', label: 'طوارئ أخرى', color: '#f59e0b' };
    default:
      return { icon: '🚨', label: 'طوارئ', color: '#ef4444' };
  }
}

function getPriorityLabel(priority: EmergencyLocationData['priority']): { label: string; color: string } {
  switch (priority) {
    case 'low':
      return { label: 'منخفضة', color: '#22c55e' };
    case 'medium':
      return { label: 'متوسطة', color: '#f59e0b' };
    case 'high':
      return { label: 'عالية', color: '#f97316' };
    case 'critical':
      return { label: 'حرجة', color: '#ef4444' };
    default:
      return { label: 'غير معروف', color: '#94a3b8' };
  }
}

function getEmergencyStatusLabel(status: EmergencyLocationData['status']): { label: string; color: string } {
  switch (status) {
    case 'pending':
      return { label: 'قيد الانتظار', color: '#ef4444' };
    case 'dispatched':
      return { label: 'تم الإرسال', color: '#f97316' };
    case 'in_progress':
      return { label: 'جاري التعامل', color: '#3b82f6' };
    case 'resolved':
      return { label: 'تم الحل', color: '#22c55e' };
    case 'cancelled':
      return { label: 'ملغي', color: '#94a3b8' };
    default:
      return { label: 'غير معروف', color: '#94a3b8' };
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - new Date(date).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'الآن';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  const diffHrs = Math.floor(diffMin / 60);
  return `منذ ${diffHrs} ساعة`;
}

export function EmergencyMarker({ emergency, onClick }: EmergencyMarkerProps) {
  const map = useMap();
  const markerRef = useRef(null);

  const typeInfo = getEmergencyTypeInfo(emergency.type);
  const priorityInfo = getPriorityLabel(emergency.priority);
  const statusInfo = getEmergencyStatusLabel(emergency.status);

  return (
    <Marker
      position={[emergency.position.lat, emergency.position.lng]}
      icon={emergencyIcon}
      ref={markerRef}
      eventHandlers={{
        click: () => {
          map.setView([emergency.position.lat, emergency.position.lng], 17, { animate: true });
          if (onClick) onClick(emergency);
        },
      }}
    >
      <Popup maxWidth={300} className="emergency-popup" direction="top">
        <div style={{ direction: 'rtl', textAlign: 'right', fontFamily: 'inherit', padding: '4px' }}>
          {/* Emergency Header */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            marginBottom: '8px',
            padding: '6px',
            background: '#fef2f2',
            borderRadius: '8px',
            border: '1px solid #fecaca',
          }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #ef4444, #dc2626)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '18px',
              flexShrink: 0,
            }}>
              {typeInfo.icon}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: '14px', color: '#991b1b' }}>
                {typeInfo.label}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                <span style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '8px',
                  background: `${priorityInfo.color}15`,
                  color: priorityInfo.color,
                  fontWeight: 600,
                }}>
                  أولوية: {priorityInfo.label}
                </span>
                <span style={{
                  fontSize: '10px',
                  padding: '1px 6px',
                  borderRadius: '8px',
                  background: `${statusInfo.color}15`,
                  color: statusInfo.color,
                  fontWeight: 500,
                }}>
                  {statusInfo.label}
                </span>
              </div>
            </div>
          </div>

          {/* Beneficiary Info */}
          {emergency.beneficiaryName && (
            <div style={{ fontSize: '12px', color: '#374151', marginBottom: '4px' }}>
              👤 {emergency.beneficiaryName}
            </div>
          )}

          {/* Description */}
          {emergency.description && (
            <div style={{
              fontSize: '12px',
              color: '#64748b',
              padding: '6px 8px',
              background: '#fff7ed',
              borderRadius: '6px',
              marginBottom: '6px',
            }}>
              📝 {emergency.description}
            </div>
          )}

          {/* Assigned Nurse */}
          {emergency.assignedNurseName && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '6px 8px',
              background: '#f0f9ff',
              borderRadius: '6px',
              marginBottom: '6px',
              fontSize: '12px',
            }}>
              🩺 الممرض: <strong>{emergency.assignedNurseName}</strong>
            </div>
          )}

          {/* ETA */}
          {emergency.estimatedArrival !== undefined && emergency.estimatedArrival > 0 && (
            <div style={{
              fontSize: '13px',
              fontWeight: 600,
              color: '#0ea5e9',
              marginBottom: '6px',
            }}>
              ⏱️ الوصول المتوقع: {emergency.estimatedArrival} دقيقة
            </div>
          )}

          {/* Time */}
          <div style={{
            fontSize: '10px',
            color: '#94a3b8',
            borderTop: '1px solid #fecaca',
            paddingTop: '4px',
          }}>
            ⏰ {formatRelativeTime(emergency.createdAt)}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

export default EmergencyMarker;
