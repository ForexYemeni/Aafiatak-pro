'use client';

import { useState, useEffect } from 'react';
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
  ShieldAlert,
  CheckCircle2,
  X,
  Wallet,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { GlassCard } from '@/components/common/glass-card';
import { GpsLocationButton } from '@/components/common/gps-location-button';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useAuthFetch } from '@/hooks/use-auth';
import { toast } from 'sonner';

interface EmergencyTypeOption {
  value: string;
  label: string;
  icon: React.ElementType;
  color: string;
  description: string;
}

const emergencyTypes: EmergencyTypeOption[] = [
  { value: 'medical', label: 'طبية عامة', icon: Heart, color: 'bg-red-500', description: 'حالة طبية طارئة' },
  { value: 'injury', label: 'إصابة', icon: Activity, color: 'bg-orange-500', description: 'إصابة أو جرح' },
  { value: 'breathing', label: 'تنفس', icon: Wind, color: 'bg-blue-500', description: 'صعوبة في التنفس' },
  { value: 'cardiac', label: 'قلب', icon: Siren, color: 'bg-red-700', description: 'أزمة قلبية' },
  { value: 'fall', label: 'سقوط', icon: ArrowDown, color: 'bg-yellow-600', description: 'سقوط وإصابة' },
  { value: 'other', label: 'أخرى', icon: AlertTriangle, color: 'bg-gray-500', description: 'حالة طارئة أخرى' },
];

const statusLabelsAr: Record<string, string> = {
  pending: 'قيد الانتظار',
  dispatched: 'تم الإرسال',
  in_progress: 'قيد التنفيذ',
  resolved: 'تم الحل',
  cancelled: 'ملغي',
};

interface ActiveEmergency {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  nurseName?: string;
  emergencyFee?: number;
}

