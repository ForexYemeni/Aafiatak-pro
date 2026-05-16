'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight, Briefcase, Clock, DollarSign, MapPin, Loader2,
  CheckCircle2, XCircle, Upload, Navigation, User, CreditCard,
  Wallet, Building2, Calendar, FileText, AlertTriangle, Eye,
  Star, ShieldCheck, Award, BriefcaseMedical, Phone, X, MessageSquare,
  Copy, PlayCircle, CheckSquare, Zap, Activity, TrendingUp
} from 'lucide-react';
import { GlassCard } from '@/components/common/glass-card';
import { BadgeStatus } from '@/components/common/badge-status';
import { EmptyState } from '@/components/common/empty-state';
import { CardSkeleton } from '@/components/common/loading-skeleton';
import { useAuthFetch } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { toArabicNum } from '@/components/common/date-formatter';

/* ─────────────── Types ─────────────── */
interface DeploymentLocation {
  lat?: number;
  lng?: number;
  address?: string;
  governorate?: string;
  district?: string;
}

interface DeploymentApplication {
  _id?: string;
  applicantId: string;
  applicantRole: string;
  applicantName: string;
  applicantSpecialization?: string[];
  applicantExperience?: number;
  applicantRating?: number;
  applicantCompletedJobs?: number;
  applicantVerificationStatus?: string;
  status: 'pending' | 'selected_by_creator' | 'admin_approved' | 'payment_pending' | 'payment_submitted' | 'payment_verified' | 'accepted' | 'rejected';
  appliedAt: string;
  hasPaymentProof: boolean;
  paymentProofData?: string;
  paymentProofImage?: string;
  paymentSubmittedAt?: string;
  paymentVerifiedAt?: string;
  paymentVerifiedBy?: string;
  serviceFee: number;
  coverLetter?: string;
  rejectedReason?: string;
}

interface DeploymentDetail {
  id: string;
  createdBy: { id?: string; name?: string; phone?: string } | null;
  creatorRole: 'admin' | 'nurse';
  creatorPhone?: string;
  title: string;
  description: string;
  type: 'nursing' | 'lab' | 'midwife' | 'home_care' | 'other';
  specialization: string[];
  hours: number;
  location: DeploymentLocation;
  amount: number;
  adminCommissionPercent: number;
  adminCommissionAmount: number;
  creatorServiceFee: number;
  applicantServiceFee: number;
  serviceFee: number;
  totalWithFee: number;
  feeResponsible: 'applicant' | 'creator';
  paymentMethod: string;
  walletNumber: string;
  walletOwnerName: string;
  status: 'open' | 'creator_selected' | 'admin_approved' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo: { id?: string; name?: string; phone?: string } | null;
  assignedAt?: string;
  contactRevealed?: boolean;
  rating?: number;
  ratingComment?: string;
  ratedAt?: string;
  ratedBy?: string;
  applications: DeploymentApplication[];
  startDate?: string;
  endDate?: string;
  completedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  requirements?: string;
  notes?: string;
  createdAt: string;
  updatedAt?: string;
}

/* ─────────────── Constants ─────────────── */
const typeLabels: Record<string, string> = {
  nursing: 'تمريض',
  lab: 'مختبر',
  midwife: 'توليد',
  home_care: 'رعاية منزلية',
  other: 'أخرى',
};

const typeColors: Record<string, { bg: string; text: string; icon: string }> = {
  nursing:    { bg: 'bg-teal-500',    text: 'text-teal-600 dark:text-teal-400',    icon: 'bg-teal-100 dark:bg-teal-900/30' },
  lab:        { bg: 'bg-purple-500',  text: 'text-purple-600 dark:text-purple-400', icon: 'bg-purple-100 dark:bg-purple-900/30' },
  midwife:    { bg: 'bg-pink-500',    text: 'text-pink-600 dark:text-pink-400',     icon: 'bg-pink-100 dark:bg-pink-900/30' },
  home_care:  { bg: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',   icon: 'bg-amber-100 dark:bg-amber-900/30' },
  other:      { bg: 'bg-gray-500',    text: 'text-gray-600 dark:text-gray-400',      icon: 'bg-gray-100 dark:bg-gray-900/30' },
};

const deploymentStatusMap: Record<string, string> = {
  open: 'pending',
  creator_selected: 'creator_selected',
  admin_approved: 'admin_approved',
  assigned: 'assigned',
  in_progress: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
};

const deploymentStatusLabel: Record<string, string> = {
  open: 'متاح',
  creator_selected: 'تم اختيار مكلف',
  admin_approved: 'موافقة الإدارة',
  assigned: 'تم التعيين',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

const applicationStatusMap: Record<string, string> = {
  pending: 'pending',
  selected_by_creator: 'selected_by_creator',
  admin_approved: 'admin_approved',
  payment_pending: 'payment_pending',
  payment_submitted: 'payment_submitted',
  payment_verified: 'payment_verified',
  accepted: 'accepted',
  rejected: 'rejected',
};

const applicationStatusLabel: Record<string, string> = {
  pending: 'معلق',
  selected_by_creator: 'تم اختياره',
  admin_approved: 'موافقة الإدارة',
  payment_pending: 'بانتظار الدفع',
  payment_submitted: 'بانتظار مراجعة الإدارة',
  payment_verified: 'تم التحقق',
  accepted: 'مقبول',
  rejected: 'مرفوض',
};

/* ─────────────── G) Status timeline config (updated) ─────────────── */
const statusTimeline: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'open', label: 'تم الإنشاء', icon: Briefcase },
  { key: 'creator_selected', label: 'تم اختيار مكلف', icon: User },
  { key: 'admin_approved', label: 'موافقة الإدارة', icon: CheckCircle2 },
  { key: 'assigned', label: 'تم التعيين', icon: User },
  { key: 'in_progress', label: 'قيد التنفيذ', icon: Clock },
  { key: 'completed', label: 'مكتمل', icon: CheckCircle2 },
];

const statusOrder = ['open', 'creator_selected', 'admin_approved', 'assigned', 'in_progress', 'completed'];

/* ─────────────── Animation ─────────────── */
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0, transition: { ease: 'easeOut' as const } } } as const;
const pulseRing = { scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] } as const;

