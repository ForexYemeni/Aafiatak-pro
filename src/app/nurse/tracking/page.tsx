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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { GlassCard } from '@/components/common/glass-card';
import { Badge } from '@/components/ui/badge';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthFetch } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';

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

  // Get current position
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

  // Start/Stop location sharing
  const toggleLocationSharing = async () => {
    if (isSharing && watchId !== null) {
      // Stop sharing
      navigator.geolocation.clearWatch(watchId);
      setWatchId(null);
      setIsSharing(false);
      return;
    }

    // Start sharing
    if (!navigator.geolocation) {
      return;
    }

    setIsUpdating(true);
    try {
      const id = navigator.geolocation.watchPosition(
        async (position) => {
          await updateLocation(position.coords.latitude, position.coords.longitude);
        },
        () => {
          // Error getting location
        },
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

  // Get current position once
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

  // Open in Google Maps
  const openInGoogleMaps = () => {
    if (location.lat && location.lng) {
      window.open(`https://www.google.com/maps?q=${location.lat},${location.lng}`, '_blank');
    }
  };

  // Open directions
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

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchId !== null) {
        navigator.geolocation.clearWatch(watchId);
      }
    };
  }, [watchId]);

  return (
    <div className="space-y-4">
      <PageHeader title="التتبع والموقع" description="مشاركة موقعك وتتبع المسارات" />

      {/* Location Sharing Toggle */}
      <GlassCard variant="nurse" className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            {isSharing ? (
              <Wifi className="w-6 h-6 text-green-500" />
            ) : (
              <WifiOff className="w-6 h-6 text-muted-foreground" />
            )}
            <div>
              <p className="font-semibold text-sm">مشاركة الموقع</p>
              <p className="text-xs text-muted-foreground">
                {isSharing ? 'يتم مشاركة موقعك حالياً' : 'مشاركة الموقع معطة'}
              </p>
            </div>
          </div>
          <Switch
            checked={isSharing}
            onCheckedChange={toggleLocationSharing}
            disabled={isUpdating}
            className="data-[state=checked]:bg-green-600"
          />
        </div>

        {location.lat && location.lng && (
          <div className="p-3 rounded-xl bg-muted/50 text-sm space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">خط العرض</span>
              <span className="font-mono text-xs">{location.lat.toFixed(6)}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">خط الطول</span>
              <span className="font-mono text-xs">{location.lng.toFixed(6)}</span>
            </div>
            {location.locationUpdatedAt && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground">آخر تحديث</span>
                <span className="text-xs">
                  {new Date(location.locationUpdatedAt).toLocaleTimeString('ar')}
                </span>
              </div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Map Preview */}
      <GlassCard variant="nurse" className="p-0 overflow-hidden">
        <div className="relative h-72 bg-muted flex items-center justify-center">
          {location.lat && location.lng ? (
            <>
              {/* Static map image from Google Maps */}
              <img
                src={`https://maps.googleapis.com/maps/api/staticmap?center=${location.lat},${location.lng}&zoom=15&size=600x300&maptype=roadmap&markers=color:blue%7C${location.lat},${location.lng}&key=`}
                alt="خريطة الموقع"
                className="w-full h-full object-cover"
                onError={(e) => {
                  // Fallback if map doesn't load
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
              {/* Fallback Map Display */}
              <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-b from-sky-50 to-blue-100 dark:from-sky-950/30 dark:to-blue-900/20">
                <div className="text-center">
                  <div className="w-16 h-16 rounded-full bg-nurse/20 flex items-center justify-center mx-auto mb-3">
                    <MapPin className="w-8 h-8 text-nurse" />
                  </div>
                  <p className="text-sm font-medium">موقعك الحالي</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                  </p>
                </div>
              </div>

              {/* Crosshair */}
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <Crosshair className="w-8 h-8 text-nurse/50" />
              </div>
            </>
          ) : (
            <div className="text-center">
              <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">لم يتم تحديد الموقع بعد</p>
              <p className="text-xs text-muted-foreground mt-1">فعّل مشاركة الموقع لعرض خريطتك</p>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          className="h-12 gap-2"
          onClick={getCurrentPosition}
          disabled={isUpdating}
        >
          <Crosshair className="w-4 h-4" />
          تحديد موقعي
        </Button>

        <Button
          variant="outline"
          className="h-12 gap-2"
          onClick={openInGoogleMaps}
          disabled={!location.lat || !location.lng}
        >
          <ExternalLink className="w-4 h-4" />
          فتح الخريطة
        </Button>
      </div>

      {/* Navigation to Beneficiary */}
      <GlassCard variant="nurse" className="p-4">
        <h3 className="font-semibold text-sm mb-3">التنقل لموقع المستفيد</h3>
        <p className="text-xs text-muted-foreground mb-3">
          افتح اتجاهات Google Maps للوصول إلى موقع المستفيد
        </p>
        <Button
          className="w-full bg-nurse hover:bg-nurse/90 gap-2"
          onClick={() => {
            // Default coordinates for Yemen (Sanaa)
            openDirections(15.3694, 44.1910);
          }}
        >
          <Navigation className="w-4 h-4" />
          فتح الاتجاهات
        </Button>
      </GlassCard>

      {/* Status Info */}
      <GlassCard variant="nurse" className="p-4">
        <h3 className="font-semibold text-sm mb-3">معلومات الحالة</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">حالة الاتصال</span>
            <Badge variant={isSharing ? 'default' : 'secondary'} className="text-[10px]">
              {isSharing ? 'متصل' : 'غير متصل'}
            </Badge>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">دقة الموقع</span>
            <span className="text-xs">عالية</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">معدل التحديث</span>
            <span className="text-xs">كل ٣٠ ثانية</span>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}
