'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Ambulance,
  AlertTriangle,
  Heart,
  Activity,
  Wind,
  Siren,
  ArrowDown,
  Loader2,
  MapPin,
  MessageSquare,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/common/glass-card';
import { GpsLocationButton } from '@/components/common/gps-location-button';
import { BadgeStatus } from '@/components/common/badge-status';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import type { ApiResponse, EmergencyType, EmergencyStatus } from '@/types';

interface EmergencyTypeOption {
  value: EmergencyType;
  label: string;
  icon: React.ElementType;
  color: string;
}

const emergencyTypes: EmergencyTypeOption[] = [
  { value: 'medical', label: 'طبية عامة', icon: Heart, color: 'bg-red-500' },
  { value: 'injury', label: 'إصابة', icon: Activity, color: 'bg-orange-500' },
  { value: 'breathing', label: 'تنفس', icon: Wind, color: 'bg-blue-500' },
  { value: 'cardiac', label: 'قلب', icon: Siren, color: 'bg-red-700' },
  { value: 'fall', label: 'سقوط', icon: ArrowDown, color: 'bg-yellow-600' },
  { value: 'other', label: 'أخرى', icon: AlertTriangle, color: 'bg-gray-500' },
];

const emergencyStatusLabels: Record<EmergencyStatus, string> = {
  pending: 'قيد الانتظار',
  dispatched: 'تم الإرسال',
  in_progress: 'قيد التنفيذ',
  resolved: 'تم الحل',
  cancelled: 'ملغي',
};

interface ActiveEmergency {
  id: string;
  type: EmergencyType;
  status: EmergencyStatus;
  createdAt: string;
  nurseName?: string;
}

export default function EmergencyPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();

  const [selectedType, setSelectedType] = useState<EmergencyType | null>(null);
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [activeEmergency, setActiveEmergency] = useState<ActiveEmergency | null>(null);

  // Auto-detect location
  useEffect(() => {
    if (navigator.geolocation) {
      setIsDetectingLocation(true);
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
          setIsDetectingLocation(false);
        },
        () => {
          setLat(15.3694);
          setLng(44.1910);
          setIsDetectingLocation(false);
        },
        { timeout: 5000 }
      );
    }
  }, []);

  const handleSubmit = async () => {
    if (!token || !selectedType) return;
    setIsSubmitting(true);
    try {
      const res = await fetch('/api/beneficiary/emergency', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          type: selectedType,
          description,
          address: address || 'تم التحديد تلقائياً',
          lat: lat || 15.3694,
          lng: lng || 44.1910,
        }),
      });
      const data: ApiResponse<ActiveEmergency> = await res.json();
      if (data.success && data.data) {
        setActiveEmergency(data.data);
        toast({ title: 'تم إرسال طلب الطوارئ بنجاح' });
      } else {
        toast({ title: data.message ?? 'فشل إرسال طلب الطوارئ', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'حدث خطأ في إرسال الطلب', variant: 'destructive' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3">
          <Ambulance className="w-8 h-8 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-red-600">طلب طوارئ</h1>
        <p className="text-sm text-muted-foreground">سيتم إرسال ممرض/ـة فوراً إلى موقعك</p>
      </motion.div>

      {/* Active Emergency Status */}
      {activeEmergency && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <GlassCard variant="beneficiary" className="border-2 border-red-500/50 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-red-600">طلب طوارئ نشط</h3>
              <BadgeStatus
                status={activeEmergency.status === 'dispatched' ? 'dispatched' : activeEmergency.status === 'in_progress' ? 'in_progress' : 'pending'}
                label={emergencyStatusLabels[activeEmergency.status]}
                size="md"
              />
            </div>
            <div className="space-y-2 text-sm">
              <p>النوع: {emergencyTypes.find((t) => t.value === activeEmergency.type)?.label ?? activeEmergency.type}</p>
              {activeEmergency.nurseName && (
                <p>الممرض/ـة: {activeEmergency.nurseName}</p>
              )}
            </div>
            <div className="flex gap-2">
              {activeEmergency.nurseName && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2"
                  onClick={() => router.push('/beneficiary/chat')}
                >
                  <MessageSquare className="w-4 h-4" />
                  محادثة الممرض/ـة
                </Button>
              )}
              {activeEmergency.status !== 'resolved' && activeEmergency.status !== 'cancelled' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1 gap-2 border-red-500 text-red-500"
                >
                  إلغاء الطوارئ
                </Button>
              )}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Warning */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
      >
        <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">تنبيه هام</p>
            <p>خدمة الطوارئ تتضمن رسوماً إضافية بنسبة ٥٠٪ من السعر الأساسي. يرجى استخدامها فقط في الحالات الطارئة.</p>
          </div>
        </div>
      </motion.div>

      {/* Emergency Type Selection */}
      <div className="space-y-3">
        <Label className="font-semibold">نوع الطوارئ</Label>
        <div className="grid grid-cols-3 gap-3">
          {emergencyTypes.map((type) => {
            const Icon = type.icon;
            const isSelected = selectedType === type.value;
            return (
              <motion.button
                key={type.value}
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedType(type.value)}
                className={`flex flex-col items-center gap-2 p-4 rounded-2xl transition-all border-2 ${
                  isSelected
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20'
                    : 'border-transparent glass hover:bg-red-50/50 dark:hover:bg-red-900/10'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white ${type.color}`}>
                  <Icon className="w-6 h-6" />
                </div>
                <span className="text-xs font-medium text-center">{type.label}</span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* Description */}
      <div className="space-y-2">
        <Label>وصف الحالة (اختياري)</Label>
        <Textarea
          placeholder="صف حالتك باختصار..."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          dir="rtl"
          className="min-h-[80px]"
        />
      </div>

      {/* Location */}
      <GlassCard variant="beneficiary" className="space-y-3">
        <Label className="flex items-center gap-2 font-semibold">
          <MapPin className="w-4 h-4 text-red-500" />
          الموقع
        </Label>
        <GpsLocationButton
          onLocationDetected={(loc) => {
            setLat(loc.latitude);
            setLng(loc.longitude);
            if (loc.address && loc.address !== `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`) {
              setAddress(loc.address);
            }
            setIsDetectingLocation(false);
          }}
          value={address}
          placeholder='اضغط "تحديد موقعي" لرفع موقعك الجغرافي'
          label="تحديد موقعي"
        />
        <div className="space-y-2">
          <Label htmlFor="emergency-address">العنوان (اختياري)</Label>
          <Textarea
            id="emergency-address"
            placeholder="أدخل عنوانك بالتفصيل..."
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            dir="rtl"
          />
        </div>
      </GlassCard>

      {/* Submit Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Button
          onClick={handleSubmit}
          disabled={!selectedType || isSubmitting}
          className="w-full h-14 text-lg gap-3 bg-red-600 hover:bg-red-700 text-white shadow-xl"
        >
          {isSubmitting ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <>
              <Ambulance className="w-6 h-6" />
              إرسال طلب الطوارئ
            </>
          )}
        </Button>
      </motion.div>
    </div>
  );
}
