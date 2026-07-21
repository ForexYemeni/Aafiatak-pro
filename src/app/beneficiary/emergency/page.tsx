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
  FileText,
  User,
  ChevronLeft,
  CircleDot,
  CircleCheck,
  Circle,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { GlassCard } from '@/components/common/glass-card';
import { GpsLocationButton } from '@/components/common/gps-location-button';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useAuthFetch } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { toast } from 'sonner';
import { toArabicNum } from '@/components/common/date-formatter';
import { formatYemeniRial } from '@/components/common/currency';

// ─── Framer Motion Variants (as const) ───

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.06, ease: 'easeOut' as const },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
} as const;

const cardHover = {
  rest: { scale: 1 },
  hover: { scale: 1.03, transition: { duration: 0.2, ease: 'easeOut' as const } },
} as const;

const pulseRing = {
  animate: {
    scale: [1, 1.4, 1],
    opacity: [0.5, 0, 0.5],
    transition: { duration: 2, repeat: Infinity, ease: 'easeOut' as const },
  },
};

const starPop = {
  initial: { scale: 1 },
  hover: { scale: 1.25, transition: { type: 'spring' as const, stiffness: 300, damping: 12 } },
  tap: { scale: 0.9 },
} as const;

const slideUp = {
  hidden: { opacity: 0, y: 24 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.45, ease: 'easeOut' as const } },
} as const;

// ─── Emergency Types with richer color data ───

interface EmergencyTypeOption {
  value: string;
  label: string;
  icon: React.ElementType;
  gradient: string;
  glow: string;
  ring: string;
  description: string;
}

const emergencyTypes: EmergencyTypeOption[] = [
  {
    value: 'medical',
    label: 'طبية عامة',
    icon: Heart,
    gradient: 'from-rose-500 via-red-500 to-red-600',
    glow: 'shadow-rose-500/30',
    ring: 'ring-rose-500/40',
    description: 'حالة طبية طارئة',
  },
  {
    value: 'injury',
    label: 'إصابة',
    icon: Activity,
    gradient: 'from-orange-400 via-orange-500 to-amber-600',
    glow: 'shadow-orange-500/30',
    ring: 'ring-orange-500/40',
    description: 'إصابة أو جرح',
  },
  {
    value: 'breathing',
    label: 'تنفس',
    icon: Wind,
    gradient: 'from-cyan-400 via-sky-500 to-blue-600',
    glow: 'shadow-sky-500/30',
    ring: 'ring-sky-500/40',
    description: 'صعوبة في التنفس',
  },
  {
    value: 'cardiac',
    label: 'قلب',
    icon: Siren,
    gradient: 'from-red-600 via-rose-600 to-pink-700',
    glow: 'shadow-red-600/30',
    ring: 'ring-red-600/40',
    description: 'أزمة قلبية',
  },
  {
    value: 'fall',
    label: 'سقوط',
    icon: ArrowDown,
    gradient: 'from-amber-400 via-yellow-500 to-orange-500',
    glow: 'shadow-amber-500/30',
    ring: 'ring-amber-500/40',
    description: 'سقوط وإصابة',
  },
  {
    value: 'other',
    label: 'أخرى',
    icon: AlertTriangle,
    gradient: 'from-slate-400 via-gray-500 to-zinc-600',
    glow: 'shadow-gray-500/25',
    ring: 'ring-gray-500/40',
    description: 'حالة طارئة أخرى',
  },
];

// ─── Status helpers ───

const statusLabelsAr: Record<string, string> = {
  pending: 'قيد الانتظار',
  dispatched: 'تم الإرسال',
  accepted: 'الممرض في الطريق',
  in_progress: 'جاري التنفيذ - الممرض في الموقع',
  resolved: 'تم الحل',
  cancelled: 'ملغي',
};

const statusSteps = ['pending', 'dispatched', 'accepted', 'in_progress', 'resolved'] as const;

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  dispatched: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  accepted: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
  in_progress: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

const statusIconMap: Record<string, React.ElementType> = {
  pending: Clock,
  dispatched: Ambulance,
  accepted: Ambulance,
  in_progress: ShieldCheck,
  resolved: CheckCircle2,
  cancelled: X,
};

// ─── Rating tags ───

const ratingTags = [
  { id: 'punctual', label: 'ملتزم بالوقت', icon: Clock, positive: true },
  { id: 'professional', label: 'محترف', icon: Stethoscope, positive: true },
  { id: 'friendly', label: 'ودود', icon: ThumbsUp, positive: true },
  { id: 'clean', label: 'نظيف', icon: CheckCircle2, positive: true },
  { id: 'skilled', label: 'ماهر', icon: Star, positive: true },
  { id: 'patient', label: 'صبور', icon: ThumbsUp, positive: true },
  { id: 'late', label: 'متأخر', icon: Clock, positive: false },
  { id: 'unprofessional', label: 'غير محترف', icon: ThumbsDown, positive: false },
];

// ─── Interfaces ───

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

// ─── Copy Button Component ───

function CopyBtn({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* fallback */
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="shrink-0 p-1.5 rounded-lg hover:bg-purple-100 dark:hover:bg-purple-900/30 transition-colors"
      title="نسخ"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-600" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
      )}
    </button>
  );
}

// ─── Step Indicator Component ───