/* ════════════════════════════════════════════════════════════════ */
/* ═══════════════ MAIN COMPONENT ════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════ */
export default function NurseDeploymentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const deploymentId = params.id as string;
  const authFetch = useAuthFetch();
  const currentUser = useAuthStore((s) => s.user);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [deployment, setDeployment] = useState<DeploymentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Payment proof modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentProof, setPaymentProof] = useState('');
  const [paymentProofImage, setPaymentProofImage] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Apply modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [isApplying, setIsApplying] = useState(false);

  // Rating state
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Select applicant state
  const [isSelecting, setIsSelecting] = useState(false);

  // Task execution state
  const [isExecuting, setIsExecuting] = useState(false);

  /* ── Fetch deployment ── */
  const fetchDeployment = useCallback(async () => {
    if (!deploymentId) return;
    try {
      const res = await authFetch(`/api/deployments/${deploymentId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setDeployment(json.data);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, deploymentId]);

  useEffect(() => {
    void fetchDeployment();
  }, [fetchDeployment]);

  /* ── Get my application ── */
  const myApplication = deployment?.applications.find(
    (a) => a.applicantId === currentUser?.id
  );

  const isAssignedToMe = deployment?.assignedTo?.id === currentUser?.id;
  const isCreator = deployment?.createdBy?.id === currentUser?.id;
  const hasApplied = !!myApplication;

  /* ── D) Apply for deployment (updated message) ── */
  const handleApply = async () => {
    setIsApplying(true);
    try {
      const res = await authFetch(`/api/deployments/${deploymentId}/apply`, {
        method: 'POST',
        body: JSON.stringify({ coverLetter }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم التقديم بنجاح. سيتم إشعارك عند اختيارك من قبل صاحب التكليف');
        void fetchDeployment();
        setShowApplyModal(false);
        setCoverLetter('');
      } else {
        toast.error(json.message ?? 'فشل التقديم');
      }
    } catch {
      toast.error('حدث خطأ أثناء التقديم');
    } finally {
      setIsApplying(false);
    }
  };

  /* ── C) Submit payment proof (updated with image) ── */
  const handleSubmitPayment = async () => {
    if (!paymentProofImage) {
      toast.error('لقطة الشاشة إلزامية — يرجى رفع صورة إثبات الدفع');
      return;
    }
    setIsSubmittingPayment(true);
    try {
      const res = await authFetch(`/api/deployments/${deploymentId}/submit-payment`, {
        method: 'POST',
        body: JSON.stringify({
          paymentProofData: paymentProof || undefined,
          paymentProofImage: paymentProofImage || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تقديم إثبات الدفع بنجاح. سيتم مراجعته قريباً');
        void fetchDeployment();
        setShowPaymentModal(false);
        setPaymentProof('');
        setPaymentProofImage('');
      } else {
        toast.error(json.message ?? 'فشل تقديم إثبات الدفع');
      }
    } catch {
      toast.error('حدث خطأ أثناء تقديم إثبات الدفع');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  /* ── Handle image upload (convert to base64) ── */
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة فقط');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPaymentProofImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  /* ── F) Submit rating ── */
  const handleRate = async () => {
    if (ratingValue < 1 || ratingValue > 5) {
      toast.error('يرجى اختيار تقييم من 1 إلى 5');
      return;
    }
    setIsSubmittingRating(true);
    try {
      const res = await authFetch(`/api/deployments/${deploymentId}/rate`, {
        method: 'POST',
        body: JSON.stringify({ rating: ratingValue, ratingComment }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تقييم المكلف بنجاح');
        void fetchDeployment();
        setRatingValue(0);
        setRatingComment('');
      } else {
        toast.error(json.message ?? 'فشل التقييم');
      }
    } catch {
      toast.error('حدث خطأ أثناء التقييم');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  /* ── Start task execution ── */
  const handleStartExecution = async () => {
    setIsExecuting(true);
    try {
      const res = await authFetch(`/api/deployments/${deploymentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'in_progress' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم بدء تنفيذ التكليف بنجاح');
        void fetchDeployment();
      } else {
        toast.error(json.message ?? 'فشل بدء التنفيذ');
      }
    } catch {
      toast.error('حدث خطأ أثناء بدء التنفيذ');
    } finally {
      setIsExecuting(false);
    }
  };

  /* ── Complete task ── */
  const handleCompleteExecution = async () => {
    setIsExecuting(true);
    try {
      const res = await authFetch(`/api/deployments/${deploymentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم إكمال التكليف بنجاح! 🎉');
        void fetchDeployment();
      } else {
        toast.error(json.message ?? 'فشل إكمال التكليف');
      }
    } catch {
      toast.error('حدث خطأ أثناء إكمال التكليف');
    } finally {
      setIsExecuting(false);
    }
  };

  /* ── Select applicant ── */
  const handleSelectApplicant = async (applicationId: string) => {
    setIsSelecting(true);
    try {
      const res = await authFetch(`/api/deployments/${deploymentId}/select-applicant`, {
        method: 'PATCH',
        body: JSON.stringify({ applicationId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم اختيار المتقدم. بانتظار موافقة الإدارة');
        void fetchDeployment();
      } else {
        toast.error(json.message ?? 'فشل اختيار المتقدم');
      }
    } catch {
      toast.error('حدث خطأ أثناء اختيار المتقدم');
    } finally {
      setIsSelecting(false);
    }
  };

  /* ── Format date ── */
  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-YE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  /* ═══════════════ LOADING ═══════════════ */
  if (isLoading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!deployment) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">لم يتم العثور على التكليف</p>
        <Button onClick={() => router.push('/nurse/deployments')}>العودة للتكليفات</Button>
      </div>
    );
  }

  const tc = typeColors[deployment.type] || typeColors.other;
  const currentStatusIndex = statusOrder.indexOf(deployment.status);
  const isCancelled = deployment.status === 'cancelled';

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-6">
      {/* Header */}
      <motion.div variants={itemAnim} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/nurse/deployments')}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">تفاصيل التكليف</h1>
          <p className="text-sm text-muted-foreground">رقم التكليف: #{deploymentId.slice(-6)}</p>
        </div>
        <BadgeStatus
          status={deploymentStatusMap[deployment.status] || 'pending'}
          label={deploymentStatusLabel[deployment.status] || deployment.status}
          size="md"
        />
      </motion.div>

      {/* Deployment Info Card */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="nurse" className="space-y-4">
          {/* Title & Type */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-xl ${tc.icon} flex items-center justify-center`}>
                <Briefcase className={`w-7 h-7 ${tc.text}`} />
              </div>
              <div>
                <h2 className="font-bold text-lg">{deployment.title}</h2>
                <span className="text-sm text-muted-foreground">{typeLabels[deployment.type] || deployment.type}</span>
              </div>
            </div>
          </div>

          {/* Description */}
          {deployment.description && (
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-[10px] text-muted-foreground mb-1 font-medium">الوصف</p>
              <p className="text-sm leading-relaxed">{deployment.description}</p>
            </div>
          )}

          {/* Details Grid */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-[10px] text-muted-foreground mb-1 font-medium flex items-center gap-1">
                <Clock className="w-3 h-3" /> الساعات
              </p>
              <p className="font-bold text-sm">{toArabicNum(deployment.hours)} ساعة</p>
            </div>
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-[10px] text-muted-foreground mb-1 font-medium flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> المبلغ
              </p>
              <p className="font-bold text-sm">{toArabicNum(deployment.amount.toLocaleString())} ر.ي</p>
            </div>
            <div className={`rounded-xl p-3 ${(deployment.createdBy as any)?._hidden ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800/30' : 'bg-muted/40'}`}>
              <p className={`text-[10px] mb-1 font-medium flex items-center gap-1 ${(deployment.createdBy as any)?._hidden ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground'}`}>
                <User className="w-3 h-3" /> صاحب التكليف
              </p>
              {(deployment.createdBy as any)?._hidden ? (
                <p className="font-semibold text-xs text-amber-700 dark:text-amber-300">مخفي حتى بعد الدفع</p>
              ) : (
                <p className="font-bold text-sm">{deployment.createdBy?.name || 'غير معروف'}</p>
              )}
            </div>
            {/* Show admin commission info */}
            {deployment.adminCommissionAmount > 0 && (
              <div className="rounded-xl bg-orange-50 dark:bg-orange-900/10 p-3 border border-orange-200 dark:border-orange-900/30">
                <p className="text-[10px] text-orange-600 dark:text-orange-400 mb-1 font-medium flex items-center gap-1">
                  <Wallet className="w-3 h-3" /> للإدارة
                </p>
                <p className="font-bold text-sm text-orange-600 dark:text-orange-400">{toArabicNum(deployment.adminCommissionAmount.toLocaleString())} ر.ي</p>
              </div>
            )}
            {deployment.applicantServiceFee > 0 && (
              <div className="rounded-xl bg-orange-50 dark:bg-orange-900/10 p-3 border border-orange-200 dark:border-orange-900/30">
                <p className="text-[10px] text-orange-600 dark:text-orange-400 mb-1 font-medium flex items-center gap-1">
                  <CreditCard className="w-3 h-3" /> رسوم التقديم
                </p>
                <p className="font-bold text-sm text-orange-600 dark:text-orange-400">{toArabicNum(deployment.applicantServiceFee)} ر.ي</p>
              </div>
            )}
            {deployment.location?.governorate && (
              <div className="rounded-xl bg-muted/40 p-3">
                <p className="text-[10px] text-muted-foreground mb-1 font-medium flex items-center gap-1">
                  <Building2 className="w-3 h-3" /> المحافظة
                </p>
                <p className="font-bold text-sm">{deployment.location.governorate}</p>
              </div>
            )}
            {deployment.location?.address && (
              <div className="rounded-xl bg-muted/40 p-3 col-span-2">
                <p className="text-[10px] text-muted-foreground mb-1 font-medium flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-red-500" /> العنوان
                </p>
                <p className="font-bold text-sm">{deployment.location.address}</p>
                {deployment.location.lat && deployment.location.lng && (
                  <a
                    href={`https://www.google.com/maps?q=${deployment.location.lat},${deployment.location.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-blue-600 mt-1 hover:underline"
                  >
                    <Navigation className="w-3 h-3" /> عرض على الخريطة
                  </a>
                )}
              </div>
            )}
            {deployment.specialization?.length > 0 && (
              <div className="rounded-xl bg-muted/40 p-3 col-span-2">
                <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">التخصصات المطلوبة</p>
                <div className="flex flex-wrap gap-1.5">
                  {deployment.specialization.map((spec, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{spec}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Requirements */}
          {deployment.requirements && (
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-[10px] text-muted-foreground mb-1 font-medium">المتطلبات</p>
              <p className="text-sm">{deployment.requirements}</p>
            </div>
          )}
          {deployment.notes && (
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-[10px] text-muted-foreground mb-1 font-medium">ملاحظات</p>
              <p className="text-sm">{deployment.notes}</p>
            </div>
          )}

          {/* Date */}
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <Calendar className="w-3.5 h-3.5" />
            <span>تاريخ الإنشاء: {formatDate(deployment.createdAt)}</span>
          </div>
        </GlassCard>
      </motion.div>

      {/* G) Status Timeline (updated) */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="nurse" className="space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-nurse" />
            حالة التكليف
          </h3>
          <div className="relative space-y-0">
            {/* Vertical connecting line */}
            <div className="absolute right-4 top-0 bottom-0 w-0.5 bg-muted/50" />
            {statusTimeline.map((step, index) => {
              const Icon = step.icon;
              const isReached = index <= currentStatusIndex && !isCancelled;
              const isCurrent = index === currentStatusIndex && !isCancelled;

              return (
                <div key={step.key} className="flex items-center gap-4 relative pb-6 last:pb-0">
                  <motion.div
                    initial={false}
                    animate={isCurrent ? { scale: [1, 1.1, 1] } : {}}
                    transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' as const }}
                    className={`relative w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 z-10 ${
                      isReached
                        ? 'bg-gradient-to-bl from-nurse to-teal-600 text-white shadow-lg shadow-nurse/20'
                        : 'bg-muted/80 text-muted-foreground border border-border'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {isCurrent && (
                      <motion.div
                        className="absolute inset-0 rounded-2xl border-2 border-nurse/40"
                        animate={pulseRing}
                        transition={{ duration: 2, repeat: Infinity, ease: 'easeOut' as const }}
                      />
                    )}
                  </motion.div>
                  <div className="flex-1">
                    <p className={`text-sm font-semibold ${isReached ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {step.label}
                    </p>
                  </div>
                  {isReached && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ ease: 'easeOut' as const }}
                    >
                      <CheckCircle2 className="w-4 h-4 text-nurse" />
                    </motion.div>
                  )}
                </div>
              );
            })}

            {isCancelled && (
              <div className="flex items-center gap-4 relative">
                <div className="w-9 h-9 rounded-2xl bg-destructive text-destructive-foreground flex items-center justify-center shrink-0 z-10">
                  <XCircle className="w-4 h-4" />
                </div>
                <p className="text-sm font-semibold text-destructive">
                  تم إلغاء التكليف
                </p>
              </div>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* My Application Status (updated for new flow) */}
      {hasApplied && myApplication && (
        <motion.div variants={itemAnim}>
          <GlassCard variant="nurse" className="space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <FileText className="w-4 h-4 text-nurse" />
              حالة تقديمك
            </h3>

            <div className="p-3 rounded-xl bg-muted/40 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">الحالة</span>
                <BadgeStatus
                  status={applicationStatusMap[myApplication.status] || 'pending'}
                  label={applicationStatusLabel[myApplication.status] || myApplication.status}
                  size="md"
                />
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">تاريخ التقديم</span>
                <span className="font-medium">{formatDate(myApplication.appliedAt)}</span>
              </div>
              {myApplication.serviceFee > 0 && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">رسوم التقديم</span>
                  <span className="font-medium">{toArabicNum(myApplication.serviceFee)} ر.ي</span>
                </div>
              )}
              {myApplication.paymentSubmittedAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">تاريخ الدفع</span>
                  <span className="font-medium">{formatDate(myApplication.paymentSubmittedAt)}</span>
                </div>
              )}
              {myApplication.rejectedReason && (
                <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/10 text-xs text-red-600 dark:text-red-400 mt-2">
                  {myApplication.rejectedReason}
                </div>
              )}
            </div>

            {/* E) Status display for applicant - selected_by_creator */}
            {myApplication.status === 'selected_by_creator' && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                <div className="flex items-center gap-2 mb-1">
                  <Star className="w-4 h-4 text-amber-600" />
                  <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                    تم اختيارك! بانتظار موافقة الإدارة
                  </p>
                </div>
                <p className="text-xs text-amber-600 dark:text-amber-400">
                  تم اختيارك من قبل صاحب التكليف. سيتم إشعارك عند موافقة الإدارة
                </p>
              </div>
            )}

            {/* E) admin_approved → Show payment details + upload button */}
            {myApplication.status === 'admin_approved' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      تمت موافقة الإدارة! يرجى دفع رسوم التقديم
                    </p>
                  </div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400">
                    المبلغ المطلوب: {toArabicNum(myApplication.serviceFee)} ر.ي
                  </p>
                </div>

                {/* Payment Details Card for admin_approved */}
                {(deployment.paymentMethod || deployment.walletNumber || deployment.walletOwnerName) && (
                  <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-50 to-blue-50 dark:from-sky-950/20 dark:to-blue-950/10 border border-sky-200 dark:border-sky-900/30 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/10 flex items-center justify-center">
                        <CreditCard className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                      </div>
                      <p className="text-sm font-bold text-sky-700 dark:text-sky-300">
                        تفاصيل الدفع
                      </p>
                    </div>
                    {deployment.paymentMethod && (
                      <div className="flex items-center justify-between py-2 border-b border-blue-100 dark:border-blue-800/30">
                        <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          <Wallet className="w-3 h-3" />
                          طريقة الدفع
                        </span>
                        <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
                          {deployment.paymentMethod}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-2 border-b border-blue-100 dark:border-blue-800/30">
                      <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                        <DollarSign className="w-3 h-3" />
                        المبلغ
                      </span>
                      <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
                        {toArabicNum(myApplication.serviceFee)} ر.ي
                      </span>
                    </div>
                    {deployment.walletNumber && (
                      <div className="flex items-center justify-between py-2 border-b border-blue-100 dark:border-blue-800/30">
                        <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          <Phone className="w-3 h-3" />
                          رقم المحفظة
                        </span>
                        <span className="text-sm font-bold font-mono text-blue-800 dark:text-blue-200" dir="ltr">
                          {deployment.walletNumber}
                        </span>
                      </div>
                    )}
                    {deployment.walletOwnerName && (
                      <div className="flex items-center justify-between py-2">
                        <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          <User className="w-3 h-3" />
                          اسم صاحب المحفظة
                        </span>
                        <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
                          {deployment.walletOwnerName}
                        </span>
                      </div>
                    )}
                    {deployment.walletNumber && (
                      <div className="flex gap-2 pt-2">
                        <a
                          href={`https://wa.me/${deployment.walletNumber.replace(/^0+/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> تحويل واتساب
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(deployment.walletNumber);
                            toast.success('تم نسخ رقم المحفظة');
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                        >
                          نسخ الرقم
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  className="w-full gap-2 bg-gradient-to-l from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg shadow-orange-500/20"
                  onClick={() => {
                    setShowPaymentModal(true);
                    setPaymentProof('');
                    setPaymentProofImage('');
                  }}
                >
                  <Upload className="w-4 h-4" />
                  تقديم إثبات الدفع
                </Button>
              </div>
            )}

            {/* Payment proof upload area if payment_pending */}
            {myApplication.status === 'payment_pending' && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30">
                  <div className="flex items-center gap-2 mb-2">
                    <Wallet className="w-4 h-4 text-orange-600" />
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                      يرجى دفع رسوم التقديم
                    </p>
                  </div>
                  <p className="text-xs text-orange-600 dark:text-orange-400">
                    المبلغ المطلوب: {toArabicNum(myApplication.serviceFee)} ر.ي
                  </p>
                  {myApplication.rejectedReason && (
                    <div className="mt-2.5 p-2 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-200 dark:border-red-800/30">
                      <p className="text-[11px] text-red-600 dark:text-red-400 font-medium flex items-center gap-1.5">
                        <XCircle className="w-3 h-3 shrink-0" />
                        {myApplication.rejectedReason}
                      </p>
                    </div>
                  )}
                </div>

                {/* Payment Details Card */}
                {(deployment.paymentMethod || deployment.walletNumber || deployment.walletOwnerName) && (
                  <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 space-y-3">
                    <div className="flex items-center gap-2 mb-2">
                      <CreditCard className="w-4 h-4 text-blue-600" />
                      <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
                        تفاصيل الدفع
                      </p>
                    </div>
                    {deployment.paymentMethod && (
                      <div className="flex items-center justify-between py-2 border-b border-blue-100 dark:border-blue-800/30">
                        <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          <Wallet className="w-3 h-3" />
                          طريقة الدفع
                        </span>
                        <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
                          {deployment.paymentMethod}
                        </span>
                      </div>
                    )}
                    <div className="flex items-center justify-between py-2 border-b border-blue-100 dark:border-blue-800/30">
                      <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                        <DollarSign className="w-3 h-3" />
                        المبلغ
                      </span>
                      <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
                        {toArabicNum(myApplication.serviceFee)} ر.ي
                      </span>
                    </div>
                    {deployment.walletNumber && (
                      <div className="flex items-center justify-between py-2 border-b border-blue-100 dark:border-blue-800/30">
                        <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          <Phone className="w-3 h-3" />
                          رقم المحفظة
                        </span>
                        <span className="text-sm font-bold font-mono text-blue-800 dark:text-blue-200" dir="ltr">
                          {deployment.walletNumber}
                        </span>
                      </div>
                    )}
                    {deployment.walletOwnerName && (
                      <div className="flex items-center justify-between py-2">
                        <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
                          <User className="w-3 h-3" />
                          اسم صاحب المحفظة
                        </span>
                        <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
                          {deployment.walletOwnerName}
                        </span>
                      </div>
                    )}
                    {deployment.walletNumber && (
                      <div className="flex gap-2 pt-2">
                        <a
                          href={`https://wa.me/${deployment.walletNumber.replace(/^0+/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-green-600 hover:bg-green-700 text-white text-xs font-medium transition-colors"
                        >
                          <MessageSquare className="w-3.5 h-3.5" /> تحويل واتساب
                        </a>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(deployment.walletNumber);
                            toast.success('تم نسخ رقم المحفظة');
                          }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium transition-colors"
                        >
                          نسخ الرقم
                        </button>
                      </div>
                    )}
                  </div>
                )}

                <Button
                  className="w-full gap-2 bg-gradient-to-l from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-lg shadow-orange-500/20"
                  onClick={() => {
                    setShowPaymentModal(true);
                    setPaymentProof('');
                    setPaymentProofImage('');
                  }}
                >
                  <Upload className="w-4 h-4" />
                  تقديم إثبات الدفع
                </Button>
              </div>
            )}

            {/* Show if payment was submitted and waiting verification */}
            {myApplication.status === 'payment_submitted' && (
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-medium text-blue-700 dark:text-blue-300">
                    تم تقديم إثبات الدفع. جارٍ المراجعة...
                  </p>
                </div>
              </div>
            )}

            {/* Show if verified */}
            {myApplication.status === 'payment_verified' && (
              <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">
                    تم التحقق من الدفع. بانتظار القبول...
                  </p>
                </div>
              </div>
            )}

            {/* Show if accepted */}
            {myApplication.status === 'accepted' && (
              <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  <p className="text-sm font-medium text-green-700 dark:text-green-300">
                    تم قبولك! يمكنك الآن التواصل مع صاحب التكليف
                  </p>
                </div>
              </div>
            )}
          </GlassCard>
        </motion.div>
      )}

      {/* B) Contact reveal section — UNLOCKED */}
      {isAssignedToMe && deployment.contactRevealed && (
        <motion.div variants={itemAnim}>
          <GlassCard variant="nurse" className="overflow-hidden p-0">
            {/* Header gradient */}
            <div className="bg-gradient-to-r from-emerald-500 to-teal-500 px-4 py-3 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Phone className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">بيانات التواصل مكشوفة</p>
                <p className="text-emerald-100 text-[10px]">تم التحقق من دفعك — تواصل الآن</p>
              </div>
              <div className="mr-auto">
                <CheckCircle2 className="w-5 h-5 text-white" />
              </div>
            </div>
            <div className="p-4 space-y-3">
              <div className="flex items-center gap-3 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800/30">
                <div className="w-10 h-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <User className="w-5 h-5 text-emerald-600" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground">صاحب التكليف</p>
                  <p className="font-bold text-sm">{deployment.createdBy?.name || 'غير معروف'}</p>
                </div>
              </div>
              {deployment.creatorPhone && (
                <>
                  <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-nurse" />
                      <span className="text-sm text-muted-foreground">رقم الهاتف</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold font-mono text-sm" dir="ltr">{deployment.creatorPhone}</span>
                      <button
                        onClick={() => { navigator.clipboard.writeText(deployment.creatorPhone!); toast.success('تم نسخ رقم الهاتف'); }}
                        className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                      >
                        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <a
                      href={`tel:${deployment.creatorPhone}`}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold transition-colors shadow-sm shadow-emerald-600/30"
                    >
                      <Phone className="w-4 h-4" /> اتصال
                    </a>
                    <a
                      href={`https://wa.me/${deployment.creatorPhone.replace(/^0+/, '')}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-[#25D366] hover:bg-[#1ebe5d] text-white text-sm font-semibold transition-colors shadow-sm shadow-green-600/30"
                    >
                      <MessageSquare className="w-4 h-4" /> واتساب
                    </a>
                  </div>
                </>
              )}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* If assigned to me but contact NOT yet revealed — show locked state with payment steps */}
      {isAssignedToMe && !deployment.contactRevealed && (
        <motion.div variants={itemAnim}>
          <GlassCard variant="nurse" className="overflow-hidden p-0">
            {/* Locked header */}
            <div className="bg-gradient-to-r from-slate-500 to-slate-600 px-4 py-3 flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center">
                <Eye className="w-4 h-4 text-white" />
              </div>
              <div>
                <p className="text-white font-semibold text-sm">بيانات التواصل مقفلة</p>
                <p className="text-slate-200 text-[10px]">أكمل خطوات الدفع لإظهار رقم الهاتف</p>
              </div>
            </div>
            <div className="p-4 space-y-3">
              {/* Blurred phone placeholder */}
              <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
                <div className="flex items-center gap-2">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">رقم الهاتف</span>
                </div>
                <span className="font-mono text-sm font-bold tracking-widest text-muted-foreground/40 select-none">
                  ••• ••• •••
                </span>
              </div>

              {/* Steps */}
              <div className="space-y-2 pt-1">
                <p className="text-[10px] text-muted-foreground font-medium mb-1.5">الخطوات المطلوبة لكشف بيانات الاتصال:</p>
                {[
                  { label: 'ادفع رسوم التقديم', done: ['payment_submitted', 'payment_verified', 'accepted'].includes(myApplication?.status ?? '') },
                  { label: 'يراجع الإدارة إثبات دفعك', done: ['payment_verified', 'accepted'].includes(myApplication?.status ?? '') },
                  { label: 'تُكشف بيانات الاتصال', done: myApplication?.status === 'accepted' },
                ].map((step, i) => (
                  <div key={i} className={`flex items-center gap-2.5 p-2.5 rounded-lg border ${step.done ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30' : 'bg-muted/30 border-border'}`}>
                    <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${step.done ? 'bg-emerald-500' : 'bg-muted-foreground/20'}`}>
                      {step.done
                        ? <CheckCircle2 className="w-3 h-3 text-white" />
                        : <span className="text-[10px] font-bold text-muted-foreground">{i + 1}</span>
                      }
                    </div>
                    <span className={`text-xs font-medium ${step.done ? 'text-emerald-700 dark:text-emerald-300 line-through' : 'text-foreground'}`}>
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ PAYMENT PENDING NOTICE — for assigned nurse without payment verified ═══ */}
      {isAssignedToMe && !deployment.contactRevealed && myApplication?.status !== 'accepted' && ['assigned'].includes(deployment.status) && (
        <motion.div variants={itemAnim}>
          <GlassCard variant="nurse" className="overflow-hidden p-0">
            <div className="bg-gradient-to-r from-amber-500 to-orange-500 px-4 py-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                <Clock className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-sm">بانتظار تأكيد الدفع</p>
                <p className="text-white/75 text-[10px]">
                  {myApplication?.status === 'payment_pending'
                    ? 'يرجى دفع رسوم التقديم أولاً للتمكن من بدء التنفيذ'
                    : myApplication?.status === 'payment_submitted'
                    ? 'تم تقديم إثبات الدفع — بانتظار مراجعة الإدارة'
                    : 'لا يمكن بدء التنفيذ حتى يتم تأكيد الدفع من الإدارة'}
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ═══ TASK EXECUTION SECTION — for assigned nurse WITH payment verified ═══ */}
      {isAssignedToMe && deployment.contactRevealed && myApplication?.status === 'accepted' && ['assigned', 'in_progress'].includes(deployment.status) && (
        <motion.div variants={itemAnim}>
          <GlassCard variant="nurse" className="overflow-hidden p-0">
            {/* Gradient header */}
            <div className={`px-4 py-3.5 flex items-center gap-3 ${
              deployment.status === 'in_progress'
                ? 'bg-gradient-to-r from-teal-600 via-teal-500 to-emerald-500'
                : 'bg-gradient-to-r from-nurse via-nurse/90 to-teal-600'
            }`}>
              <div className="w-9 h-9 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20">
                {deployment.status === 'in_progress'
                  ? <Activity className="w-4 h-4 text-white" />
                  : <PlayCircle className="w-4 h-4 text-white" />
                }
              </div>
              <div className="flex-1">
                <p className="text-white font-bold text-sm">إجراءات تنفيذ التكليف</p>
                <p className="text-white/75 text-[10px]">
                  {deployment.status === 'in_progress' ? 'التكليف قيد التنفيذ حالياً' : 'جاهز للبدء — ابدأ التنفيذ متى أردت'}
                </p>
              </div>
              <div className={`px-2.5 py-1 rounded-full text-[10px] font-bold ${
                deployment.status === 'in_progress'
                  ? 'bg-white/20 text-white border border-white/30'
                  : 'bg-white/15 text-white border border-white/25'
              }`}>
                {deploymentStatusLabel[deployment.status]}
              </div>
            </div>

            <div className="p-4 space-y-4">
              {/* Progress steps */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-2">مراحل التكليف</p>
                {[
                  {
                    label: 'تم التعيين والموافقة على الدفع',
                    sublabel: 'تم التحقق من دفعك وتعيينك',
                    done: true,
                    icon: CheckSquare,
                  },
                  {
                    label: 'تنفيذ التكليف',
                    sublabel: deployment.status === 'in_progress' ? 'جارٍ التنفيذ الآن' : 'ابدأ حين تصل إلى موقع العمل',
                    done: deployment.status === 'in_progress' || deployment.status === 'completed',
                    icon: Zap,
                  },
                  {
                    label: 'إكمال التكليف',
                    sublabel: 'أنهِ التكليف بعد الانتهاء',
                    done: deployment.status === 'completed',
                    icon: TrendingUp,
                  },
                ].map((step, i) => {
                  const Icon = step.icon;
                  const isCurrent = i === 1 && deployment.status === 'assigned' || i === 2 && deployment.status === 'in_progress';
                  return (
                    <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border transition-all ${
                      step.done
                        ? 'bg-teal-50 dark:bg-teal-900/10 border-teal-200 dark:border-teal-800/30'
                        : isCurrent
                          ? 'bg-nurse/5 dark:bg-nurse/10 border-nurse/30 ring-1 ring-nurse/20'
                          : 'bg-muted/30 border-border'
                    }`}>
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                        step.done
                          ? 'bg-teal-500 text-white'
                          : isCurrent
                            ? 'bg-nurse/20 text-nurse'
                            : 'bg-muted-foreground/10 text-muted-foreground'
                      }`}>
                        {step.done
                          ? <CheckCircle2 className="w-4 h-4" />
                          : <Icon className="w-4 h-4" />
                        }
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-xs font-semibold ${
                          step.done ? 'text-teal-700 dark:text-teal-300' : isCurrent ? 'text-foreground' : 'text-muted-foreground'
                        }`}>{step.label}</p>
                        <p className="text-[10px] text-muted-foreground">{step.sublabel}</p>
                      </div>
                      {step.done && <CheckCircle2 className="w-4 h-4 text-teal-500 shrink-0" />}
                      {isCurrent && !step.done && (
                        <div className="w-2 h-2 rounded-full bg-nurse animate-pulse shrink-0" />
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="h-px bg-border" />

              {/* Action Buttons */}
              {deployment.status === 'assigned' && (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground text-center">اضغط لبدء التنفيذ عند وصولك لموقع العمل</p>
                  <Button
                    className="w-full gap-2 h-12 text-sm font-bold bg-gradient-to-r from-nurse to-teal-600 hover:from-nurse/90 hover:to-teal-700 text-white shadow-md shadow-nurse/20 border-0"
                    onClick={handleStartExecution}
                    disabled={isExecuting}
                  >
                    {isExecuting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <PlayCircle className="w-5 h-5" />
                    )}
                    بدء تنفيذ التكليف
                  </Button>
                </div>
              )}

              {deployment.status === 'in_progress' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-2.5 rounded-lg bg-teal-50 dark:bg-teal-900/10 border border-teal-200 dark:border-teal-800/30">
                    <Activity className="w-3.5 h-3.5 text-teal-600 animate-pulse" />
                    <p className="text-xs text-teal-700 dark:text-teal-300 font-medium">التكليف قيد التنفيذ — اضغط للإكمال عند الانتهاء</p>
                  </div>
                  <Button
                    className="w-full gap-2 h-12 text-sm font-bold bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white shadow-md shadow-emerald-600/20 border-0"
                    onClick={handleCompleteExecution}
                    disabled={isExecuting}
                  >
                    {isExecuting ? (
                      <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5" />
                    )}
                    إكمال التكليف
                  </Button>
                </div>
              )}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Creator: Manage applicants section */}
      {isCreator && deployment.applications.length > 0 && (
        <motion.div variants={itemAnim}>
          <GlassCard variant="nurse" className="space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <User className="w-4 h-4 text-nurse" />
              المتقدمون ({toArabicNum(deployment.applications.length)})
            </h3>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {deployment.applications.map((app) => (
                <div
                  key={app.id || app.applicantId}
                  className="p-3 rounded-xl border bg-card space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-nurse/10 flex items-center justify-center">
                        <User className="w-4 h-4 text-nurse" />
                      </div>
                      <div>
                        <p className="text-sm font-medium">{app.applicantName}</p>
                        {app.applicantVerificationStatus === 'verified' && (
                          <ShieldCheck className="w-3 h-3 text-emerald-500 inline-block ml-1" />
                        )}
                      </div>
                    </div>
                    <BadgeStatus
                      status={applicationStatusMap[app.status] || 'pending'}
                      label={applicationStatusLabel[app.status] || app.status}
                      size="sm"
                    />
                  </div>

                  {/* Applicant details (NO phone numbers) */}
                  <div className="grid grid-cols-2 gap-1.5 text-[11px]">
                    {app.applicantSpecialization && app.applicantSpecialization.length > 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <BriefcaseMedical className="w-3 h-3" />
                        <span className="truncate">{app.applicantSpecialization.slice(0, 2).join('، ')}</span>
                      </div>
                    )}
                    {app.applicantExperience !== undefined && app.applicantExperience > 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Award className="w-3 h-3" />
                        <span>{toArabicNum(app.applicantExperience)} سنوات خبرة</span>
                      </div>
                    )}
                    {app.applicantRating !== undefined && app.applicantRating > 0 && (
                      <div className="flex items-center gap-1 text-amber-600">
                        <Star className="w-3 h-3 fill-amber-500" />
                        <span>{toArabicNum(app.applicantRating)}</span>
                      </div>
                    )}
                    {app.applicantCompletedJobs !== undefined && app.applicantCompletedJobs > 0 && (
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <CheckCircle2 className="w-3 h-3" />
                        <span>{toArabicNum(app.applicantCompletedJobs)} تكليف مكتمل</span>
                      </div>
                    )}
                  </div>

                  {app.coverLetter && (
                    <div className="p-2 rounded-lg bg-muted/40">
                      <p className="text-[10px] text-muted-foreground mb-0.5">رسالة التقديم</p>
                      <p className="text-[11px] leading-relaxed">{app.coverLetter}</p>
                    </div>
                  )}

                  {/* Select button for pending applicants */}
                  {app.status === 'pending' && deployment.status === 'open' && (
                    <Button
                      size="sm"
                      className="w-full h-8 text-xs gap-1 bg-nurse hover:bg-nurse/90 text-white"
                      onClick={() => handleSelectApplicant(app.id)}
                      disabled={isSelecting}
                    >
                      {isSelecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                      اختيار
                    </Button>
                  )}

                  {/* Status messages */}
                  {app.status === 'selected_by_creator' && (
                    <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                      <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">بانتظار موافقة الإدارة</p>
                    </div>
                  )}
                  {(app.status === 'admin_approved' || app.status === 'payment_pending') && (
                    <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30">
                      <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">بانتظار دفع المكلف</p>
                    </div>
                  )}
                  {app.status === 'payment_submitted' && (
                    <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30">
                      <p className="text-[11px] text-blue-700 dark:text-blue-300 font-medium">تم تقديم إثبات الدفع — جارٍ المراجعة</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Creator status messages for created deployments */}
      {isCreator && deployment.status === 'creator_selected' && (
        <motion.div variants={itemAnim}>
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-600" />
              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">بانتظار موافقة الإدارة على اختيارك</p>
            </div>
          </div>
        </motion.div>
      )}
      {isCreator && deployment.status === 'admin_approved' && (
        <motion.div variants={itemAnim}>
          <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30">
            <div className="flex items-center gap-2">
              <Wallet className="w-4 h-4 text-emerald-600" />
              <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">تمت الموافقة الإدارية — بانتظار دفع المكلف</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* F) Rating section — creator rates assigned nurse after completion */}
      {isCreator && deployment.status === 'completed' && !deployment.rating && deployment.assignedTo && (
        <motion.div variants={itemAnim}>
          <GlassCard variant="nurse" className="space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Star className="w-4 h-4 text-nurse" />
              تقييم المكلف
            </h3>
            <p className="text-xs text-muted-foreground">
              قيّم أداء {deployment.assignedTo?.name || 'المكلف'} على هذا التكليف
            </p>

            {/* Star rating */}
            <div className="flex items-center gap-1.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRatingValue(star)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`w-8 h-8 ${
                      star <= ratingValue
                        ? 'text-amber-500 fill-amber-500'
                        : 'text-muted-foreground/30'
                    }`}
                  />
                </button>
              ))}
              {ratingValue > 0 && (
                <span className="text-sm font-medium ms-2">{toArabicNum(ratingValue)}/5</span>
              )}
            </div>

            {/* Comment */}
            <div className="space-y-2">
              <Label htmlFor="rating-comment" className="text-sm font-medium">تعليق (اختياري)</Label>
              <Textarea
                id="rating-comment"
                placeholder="اكتب تعليقاً على أداء المكلف..."
                rows={2}
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
              />
            </div>

            <Button
              className="w-full gap-2 bg-nurse hover:bg-nurse/90 text-white"
              onClick={handleRate}
              disabled={isSubmittingRating || ratingValue === 0}
            >
              {isSubmittingRating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
              إرسال التقييم
            </Button>
          </GlassCard>
        </motion.div>
      )}

      {/* Show existing rating if already rated */}
      {isCreator && deployment.rating && (
        <motion.div variants={itemAnim}>
          <GlassCard variant="nurse" className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500" />
              تقييمك
            </h3>
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= (deployment.rating ?? 0)
                      ? 'text-amber-500 fill-amber-500'
                      : 'text-muted-foreground/30'
                  }`}
                />
              ))}
              <span className="text-sm font-medium ms-2">{toArabicNum(deployment.rating ?? 0)}/5</span>
            </div>
            {deployment.ratingComment && (
              <p className="text-sm text-muted-foreground">{deployment.ratingComment}</p>
            )}
          </GlassCard>
        </motion.div>
      )}

      {/* Apply button if open and not yet applied */}
      {!hasApplied && deployment.status === 'open' && !isCreator && (
        <motion.div variants={itemAnim}>
          <Button
            className="w-full gap-2 bg-nurse hover:bg-nurse/90 text-white"
            onClick={() => {
              setShowApplyModal(true);
              setCoverLetter('');
            }}
          >
            <FileText className="w-4 h-4" />
            تقديم على التكليف
          </Button>
        </motion.div>
      )}

      {/* Already applied indicator */}
      {!hasApplied && deployment.status !== 'open' && !isAssignedToMe && !isCreator && (
        <motion.div variants={itemAnim}>
          <GlassCard variant="nurse" className="text-center py-4">
            <p className="text-sm text-muted-foreground">
              هذا التكليف {deploymentStatusLabel[deployment.status]} ولا يمكن التقديم عليه
            </p>
          </GlassCard>
        </motion.div>
      )}

      {/* ═══════════════ APPLY DIALOG ═══════════════ */}
      <Dialog open={showApplyModal} onOpenChange={setShowApplyModal}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-nurse/10 flex items-center justify-center">
                <FileText className="w-4 h-4 text-nurse" />
              </div>
              التقديم على التكليف
            </DialogTitle>
            <DialogDescription>
              {deployment.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <div className="p-4 rounded-2xl bg-gradient-to-br from-nurse/5 to-teal-500/5 border border-nurse/10 space-y-2.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">النوع</span>
                <span className="font-bold">{typeLabels[deployment.type]}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">الساعات</span>
                <span className="font-bold">{toArabicNum(deployment.hours)} ساعة</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">المبلغ</span>
                <span className="font-black text-emerald-600 dark:text-emerald-400">{toArabicNum(deployment.amount.toLocaleString())} ر.ي</span>
              </div>
              {deployment.adminCommissionAmount > 0 && (
                <div className="flex items-center justify-between text-sm text-orange-600 dark:text-orange-400">
                  <span>منها {toArabicNum(deployment.adminCommissionAmount.toLocaleString())} للإدارة</span>
                </div>
              )}
            </div>

            {/* D) Info note: no payment at apply time */}
            <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30">
              <p className="text-xs text-blue-700 dark:text-blue-300">
                التقديم مجاني. سيتم طلب رسوم التقديم فقط عند اختيارك وموافقة الإدارة.
              </p>
            </div>

            {/* Cover letter */}
            <div className="space-y-2">
              <Label htmlFor="nurse-cover-letter" className="text-sm font-semibold flex items-center gap-1.5">
                <MessageSquare className="w-3.5 h-3.5 text-nurse" />
                رسالة التقديم (اختياري)
              </Label>
              <Textarea
                id="nurse-cover-letter"
                placeholder="اكتب رسالة تشرح فيها لماذا أنت مناسب لهذا التكليف..."
                rows={4}
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
                className="border-nurse/20 focus:border-nurse resize-none"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowApplyModal(false)}>إلغاء</Button>
            <Button
              className="gap-2 bg-nurse hover:bg-nurse/90 text-white"
              onClick={handleApply}
              disabled={isApplying}
            >
              {isApplying ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
              تأكيد التقديم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ PAYMENT PROOF DIALOG (updated with image upload) ═══════════════ */}
      <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-orange-600" />
              تقديم إثبات الدفع
            </DialogTitle>
            <DialogDescription>
              {deployment.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900/30">
              <div className="flex items-center justify-between text-sm">
                <span className="text-orange-700 dark:text-orange-300">رسوم التقديم</span>
                <span className="font-bold text-orange-700 dark:text-orange-300">
                  {toArabicNum(myApplication?.serviceFee ?? deployment.applicantServiceFee ?? deployment.serviceFee)} ر.ي
                </span>
              </div>
            </div>

            {/* Image upload */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">
                صورة إثبات الدفع <span className="text-red-500">*</span>
              </Label>
              <div className="space-y-2">
                {paymentProofImage ? (
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    <img
                      src={paymentProofImage}
                      alt="إثبات الدفع"
                      className="w-full h-48 object-cover"
                    />
                    <Button
                      variant="destructive"
                      size="icon"
                      className="absolute top-2 left-2 w-7 h-7"
                      onClick={() => setPaymentProofImage('')}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <div
                    className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-6 flex flex-col items-center gap-2 cursor-pointer hover:border-orange-400 transition-colors"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Upload className="w-8 h-8 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">اضغط لرفع صورة إثبات الدفع</p>
                    <p className="text-[10px] text-muted-foreground">PNG, JPG حتى 5MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageUpload}
                />
              </div>
            </div>

            {/* Text input (alternative) */}
            <div className="space-y-2">
              <Label htmlFor="nurse-payment-proof" className="text-sm font-medium">
                أو أدخل رقم العملية (اختياري)
              </Label>
              <Textarea
                id="nurse-payment-proof"
                placeholder="أدخل رقم العملية أو معلومات التحويل البنكي..."
                rows={2}
                value={paymentProof}
                onChange={(e) => setPaymentProof(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>إلغاء</Button>
            <Button
              className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handleSubmitPayment}
              disabled={isSubmittingPayment || !paymentProofImage}
            >
              {isSubmittingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              إرسال إثبات الدفع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
