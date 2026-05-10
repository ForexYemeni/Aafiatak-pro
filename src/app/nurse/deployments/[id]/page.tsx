'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight, Briefcase, Clock, DollarSign, MapPin, Loader2,
  CheckCircle2, XCircle, Upload, Navigation, User, CreditCard,
  Wallet, Building2, Calendar, FileText, AlertTriangle, Eye
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
  status: 'pending' | 'payment_pending' | 'payment_submitted' | 'payment_verified' | 'accepted' | 'rejected';
  appliedAt: string;
  hasPaymentProof: boolean;
  paymentProofData?: string;
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
  title: string;
  description: string;
  type: 'nursing' | 'lab' | 'midwife' | 'home_care' | 'other';
  specialization: string[];
  hours: number;
  location: DeploymentLocation;
  amount: number;
  adminCommissionPercent: number;
  adminCommissionAmount: number;
  serviceFee: number;
  totalWithFee: number;
  status: 'open' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
  assignedTo: { id?: string; name?: string; phone?: string } | null;
  assignedAt?: string;
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
  assigned: 'assigned',
  in_progress: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
};

const deploymentStatusLabel: Record<string, string> = {
  open: 'متاح',
  assigned: 'تم التعيين',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

const applicationStatusMap: Record<string, string> = {
  pending: 'pending',
  payment_pending: 'awaiting_payment',
  payment_submitted: 'awaiting_payment',
  payment_verified: 'verified',
  accepted: 'accepted',
  rejected: 'rejected',
};

const applicationStatusLabel: Record<string, string> = {
  pending: 'معلق',
  payment_pending: 'بانتظار الدفع',
  payment_submitted: 'تم تقديم الدفع',
  payment_verified: 'تم التحقق',
  accepted: 'مقبول',
  rejected: 'مرفوض',
};

/* ─────────────── Status timeline config ─────────────── */
const statusTimeline: { key: string; label: string; icon: React.ElementType }[] = [
  { key: 'open', label: 'تم الإنشاء', icon: Briefcase },
  { key: 'assigned', label: 'تم التعيين', icon: User },
  { key: 'in_progress', label: 'قيد التنفيذ', icon: Clock },
  { key: 'completed', label: 'مكتمل', icon: CheckCircle2 },
];

const statusOrder = ['open', 'assigned', 'in_progress', 'completed'];

/* ─────────────── Animation ─────────────── */
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

/* ════════════════════════════════════════════════════════════════ */
/* ═══════════════ MAIN COMPONENT ════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════ */
export default function NurseDeploymentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const deploymentId = params.id as string;
  const authFetch = useAuthFetch();
  const currentUser = useAuthStore((s) => s.user);

  const [deployment, setDeployment] = useState<DeploymentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Payment proof modal
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentProof, setPaymentProof] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Apply modal
  const [showApplyModal, setShowApplyModal] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');
  const [isApplying, setIsApplying] = useState(false);

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

  /* ── Apply for deployment ── */
  const handleApply = async () => {
    setIsApplying(true);
    try {
      const res = await authFetch(`/api/deployments/${deploymentId}/apply`, {
        method: 'POST',
        body: JSON.stringify({ coverLetter }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم التقديم على التكليف بنجاح. يرجى دفع رسوم التقديم');
        if (json.data?.bankAccountInfo) {
          toast.info(`حساب البنك: ${json.data.bankAccountInfo}`);
        }
        if (json.data?.serviceFee) {
          toast.info(`رسوم التقديم: ${toArabicNum(json.data.serviceFee)} ر.ي`);
        }
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

  /* ── Submit payment proof ── */
  const handleSubmitPayment = async () => {
    if (!paymentProof) return;
    setIsSubmittingPayment(true);
    try {
      const res = await authFetch(`/api/deployments/${deploymentId}/submit-payment`, {
        method: 'POST',
        body: JSON.stringify({ paymentProofData: paymentProof }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تقديم إثبات الدفع بنجاح. سيتم مراجعته قريباً');
        void fetchDeployment();
        setShowPaymentModal(false);
        setPaymentProof('');
      } else {
        toast.error(json.message ?? 'فشل تقديم إثبات الدفع');
      }
    } catch {
      toast.error('حدث خطأ أثناء تقديم إثبات الدفع');
    } finally {
      setIsSubmittingPayment(false);
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
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-[10px] text-muted-foreground mb-1 font-medium flex items-center gap-1">
                <User className="w-3 h-3" /> المنشئ
              </p>
              <p className="font-bold text-sm">{deployment.createdBy?.name || 'غير معروف'}</p>
            </div>
            {deployment.serviceFee > 0 && (
              <div className="rounded-xl bg-orange-50 dark:bg-orange-900/10 p-3 border border-orange-200 dark:border-orange-900/30">
                <p className="text-[10px] text-orange-600 dark:text-orange-400 mb-1 font-medium flex items-center gap-1">
                  <Wallet className="w-3 h-3" /> رسوم التقديم
                </p>
                <p className="font-bold text-sm text-orange-600 dark:text-orange-400">{toArabicNum(deployment.serviceFee)} ر.ي</p>
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

      {/* Status Timeline */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="nurse" className="space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <Clock className="w-4 h-4 text-nurse" />
            حالة التكليف
          </h3>
          <div className="space-y-3">
            {statusTimeline.map((step, index) => {
              const Icon = step.icon;
              const isReached = index <= currentStatusIndex && !isCancelled;
              const isCurrent = index === currentStatusIndex && !isCancelled;

              return (
                <div key={step.key} className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                    isReached
                      ? 'bg-nurse text-white'
                      : 'bg-muted text-muted-foreground'
                  } ${isCurrent ? 'ring-2 ring-nurse/30 ring-offset-2' : ''}`}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${isReached ? 'text-foreground' : 'text-muted-foreground'}`}>
                      {step.label}
                    </p>
                  </div>
                  {isReached && (
                    <CheckCircle2 className="w-4 h-4 text-nurse" />
                  )}
                </div>
              );
            })}

            {isCancelled && (
              <div className="flex items-center gap-3 mt-2">
                <div className="w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shrink-0">
                  <XCircle className="w-4 h-4" />
                </div>
                <p className="text-sm font-medium text-destructive">
                  تم إلغاء التكليف
                </p>
              </div>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* My Application Status */}
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

            {/* Payment proof upload area if pending */}
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
                </div>
                <Button
                  className="w-full gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={() => {
                    setShowPaymentModal(true);
                    setPaymentProof('');
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
          </GlassCard>
        </motion.div>
      )}

      {/* If assigned to me, show assignment details */}
      {isAssignedToMe && (
        <motion.div variants={itemAnim}>
          <GlassCard variant="nurse" className="space-y-4">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-nurse" />
              تم تعيينك على هذا التكليف
            </h3>
            <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30 space-y-2">
              {deployment.assignedAt && (
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">تاريخ التعيين</span>
                  <span className="font-medium">{formatDate(deployment.assignedAt)}</span>
                </div>
              )}
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">الحالة</span>
                <BadgeStatus
                  status={deploymentStatusMap[deployment.status] || 'pending'}
                  label={deploymentStatusLabel[deployment.status] || deployment.status}
                  size="sm"
                />
              </div>
            </div>
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
              <FileText className="w-5 h-5 text-nurse" />
              التقديم على التكليف
            </DialogTitle>
            <DialogDescription>
              {deployment.title}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Summary */}
            <div className="p-3 rounded-xl bg-muted/40 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">النوع</span>
                <span className="font-medium">{typeLabels[deployment.type]}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">الساعات</span>
                <span className="font-medium">{toArabicNum(deployment.hours)} ساعة</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">المبلغ</span>
                <span className="font-medium">{toArabicNum(deployment.amount.toLocaleString())} ر.ي</span>
              </div>
              {deployment.serviceFee > 0 && (
                <div className="flex items-center justify-between text-sm text-orange-600 dark:text-orange-400">
                  <span>رسوم التقديم</span>
                  <span className="font-bold">{toArabicNum(deployment.serviceFee)} ر.ي</span>
                </div>
              )}
            </div>

            {/* Cover letter */}
            <div className="space-y-2">
              <Label htmlFor="nurse-cover-letter" className="text-sm font-medium">رسالة التقديم (اختياري)</Label>
              <Textarea
                id="nurse-cover-letter"
                placeholder="اكتب رسالة تشرح فيها لماذا أنت مناسب لهذا التكليف..."
                rows={3}
                value={coverLetter}
                onChange={(e) => setCoverLetter(e.target.value)}
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

      {/* ═══════════════ PAYMENT PROOF DIALOG ═══════════════ */}
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
                  {toArabicNum(myApplication?.serviceFee ?? deployment.serviceFee)} ر.ي
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="nurse-payment-proof" className="text-sm font-medium">
                إثبات الدفع <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="nurse-payment-proof"
                placeholder="أدخل رقم العملية أو معلومات التحويل البنكي..."
                rows={3}
                value={paymentProof}
                onChange={(e) => setPaymentProof(e.target.value)}
              />
              <p className="text-[11px] text-muted-foreground">
                أدخل رقم إيصال التحويل أو أي معلومات تثبت عملية الدفع
              </p>
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowPaymentModal(false)}>إلغاء</Button>
            <Button
              className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handleSubmitPayment}
              disabled={isSubmittingPayment || !paymentProof}
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
