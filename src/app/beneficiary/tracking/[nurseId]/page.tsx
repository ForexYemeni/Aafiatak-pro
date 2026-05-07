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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { GlassCard } from '@/components/common/glass-card';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import type { ApiResponse, TrackingData } from '@/types';

export default function TrackingPage() {
  const router = useRouter();
  const params = useParams();
  const nurseId = params.nurseId as string;
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();

  const [nurseData, setNurseData] = useState<{
    name: string;
    rating: number;
    phone: string;
    avatar: string | null;
    isOnline: boolean;
  } | null>(null);
  const [trackingData, setTrackingData] = useState<TrackingData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [eta, setEta] = useState<number | null>(null);

  const fetchTracking = useCallback(async () => {
    if (!token || !nurseId) return;
    try {
      const res = await fetch(`/api/beneficiary/tracking/${nurseId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<TrackingData & {
        nurseName?: string;
        nurseRating?: number;
        nursePhone?: string;
        nurseAvatar?: string;
        isOnline?: boolean;
        eta?: number;
      }> = await res.json();
      if (data.success && data.data) {
        setTrackingData(data.data);
        setNurseData({
          name: data.data.nurseName ?? 'الممرض/ـة',
          rating: data.data.nurseRating ?? 0,
          phone: data.data.nursePhone ?? '',
          avatar: data.data.nurseAvatar ?? null,
          isOnline: data.data.isOnline ?? false,
        });
        setEta(data.data.eta ?? null);
      }
    } catch {
      // Error handled silently
    } finally {
      setIsLoading(false);
    }
  }, [token, nurseId]);

  useEffect(() => {
    fetchTracking();
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchTracking, 5000);
    return () => clearInterval(interval);
  }, [fetchTracking]);

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

  return (
    <div className="space-y-4 -m-4 md:-m-6">
      {/* Full-screen Map Area */}
      <div className="relative w-full h-[60vh] bg-muted flex items-center justify-center">
        {/* Map placeholder - in production this would be a real map */}
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
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-6 h-6 rounded-full bg-beneficiary border-4 border-white shadow-lg"
            />
            <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white dark:bg-card px-2 py-1 rounded-lg shadow-md text-xs font-medium">
              موقعك
            </div>
          </div>

          {/* Nurse Marker */}
          {trackingData?.location && (
            <div
              className="absolute"
              style={{
                top: `${40 + Math.random() * 20}%`,
                left: `${35 + Math.random() * 30}%`,
              }}
            >
              <motion.div
                animate={{ y: [0, -5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="relative"
              >
                <div className="w-10 h-10 rounded-full bg-green-500 border-4 border-white shadow-lg flex items-center justify-center">
                  <Navigation className="w-5 h-5 text-white" />
                </div>
                <div className="absolute -bottom-8 left-1/2 -translate-x-1/2 whitespace-nowrap bg-white dark:bg-card px-2 py-1 rounded-lg shadow-md text-xs font-medium">
                  {nurseData?.name ?? 'الممرض/ـة'}
                </div>
              </motion.div>
            </div>
          )}

          {/* ETA Badge */}
          {eta !== null && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2">
              <div className="glass-strong rounded-2xl px-4 py-2 flex items-center gap-2 shadow-lg">
                <Clock className="w-4 h-4 text-beneficiary" />
                <span className="text-sm font-bold">الوصول خلال {eta} دقيقة</span>
              </div>
            </div>
          )}
        </div>

        {/* Back button */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute top-4 right-4 glass-strong rounded-full"
          onClick={() => router.back()}
        >
          <ArrowRight className="w-5 h-5" />
        </Button>
      </div>

      {/* Nurse Info Overlay */}
      {nurseData && (
        <div className="p-4">
          <GlassCard variant="beneficiary" className="space-y-4">
            <div className="flex items-center gap-4">
              <Avatar className="w-14 h-14">
                <AvatarFallback className="bg-beneficiary/10 text-beneficiary text-lg">
                  {nurseData.name.slice(0, 2)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-lg">{nurseData.name}</h3>
                  <div className={`w-2.5 h-2.5 rounded-full ${nurseData.isOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                </div>
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                  <span className="text-sm font-medium">{nurseData.rating.toFixed(1)}</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => nurseData.phone && window.open(`tel:${nurseData.phone}`)}
                disabled={!nurseData.phone}
              >
                <Phone className="w-4 h-4" />
                اتصال
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

          {/* Tracking info */}
          {trackingData && (
            <GlassCard variant="beneficiary" className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">الحالة</span>
                <span className="font-medium text-green-600">
                  {trackingData.isOnline ? 'متصل ومتوجه إليك' : 'غير متصل'}
                </span>
              </div>
              {trackingData.speed > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">السرعة</span>
                  <span className="font-medium">{Math.round(trackingData.speed)} كم/س</span>
                </div>
              )}
              {trackingData.batteryLevel !== null && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">البطارية</span>
                  <span className="font-medium">{Math.round(trackingData.batteryLevel)}%</span>
                </div>
              )}
            </GlassCard>
          )}
        </div>
      )}
    </div>
  );
}