function StepIndicator({ currentStatus }: { currentStatus: string }) {
  const currentIdx = statusSteps.indexOf(currentStatus as typeof statusSteps[number]);
  const isCancelled = currentStatus === 'cancelled';

  return (
    <div className="flex items-center justify-between gap-1 px-2 py-4" dir="ltr">
      {statusSteps.map((step, idx) => {
        const StatusIcon = statusIconMap[step] || Circle;
        const isActive = idx <= currentIdx && !isCancelled;
        const isCurrent = idx === currentIdx && !isCancelled;
        return (
          <div key={step} className="flex flex-col items-center gap-1.5 flex-1">
            <motion.div
              initial={false}
              animate={{
                scale: isCurrent ? 1.15 : 1,
                backgroundColor: isActive ? (isCurrent ? '#9333ea' : '#22c55e') : 'rgba(156,163,175,0.3)',
              }}
              transition={{ duration: 0.35, ease: 'easeOut' as const }}
              className={`relative w-10 h-10 rounded-full flex items-center justify-center ${
                isCurrent ? 'ring-4 ring-purple-500/20' : ''
              }`}
            >
              {isCurrent && !isCancelled && (
                <motion.div
                  variants={pulseRing}
                  animate="animate"
                  className="absolute inset-0 rounded-full bg-purple-500/30"
                />
              )}
              <StatusIcon
                className={`w-4.5 h-4.5 ${isActive ? 'text-white' : 'text-gray-400 dark:text-gray-600'}`}
              />
            </motion.div>
            <span
              className={`text-[9px] font-bold leading-tight text-center ${
                isActive
                  ? isCurrent
                    ? 'text-purple-600 dark:text-purple-400'
                    : 'text-green-600 dark:text-green-400'
                  : 'text-muted-foreground/50'
              }`}
            >
              {statusLabelsAr[step]?.split(' - ')[0] || step}
            </span>
            {idx < statusSteps.length - 1 && (
              <div
                className={`absolute top-5 ${
                  idx < currentIdx && !isCancelled
                    ? 'bg-green-400 dark:bg-green-500'
                    : 'bg-gray-200 dark:bg-gray-700'
                }`}
                style={{
                  width: 'calc(100% - 40px)',
                  height: '2px',
                  left: `calc(50% + 20px)`,
                  zIndex: -1,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════ MAIN PAGE COMPONENT ══════════════════════════════
// ═══════════════════════════════════════════════════════════════════════

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
  const [existingRating, setExistingRating] = useState<{
    score: number;
    comment?: string;
    tags?: string[];
    isAnonymous?: boolean;
  } | null>(null);

  // ── فحص حالة الخدمات العامة - redirect صامت عند التعطيل ──
  // الخدمات العامة معطّلة = يُخفى هذا المسار تماماً ولا يصل إليه المستفيد
  const [servicesHidden, setServicesHidden] = useState(false);
  useEffect(() => {
    fetch('/api/settings/services-status')
      .then((r) => r.json())
      .then((json) => {
        if (json.success && json.data && json.data.generalServicesEnabled === false) {
          // إخفاء صامت - إعادة توجيه للصفحة الرئيسية للمستفيد دون أي إشعار
          router.replace('/beneficiary');
        } else {
          setServicesHidden(true);
        }
      })
      .catch(() => setServicesHidden(true));
  }, [router]);

  // Derived payment info
  const selectedPaymentMethod = paymentMethods.find((pm) => pm.id === selectedPaymentMethodId);
  const isCashPayment = selectedPaymentMethod?.type === 'cash';

  // ─── Fetch payment methods ───
  const fetchPaymentMethods = useCallback(async () => {
    try {
      const res = await fetch('/api/payments/methods');
      const data = await res.json();
      if (data.success && data.data) {
        const methods = Array.isArray(data.data) ? data.data : [];
        setPaymentMethods(methods);
        const cashMethod = methods.find((m: PaymentMethodItem) => m.type === 'cash');
        if (cashMethod) setSelectedPaymentMethodId(cashMethod.id);
      }
    } catch {
      // silent
    }
  }, []);

  // ─── Check for active or recently-resolved emergency on load ───
  const fetchActiveEmergency = useCallback(async () => {
    try {
      const res = await authFetch('/api/beneficiary/emergency');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          const emergencies = Array.isArray(data.data)
            ? data.data
            : data.data.emergencies || [];
          const active = emergencies.find((e: any) =>
            ['pending', 'dispatched', 'in_progress'].includes(e.status)
          );
          if (active) {
            setActiveEmergency(active);
          } else {
            const resolved = emergencies.find(
              (e: any) => e.status === 'resolved' && e.nurseId
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
  }, [authFetch]);

  useEffect(() => {
    fetchActiveEmergency();
  }, [fetchActiveEmergency]);

  useRealtimeRefresh({
    entities: ['emergency'],
    onRefresh: () => void fetchActiveEmergency(),
    fallbackInterval: 5000,
  });

  // ─── Fetch emergency fee ───
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

  // ─── Check existing rating when emergency is resolved ───
  useEffect(() => {
    if (activeEmergency?.status === 'resolved' && activeEmergency.nurseName) {
      const checkExistingRating = async () => {
        try {
          const ratingRes = await authFetch('/api/beneficiary/ratings?limit=100');
          if (ratingRes.ok) {
            const ratingData = await ratingRes.json();
            if (ratingData.success && ratingData.data?.ratings) {
              const found = ratingData.data.ratings.find(
                (r: any) =>
                  r.requestId === activeEmergency.id ||
                  r.requestId?.toString() === activeEmergency.id
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

  // ─── Cooldown timer ───
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown((prev) => prev - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // ─── Auto-detect location ───
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
          const emergencies = Array.isArray(checkData.data)
            ? checkData.data
            : checkData.data.emergencies || [];
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
        setCooldown(60);
        toast.success('تم إرسال طلب الطوارئ بنجاح');
      } else {
        toast.error(data.message ?? 'فشل إرسال طلب الطوارئ');
        setShowConfirmation(false);
        if (data.code === 'DUPLICATE_EMERGENCY') {
          try {
            const checkRes = await authFetch('/api/beneficiary/emergency');
            if (checkRes.ok) {
              const checkData = await checkRes.json();
              if (checkData.success && checkData.data) {
                const emergencies = Array.isArray(checkData.data)
                  ? checkData.data
                  : checkData.data.emergencies || [];
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

  // ─── Group payment methods by type ───
  const walletMethods = paymentMethods.filter((pm) => pm.type === 'wallet_deposit');
  const bankMethods = paymentMethods.filter((pm) => pm.type === 'bank_transfer');
  const cashMethods = paymentMethods.filter((pm) => pm.type === 'cash');

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'wallet_deposit':
        return <Smartphone className="w-5 h-5" />;
      case 'bank_transfer':
        return <Building2 className="w-5 h-5" />;
      case 'cash':
        return <HandCoins className="w-5 h-5" />;
      default:
        return <CreditCard className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'wallet_deposit':
        return 'border-purple-500 bg-purple-50 dark:bg-purple-900/20';
      case 'bank_transfer':
        return 'border-blue-500 bg-blue-50 dark:bg-blue-900/20';
      case 'cash':
        return 'border-green-500 bg-green-50 dark:bg-green-900/20';
      default:
        return 'border-muted bg-muted/50';
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // ═══════════════════ ACTIVE EMERGENCY VIEW ════════════════════════════
  // ═══════════════════════════════════════════════════════════════════════

  if (activeEmergency) {
    const emergencyType = emergencyTypes.find((t) => t.value === activeEmergency.type);
    const isResolved = activeEmergency.status === 'resolved';

    return (
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="space-y-5"
      >
        {/* ── Hero Banner ── */}
        <motion.div
          variants={itemVariants}
          className="relative overflow-hidden rounded-3xl p-6 pb-5 text-center text-white shadow-2xl"
        >
          <div
            className={`absolute inset-0 ${
              isResolved
                ? 'bg-gradient-to-br from-emerald-500 via-green-500 to-teal-600'
                : 'bg-gradient-to-br from-red-500 via-rose-600 to-orange-500'
            }`}
          />
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
            <div className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full bg-white/10 blur-xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
          </div>
          <div className="relative z-10">
            <motion.div
              initial={{ scale: 0, rotate: -10 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.1 }}
              className={`w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-white/20 backdrop-blur-sm border border-white/25 ${
                !isResolved ? 'animate-pulse' : ''
              }`}
            >
              {isResolved ? (
                <CheckCircle2 className="w-10 h-10 text-white" />
              ) : (
                <ShieldAlert className="w-10 h-10 text-white" />
              )}
            </motion.div>
            <h1 className="text-2xl font-black">
              {isResolved ? 'حالة طوارئ مكتملة' : 'طلب طوارئ نشط'}
            </h1>
            <p className="text-sm opacity-90 mt-1.5 font-medium">
              {isResolved ? 'تم التعامل مع حالة الطوارئ بنجاح' : 'يتم التعامل مع طلبك حالياً'}
            </p>
          </div>
        </motion.div>

        {/* ── Status & Info Card ── */}
        <motion.div variants={itemVariants}>
          <GlassCard
            variant="beneficiary"
            className={`border-2 space-y-4 p-5 ${
              isResolved ? 'border-green-500/40' : 'border-red-500/40'
            }`}
          >
            {/* Emergency Type Header */}
            <div className="flex items-center gap-3.5">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br ${
                  emergencyType?.gradient || 'from-red-500 to-red-600'
                } ${emergencyType?.glow || ''}`}
              >
                {emergencyType?.icon ? (
                  <emergencyType.icon className="w-7 h-7" />
                ) : (
                  <AlertTriangle className="w-7 h-7" />
                )}
              </motion.div>
              <div className="flex-1">
                <p className="font-bold text-lg">{emergencyType?.label || 'طوارئ'}</p>
                <div
                  className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold ${
                    statusColors[activeEmergency.status] || ''
                  }`}
                >
                  {(() => {
                    const StatusIcon = statusIconMap[activeEmergency.status];
                    return StatusIcon ? <StatusIcon className="w-3 h-3" /> : null;
                  })()}
                  {statusLabelsAr[activeEmergency.status] || activeEmergency.status}
                </div>
              </div>
            </div>

            {/* ── Step Progress Indicator ── */}
            {!isResolved && activeEmergency.status !== 'cancelled' && (
              <div className="relative">
                <StepIndicator currentStatus={activeEmergency.status} />
              </div>
            )}

            {/* Description */}
            {activeEmergency.description && (
              <div className="p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100 dark:border-purple-900/20">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <FileText className="w-3.5 h-3.5 text-purple-500" />
                  <p className="text-xs font-semibold text-purple-600 dark:text-purple-400">
                    الوصف
                  </p>
                </div>
                <p className="text-sm leading-relaxed">{activeEmergency.description}</p>
              </div>
            )}

            {/* ── Nurse Info Card ── */}
            {activeEmergency.nurseName && (
              <motion.div
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4, ease: 'easeOut' as const }}
                className="relative overflow-hidden flex items-center gap-3.5 p-4 rounded-xl bg-gradient-to-l from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200/60 dark:border-green-900/30"
              >
                <div className="absolute -left-4 -top-4 w-20 h-20 rounded-full bg-green-200/30 dark:bg-green-800/20 blur-xl" />
                <div className="relative w-12 h-12 rounded-full bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-lg shadow-green-500/20">
                  <User className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 relative">
                  <p className="font-bold text-green-700 dark:text-green-400">
                    {activeEmergency.nurseName}
                  </p>
                  <p className="text-xs text-green-600/80 dark:text-green-400/80 mt-0.5">
                    {activeEmergency.status === 'dispatched'
                      ? 'سيتم قبول الحالة قريباً'
                      : activeEmergency.status === 'accepted'
                      ? 'في الطريق إليك'
                      : activeEmergency.status === 'in_progress'
                      ? 'في موقعك وبدأ العلاج'
                      : 'تم التعيين'}
                  </p>
                </div>
                <div className="relative">
                  <CheckCircle2 className="w-6 h-6 text-green-500" />
                </div>
              </motion.div>
            )}

            {/* ── Outcome Display ── */}
            {activeEmergency.status === 'resolved' && activeEmergency.outcome && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, ease: 'easeOut' as const }}
                className="p-4 rounded-xl bg-gradient-to-l from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 border border-green-200/60 dark:border-green-900/30"
              >
                <p className="text-xs font-semibold text-green-600 dark:text-green-400 mb-1.5">
                  نتيجة الحالة
                </p>
                <p className="text-sm font-bold text-green-700 dark:text-green-400">
                  {activeEmergency.outcome === 'treated_on_site'
                    ? '✅ تم العلاج في الموقع'
                    : activeEmergency.outcome === 'transferred_to_hospital'
                    ? '🏥 تم النقل للمستشفى'
                    : activeEmergency.outcome === 'refused_treatment'
                    ? '⚠️ رفض المريض العلاج'
                    : activeEmergency.outcome === 'other'
                    ? '📋 أخرى'
                    : activeEmergency.outcome}
                </p>
                {activeEmergency.resolvedNotes && (
                  <p className="text-xs text-muted-foreground mt-2 bg-white/50 dark:bg-black/20 rounded-lg p-2">
                    {activeEmergency.resolvedNotes}
                  </p>
                )}
              </motion.div>
            )}

            {/* ── Payment & Fee Card ── */}
            <div className="p-4 rounded-xl bg-gradient-to-l from-red-50/80 to-orange-50/80 dark:from-red-900/15 dark:to-orange-900/15 border border-red-200/50 dark:border-red-900/25 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-sm ${
                      activeEmergency.paymentMethod === 'cash'
                        ? 'bg-green-100 dark:bg-green-900/30'
                        : activeEmergency.paymentMethod === 'wallet_deposit'
                        ? 'bg-purple-100 dark:bg-purple-900/30'
                        : activeEmergency.paymentMethod === 'bank_transfer'
                        ? 'bg-blue-100 dark:bg-blue-900/30'
                        : 'bg-red-100 dark:bg-red-900/30'
                    }`}
                  >
                    {activeEmergency.paymentMethod === 'cash' ? (
                      <HandCoins className="w-5 h-5 text-green-600" />
                    ) : activeEmergency.paymentMethod === 'wallet_deposit' ? (
                      <Smartphone className="w-5 h-5 text-purple-600" />
                    ) : activeEmergency.paymentMethod === 'bank_transfer' ? (
                      <Building2 className="w-5 h-5 text-blue-600" />
                    ) : (
                      <Wallet className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-sm">
                      {activeEmergency.paymentMethod === 'cash'
                        ? 'نقدي عند الوصول'
                        : activeEmergency.paymentMethod === 'wallet_deposit'
                        ? 'محفظة إلكترونية'
                        : activeEmergency.paymentMethod === 'bank_transfer'
                        ? 'تحويل بنكي / صرافة'
                        : 'رسوم الطوارئ'}
                    </p>
                    <p className="text-[10px] text-muted-foreground">طريقة الدفع</p>
                  </div>
                </div>
                <div className="text-left">
                  <span className="font-black text-red-600 dark:text-red-400 text-lg">
                    {formatYemeniRial(activeEmergency.emergencyFee || emergencyFee || 5000)}
                  </span>
                </div>
              </div>
            </div>

            {/* ═══════════════════════════════════════════════════════════ */}
            {/* ═══════════════ RATING SECTION ══════════════════════════ */}
            {/* ═══════════════════════════════════════════════════════════ */}
            {activeEmergency.status === 'resolved' && activeEmergency.nurseName && (
              <div className="space-y-5 pt-2">
                <div className="h-px bg-gradient-to-l from-transparent via-border to-transparent" />
                <div className="space-y-4">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                    </div>
                    تقييم خدمة الطوارئ
                  </h3>

                  {existingRating ? (
                    /* ── Already rated ── */
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.3, ease: 'easeOut' as const }}
                      className="text-center py-5 space-y-4 rounded-xl bg-yellow-50/50 dark:bg-yellow-900/10 border border-yellow-200/50 dark:border-yellow-900/20 px-4"
                    >
                      <div className="flex items-center justify-center gap-1.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <motion.div
                            key={star}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{
                              delay: star * 0.08,
                              type: 'spring',
                              stiffness: 300,
                              damping: 15,
                            }}
                          >
                            <Star
                              className={`w-8 h-8 ${
                                star <= existingRating.score
                                  ? 'fill-yellow-500 text-yellow-500'
                                  : 'text-gray-300 dark:text-gray-600'
                              }`}
                            />
                          </motion.div>
                        ))}
                      </div>
                      <p className="text-sm text-muted-foreground font-medium">
                        تم تقييم هذه الخدمة
                      </p>
                      {existingRating.comment && (
                        <div className="p-3 rounded-xl bg-white/60 dark:bg-black/20 text-sm text-right leading-relaxed">
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
                                className={`px-2.5 py-1 rounded-full text-[11px] font-medium ${
                                  tagInfo.positive
                                    ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                                    : 'bg-red-500/10 text-red-600 dark:text-red-400'
                                }`}
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
                    </motion.div>
                  ) : (
                    /* ── Rating form ── */
                    <div className="space-y-5">
                      {/* Star selector */}
                      <div className="text-center space-y-3 py-3">
                        <p className="text-sm text-muted-foreground">
                          كيف تقيّم تجربتك مع{' '}
                          <span className="font-bold text-foreground">
                            {activeEmergency.nurseName}
                          </span>
                          ؟
                        </p>
                        <div className="flex items-center justify-center gap-3 py-2">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <motion.button
                              key={star}
                              variants={starPop}
                              initial="initial"
                              whileHover="hover"
                              whileTap="tap"
                              type="button"
                              onMouseEnter={() => setHoveredStar(star)}
                              onMouseLeave={() => setHoveredStar(0)}
                              onClick={() => setRatingScore(star)}
                            >
                              <Star
                                className={`w-11 h-11 transition-colors duration-150 ${
                                  star <= (hoveredStar || ratingScore)
                                    ? 'fill-yellow-500 text-yellow-500 drop-shadow-md'
                                    : 'text-gray-300 dark:text-gray-600'
                                }`}
                              />
                            </motion.button>
                          ))}
                        </div>
                        <AnimatePresence mode="wait">
                          {ratingScore > 0 && (
                            <motion.p
                              key={ratingScore}
                              initial={{ opacity: 0, y: 8 }}
                              animate={{ opacity: 1, y: 0 }}
                              exit={{ opacity: 0, y: -8 }}
                              transition={{ duration: 0.2, ease: 'easeOut' as const }}
                              className={`text-sm font-bold ${
                                ratingScore >= 4
                                  ? 'text-green-600 dark:text-green-400'
                                  : ratingScore >= 3
                                  ? 'text-yellow-600 dark:text-yellow-400'
                                  : 'text-red-600 dark:text-red-400'
                              }`}
                            >
                              {ratingScore === 1 && 'سيء'}
                              {ratingScore === 2 && 'ضعيف'}
                              {ratingScore === 3 && 'مقبول'}
                              {ratingScore === 4 && 'جيد'}
                              {ratingScore === 5 && 'ممتاز'}
                            </motion.p>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Tags */}
                      <AnimatePresence>
                        {ratingScore > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: 'easeOut' as const }}
                            className="space-y-2.5 overflow-hidden"
                          >
                            <p className="text-xs text-muted-foreground font-semibold">
                              اختر الصفات المناسبة (اختياري)
                            </p>
                            <div className="flex flex-wrap gap-2">
                              {ratingTags.map((tag) => {
                                const TagIcon = tag.icon;
                                const isSelected = selectedTags.includes(tag.id);
                                return (
                                  <motion.button
                                    key={tag.id}
                                    type="button"
                                    whileTap={{ scale: 0.92 }}
                                    onClick={() =>
                                      setSelectedTags((prev) =>
                                        prev.includes(tag.id)
                                          ? prev.filter((t) => t !== tag.id)
                                          : [...prev, tag.id]
                                      )
                                    }
                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-200 ${
                                      isSelected
                                        ? tag.positive
                                          ? 'bg-purple-600 text-white shadow-md shadow-purple-500/25'
                                          : 'bg-red-500 text-white shadow-md shadow-red-500/25'
                                        : tag.positive
                                        ? 'bg-purple-50 dark:bg-purple-900/15 text-purple-600 dark:text-purple-400 hover:bg-purple-100 dark:hover:bg-purple-900/25 border border-purple-200/60 dark:border-purple-800/30'
                                        : 'bg-red-50 dark:bg-red-900/15 text-red-500 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/25 border border-red-200/60 dark:border-red-800/30'
                                    }`}
                                  >
                                    <TagIcon className="w-3 h-3" />
                                    {tag.label}
                                  </motion.button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Comment */}
                      <AnimatePresence>
                        {ratingScore > 0 && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.3, ease: 'easeOut' as const }}
                            className="space-y-2 overflow-hidden"
                          >
                            <p className="text-xs text-muted-foreground font-semibold">
                              تعليقك (اختياري)
                            </p>
                            <Textarea
                              value={ratingComment}
                              onChange={(e) => setRatingComment(e.target.value)}
                              placeholder="شاركنا رأيك في التجربة..."
                              rows={3}
                              dir="rtl"
                              className="resize-none rounded-xl border-purple-200/50 dark:border-purple-800/30 focus:border-purple-500"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Anonymous toggle */}
                      <AnimatePresence>
                        {ratingScore > 0 && (
                          <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.2, ease: 'easeOut' as const }}
                            className="flex items-center gap-3"
                          >
                            <button
                              type="button"
                              onClick={() => setIsAnonymous(!isAnonymous)}
                              className={`relative w-11 h-6 rounded-full transition-colors duration-200 ${
                                isAnonymous ? 'bg-purple-600' : 'bg-muted'
                              }`}
                            >
                              <motion.div
                                animate={{ x: isAnonymous ? 20 : 2 }}
                                transition={{
                                  type: 'spring',
                                  stiffness: 500,
                                  damping: 30,
                                }}
                                className="absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md"
                              />
                            </button>
                            <span className="text-xs text-muted-foreground font-medium">
                              تقييم مجهول
                            </span>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Submit button */}
                      <AnimatePresence>
                        {ratingScore > 0 && (
                          <motion.div
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: 12 }}
                            transition={{ duration: 0.3, ease: 'easeOut' as const }}
                          >
                            <Button
                              className="w-full gap-2 h-12 bg-gradient-to-l from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 text-white shadow-lg shadow-purple-600/25 font-bold rounded-xl"
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
                                    setExistingRating({
                                      score: ratingScore,
                                      comment: ratingComment,
                                      tags: selectedTags,
                                      isAnonymous,
                                    });
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
                                <Loader2 className="w-5 h-5 animate-spin" />
                              ) : (
                                <Send className="w-5 h-5" />
                              )}
                              إرسال التقييم
                            </Button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Action buttons ── */}
            <div className="flex gap-3 pt-1">
              {activeEmergency.nurseName && activeEmergency.status !== 'resolved' && (
                <Button
                  variant="outline"
                  className="flex-1 gap-2 h-12 rounded-xl border-purple-200 dark:border-purple-800/40 hover:bg-purple-50 dark:hover:bg-purple-900/20 font-semibold"
                  onClick={() => router.push('/beneficiary/chat')}
                >
                  <MessageSquare className="w-4 h-4" />
                  محادثة الممرض/ـة
                </Button>
              )}
              {isResolved && (
                <Button
                  className="flex-1 gap-2 h-12 bg-gradient-to-l from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white shadow-lg shadow-red-500/20 font-bold rounded-xl"
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
        </motion.div>
      </motion.div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ═══════════════════ EMERGENCY REQUEST FORM ═══════════════════════════
  // ═══════════════════════════════════════════════════════════════════════

  const feeValue = emergencyFee || 5000;

  // ── أثناء فحص حالة الخدمات أو عند التعطيل: لا شيء يُعرض ──
  if (!servicesHidden) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-beneficiary animate-spin" />
      </div>
    );
  }

  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-5"
    >
      {/* ── Hero Header ── */}
      <motion.div
        variants={itemVariants}
        className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-red-500 via-rose-600 to-orange-500 p-6 pb-5 text-center text-white shadow-2xl shadow-red-600/25"
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-white/10 blur-2xl" />
          <div className="absolute -bottom-10 -left-10 w-28 h-28 rounded-full bg-white/10 blur-xl" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 rounded-full bg-white/5 blur-3xl" />
        </div>
        <div className="relative z-10">
          <motion.div
            initial={{ scale: 0, rotate: -10 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
            className="w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-4 bg-white/20 backdrop-blur-sm border border-white/25"
          >
            <Ambulance className="w-10 h-10 text-white" />
          </motion.div>
          <h1 className="text-2xl font-black">طلب طوارئ</h1>
          <p className="text-sm opacity-90 mt-1.5 font-medium">
            سيتم إرسال ممرض/ـة فوراً إلى موقعك
          </p>
        </div>
      </motion.div>

      {/* ── Warning + Fee ── */}
      <motion.div variants={itemVariants} className="space-y-3">
        {/* Warning */}
        <div className="flex items-start gap-3 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 text-amber-800 dark:text-amber-300 border border-amber-200/70 dark:border-amber-900/30 shadow-sm">
          <div className="w-9 h-9 rounded-xl bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0 mt-0.5">
            <AlertTriangle className="w-4.5 h-4.5" />
          </div>
          <div className="text-sm">
            <p className="font-bold mb-1">تنبيه هام</p>
            <p className="leading-relaxed">
              يرجى استخدام خدمة الطوارئ فقط في الحالات الطارئة الفعلية. لا يمكن إرسال طلب طوارئ
              آخر حتى يتم التعامل مع الطلب الحالي.
            </p>
          </div>
        </div>

        {/* Emergency Fee Card */}
        <GlassCard
          variant="beneficiary"
          className="overflow-hidden p-0 border-2 border-red-200/70 dark:border-red-900/30"
        >
          <div className="bg-gradient-to-l from-red-500 to-rose-600 px-4 py-3 flex items-center gap-2.5">
            <Wallet className="w-4.5 h-4.5 text-white" />
            <span className="text-white font-bold text-sm">رسوم خدمة الطوارئ</span>
          </div>
          <div className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs text-muted-foreground">تدفع عند تقديم الخدمة</p>
              {emergencyFee === null ? (
                <Loader2 className="w-5 h-5 animate-spin text-red-600 mt-1" />
              ) : (
                <p className="text-2xl font-black text-red-600 dark:text-red-400 mt-1">
                  {formatYemeniRial(feeValue)}
                </p>
              )}
            </div>
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/20 dark:to-orange-900/20 flex items-center justify-center shadow-inner">
              <Wallet className="w-7 h-7 text-red-500" />
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ── Emergency Type Selection ── */}
      <motion.div variants={itemVariants} className="space-y-3">
        <Label className="font-bold text-sm flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
            <AlertTriangle className="w-4 h-4 text-red-600" />
          </div>
          نوع الطوارئ <span className="text-red-500">*</span>
        </Label>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {emergencyTypes.map((type, idx) => {
            const Icon = type.icon;
            const isSelected = selectedType === type.value;
            return (
              <motion.button
                key={type.value}
                variants={cardHover}
                initial="rest"
                whileHover="hover"
                whileTap={{ scale: 0.95 }}
                onClick={() => setSelectedType(type.value)}
                className={`relative flex flex-col items-center gap-2.5 p-4 rounded-2xl transition-all duration-300 border-2 overflow-hidden ${
                  isSelected
                    ? `border-purple-500 bg-purple-50/80 dark:bg-purple-900/20 shadow-lg ${type.glow}`
                    : 'border-transparent glass hover:border-purple-200/50 dark:hover:border-purple-900/30'
                }`}
              >
                {/* Background glow when selected */}
                {isSelected && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className={`absolute inset-0 bg-gradient-to-br ${type.gradient} opacity-[0.06]`}
                  />
                )}
                <div
                  className={`relative w-16 h-16 rounded-2xl flex items-center justify-center text-white shadow-lg bg-gradient-to-br ${type.gradient} ${type.glow}`}
                >
                  <Icon className="w-8 h-8" />
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white shadow-md flex items-center justify-center"
                    >
                      <Check className="w-3 h-3 text-purple-600" />
                    </motion.div>
                  )}
                </div>
                <span className="text-xs font-bold text-center relative z-10">{type.label}</span>
                <span className="text-[10px] text-muted-foreground text-center leading-tight relative z-10">
                  {type.description}
                </span>
              </motion.button>
            );
          })}
        </div>
      </motion.div>

      {/* ── Description ── */}
      <motion.div variants={itemVariants}>
        <GlassCard variant="beneficiary" className="space-y-3">
          <Label className="flex items-center gap-2 font-semibold">
            <FileText className="w-4 h-4 text-purple-500" />
            وصف الحالة <span className="text-red-500">*</span>
          </Label>
          <Textarea
            placeholder="صف حالتك باختصار..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            dir="rtl"
            className="min-h-[80px] rounded-xl border-purple-200/50 dark:border-purple-800/30 focus:border-purple-500 resize-none"
          />
        </GlassCard>
      </motion.div>

      {/* ── Location ── */}
      <motion.div variants={itemVariants}>
        <GlassCard variant="beneficiary" className="space-y-3">
          <Label className="flex items-center gap-2 font-semibold">
            <MapPin className="w-4 h-4 text-red-500" />
            الموقع
          </Label>
          <GpsLocationButton
            onLocationDetected={(loc) => {
              setLat(loc.latitude);
              setLng(loc.longitude);
              // Accept any address — coordinates initially, then enriched address via callback
              if (loc.address) {
                setAddress(loc.address);
              }
              if (loc.governorate) {
                // Could store governorate if needed
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
              className="rounded-xl border-purple-200/50 dark:border-purple-800/30 focus:border-purple-500 resize-none"
            />
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ═══════════════ PAYMENT METHOD ════════════════════════════ */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <motion.div variants={itemVariants}>
        <GlassCard variant="beneficiary" className="space-y-4">
          <Label className="flex items-center gap-2 font-semibold">
            <CreditCard className="w-4 h-4 text-purple-500" />
            طريقة الدفع <span className="text-red-500">*</span>
          </Label>

          {paymentMethods.length === 0 ? (
            <div className="text-center py-8">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}
                className="w-10 h-10 mx-auto mb-3"
              >
                <CreditCard className="w-10 h-10 text-muted-foreground" />
              </motion.div>
              <p className="text-sm text-muted-foreground">جاري تحميل طرق الدفع...</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* ── Cash Methods ── */}
              {cashMethods.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-green-700 dark:text-green-400 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <HandCoins className="w-3.5 h-3.5" />
                    </div>
                    نقدي عند الوصول
                  </p>
                  {cashMethods.map((pm) => {
                    const isSelected = selectedPaymentMethodId === pm.id;
                    return (
                      <motion.label
                        key={pm.id}
                        whileTap={{ scale: 0.98 }}
                        className={`relative flex items-center gap-3.5 p-3.5 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                          isSelected
                            ? 'border-green-500 bg-green-50/80 dark:bg-green-900/20 shadow-md shadow-green-500/10'
                            : 'border-transparent glass hover:border-green-200/50 dark:hover:border-green-900/30'
                        }`}
                      >
                        {/* Custom radio indicator */}
                        <div
                          className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'border-green-500 bg-green-500'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-2 h-2 rounded-full bg-white"
                            />
                          )}
                        </div>
                        <input
                          type="radio"
                          name="payment"
                          checked={isSelected}
                          onChange={() => setSelectedPaymentMethodId(pm.id)}
                          className="sr-only"
                        />
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-sm">{pm.nameAr}</p>
                            {isSelected && (
                              <motion.span
                                initial={{ opacity: 0, x: -8 }}
                                animate={{ opacity: 1, x: 0 }}
                                className="font-bold text-green-600 dark:text-green-400 text-sm"
                              >
                                {formatYemeniRial(feeValue)}
                              </motion.span>
                            )}
                          </div>
                          {pm.instructions && (
                            <p className="text-xs text-muted-foreground mt-0.5">
                              {pm.instructions}
                            </p>
                          )}
                        </div>
                      </motion.label>
                    );
                  })}
                </div>
              )}

              {/* ── Wallet Methods ── */}
              {walletMethods.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-purple-700 dark:text-purple-400 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Smartphone className="w-3.5 h-3.5" />
                    </div>
                    إيداع محفظة إلكترونية
                  </p>
                  {walletMethods.map((pm) => {
                    const isSelected = selectedPaymentMethodId === pm.id;
                    return (
                      <motion.label
                        key={pm.id}
                        whileTap={{ scale: 0.98 }}
                        className={`relative flex items-start gap-3.5 p-3.5 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                          isSelected
                            ? 'border-purple-500 bg-purple-50/80 dark:bg-purple-900/20 shadow-md shadow-purple-500/10'
                            : 'border-transparent glass hover:border-purple-200/50 dark:hover:border-purple-900/30'
                        }`}
                      >
                        {/* Custom radio indicator */}
                        <div
                          className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'border-purple-500 bg-purple-500'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-2 h-2 rounded-full bg-white"
                            />
                          )}
                        </div>
                        <input
                          type="radio"
                          name="payment"
                          checked={isSelected}
                          onChange={() => setSelectedPaymentMethodId(pm.id)}
                          className="sr-only"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-sm">{pm.nameAr}</p>
                            <span className="text-[10px] text-muted-foreground">{pm.nameEn}</span>
                          </div>
                          {isSelected && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              transition={{ duration: 0.3, ease: 'easeOut' as const }}
                              className="space-y-2.5 pt-2.5 border-t border-purple-200/50 dark:border-purple-800/30 overflow-hidden"
                            >
                              {/* Amount display */}
                              <div className="flex items-center justify-between p-2.5 rounded-lg bg-purple-100/60 dark:bg-purple-900/30">
                                <span className="text-xs font-semibold text-purple-700 dark:text-purple-300">
                                  المبلغ المطلوب
                                </span>
                                <span className="font-bold text-purple-600 dark:text-purple-400 text-sm">
                                  {formatYemeniRial(feeValue)}
                                </span>
                              </div>
                              {pm.accountName && (
                                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/50 dark:bg-black/20 border border-purple-100/50 dark:border-purple-900/20">
                                  <span className="text-xs text-muted-foreground shrink-0 font-medium">
                                    الاسم:
                                  </span>
                                  <span className="text-sm font-medium flex-1 truncate">
                                    {pm.accountName}
                                  </span>
                                  <CopyBtn text={pm.accountName} />
                                </div>
                              )}
                              {pm.accountNumber && (
                                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/50 dark:bg-black/20 border border-purple-100/50 dark:border-purple-900/20">
                                  <span className="text-xs text-muted-foreground shrink-0 font-medium">
                                    الرقم:
                                  </span>
                                  <span
                                    className="text-sm font-mono font-bold tracking-wider flex-1"
                                    dir="ltr"
                                  >
                                    {pm.accountNumber}
                                  </span>
                                  <CopyBtn text={pm.accountNumber} />
                                </div>
                              )}
                              {pm.instructions && (
                                <p className="text-xs text-muted-foreground">{pm.instructions}</p>
                              )}
                            </motion.div>
                          )}
                        </div>
                      </motion.label>
                    );
                  })}
                </div>
              )}

              {/* ── Bank/Exchange Methods ── */}
              {bankMethods.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm font-bold text-blue-700 dark:text-blue-400 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    تحويل بنكي / صرافة
                  </p>
                  {bankMethods.map((pm) => {
                    const isSelected = selectedPaymentMethodId === pm.id;
                    return (
                      <motion.label
                        key={pm.id}
                        whileTap={{ scale: 0.98 }}
                        className={`relative flex items-start gap-3.5 p-3.5 rounded-xl cursor-pointer transition-all duration-200 border-2 ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50/80 dark:bg-blue-900/20 shadow-md shadow-blue-500/10'
                            : 'border-transparent glass hover:border-blue-200/50 dark:hover:border-blue-900/30'
                        }`}
                      >
                        {/* Custom radio indicator */}
                        <div
                          className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center transition-colors ${
                            isSelected
                              ? 'border-blue-500 bg-blue-500'
                              : 'border-gray-300 dark:border-gray-600'
                          }`}
                        >
                          {isSelected && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="w-2 h-2 rounded-full bg-white"
                            />
                          )}
                        </div>
                        <input
                          type="radio"
                          name="payment"
                          checked={isSelected}
                          onChange={() => setSelectedPaymentMethodId(pm.id)}
                          className="sr-only"
                        />
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center justify-between">
                            <p className="font-semibold text-sm">{pm.nameAr}</p>
                            <span className="text-[10px] text-muted-foreground">{pm.nameEn}</span>
                          </div>
                          {isSelected && (
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              transition={{ duration: 0.3, ease: 'easeOut' as const }}
                              className="space-y-2.5 pt-2.5 border-t border-blue-200/50 dark:border-blue-800/30 overflow-hidden"
                            >
                              {/* Amount display */}
                              <div className="flex items-center justify-between p-2.5 rounded-lg bg-blue-100/60 dark:bg-blue-900/30">
                                <span className="text-xs font-semibold text-blue-700 dark:text-blue-300">
                                  المبلغ المطلوب
                                </span>
                                <span className="font-bold text-blue-600 dark:text-blue-400 text-sm">
                                  {formatYemeniRial(feeValue)}
                                </span>
                              </div>
                              {pm.accountName && (
                                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/50 dark:bg-black/20 border border-blue-100/50 dark:border-blue-900/20">
                                  <span className="text-xs text-muted-foreground shrink-0 font-medium">
                                    الاسم:
                                  </span>
                                  <span className="text-sm font-medium flex-1 truncate">
                                    {pm.accountName}
                                  </span>
                                  <CopyBtn text={pm.accountName} />
                                </div>
                              )}
                              {pm.accountNumber && (
                                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-white/50 dark:bg-black/20 border border-blue-100/50 dark:border-blue-900/20">
                                  <span className="text-xs text-muted-foreground shrink-0 font-medium">
                                    الهاتف:
                                  </span>
                                  <span
                                    className="text-sm font-mono font-bold tracking-wider flex-1"
                                    dir="ltr"
                                  >
                                    {pm.accountNumber}
                                  </span>
                                  <CopyBtn text={pm.accountNumber} />
                                </div>
                              )}
                              {pm.instructions && (
                                <p className="text-xs text-muted-foreground">{pm.instructions}</p>
                              )}
                            </motion.div>
                          )}
                        </div>
                      </motion.label>
                    );
                  })}
                </div>
              )}

              {/* ── Payment Proof Upload for non-cash ── */}
              <AnimatePresence>
                {selectedPaymentMethod && !isCashPayment && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3, ease: 'easeOut' as const }}
                    className="space-y-3 pt-4 border-t border-border overflow-hidden"
                  >
                    <Label className="flex items-center gap-2 font-semibold text-sm">
                      <Upload className="w-4 h-4 text-purple-500" />
                      إثبات الدفع (اختياري)
                    </Label>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      قم بتحويل المبلغ ثم ارفع صورة إثبات الدفع. يمكنك أيضاً إرسالها عبر الواتساب
                      بعد تأكيد الطلب.
                    </p>
                    {paymentProofPreview ? (
                      <div className="relative rounded-xl overflow-hidden border-2 border-purple-200/50 dark:border-purple-800/30 shadow-lg">
                        <img
                          src={paymentProofPreview}
                          alt="إثبات الدفع"
                          className="w-full max-h-52 object-cover"
                        />
                        <button
                          onClick={() => {
                            setPaymentProofFile(null);
                            setPaymentProofPreview(null);
                          }}
                          className="absolute top-2 left-2 p-2 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors shadow-lg"
                        >
                          <X className="w-4 h-4" />
                        </button>
                        <div className="absolute bottom-2 right-2 px-2.5 py-1 rounded-lg bg-green-500/90 text-white text-[10px] font-bold flex items-center gap-1">
                          <CheckCircle2 className="w-3 h-3" />
                          تم الرفع
                        </div>
                      </div>
                    ) : (
                      <label className="flex flex-col items-center justify-center gap-2.5 p-6 rounded-xl border-2 border-dashed border-purple-300/50 dark:border-purple-700/30 hover:border-purple-500/70 dark:hover:border-purple-500/50 cursor-pointer transition-all duration-200 bg-purple-50/30 dark:bg-purple-900/10 hover:bg-purple-50/60 dark:hover:bg-purple-900/20">
                        <div className="w-12 h-12 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-purple-500" />
                        </div>
                        <span className="text-xs text-muted-foreground font-medium">
                          اضغط لرفع صورة إثبات الدفع
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={handlePaymentProofChange}
                        />
                      </label>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* ── Submit Button ── */}
      <motion.div variants={slideUp}>
        <Button
          onClick={() => setShowConfirmation(true)}
          disabled={!selectedType || !description.trim() || cooldown > 0 || !selectedPaymentMethodId}
          className="w-full h-14 text-lg gap-3 bg-gradient-to-l from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white shadow-2xl shadow-red-600/25 font-bold rounded-2xl disabled:opacity-50 disabled:shadow-none transition-all duration-200"
        >
          {cooldown > 0 ? (
            <>
              <Clock className="w-6 h-6" />
              انتظر {toArabicNum(cooldown)} ثانية
            </>
          ) : (
            <>
              <Ambulance className="w-6 h-6" />
              إرسال طلب الطوارئ
            </>
          )}
        </Button>
      </motion.div>

      {/* ═══════════════════════════════════════════════════════════ */}
      {/* ═══════════════ CONFIRMATION DIALOG ═══════════════════════ */}
      {/* ═══════════════════════════════════════════════════════════ */}
      <AnimatePresence>
        {showConfirmation && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={() => setShowConfirmation(false)}
          >
            <motion.div
              initial={{ scale: 0.85, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.85, opacity: 0, y: 20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 25 }}
              className="w-full max-w-md bg-background rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] overflow-y-auto border border-border/50"
              onClick={(e) => e.stopPropagation()}
              dir="rtl"
            >
              {/* Header */}
              <div className="relative bg-gradient-to-l from-red-600 to-rose-700 text-white p-6 overflow-hidden">
                <div className="absolute inset-0 overflow-hidden pointer-events-none">
                  <div className="absolute -top-8 -left-8 w-24 h-24 rounded-full bg-white/10 blur-xl" />
                </div>
                <div className="relative flex items-center gap-4">
                  <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                    <AlertTriangle className="w-7 h-7" />
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">تأكيد طلب الطوارئ</h3>
                    <p className="text-sm text-red-100">هل أنت متأكد من إرسال الطلب؟</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="p-5 space-y-3.5">
                {/* Emergency type */}
                <div className="flex items-center gap-3.5 p-3.5 rounded-xl bg-purple-50/50 dark:bg-purple-900/10 border border-purple-100/50 dark:border-purple-900/20">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center text-white shadow-md bg-gradient-to-br ${
                      emergencyTypes.find((t) => t.value === selectedType)?.gradient ||
                      'from-red-500 to-red-600'
                    }`}
                  >
                    {(() => {
                      const TypeIcon =
                        emergencyTypes.find((t) => t.value === selectedType)?.icon || AlertTriangle;
                      return <TypeIcon className="w-5 h-5" />;
                    })()}
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground font-medium">نوع الطوارئ</p>
                    <p className="font-bold text-sm">
                      {emergencyTypes.find((t) => t.value === selectedType)?.label || selectedType}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <div className="p-3.5 rounded-xl bg-muted/40 border border-border/50">
                  <p className="text-[10px] text-muted-foreground font-medium mb-1">الوصف</p>
                  <p className="text-sm line-clamp-3 leading-relaxed">{description}</p>
                </div>

                {/* Fee */}
                <div className="flex items-center justify-between p-4 rounded-xl bg-red-50/80 dark:bg-red-900/15 border border-red-200/50 dark:border-red-900/25">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-red-600" />
                    <span className="text-sm font-bold text-red-700 dark:text-red-400">
                      رسوم الطوارئ
                    </span>
                  </div>
                  <span className="font-black text-red-600 dark:text-red-400 text-lg">
                    {formatYemeniRial(feeValue)}
                  </span>
                </div>

                {/* Payment Method */}
                {selectedPaymentMethod && (
                  <div
                    className={`flex items-center gap-3 p-3.5 rounded-xl border-2 ${getTypeColor(
                      selectedPaymentMethod.type
                    )}`}
                  >
                    {getTypeIcon(selectedPaymentMethod.type)}
                    <div>
                      <p className="text-[10px] text-muted-foreground font-medium">طريقة الدفع</p>
                      <p className="font-semibold text-sm">{selectedPaymentMethod.nameAr}</p>
                    </div>
                  </div>
                )}

                {/* Warning */}
                <div className="flex items-start gap-2.5 p-3 rounded-xl bg-yellow-50/80 dark:bg-yellow-900/10 text-yellow-700 dark:text-yellow-400 border border-yellow-200/50 dark:border-yellow-900/20">
                  <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="text-xs space-y-1">
                    <p className="font-bold">تنبيه قبل التأكيد:</p>
                    <p className="leading-relaxed">
                      لا يمكن إرسال طلب طوارئ آخر حتى يتم التعامل مع الطلب الحالي. تأكد من صحة
                      المعلومات قبل الإرسال.
                    </p>
                  </div>
                </div>
              </div>

              {/* Actions */}
              <div className="p-5 pt-2 flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1 h-12 rounded-xl font-semibold"
                  onClick={() => setShowConfirmation(false)}
                  disabled={isSubmitting}
                >
                  <X className="w-4 h-4 ml-1" />
                  إلغاء
                </Button>
                <Button
                  className="flex-1 h-12 bg-gradient-to-l from-red-500 to-rose-600 hover:from-red-600 hover:to-rose-700 text-white gap-2 shadow-lg shadow-red-500/20 font-bold rounded-xl"
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
    </motion.div>
  );
}
