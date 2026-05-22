'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight,
  MapPin,
  Phone,
  MessageCircle,
  Clock,
  Star,
  Navigation,
  Loader2,
  User,
  CheckCircle2,
  Shield,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { GlassCard } from '@/components/common/glass-card';
import { BadgeStatus } from '@/components/common/badge-status';
import { PullToRefresh } from '@/components/common/pull-to-refresh';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';

interface NurseInfo {
  name: string;
  rating: number;
  phone: string;
  specialization: string | null;
  isOnline: boolean;
}

interface LocationData {
  lat: number;
  lng: number;
  updatedAt: string | Date;
}

interface TrackingResponse {
  nurseId: string;
  nurseName: string;
  nursePhone: string | null;
  nurseRating: number;
  nurseAvatar: string | null;
  nurseSpecialization: string | null;
  isOnline: boolean;
  location: LocationData | null;
  orderId: string;
  orderStatus: string;
  eta: number | null;
  speed: number;
  batteryLevel: number | null;
}

const orderStatusLabel: Record<string, string> = {
  assigned: 'تم التعيين',
  accepted: 'تم القبول - في الطريق إليك',
  in_progress: 'جاري التنفيذ',
};

export default function TrackingPage() {
  const router = useRouter();
  const params = useParams();
  const nurseId = params.nurseId as string;
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();

  const [nurseInfo, setNurseInfo] = useState<NurseInfo | null>(null);
  const [trackingData, setTrackingData] = useState<TrackingResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTracking = useCallback(async () => {
    if (!token || !nurseId) return;
    try {
      const res = await fetch(`/api/beneficiary/tracking/${nurseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        const d: TrackingResponse = data.data;
        setTrackingData(d);
        setNurseInfo({
          name: d.nurseName || 'الممرض/ـة',
          rating: d.nurseRating || 0,
          phone: d.nursePhone || '',
          specialization: d.nurseSpecialization || null,
          isOnline: d.isOnline || false,
        });
        setError(null);
      } else {
        setError(data.message || 'لا يمكن تتبع الممرض حالياً');
      }
    } catch {
      setError('حدث خطأ في الاتصال');
    } finally {
      setIsLoading(false);
    }
  }, [token, nurseId]);

  useEffect(() => {
    fetchTracking();
  }, [fetchTracking]);

  // Real-time refresh via socket events (location/order changes)
  // Falls back to polling only when socket is disconnected
  useRealtimeRefresh({
    entities: ['location', 'order'],
    onRefresh: fetchTracking,
    fallbackInterval: 15000,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[80vh]">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="w-10 h-10 text-beneficiary animate-spin" />
          <p className="text-muted-foreground">جاري تحميل بيانات التتبع...</p>
        </div>
      </div>
    );
  }

  if (error || !trackingData) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[80vh] gap-4 px-4">
        <MapPin className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground text-center">{error || 'لا تتوفر بيانات تتبع'}</p>
        <Button variant="outline" onClick={() => router.back()}>
          العودة
        </Button>
      </div>
    );
  }

  return (
    <PullToRefresh onRefresh={fetchTracking} className="space-y-4 -m-4 md:-m-6 min-h-screen">
      {/* Full-screen Map Area */}
      <div className="relative w-full h-[50vh] bg-muted flex items-center justify-center">
        {/* Map placeholder */}
        <div className="absolute inset-0 bg-gradient-to-b from-beneficiary/5 to-beneficiary/10">
          {/* Grid pattern for map effect */}
          <div className="absolute inset-0 opacity-10">
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={`h-${i}`} className="absolute w-full border-t border-beneficiary/30" style={{ top: `${i * 5}%` }} />
            ))}
            {Array.from({ length: 20 }).map((_, i) => (
              <div key={`v-${i}`} className="absolute h-full border-r border-beneficiary/30" style={{ right: `${i * 5}%` }} />
            ))}
          </div>

          {/* Beneficiary Marker */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2">
            <motion.div
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-6 h-6 rounded-full bg-beneficiary border-4 border-white shadow-lg"
            />
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white dark:bg-card px-2 py-1 rounded-lg shadow-md text-xs font-medium">
              موقعك
            </div>
          </div>

          {/* Nurse Marker */}
          {trackingData.location && (
            <div
              className="absolute"
              style={{
                top: `${40 + (trackingData.location.lat % 1) * 20}%`,
                left: `${35 + (trackingData.location.lng % 1) * 30}%`,
              }}
            >
              <motion.div
                animate={{ y: [0, -6, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="relative"
              >
                <div className="w-10 h-10 rounded-full bg-green-500 border-4 border-white shadow-lg flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white dark:bg-card px-2 py-1 rounded-lg shadow-md text-xs font-medium">
                  {nurseInfo?.name ?? 'الممرض/ـة'}
                </div>
              </motion.div>
            </div>
          )}

          {/* ETA Badge */}
          {trackingData.eta !== null && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2">
              <div className="glass-strong rounded-2xl px-4 py-2 flex items-center gap-2 shadow-lg">
                <Clock className="w-4 h-4 text-beneficiary" />
                <span className="text-sm font-bold">الوصول خلال {trackingData.eta} دقيقة</span>
              </div>
            </div>
          )}

          {/* Order Status Badge */}
          <div className="absolute top-4 right-4">
            <div className="glass-strong rounded-2xl px-3 py-1.5 shadow-lg">
              <span className="text-xs font-semibold text-beneficiary">
                {orderStatusLabel[trackingData.orderStatus] || trackingData.orderStatus}
              </span>
            </div>
          </div>
        </div>

        {/* Back button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 glass-strong rounded-full"
          style={{ top: trackingData.orderStatus ? '4rem' : '1rem' }}
          onClick={() => router.back()}
        >
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Nurse Info Card */}
      {nurseInfo && (
        <div className="p-4 space-y-3">
          <GlassCard variant="beneficiary" className="space-y-4">
            {/* Nurse header */}
            <div className="flex items-center gap-4">
              <Avatar className="w-16 h-16">
                <AvatarFallback className="bg-beneficiary/10 text-beneficiary text-xl">
                  {nurseInfo.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg">{nurseInfo.name}</h3>
                  <div className={`w-2.5 h-2.5 rounded-full ${nurseInfo.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                  <span className={`text-xs ${nurseInfo.isOnline ? 'text-green-600' : 'text-muted-foreground'}`}>
                    {nurseInfo.isOnline ? 'متصل الآن' : 'غير متصل'}
                  </span>
                </div>
                {nurseInfo.specialization && (
                  <p className="text-sm text-muted-foreground mt-0.5">{nurseInfo.specialization}</p>
                )}
                {nurseInfo.rating > 0 && (
                  <div className="flex items-center gap-1 mt-1">
                    <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                    <span className="text-sm font-medium">{nurseInfo.rating.toFixed(1)}</span>
                    <Shield className="w-3.5 h-3.5 text-beneficiary mr-1" />
                    <span className="text-xs text-muted-foreground">ممرض معتمد</span>
                  </div>
                )}
              </div>
            </div>

            {/* Contact buttons */}
            <div className="flex gap-2">
              <Button
                className="flex-1 gap-2 bg-green-600 hover:bg-green-700 text-white"
                onClick={() => nurseInfo.phone && window.open(`tel:${nurseInfo.phone}`)}
                disabled={!nurseInfo.phone}
              >
                <Phone className="w-4 h-4" />
                اتصال {nurseInfo.phone && `(${nurseInfo.phone})`}
              </Button>
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => router.push(`/beneficiary/chat/${nurseId}`)}
              >
                <MessageCircle className="w-4 h-4" />
                محادثة
              </Button>
            </div>
          </GlassCard>

          {/* Tracking details */}
          <GlassCard variant="beneficiary" className="space-y-3">
            <h4 className="font-semibold text-sm flex items-center gap-2">
              <MapPin className="w-4 h-4 text-beneficiary" />
              تفاصيل التتبع
            </h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">حالة الطلب</span>
                <span className="font-medium text-beneficiary">
                  {orderStatusLabel[trackingData.orderStatus] || trackingData.orderStatus}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">حالة الممرض</span>
                <span className={`font-medium ${trackingData.isOnline ? 'text-green-600' : 'text-muted-foreground'}`}>
                  {trackingData.isOnline ? 'متصل ومتوجه إليك' : 'غير متصل حالياً'}
                </span>
              </div>
              {trackingData.location && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">آخر تحديث للموقع</span>
                  <span className="font-medium text-xs">
                    {new Date(trackingData.location.updatedAt).toLocaleTimeString('ar-YE', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                </div>
              )}
              {trackingData.eta !== null && (
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">الوقت المتوقع للوصول</span>
                  <span className="font-bold text-beneficiary">{trackingData.eta} دقيقة</span>
                </div>
              )}
              {!trackingData.location && (
                <div className="bg-yellow-50 dark:bg-yellow-950/20 rounded-lg p-3 text-center">
                  <MapPin className="w-5 h-5 text-yellow-600 mx-auto mb-1" />
                  <p className="text-xs text-yellow-700 dark:text-yellow-400">
                    لم يتم تحديث موقع الممرض بعد. سيظهر الموقع بمجرد تحديثه.
                  </p>
                </div>
              )}
            </div>
          </GlassCard>

          {/* Info note */}
          <div className="bg-beneficiary/5 rounded-xl p-3 flex items-start gap-2">
            <CheckCircle2 className="w-4 h-4 text-beneficiary mt-0.5 shrink-0" />
            <p className="text-xs text-muted-foreground">
              يتم تحديث الموقع تلقائياً في الوقت الفعلي. يمكنك الاتصال بالممرض مباشرة أو مراسلته عبر المحادثة.
            </p>
          </div>
        </div>
      )}
    </PullToRefresh>
  );
}
