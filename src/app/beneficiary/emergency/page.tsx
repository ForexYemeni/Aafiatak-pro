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
  Clock,
  ShieldCheck,
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

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  dispatched: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

interface ActiveEmergency {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  nurseName?: string;
  emergencyFee?: number;
  description?: string;
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
  const [emergencyFee, setEmergencyFee] = useState<number | null>(null);

  // Cooldown state for anti-spam (30 seconds)
  const [cooldown, setCooldown] = useState(0);

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

  // Fetch emergency fee from public endpoint
  useEffect(() => {
    const fetchFee = async () => {
      try {
        const res = await fetch('/api/settings/emergency-fee');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            setEmergencyFee(data.data.emergencyFee || 5000);
          }
        }
      } catch {
        setEmergencyFee(5000);
      }
    };
    fetchFee();
  }, []);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(prev => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

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
    if (!selectedType || !description.trim() || isSubmitting || cooldown > 0) return;

    // Double-check for active emergency before submitting
    try {
      const checkRes = await authFetch('/api/beneficiary/emergency');
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData.success && checkData.data) {
          const emergencies = Array.isArray(checkData.data) ? checkData.data : checkData.data.emergencies || [];
          const active = emergencies.find((e: any) =>
            ['pending', 'dispatched', 'in_progress'].includes(e.status)
          );
          if (active) {
            setActiveEmergency(active);
            setShowConfirmation(false);
            toast.error('لديك بالفعل طلب طوارئ نشط');
            return;
          }
        }
      }
    } catch {
      // Continue with submission
    }

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
        setCooldown(60); // 60-second cooldown after submission
        toast.success('تم إرسال طلب الطوارئ بنجاح');
      } else {
        toast.error(data.message ?? 'فشل إرسال طلب الطوارئ');
        setShowConfirmation(false);
        // If duplicate, set the active emergency
        if (data.code === 'DUPLICATE_EMERGENCY') {
          // Re-fetch to get the active emergency
          try {
            const checkRes = await authFetch('/api/beneficiary/emergency');
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              if (checkData.success && checkData.data) {
                const emergencies = Array.isArray(checkData.data) ? checkData.data : checkData.data.emergencies || [];
                const active = emergencies.find((e: any) =>
                  ['pending', 'dispatched', 'in_progress'].includes(e.status)
                );
                if (active) setActiveEmergency(active);
              }
            }
          } catch {}
        }
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

    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4 animate-pulse">
            <ShieldAlert className="w-10 h-10 text-red-600" />
          </div>
          <h1 className="text-2xl font-bold text-red-600">طلب طوارئ نشط</h1>
          <p className="text-sm text-muted-foreground mt-1">يتم التعامل مع طلبك حالياً</p>
        </motion.div>

        <GlassCard variant="beneficiary" className="border-2 border-red-500/50 space-y-4 p-5">
          {/* Status Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center text-white ${emergencyType?.color || 'bg-red-500'}`}>
                {emergencyType?.icon ? <emergencyType.icon className="w-7 h-7" /> : <AlertTriangle className="w-7 h-7" />}
              </div>
              <div>
                <p className="font-bold text-lg">{emergencyType?.label || 'طوارئ'}</p>
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusColors[activeEmergency.status] || ''}`}>
                  {activeEmergency.status === 'pending' && <Clock className="w-3 h-3" />}
                  {activeEmergency.status === 'dispatched' && <Ambulance className="w-3 h-3" />}
                  {activeEmergency.status === 'in_progress' && <ShieldCheck className="w-3 h-3" />}
                  {statusLabelsAr[activeEmergency.status] || activeEmergency.status}
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Description */}
          {activeEmergency.description && (
            <div className="p-3 rounded-xl bg-muted/50">
              <p className="text-xs text-muted-foreground mb-1">الوصف</p>
              <p className="text-sm">{activeEmergency.description}</p>
            </div>
          )}

          {/* Nurse info */}
          {activeEmergency.nurseName && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/30">
              <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <p className="font-semibold text-green-700 dark:text-green-400">الممرض/ـة: {activeEmergency.nurseName}</p>
                <p className="text-xs text-green-600/80 dark:text-green-400/80">في الطريق إليك</p>
              </div>
            </div>
          )}

          {/* Emergency fee */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-red-600" />
              <span className="text-sm font-medium text-red-700 dark:text-red-400">رسوم خدمة الطوارئ</span>
            </div>
            <span className="font-bold text-red-600 text-lg">{(activeEmergency.emergencyFee || emergencyFee || 5000).toLocaleString('ar-YE')} ر.ي</span>
          </div>

          {/* Action buttons */}
          <div className="flex gap-3">
            {activeEmergency.nurseName && (
              <Button
                variant="outline"
                className="flex-1 gap-2 h-12"
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

  const feeValue = emergencyFee || 5000;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center"
      >
        <div className="w-20 h-20 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-4">
          <Ambulance className="w-10 h-10 text-red-600" />
        </div>
        <h1 className="text-2xl font-bold text-red-600">طلب طوارئ</h1>
        <p className="text-sm text-muted-foreground mt-1">سيتم إرسال ممرض/ـة فوراً إلى موقعك</p>
      </motion.div>

      {/* Warning + Price */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="space-y-3"
      >
        <div className="flex items-start gap-3 p-4 rounded-xl bg-yellow-50 dark:bg-yellow-900/20 text-yellow-800 dark:text-yellow-300 border border-yellow-200 dark:border-yellow-900/30">
          <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-semibold mb-1">تنبيه هام</p>
            <p>يرجى استخدام خدمة الطوارئ فقط في الحالات الطارئة الفعلية. لا يمكن إرسال طلب طوارئ آخر حتى يتم التعامل مع الطلب الحالي.</p>
          </div>
        </div>

        {/* Emergency Fee Card */}
        <GlassCard variant="beneficiary" className="p-4 border-2 border-red-200 dark:border-red-900/30">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Wallet className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <p className="text-sm font-bold">رسوم خدمة الطوارئ</p>
                <p className="text-[10px] text-muted-foreground">تدفع عند تقديم الخدمة</p>
              </div>
            </div>
            <div className="text-left">
              {emergencyFee === null ? (
                <Loader2 className="w-5 h-5 animate-spin text-red-600" />
              ) : (
                <>
                  <p className="text-2xl font-bold text-red-600">{feeValue.toLocaleString('ar-YE')}</p>
                  <p className="text-[10px] text-muted-foreground text-left">ريال يمني</p>
                </>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Emergency Type Selection */}
      <div className="space-y-3">
        <Label className="font-semibold">نوع الطوارئ <span className="text-red-500">*</span></Label>
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
                    ? 'border-red-500 bg-red-50 dark:bg-red-900/20 shadow-md'
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
          disabled={!selectedType || !description.trim() || cooldown > 0}
          className="w-full h-14 text-lg gap-3 bg-red-600 hover:bg-red-700 text-white shadow-xl"
        >
          {cooldown > 0 ? (
            <>
              <Clock className="w-6 h-6" />
              انتظر {cooldown} ثانية
            </>
          ) : (
            <>
              <Ambulance className="w-6 h-6" />
              إرسال طلب الطوارئ
            </>
          )}
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
              <div className="bg-gradient-to-l from-red-600 to-red-700 text-white p-6">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                    <AlertTriangle className="w-7 h-7" />
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
                <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                  <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-white ${emergencyTypes.find(t => t.value === selectedType)?.color || 'bg-red-500'}`}>
                    {(() => {
                      const TypeIcon = emergencyTypes.find(t => t.value === selectedType)?.icon || AlertTriangle;
                      return <TypeIcon className="w-5 h-5" />;
                    })()}
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">نوع الطوارئ</p>
                    <p className="font-semibold text-sm">{emergencyTypes.find(t => t.value === selectedType)?.label || selectedType}</p>
                  </div>
                </div>

                {/* Description */}
                <div className="p-3 rounded-xl bg-muted/50">
                  <p className="text-xs text-muted-foreground mb-1">الوصف</p>
                  <p className="text-sm line-clamp-3">{description}</p>
                </div>

                {/* Fee */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-bold text-red-700 dark:text-red-400">رسوم الطوارئ</span>
                  </div>
                  <span className="font-bold text-red-600 text-lg">{feeValue.toLocaleString('ar-YE')} ر.ي</span>
                </div>

                {/* Warning */}
                <div className="flex items-start gap-2 p-3 rounded-lg bg-yellow-50 dark:bg-yellow-900/10 text-yellow-700 dark:text-yellow-400 border border-yellow-200 dark:border-yellow-900/30">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-semibold">تنبيه قبل التأكيد:</p>
                    <p>لا يمكن إرسال طلب طوارئ آخر حتى يتم التعامل مع الطلب الحالي. تأكد من صحة المعلومات قبل الإرسال.</p>
                  </div>
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
