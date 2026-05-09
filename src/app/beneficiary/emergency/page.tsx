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
  ShieldAlert,
  CheckCircle2,
  X,
  Wallet,
  Clock,
  ShieldCheck,
  Star,
  Send,
  ThumbsUp,
  ThumbsDown,
  Stethoscope,
  CreditCard,
  Smartphone,
  Building2,
  HandCoins,
  Copy,
  Check,
  Upload,
  Image as ImageIcon,
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
  accepted: 'الممرض في الطريق',
  in_progress: 'جاري التنفيذ - الممرض في الموقع',
  resolved: 'تم الحل',
  cancelled: 'ملغي',
};

// Rating tags options
const ratingTags = [
  { id: 'punctual', label: 'ملتزم بالوقت', icon: Clock },
  { id: 'professional', label: 'محترف', icon: Stethoscope },
  { id: 'friendly', label: 'ودود', icon: ThumbsUp },
  { id: 'clean', label: 'نظيف', icon: CheckCircle2 },
  { id: 'skilled', label: 'ماهر', icon: Star },
  { id: 'patient', label: 'صبور', icon: ThumbsUp },
  { id: 'late', label: 'متأخر', icon: Clock },
  { id: 'unprofessional', label: 'غير محترف', icon: ThumbsDown },
];

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  dispatched: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  accepted: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
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
  nurseId?: string;
  emergencyFee?: number;
  description?: string;
  outcome?: string;
  resolvedNotes?: string;
  paymentMethod?: string;
  paymentMethodId?: string;
}

// Payment method from API
interface PaymentMethodItem {
  id: string;
  nameAr: string;
  nameEn: string;
  type: string;
  walletType: string | null;
  exchangeType: string | null;
  customProviderName: string;
  icon: string;
  isActive: boolean;
  instructions: string;
  accountName: string;
  accountNumber: string;
}