export default function EmergencyPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const user = useAuthStore((s) => s.user);

  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [description, setDescription] = useState('');
  const [address, setAddress] = useState('');
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [activeEmergency, setActiveEmergency] = useState<ActiveEmergency | null>(null);

  // Confirmation dialog state
  const [showConfirmation, setShowConfirmation] = useState(false);

  // Emergency fee from admin settings
  const [emergencyFee, setEmergencyFee] = useState(5000);

  // Check for active emergency on load
  useEffect(() => {
    const checkActiveEmergency = async () => {
      try {
        const res = await authFetch('/api/beneficiary/emergency');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            const emergencies = Array.isArray(data.data) ? data.data : data.data.emergencies || [];
            const active = emergencies.find((e: any) =>
              ['pending', 'dispatched', 'in_progress'].includes(e.status)
            );
            if (active) {
              setActiveEmergency(active);
            }
          }
        }
      } catch {
        // Ignore
      }
    };
    checkActiveEmergency();
  }, [authFetch]);

  // Fetch emergency fee
  useEffect(() => {
    const fetchFee = async () => {
      try {
        const res = await authFetch('/api/admin/settings');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setEmergencyFee(data.data.emergencyFee || 5000);
          }
        }
      } catch {
        // Use default
      }
    };
    fetchFee();
  }, [authFetch]);

  // Auto-detect location
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setLat(pos.coords.latitude);
          setLng(pos.coords.longitude);
        },
        () => {
          setLat(15.3694);
          setLng(44.1910);
        },
        { timeout: 5000 }
      );
    }
  }, []);

  const handleSubmit = async () => {
    if (!selectedType || !description.trim()) return;
    setIsSubmitting(true);
    try {
      const res = await authFetch('/api/beneficiary/emergency', {
        method: 'POST',
        body: JSON.stringify({
          type: selectedType,
          description: description.trim(),
          address: address || 'تم التحديد تلقائياً',
          lat: lat || 15.3694,
          lng: lng || 44.1910,
        }),
      });
      const data = await res.json();
      if (data.success && data.data) {
        setActiveEmergency(data.data);
        setShowConfirmation(false);
        toast.success('تم إرسال طلب الطوارئ بنجاح');
      } else {
        toast.error(data.message ?? 'فشل إرسال طلب الطوارئ');
        setShowConfirmation(false);
      }
    } catch {
      toast.error('حدث خطأ في إرسال الطلب');
      setShowConfirmation(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  // If there's an active emergency, show its status
  if (activeEmergency) {
    const emergencyType = emergencyTypes.find(t => t.value === activeEmergency.type);
    const StatusIcon = activeEmergency.status === 'resolved' ? CheckCircle2 : ShieldAlert;

    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3 animate-pulse">
            <ShieldAlert className="w-8 h-8 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-red-600">طلب طوارئ نشط</h1>
        </motion.div>

        <GlassCard variant="beneficiary" className="border-2 border-red-500/50 space-y-4 p-5">
          {/* Status */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${emergencyType?.color || 'bg-red-500'}`}>
                {emergencyType?.icon ? <emergencyType.icon className="w-6 h-6" /> : <AlertTriangle className="w-6 h-6" />}
              </div>
              <div>
                <p className="font-bold">{emergencyType?.label || 'طوارئ'}</p>
                <p className="text-xs text-muted-foreground">
                  {statusLabelsAr[activeEmergency.status] || activeEmergency.status}
                </p>
              </div>
            </div>
            <div className={`px-3 py-1.5 rounded-full text-xs font-medium ${
              activeEmergency.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
              activeEmergency.status === 'dispatched' ? 'bg-blue-100 text-blue-800' :
              activeEmergency.status === 'in_progress' ? 'bg-orange-100 text-orange-800' :
              'bg-green-100 text-green-800'
            }`}>
              {statusLabelsAr[activeEmergency.status] || activeEmergency.status}
            </div>
          </div>

          <Separator />

          {/* Nurse info */}
          {activeEmergency.nurseName && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/20">
              <CheckCircle2 className="w-5 h-5 text-green-600" />
              <div>
                <p className="text-sm font-medium">الممرض/ـة: {activeEmergency.nurseName}</p>
                <p className="text-xs text-muted-foreground">في الطريق إليك</p>
              </div>
            </div>
          )}

          {/* Emergency fee */}
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/50">
            <span className="text-sm text-muted-foreground">رسوم خدمة الطوارئ</span>
            <span className="font-bold text-red-600">{(activeEmergency.emergencyFee || emergencyFee).toLocaleString('ar-YE')} ر.ي</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-2">
            {activeEmergency.nurseName && (
              <Button
                variant="outline"
                className="flex-1 gap-2"
                onClick={() => router.push('/beneficiary/chat')}
              >
                <MessageSquare className="w-4 h-4" />
                محادثة الممرض/ـة
              </Button>
            )}
          </div>
        </GlassCard>
      </div>
    );
  }

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

      {/* Warning + Price */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">تنبيه هام</p>
            <p>يرجى استخدام خدمة الطوارئ فقط في الحالات الطارئة الفعلية. سيتم إرسال ممرض فور تأكيد الطلب.</p>
          </div>
        </div>

        {/* Emergency Fee Card */}
        <GlassCard variant="beneficiary" className="p-4 border-red-200 dark:border-red-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Wallet className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-semibold">رسوم خدمة الطوارئ</p>
                <p className="text-[10px] text-muted-foreground">تدفع عند تقديم الخدمة</p>
              </div>
            </div>
            <div className="text-left">
              <p className="text-lg font-bold text-red-600">{emergencyFee.toLocaleString('ar-YE')}</p>
              <p className="text-[10px] text-muted-foreground">ريال يمني</p>
            </div>
          </div>
        </GlassCard>
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
        <Label>وصف الحالة <span className="text-red-500">*</span></Label>
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
          onClick={() => setShowConfirmation(true)}
          disabled={!selectedType || !description.trim()}
          className="w-full h-14 text-lg gap-3 bg-red-600 hover:bg-red-700 text-white shadow-xl"
        >
          <Ambulance className="w-6 h-6" />
          إرسال طلب الطوارئ
        </Button>
      </motion.div>

      {/* Confirmation Dialog */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
            onClick={() => setShowConfirmation(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-md bg-background rounded-2xl shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              {/* Header */}
              <div className="bg-red-600 text-white p-5">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-white/20 flex items-center justify-center">
                    <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">تأكيد طلب الطوارئ</h3>
                    <p className="text-sm text-red-100">هل أنت متأكد من إرسال الطلب؟</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-4">
                {/* Emergency type */}
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">نوع الطوارئ:</span>
                  <span className="font-medium">
                    {emergencyTypes.find(t => t.value === selectedType)?.label || selectedType}
                  </span>
                </div>

                {/* Description */}
                <div>
                  <span className="text-sm text-muted-foreground">الوصف:</span>
                  <p className="text-sm mt-1 line-clamp-2">{description}</p>
                </div>

                {/* Fee */}
                <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30">
                  <span className="text-sm font-medium text-red-700 dark:text-red-400">رسوم الطوارئ</span>
                  <span className="font-bold text-red-600">{emergencyFee.toLocaleString('ar-YE')} ر.ي</span>
                </div>

                {/* Warning */}
                <div className="flex items-start gap-2 text-xs text-muted-foreground">
                  <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-yellow-500" />
                  <p>لا يمكن إرسال طلب طوارئ آخر حتى يتم التعامل مع الطلب الحالي</p>
                </div>
              </div>

              {/* Actions */}
              <div className="p-5 pt-0 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12"
                  onClick={() => setShowConfirmation(false)}
                  disabled={isSubmitting}
                >
                  <X className="w-4 h-4 ml-1" />
                  إلغاء
                </Button>
                <Button
                  className="flex-1 h-12 bg-red-600 hover:bg-red-700 text-white gap-2"
                  onClick={handleSubmit}
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <CheckCircle2 className="w-5 h-5" />
                      تأكيد الإرسال
                    </>
                  )}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
