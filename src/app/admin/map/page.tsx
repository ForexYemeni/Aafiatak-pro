'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MapPin, AlertTriangle, Loader2, Navigation, Phone, Stethoscope } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { GlassCard } from '@/components/common/glass-card';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthFetch } from '@/hooks/use-auth';
import dynamic from 'next/dynamic';
import Link from 'next/link';

// Dynamically import map to avoid SSR issues with Leaflet
const TrackingMap = dynamic(
  () => import('@/components/maps/tracking-map').then(m => ({ default: m.TrackingMap })),
  { ssr: false, loading: () => <div className="h-[500px] bg-muted animate-pulse rounded-xl" /> }
);

interface EmergencyItem {
  id: string;
  beneficiaryName: string;
  beneficiaryPhone: string;
  lat: number;
  lng: number;
  status: string;
  createdAt: string;
  serviceName: string;
}

interface NurseItem {
  id: string;
  name: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  isOnline: boolean;
  isAvailable: boolean;
  specialization: string[];
}

export default function AdminMapPage() {
  const authFetch = useAuthFetch();
  const [emergencies, setEmergencies] = useState<EmergencyItem[]>([]);
  const [nurses, setNurses] = useState<NurseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [emergenciesRes, nursesRes] = await Promise.all([
        authFetch('/api/admin/emergencies?status=pending,assigned,in_progress'),
        authFetch('/api/admin/nurses?limit=100'),
      ]);

      const emergenciesData = await emergenciesRes.json();
      if (emergenciesData.success && emergenciesData.data) {
        const items = Array.isArray(emergenciesData.data) ? emergenciesData.data : emergenciesData.data.emergencies || [];
        setEmergencies(items.filter((e: any) => e.lat && e.lng));
      }

      const nursesData = await nursesRes.json();
      if (nursesData.success && nursesData.data) {
        const items = Array.isArray(nursesData.data) ? nursesData.data : nursesData.data.nurses || [];
        setNurses(items.filter((n: any) => n.lat && n.lng));
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Map data adapted for TrackingMap component
  const mapEmergencies = emergencies.map(e => ({
    id: e.id,
    position: { lat: e.lat, lng: e.lng },
    type: 'general_medical' as const,
    priority: 'high' as const,
    beneficiaryName: e.beneficiaryName,
    status: e.status as 'pending',
    createdAt: new Date(e.createdAt),
  }));

  const mapNurses = nurses.map(n => ({
    id: n.id,
    name: n.name,
    position: { lat: n.lat!, lng: n.lng! },
    isOnline: n.isOnline,
    isAvailable: n.isAvailable,
    heading: null as number | null,
    speed: null as number | null,
    lastUpdate: null as Date | null,
  }));

  return (
    <div className="space-y-4">
      <PageHeader title="الخريطة" description="موقع الممرضين وحالات الطوارئ" />

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard variant="admin" className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <AlertTriangle className="w-4 h-4 text-red-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-red-600">{emergencies.length}</p>
              <p className="text-[10px] text-muted-foreground">حالات طوارئ نشطة</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard variant="admin" className="p-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-blue-600" />
            </div>
            <div>
              <p className="text-lg font-bold text-blue-600">{nurses.length}</p>
              <p className="text-[10px] text-muted-foreground">ممرضين متاحين</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Map */}
      <GlassCard variant="admin" className="p-4 overflow-hidden">
        <div className="h-[500px] rounded-xl overflow-hidden">
          {isLoading ? (
            <div className="h-full flex items-center justify-center">
              <Loader2 className="w-8 h-8 text-admin animate-spin" />
            </div>
          ) : (
            <TrackingMap
              nurses={mapNurses}
              emergencies={mapEmergencies}
              center={{ lat: 15.3694, lng: 44.1910 }}
              zoom={12}
              showRoutes={false}
              showStats={false}
            />
          )}
        </div>
      </GlassCard>

      {/* Active Emergencies List */}
      {emergencies.length > 0 && (
        <GlassCard variant="admin" className="p-4">
          <h3 className="font-semibold text-sm mb-3 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-red-600" />
            حالات الطوارئ النشطة
          </h3>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {emergencies.map((emergency) => (
              <div key={emergency.id} className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/50">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-red-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium">{emergency.beneficiaryName}</p>
                    <p className="text-[10px] text-muted-foreground">{emergency.serviceName}</p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <a href={`tel:${emergency.beneficiaryPhone}`} className="p-2 rounded-lg hover:bg-muted">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                  </a>
                  <a
                    href={`https://www.google.com/maps?q=${emergency.lat},${emergency.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-2 rounded-lg hover:bg-muted"
                  >
                    <Navigation className="w-4 h-4 text-blue-600" />
                  </a>
                  <Link href="/admin/emergencies">
                    <Button size="sm" variant="destructive" className="h-8 text-xs">إدارة</Button>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}
