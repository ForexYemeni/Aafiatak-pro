'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  MapPin,
  Navigation,
  Share2,
  ToggleLeft,
  Wifi,
  WifiOff,
  ExternalLink,
  Crosshair,
  Satellite,
  Radio,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { GlassCard } from '@/components/common/glass-card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthFetch } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { toArabicNum } from '@/components/common/date-formatter';

// ---- Types ----

interface NurseLocation {
  lat: number | null;
  lng: number | null;
  isOnline: boolean;
  isAvailable: boolean;
  locationUpdatedAt: string | null;
}

// ---- Component ----

export default function NurseTrackingPage() {
  const [location, setLocation] = useState<NurseLocation>({
    lat: null,
    lng: null,
    isOnline: false,
    isAvailable: false,
    locationUpdatedAt: null,
  });
  const [isSharing, setIsSharing] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [watchId, setWatchId] = useState<number | null>(null);
  const authFetch = useAuthFetch();
  const user = useAuthStore((s) => s.user);

  const updateLocation = useCallback(async (lat: number, lng: number) => {
    try {
      await authFetch('/api/nurse/location', {
        method: 'POST',
        body: JSON.stringify({ lat, lng }),
      });
      setLocation((prev) => ({
        ...prev,
        lat,
        lng,
        locationUpdatedAt: new Date().toISOString(),
      }));
    } catch {
      // silently handle
    }
  }, [authFetch]);

  const toggleLocationSharing = async () => {
    if (isSharing && watchId !== null) {
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      setIsSharing(false);
      return;
    }

    if (!navigator.geolocation) {
      return;
    }

    setIsUpdating(true);
    try {
      const id = navigator.geolocation.watchPosition(
        async (position) => {
          await updateLocation(position.coords.latitude, position.coords.longitude);
        },
        () => {},
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        }
      );
      setWatchId(id);
      setIsSharing(true);
    } catch {
      // silently handle
    } finally {
      setIsUpdating(false);
    }
  };

  const getCurrentPosition = () => {
    if (!navigator.geolocation) return;
    setIsUpdating(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        await updateLocation(position.coords.latitude, position.coords.longitude);
        setIsUpdating(false);
      },
      () => {
        setIsUpdating(false);
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  const openInGoogleMaps = () => {
    if (location.lat && location.lng) {
      window.open(`https://www.google.com/maps?q=${location.lat},${location.lng}`, '_blank');
    }
  };

  const openDirections = (destLat: number, destLng: number) => {
    if (location.lat && location.lng) {
      window.open(
        `https://www.google.com/maps/dir/${location.lat},${location.lng}/${destLat},${destLng}`,
        '_blank'
      );
    } else {
      window.open(`https://www.google.com/maps?q=${destLat},${destLng}`, '_blank');
    }
  };

  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  return (
    <div className="space-y-5">
      <PageHeader title="التتبع والموقع" description="مشاركة موقعك وتتبع المسارات" />

      {/* ══════════════ Location Sharing Status ══════════════ */}
      <GlassCard variant="nurse" className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div
              animate={isSharing ? { scale: [1, 1.1, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' as const }}
              className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                isSharing
                  ? 'bg-gradient-to-bl from-emerald-400 to-green-500 shadow-lg shadow-emerald-500/25'
                  : 'bg-muted'
              }`}
            >
              {isSharing ? (
                <Wifi className="w-6 h-6 text-white" />
              ) : (
                <WifiOff className="w-6 h-6 text-muted-foreground" />
              )}
            </motion.div>
            <div>
              <p className="font-bold text-sm">مشاركة الموقع</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isSharing ? 'يتم مشاركة موقعك حالياً' : 'مشاركة الموقع معطة'}
              </p>
            </div>
          </div>
          <Switch
            checked={isSharing}
            onCheckedChange={toggleLocationSharing}
            disabled={isUpdating}
            className="data-[state=checked]:bg-emerald-600"
          />
        </div>

        {location.lat && location.lng && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="p-4 rounded-2xl bg-muted/30 text-sm space-y-2.5 border border-border/50"
          >
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">خط العرض</span>
              <span className="font-mono text-xs font-bold bg-muted px-2 py-0.5 rounded-lg">{location.lat.toFixed(6)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground font-medium">خط الطول</span>
              <span className="font-mono text-xs font-bold bg-muted px-2 py-0.5 rounded-lg">{location.lng.toFixed(6)}</span>
            </div>
            {location.locationUpdatedAt && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground font-medium">آخر تحديث</span>
                <span className="text-xs font-bold">
                  {new Date(location.locationUpdatedAt).toLocaleTimeString('ar')}
                </span>
              </div>
            )}
          </motion.div>
        )}
      </GlassCard>

      {/* ══════════════ Map Preview ══════════════ */}
      <GlassCard variant="nurse" className="p-0 overflow-hidden">
        <div className="relative h-72 bg-muted flex items-center justify-center">
          {location.lat && location.lng ? (
            <>
              <img
                src={`https://maps.googleapis.com/maps/api/staticmap?center=${location.lat},${location.lng}&zoom=15&size=600x300&maptype=roadmap&markers=color:blue%7C${location.lat},${location.lng}&key=`}
                alt="خريطة الموقع"
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              {/* Fallback Map Display */}
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-sky-50/90 to-blue-100/90 dark:from-sky-950/80 dark:to-blue-900/70">
                <div className="text-center">
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' as const }}
                    className="w-20 h-20 rounded-full bg-gradient-to-bl from-nurse to-sky-400 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-nurse/30"
                  >
                    <MapPin className="w-10 h-10 text-white" />
                  </motion.div>
                  <p className="text-sm font-black">موقعك الحالي</p>
                  <p className="text-xs text-muted-foreground mt-1 font-mono">
                    {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </p>
                </div>
              </div>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Crosshair className="w-10 h-10 text-nurse/30" />
              </div>
            </>
          ) : (
            <div className="text-center">
              <motion.div
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' as const }}
              >
                <Satellite className="w-16 h-16 text-muted-foreground/50 mx-auto mb-3" />
              </motion.div>
              <p className="text-sm font-bold text-muted-foreground">لم يتم تحديد الموقع بعد</p>
              <p className="text-xs text-muted-foreground/70 mt-1">فعّل مشاركة الموقع لعرض خريطتك</p>
            </div>
          )}
        </div>
      </GlassCard>

      {/* ══════════════ Action Buttons ══════════════ */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button
            variant="outline"
            className="h-12 gap-2 w-full rounded-xl font-bold"
            onClick={getCurrentPosition}
            disabled={isUpdating}
          >
            <Crosshair className="w-4 h-4" />
            تحديد موقعي
          </Button>
        </motion.div>
        <motion.div whileTap={{ scale: 0.97 }}>
          <Button
            variant="outline"
            className="h-12 gap-2 w-full rounded-xl font-bold"
            onClick={openInGoogleMaps}
            disabled={!location.lat || !location.lng}
          >
            <ExternalLink className="w-4 h-4" />
            فتح الخريطة
          </Button>
        </motion.div>
      </div>

      {/* ══════════════ Navigation to Beneficiary ══════════════ */}
      <GlassCard variant="nurse" className="p-5">
        <div className="flex items-center gap-2 mb-3">
          <Navigation className="w-4 h-4 text-nurse" />
          <h3 className="font-bold text-sm">التنقل لموقع المستفيد</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-4 leading-relaxed">
          افتح اتجاهات Google Maps للوصول إلى موقع المستفيد
        </p>
        <Button
          className="w-full bg-gradient-to-l from-nurse to-sky-500 hover:from-sky-600 hover:to-sky-600 gap-2 shadow-lg shadow-nurse/25 rounded-xl h-12 font-bold"
          onClick={() => {
            openDirections(15.3694, 44.1910);
          }}
        >
          <Navigation className="w-4 h-4" />
          فتح الاتجاهات
        </Button>
      </GlassCard>

      {/* ══════════════ Status Info ══════════════ */}
      <GlassCard variant="nurse" className="p-5">
        <div className="flex items-center gap-2 mb-4">
          <Radio className="w-4 h-4 text-nurse" />
          <h3 className="font-bold text-sm">معلومات الحالة</h3>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">حالة الاتصال</span>
            <Badge variant={isSharing ? 'default' : 'secondary'} className={`text-[10px] font-bold ${isSharing ? 'bg-emerald-500' : ''}`}>
              {isSharing ? 'متصل' : 'غير متصل'}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">دقة الموقع</span>
            <span className="text-xs font-bold">عالية</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground font-medium">معدل التحديث</span>
            <span className="text-xs font-bold">كل {toArabicNum(30)} ثانية</span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