// Copy button helper
function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { /* fallback */ }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors" title="نسخ">
      {copied ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5 text-muted-foreground" />}
    </button>
  );
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

  // Payment method state
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState<string>('');
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null);

  // Rating state
  const [ratingScore, setRatingScore] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [existingRating, setExistingRating] = useState<{ score: number; comment?: string; tags?: string[]; isAnonymous?: boolean } | null>(null);

  // Derived payment info
  const selectedPaymentMethod = paymentMethods.find(pm => pm.id === selectedPaymentMethodId);
  const isCashPayment = selectedPaymentMethod?.type === 'cash';

  // Fetch payment methods
  const fetchPaymentMethods = useCallback(async () => {
    try {
      const res = await fetch('/api/payments/methods');
      const data = await res.json();
      if (data.success && data.data) {
        const methods = Array.isArray(data.data) ? data.data : [];
        setPaymentMethods(methods);
        // Auto-select cash if available
        const cashMethod = methods.find((m: PaymentMethodItem) => m.type === 'cash');
        if (cashMethod) setSelectedPaymentMethodId(cashMethod.id);
      }
    } catch {
      // silent
    }
  }, []);

  // Check for active or recently-resolved emergency on load
  useEffect(() => {
    const checkActiveEmergency = async () => {
      try {
        const res = await authFetch('/api/beneficiary/emergency');
        if (res.ok) {
          const data = await res.json();
          if (data.success && data.data) {
            const emergencies = Array.isArray(data.data) ? data.data : data.data.emergencies || [];
            // Priority 1: truly active emergency
            const active = emergencies.find((e: any) =>
              ['pending', 'dispatched', 'in_progress'].includes(e.status)
            );
            if (active) {
              setActiveEmergency(active);
            } else {
              // Priority 2: most recent resolved emergency (for rating)
              const resolved = emergencies.find((e: any) =>
                e.status === 'resolved' && e.nurseId
              );
              if (resolved) {
                setActiveEmergency(resolved);
              }
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
    fetchPaymentMethods();
  }, [fetchPaymentMethods]);

  // Check existing rating when emergency is resolved
  useEffect(() => {
    if (activeEmergency?.status === 'resolved' && activeEmergency.nurseName) {
      const checkExistingRating = async () => {
        try {
          const ratingRes = await authFetch('/api/beneficiary/ratings?limit=100');
          if (ratingRes.ok) {
            const ratingData = await ratingRes.json();
            if (ratingData.success && ratingData.data?.ratings) {
              const found = ratingData.data.ratings.find(
                (r: any) => r.requestId === activeEmergency.id || r.requestId?.toString() === activeEmergency.id
              );
              if (found) {
                setExistingRating({
                  score: found.score,
                  comment: found.comment,
                  tags: found.tags,
                  isAnonymous: found.isAnonymous,
                });
              }
            }
          }
        } catch {
          // Rating check failed, continue
        }
      };
      checkExistingRating();
    }
  }, [activeEmergency?.status, activeEmergency?.id, activeEmergency?.nurseName, authFetch]);

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

  const handlePaymentProofChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPaymentProofFile(file);
      const reader = new FileReader();
      reader.onloadend = () => setPaymentProofPreview(reader.result as string);
      reader.readAsDataURL(file);
    }
  };

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
      const requestBody: any = {
        type: selectedType,
        description: description.trim(),
        address: address || 'تم التحديد تلقائياً',
        lat: lat || 15.3694,
        lng: lng || 44.1910,
        paymentMethod: selectedPaymentMethod?.type || 'cash',
        paymentMethodId: selectedPaymentMethodId || undefined,
        hasPaymentProof: !isCashPayment && !!paymentProofFile,
        paymentProofData: !isCashPayment && paymentProofPreview ? paymentProofPreview : undefined,
      };

      const res = await authFetch('/api/beneficiary/emergency', {
        method: 'POST',
        body: JSON.stringify(requestBody),
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

  // Group payment methods by type
  const walletMethods = paymentMethods.filter(pm => pm.type === 'wallet_deposit');
  const bankMethods = paymentMethods.filter(pm => pm.type === 'bank_transfer');
  const cashMethods = paymentMethods.filter(pm => pm.type === 'cash');

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'wallet_deposit': return <Smartphone className="w-5 h-5" />;
      case 'bank_transfer': return <Building2 className="w-5 h-5" />;
      case 'cash': return <HandCoins className="w-5 h-5" />;
      default: return <CreditCard className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'wallet_deposit': return 'border-purple-500 bg-purple-50 dark:bg-purple-900/20';
      case 'bank_transfer': return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'cash': return 'border-green-500 bg-green-50 dark:bg-green-900/20';
      default: return 'border-muted bg-muted/50';
    }
  };

  // If there's an active emergency, show its status
  if (activeEmergency) {
    const emergencyType = emergencyTypes.find(t => t.value === activeEmergency.type);
    const isResolved = activeEmergency.status === 'resolved';

    return (
      <div className="space-y-6">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className={`w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 ${isResolved ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30 animate-pulse'}`}>
            {isResolved ? (
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            ) : (
              <ShieldAlert className="w-10 h-10 text-red-600" />
            )}
          </div>
          <h1 className={`text-2xl font-bold ${isResolved ? 'text-green-600' : 'text-red-600'}`}>
            {isResolved ? 'حالة طوارئ مكتملة' : 'طلب طوارئ نشط'}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isResolved ? 'تم التعامل مع حالة الطوارئ بنجاح' : 'يتم التعامل مع طلبك حالياً'}
          </p>
        </motion.div>

        <GlassCard variant="beneficiary" className={`border-2 space-y-4 p-5 ${isResolved ? 'border-green-500/50' : 'border-red-500/50'}`}>
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
                  {activeEmergency.status === 'accepted' && <Ambulance className="w-3 h-3" />}
                  {activeEmergency.status === 'in_progress' && <ShieldCheck className="w-3 h-3" />}
                  {activeEmergency.status === 'resolved' && <CheckCircle2 className="w-3 h-3" />}
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
                <p className="text-xs text-green-600/80 dark:text-green-400/80">
                  {activeEmergency.status === 'dispatched' ? 'سيتم قبول الحالة قريباً' :
                   activeEmergency.status === 'accepted' ? 'في الطريق إليك' :
                   activeEmergency.status === 'in_progress' ? 'في موقعك وبدأ العلاج' :
                   'تم التعيين'}
                </p>
              </div>
            </div>
          )}

          {/* Outcome display for resolved emergencies */}
          {activeEmergency.status === 'resolved' && activeEmergency.outcome && (
            <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/30">
              <p className="text-xs text-muted-foreground mb-1">نتيجة الحالة</p>
              <p className="text-sm font-semibold text-green-700 dark:text-green-400">
                {activeEmergency.outcome === 'treated_on_site' ? 'تم العلاج في الموقع' :
                 activeEmergency.outcome === 'transferred_to_hospital' ? 'تم النقل للمستشفى' :
                 activeEmergency.outcome === 'refused_treatment' ? 'رفض المريض العلاج' :
                 activeEmergency.outcome === 'other' ? 'أخرى' : activeEmergency.outcome}
              </p>
              {activeEmergency.resolvedNotes && (
                <p className="text-xs text-muted-foreground mt-2">{activeEmergency.resolvedNotes}</p>
              )}
            </div>
          )}

          {/* Payment & Fee - Combined Card */}
          <div className="p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  activeEmergency.paymentMethod === 'cash' ? 'bg-green-100 dark:bg-green-900/30' :
                  activeEmergency.paymentMethod === 'wallet_deposit' ? 'bg-purple-100 dark:bg-purple-900/30' :
                  activeEmergency.paymentMethod === 'bank_transfer' ? 'bg-blue-100 dark:bg-blue-900/30' :
                  'bg-red-100 dark:bg-red-900/30'
                }`}>
                  {activeEmergency.paymentMethod === 'cash' ? <HandCoins className="w-5 h-5 text-green-600" /> :
                   activeEmergency.paymentMethod === 'wallet_deposit' ? <Smartphone className="w-5 h-5 text-purple-600" /> :
                   activeEmergency.paymentMethod === 'bank_transfer' ? <Building2 className="w-5 h-5 text-blue-600" /> :
                   <Wallet className="w-5 h-5 text-red-600" />}
                </div>
                <div>
                  <p className="font-bold text-sm">
                    {activeEmergency.paymentMethod === 'cash' ? 'نقدي عند الوصول' :
                     activeEmergency.paymentMethod === 'wallet_deposit' ? 'محفظة إلكترونية' :
                     activeEmergency.paymentMethod === 'bank_transfer' ? 'تحويل بنكي / صرافة' :
                     'رسوم الطوارئ'}
                  </p>
                  <p className="text-[10px] text-muted-foreground">طريقة الدفع</p>
                </div>
              </div>
              <div className="text-left">
                <span className="font-bold text-red-600 text-lg">{(activeEmergency.emergencyFee || emergencyFee || 5000).toLocaleString('ar-YE')} ر.ي</span>
              </div>
            </div>
          </div>

          {/* ═══════════════════════════════════════════════════════════ */}
          {/* ═══════════════ RATING SECTION ══════════════════════════ */}
          {/* ═══════════════════════════════════════════════════════════ */}
          {activeEmergency.status === 'resolved' && activeEmergency.nurseName && (
            <div className="space-y-5">
              <Separator />
              <div className="space-y-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Star className="w-4 h-4 text-yellow-500" />
                  تقييم خدمة الطوارئ
                </h3>

                {existingRating ? (
                  /* ── Already rated ── */
                  <div className="text-center py-4 space-y-3">
                    <div className="flex items-center justify-center gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`w-8 h-8 ${
                            star <= existingRating.score
                              ? 'fill-yellow-500 text-yellow-500'
                              : 'text-gray-300 dark:text-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                    <p className="text-sm text-muted-foreground">تم تقييم هذه الخدمة</p>
                    {existingRating.comment && (
                      <div className="p-3 rounded-xl bg-muted/40 text-sm text-right">
                        {existingRating.comment}
                      </div>
                    )}
                    {existingRating.tags && existingRating.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 justify-center">
                        {existingRating.tags.map((tag) => {
                          const tagInfo = ratingTags.find((t) => t.id === tag);
                          return tagInfo ? (
                            <span
                              key={tag}
                              className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-red-500/10 text-red-600 dark:text-red-400"
                            >
                              {tagInfo.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                    )}
                    {existingRating.isAnonymous && (
                      <p className="text-xs text-muted-foreground">تم التقييم بشكل مجهول</p>
                    )}
                  </div>
                ) : (
                  /* ── Rating form ── */
                  <div className="space-y-5">
                    {/* Star selector */}
                    <div className="text-center space-y-2">
                      <p className="text-sm text-muted-foreground">كيف تقيّم تجربتك مع {activeEmergency.nurseName}؟</p>
                      <div className="flex items-center justify-center gap-2 py-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            className="transition-transform hover:scale-110 active:scale-95"
                            onMouseEnter={() => setHoveredStar(star)}
                            onMouseLeave={() => setHoveredStar(0)}
                            onClick={() => setRatingScore(star)}
                          >
                            <Star
                              className={`w-10 h-10 transition-colors ${
                                star <= (hoveredStar || ratingScore)
                                  ? 'fill-yellow-500 text-yellow-500'
                                  : 'text-gray-300 dark:text-gray-600'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                      {ratingScore > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {ratingScore === 1 && 'سيء'}
                          {ratingScore === 2 && 'ضعيف'}
                          {ratingScore === 3 && 'مقبول'}
                          {ratingScore === 4 && 'جيد'}
                          {ratingScore === 5 && 'ممتاز'}
                        </p>
                      )}
                    </div>

                    {/* Tags */}
                    {ratingScore > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium">اختر الصفات المناسبة (اختياري)</p>
                        <div className="flex flex-wrap gap-2">
                          {ratingTags.map((tag) => {
                            const TagIcon = tag.icon;
                            const isSelected = selectedTags.includes(tag.id);
                            return (
                              <button
                                key={tag.id}
                                type="button"
                                onClick={() =>
                                  setSelectedTags((prev) =>
                                    prev.includes(tag.id) ? prev.filter((t) => t !== tag.id) : [...prev, tag.id]
                                  )
                                }
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                  isSelected
                                    ? tag.id === 'late' || tag.id === 'unprofessional'
                                      ? 'bg-red-500 text-white shadow-sm'
                                      : 'bg-red-600 text-white shadow-sm'
                                    : tag.id === 'late' || tag.id === 'unprofessional'
                                      ? 'text-red-400 bg-muted/60 hover:bg-muted'
                                      : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                                }`}
                              >
                                <TagIcon className="w-3 h-3" />
                                {tag.label}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Comment */}
                    {ratingScore > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs text-muted-foreground font-medium">تعليقك (اختياري)</p>
                        <Textarea
                          value={ratingComment}
                          onChange={(e) => setRatingComment(e.target.value)}
                          placeholder="شاركنا رأيك في التجربة..."
                          rows={3}
                          dir="rtl"
                          className="resize-none"
                        />
                      </div>
                    )}

                    {/* Anonymous toggle */}
                    {ratingScore > 0 && (
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <div
                          className={`w-10 h-6 rounded-full transition-colors relative ${isAnonymous ? 'bg-red-600' : 'bg-muted'}`}
                          onClick={() => setIsAnonymous(!isAnonymous)}
                        >
                          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isAnonymous ? 'left-[18px]' : 'left-0.5'}`} />
                        </div>
                        <span className="text-xs text-muted-foreground">تقييم مجهول</span>
                      </label>
                    )}

                    {/* Submit button */}
                    {ratingScore > 0 && (
                      <Button
                        className="w-full gap-2 bg-red-600 hover:bg-red-700 text-white"
                        onClick={async () => {
                          if (ratingScore === 0) return;
                          setIsSubmittingRating(true);
                          try {
                            const res = await authFetch('/api/beneficiary/ratings', {
                              method: 'POST',
                              body: JSON.stringify({
                                requestId: activeEmergency.id,
                                ratingType: 'emergency',
                                score: ratingScore,
                                comment: ratingComment || undefined,
                                tags: selectedTags.length > 0 ? selectedTags : undefined,
                                isAnonymous,
                              }),
                            });
                            const data = await res.json();
                            if (data.success) {
                              toast.success('تم إرسال التقييم بنجاح');
                              setExistingRating({ score: ratingScore, comment: ratingComment, tags: selectedTags, isAnonymous });
                              setRatingScore(0);
                              setRatingComment('');
                              setSelectedTags([]);
                              setIsAnonymous(false);
                            } else if (data.code === 'ALREADY_RATED') {
                              toast.error('تم تقييم هذا الطلب بالفعل');
                              setExistingRating({ score: ratingScore });
                            } else {
                              toast.error(data.message || 'فشل إرسال التقييم');
                            }
                          } catch {
                            toast.error('حدث خطأ أثناء إرسال التقييم');
                          } finally {
                            setIsSubmittingRating(false);
                          }
                        }}
                        disabled={isSubmittingRating}
                      >
                        {isSubmittingRating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        إرسال التقييم
                      </Button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Action buttons */}
          <div className="flex gap-3">
            {activeEmergency.nurseName && activeEmergency.status !== 'resolved' && (
              <Button
                variant="outline"
                className="flex-1 gap-2 h-12"
                onClick={() => router.push('/beneficiary/chat')}
              >
                <MessageSquare className="w-4 h-4" />
                محادثة الممرض/ـة
              </Button>
            )}
            {isResolved && (
              <Button
                className="flex-1 gap-2 h-12 bg-red-600 hover:bg-red-700 text-white"
                onClick={() => {
                  setActiveEmergency(null);
                  setExistingRating(null);
                  setRatingScore(0);
                  setRatingComment('');
                  setSelectedTags([]);
                  setIsAnonymous(false);
                }}
              >
                <Ambulance className="w-5 h-5" />
                طلب طوارئ جديد
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
            if (loc.address) {
              // Always update the address if available from detection
              setAddress(loc.address);
            } else if (!address) {
              // If no address returned and no address set yet, show coordinates as placeholder
              setAddress(`${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`);
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

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ═══════════════ PAYMENT METHOD ════════════════════════════ */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <GlassCard variant="beneficiary" className="space-y-4">
        <Label className="flex items-center gap-2 font-semibold">
          <CreditCard className="w-4 h-4 text-red-500" />
          طريقة الدفع <span className="text-red-500">*</span>
        </Label>

        {paymentMethods.length === 0 ? (
          <div className="text-center py-6">
            <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">جاري تحميل طرق الدفع...</p>
          </div>
        ) : (
          <div className="space-y-3">
            {/* Cash Methods */}
            {cashMethods.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-green-700 dark:text-green-400 flex items-center gap-2">
                  <HandCoins className="w-4 h-4" /> نقدي عند الوصول
                </p>
                {cashMethods.map(pm => (
                  <label key={pm.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2 ${
                    selectedPaymentMethodId === pm.id ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-transparent glass'
                  }`}>
                    <input type="radio" name="payment" checked={selectedPaymentMethodId === pm.id} onChange={() => setSelectedPaymentMethodId(pm.id)} className="w-4 h-4 text-green-600" />
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{pm.nameAr}</p>
                        {selectedPaymentMethodId === pm.id && (
                          <span className="font-bold text-green-600 text-sm">{feeValue.toLocaleString('ar-YE')} ر.ي</span>
                        )}
                      </div>
                      {pm.instructions && <p className="text-xs text-muted-foreground mt-0.5">{pm.instructions}</p>}
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Wallet Methods */}
            {walletMethods.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-purple-700 dark:text-purple-400 flex items-center gap-2">
                  <Smartphone className="w-4 h-4" /> إيداع محفظة إلكترونية
                </p>
                {walletMethods.map(pm => (
                  <label key={pm.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2 ${
                    selectedPaymentMethodId === pm.id ? 'border-purple-500 bg-purple-50 dark:bg-purple-900/20' : 'border-transparent glass'
                  }`}>
                    <input type="radio" name="payment" checked={selectedPaymentMethodId === pm.id} onChange={() => setSelectedPaymentMethodId(pm.id)} className="w-4 h-4 text-purple-600" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{pm.nameAr}</p>
                        <span className="text-[10px] text-muted-foreground">{pm.nameEn}</span>
                      </div>
                      {selectedPaymentMethodId === pm.id && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pt-2 border-t border-border">
                          {/* Amount display */}
                          <div className="flex items-center justify-between p-2 rounded-lg bg-purple-100/50 dark:bg-purple-900/30">
                            <span className="text-xs text-purple-700 dark:text-purple-300">المبلغ المطلوب</span>
                            <span className="font-bold text-purple-600 text-sm">{feeValue.toLocaleString('ar-YE')} ر.ي</span>
                          </div>
                          {pm.accountName && (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                              <span className="text-xs text-muted-foreground shrink-0">الاسم:</span>
                              <span className="text-sm font-medium flex-1 truncate">{pm.accountName}</span>
                              <CopyBtn text={pm.accountName} />
                            </div>
                          )}
                          {pm.accountNumber && (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                              <span className="text-xs text-muted-foreground shrink-0">الرقم:</span>
                              <span className="text-sm font-mono font-bold tracking-wider flex-1" dir="ltr">{pm.accountNumber}</span>
                              <CopyBtn text={pm.accountNumber} />
                            </div>
                          )}
                          {pm.instructions && <p className="text-xs text-muted-foreground">{pm.instructions}</p>}
                        </motion.div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Bank/Exchange Methods */}
            {bankMethods.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                  <Building2 className="w-4 h-4" /> تحويل بنكي / صرافة
                </p>
                {bankMethods.map(pm => (
                  <label key={pm.id} className={`flex items-center gap-3 p-3 rounded-xl cursor-pointer transition-all border-2 ${
                    selectedPaymentMethodId === pm.id ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' : 'border-transparent glass'
                  }`}>
                    <input type="radio" name="payment" checked={selectedPaymentMethodId === pm.id} onChange={() => setSelectedPaymentMethodId(pm.id)} className="w-4 h-4 text-blue-600" />
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-sm">{pm.nameAr}</p>
                        <span className="text-[10px] text-muted-foreground">{pm.nameEn}</span>
                      </div>
                      {selectedPaymentMethodId === pm.id && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-2 pt-2 border-t border-border">
                          {/* Amount display */}
                          <div className="flex items-center justify-between p-2 rounded-lg bg-blue-100/50 dark:bg-blue-900/30">
                            <span className="text-xs text-blue-700 dark:text-blue-300">المبلغ المطلوب</span>
                            <span className="font-bold text-blue-600 text-sm">{feeValue.toLocaleString('ar-YE')} ر.ي</span>
                          </div>
                          {pm.accountName && (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                              <span className="text-xs text-muted-foreground shrink-0">الاسم:</span>
                              <span className="text-sm font-medium flex-1 truncate">{pm.accountName}</span>
                              <CopyBtn text={pm.accountName} />
                            </div>
                          )}
                          {pm.accountNumber && (
                            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                              <span className="text-xs text-muted-foreground shrink-0">الهاتف:</span>
                              <span className="text-sm font-mono font-bold tracking-wider flex-1" dir="ltr">{pm.accountNumber}</span>
                              <CopyBtn text={pm.accountNumber} />
                            </div>
                          )}
                          {pm.instructions && <p className="text-xs text-muted-foreground">{pm.instructions}</p>}
                        </motion.div>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            )}

            {/* Payment Proof Upload for non-cash */}
            {selectedPaymentMethod && !isCashPayment && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="space-y-3 pt-3 border-t border-border">
                <Label className="flex items-center gap-2 font-semibold text-sm">
                  <Upload className="w-4 h-4 text-red-500" />
                  إثبات الدفع (اختياري)
                </Label>
                <p className="text-xs text-muted-foreground">
                  قم بتحويل المبلغ ثم ارفع صورة إثبات الدفع. يمكنك أيضاً إرسالها عبر الواتساب بعد تأكيد الطلب.
                </p>
                {paymentProofPreview ? (
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    <img src={paymentProofPreview} alt="إثبات الدفع" className="w-full max-h-48 object-cover" />
                    <button onClick={() => { setPaymentProofFile(null); setPaymentProofPreview(null); }} className="absolute top-2 left-2 p-1.5 rounded-full bg-black/50 text-white hover:bg-black/70">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-border hover:border-red-500/50 cursor-pointer transition-colors">
                    <ImageIcon className="w-6 h-6 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">اضغط لرفع صورة إثبات الدفع</span>
                    <input type="file" accept="image/*" className="hidden" onChange={handlePaymentProofChange} />
                  </label>
                )}
              </motion.div>
            )}
          </div>
        )}
      </GlassCard>

      {/* Submit Button */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Button
          onClick={() => setShowConfirmation(true)}
          disabled={!selectedType || !description.trim() || cooldown > 0 || !selectedPaymentMethodId}
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
              className="w-full max-w-md bg-background rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto"
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

                {/* Payment Method */}
                {selectedPaymentMethod && (
                  <div className={`flex items-center gap-3 p-3 rounded-xl border-2 ${getTypeColor(selectedPaymentMethod.type)}`}>
                    {getTypeIcon(selectedPaymentMethod.type)}
                    <div>
                      <p className="text-xs text-muted-foreground">طريقة الدفع</p>
                      <p className="font-semibold text-sm">{selectedPaymentMethod.nameAr}</p>
                    </div>
                  </div>
                )}

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
