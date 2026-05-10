'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight, Briefcase, Clock, DollarSign, MapPin, Loader2,
  CheckCircle2, XCircle, Eye, ShieldCheck, ShieldX, Play, Square,
  Navigation, Users, FileText, AlertTriangle, User, CreditCard,
  Wallet, Percent, Building2, Calendar, MessageSquare, Ban,
  Star, Phone, PhoneOff, BadgeCheck, Award, TrendingUp
} from 'lucide-react';
import { GlassCard } from '@/components/common/glass-card';
import { BadgeStatus } from '@/components/common/badge-status';
import { EmptyState } from '@/components/common/empty-state';
import { CardSkeleton } from '@/components/common/loading-skeleton';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
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
  applicantSpecialization?: string[];
  applicantExperience?: number;
  applicantRating?: number;
  applicantCompletedJobs?: number;
  applicantVerificationStatus?: string;
}

interface DeploymentDetail {
  id: string;
  createdBy: { id?: string; name?: string; phone?: string } | null;
  creatorRole: 'admin' | 'nurse';
  creatorPhone?: string;
  creatorServiceFee?: number;
  applicantServiceFee?: number;
  contactRevealed?: boolean;
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
  status: 'open' | 'creator_selected' | 'admin_approved' | 'assigned' | 'in_progress' | 'completed' | 'cancelled';
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
  rating?: number;
  ratingComment?: string;
  ratedAt?: string;
  ratedBy?: string;
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
  creator_selected: 'بانتظار الموافقة',
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
  payment_submitted: 'تم تقديم الدفع',
  payment_verified: 'تم التحقق',
  accepted: 'مقبول',
  rejected: 'مرفوض',
};

/* ─────────────── Helper: Star Rating ─────────────── */
function StarRating({ rating, max = 5 }: { rating: number; max?: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: max }, (_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < Math.round(rating) ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300 dark:text-gray-600'}`}
        />
      ))}
    </div>
  );
}

/* ─────────────── Animation ─────────────── */
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

/* ════════════════════════════════════════════════════════════════ */
/* ═══════════════ MAIN COMPONENT ════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════ */
export default function AdminDeploymentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const deploymentId = params.id as string;
  const authFetch = useAuthFetch();

  const [deployment, setDeployment] = useState<DeploymentDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Action states
  const [verifyingApp, setVerifyingApp] = useState<DeploymentApplication | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [acceptingApp, setAcceptingApp] = useState<DeploymentApplication | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);
  const [viewingPayment, setViewingPayment] = useState<DeploymentApplication | null>(null);

  // Admin approve state
  const [showApproveDialog, setShowApproveDialog] = useState(false);
  const [isApproving, setIsApproving] = useState(false);

  // Status change states
  const [statusChangeTarget, setStatusChangeTarget] = useState<{ status: string; label: string } | null>(null);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

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

  /* ── Admin approve selection ── */
  const handleAdminApprove = async () => {
    setIsApproving(true);
    try {
      const res = await authFetch(`/api/deployments/${deploymentId}/admin-approve`, {
        method: 'PATCH',
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تمت الموافقة على الاختيار بنجاح. تم إرسال إشعار للمتقدم بالدفع.');
        void fetchDeployment();
      } else {
        toast.error(json.message ?? 'فشل الموافقة على الاختيار');
      }
    } catch {
      toast.error('حدث خطأ أثناء الموافقة');
    } finally {
      setIsApproving(false);
      setShowApproveDialog(false);
    }
  };

  /* ── Verify payment ── */
  const handleVerifyPayment = async (verified: boolean) => {
    if (!verifyingApp) return;
    setIsVerifying(true);
    try {
      const res = await authFetch(`/api/deployments/${deploymentId}/verify-payment`, {
        method: 'PATCH',
        body: JSON.stringify({ applicationId: verifyingApp._id, verified }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(verified ? 'تم التحقق من الدفع بنجاح وتم تعيين المتقدم' : 'تم رفض إثبات الدفع');
        void fetchDeployment();
      } else {
        toast.error(json.message ?? 'فشل العملية');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setIsVerifying(false);
      setVerifyingApp(null);
    }
  };

  /* ── Accept application ── */
  const handleAcceptApplication = async () => {
    if (!acceptingApp) return;
    setIsAccepting(true);
    try {
      const res = await authFetch(`/api/deployments/${deploymentId}/accept`, {
        method: 'PATCH',
        body: JSON.stringify({ applicationId: acceptingApp._id }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`تم قبول ${acceptingApp.applicantName} على التكليف بنجاح`);
        void fetchDeployment();
      } else {
        toast.error(json.message ?? 'فشل قبول التقديم');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setIsAccepting(false);
      setAcceptingApp(null);
    }
  };

  /* ── Change deployment status ── */
  const handleStatusChange = async () => {
    if (!statusChangeTarget || !deployment) return;
    setIsChangingStatus(true);
    try {
      const res = await authFetch(`/api/deployments/${deploymentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: statusChangeTarget.status }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`تم تحديث حالة التكليف إلى: ${statusChangeTarget.label}`);
        void fetchDeployment();
      } else {
        toast.error(json.message ?? 'فشل تحديث الحالة');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setIsChangingStatus(false);
      setStatusChangeTarget(null);
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
        <Button onClick={() => router.push('/admin/deployments')}>العودة للتكليفات</Button>
      </div>
    );
  }

  const tc = typeColors[deployment.type] || typeColors.other;
  const isActive = ['open', 'creator_selected', 'admin_approved', 'assigned', 'in_progress'].includes(deployment.status);

  // Find the selected applicant (by creator)
  const selectedApplicant = deployment.applications.find((a) => a.status === 'selected_by_creator' || a.status === 'admin_approved' || a.status === 'payment_pending' || a.status === 'payment_submitted' || a.status === 'payment_verified' || a.status === 'accepted');

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <motion.div initial="hidden" animate="show" variants={{ show: { transition: { staggerChildren: 0.06 } } }} className="space-y-6">
      {/* Header */}
      <motion.div variants={itemAnim} className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.push('/admin/deployments')}>
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

      {/* ── APPROVE SELECTION BANNER ── */}
      {deployment.status === 'creator_selected' && (
        <motion.div variants={itemAnim}>
          <div className="p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800/40">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                  <ShieldCheck className="w-6 h-6 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="font-bold text-amber-800 dark:text-amber-300">بانتظار موافقة الإدارة</p>
                  <p className="text-sm text-amber-600 dark:text-amber-400">
                    قام صاحب التكليف باختيار{' '}
                    <span className="font-semibold">{selectedApplicant?.applicantName || 'متقدم'}</span>
                    . يرجى الموافقة أو الرفض.
                  </p>
                </div>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => setStatusChangeTarget({ status: 'cancelled', label: 'ملغي' })}
                >
                  <Ban className="w-3.5 h-3.5" /> رفض
                </Button>
                <Button
                  size="sm"
                  className="gap-1.5 bg-amber-600 hover:bg-amber-700 text-white"
                  onClick={() => setShowApproveDialog(true)}
                  disabled={isApproving}
                >
                  {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  الموافقة على الاختيار
                </Button>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Deployment Info Card */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin" className={`space-y-4 ${isActive ? 'border-r-4 border-admin' : ''}`}>
          {/* Title & Type */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className={`w-14 h-14 rounded-xl ${tc.icon} flex items-center justify-center`}>
                <Briefcase className={`w-7 h-7 ${tc.text}`} />
              </div>
              <div>
                <h2 className="font-bold text-lg">{deployment.title}</h2>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">{typeLabels[deployment.type] || deployment.type}</span>
                  {deployment.creatorRole === 'admin' ? (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-admin/10 text-admin">إدارة</Badge>
                  ) : (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">ممرض/ـة</Badge>
                  )}
                </div>
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
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
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
            {/* Contact Reveal Indicator */}
            <div className="rounded-xl bg-muted/40 p-3">
              <p className="text-[10px] text-muted-foreground mb-1 font-medium flex items-center gap-1">
                {deployment.contactRevealed ? (
                  <Phone className="w-3 h-3 text-green-500" />
                ) : (
                  <PhoneOff className="w-3 h-3 text-red-400" />
                )}
                كشف التواصل
              </p>
              <p className={`font-bold text-sm flex items-center gap-1 ${deployment.contactRevealed ? 'text-green-600 dark:text-green-400' : 'text-red-500 dark:text-red-400'}`}>
                {deployment.contactRevealed ? (
                  <><CheckCircle2 className="w-3.5 h-3.5" /> مكشوف</>
                ) : (
                  <><XCircle className="w-3.5 h-3.5" /> غير مكشوف</>
                )}
              </p>
            </div>
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
              <div className="rounded-xl bg-muted/40 p-3 col-span-2 md:col-span-3">
                <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">التخصصات المطلوبة</p>
                <div className="flex flex-wrap gap-1.5">
                  {deployment.specialization.map((spec, i) => (
                    <Badge key={i} variant="secondary" className="text-[10px]">{spec}</Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Financial Details */}
          <div className="rounded-xl bg-muted/40 p-3 space-y-2">
            <p className="text-[10px] text-muted-foreground mb-1.5 font-medium flex items-center gap-1">
              <CreditCard className="w-3 h-3" /> التفاصيل المالية
            </p>
            <div className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">المبلغ الأساسي</span>
                <span className="font-medium">{toArabicNum(deployment.amount.toLocaleString())} ر.ي</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">عمولة المنصة ({toArabicNum(deployment.adminCommissionPercent)}%)</span>
                <span className="font-medium text-orange-600">{toArabicNum(deployment.adminCommissionAmount.toLocaleString())} ر.ي</span>
              </div>
              {deployment.creatorServiceFee !== undefined && deployment.creatorServiceFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">رسوم صاحب التكليف</span>
                  <span className="font-medium text-rose-600">{toArabicNum(deployment.creatorServiceFee)} ر.ي</span>
                </div>
              )}
              {deployment.applicantServiceFee !== undefined && deployment.applicantServiceFee > 0 && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">رسوم المتقدم</span>
                  <span className="font-medium text-purple-600">{toArabicNum(deployment.applicantServiceFee)} ر.ي</span>
                </div>
              )}
              {(deployment.creatorServiceFee === undefined || deployment.creatorServiceFee === 0) && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">رسوم التقديم</span>
                  <span className="font-medium">{toArabicNum(deployment.serviceFee)} ر.ي</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between font-bold">
                <span>الإجمالي مع الرسوم</span>
                <span className="text-admin">{toArabicNum(deployment.totalWithFee.toLocaleString())} ر.ي</span>
              </div>
            </div>
          </div>

          {/* Requirements & Notes */}
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

          {/* Rating Display */}
          {deployment.rating && (
            <div className="p-3 rounded-xl bg-yellow-50 dark:bg-yellow-900/10 border border-yellow-200 dark:border-yellow-800/30">
              <p className="text-[10px] text-muted-foreground mb-1.5 font-medium flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-500" /> تقييم التكليف
              </p>
              <div className="flex items-center gap-2">
                <StarRating rating={deployment.rating} />
                <span className="font-bold text-sm text-yellow-700 dark:text-yellow-400">{toArabicNum(deployment.rating)}/5</span>
              </div>
              {deployment.ratingComment && (
                <p className="text-sm mt-1.5 text-muted-foreground leading-relaxed">&quot;{deployment.ratingComment}&quot;</p>
              )}
              {deployment.ratedAt && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  تم التقييم: {formatDate(deployment.ratedAt)}
                  {deployment.ratedBy && ` بواسطة: ${deployment.ratedBy}`}
                </p>
              )}
            </div>
          )}

          {/* Dates */}
          <div className="grid grid-cols-2 gap-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5" />
              <span>تاريخ الإنشاء: {formatDate(deployment.createdAt)}</span>
            </div>
            {deployment.startDate && (
              <div className="flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5" />
                <span>تاريخ البداية: {formatDate(deployment.startDate)}</span>
              </div>
            )}
            {deployment.assignedAt && (
              <div className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" />
                <span>تاريخ التعيين: {formatDate(deployment.assignedAt)}</span>
              </div>
            )}
            {deployment.completedAt && (
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                <span>تاريخ الإكمال: {formatDate(deployment.completedAt)}</span>
              </div>
            )}
            {deployment.cancelledAt && (
              <div className="flex items-center gap-1.5">
                <XCircle className="w-3.5 h-3.5 text-red-500" />
                <span>تاريخ الإلغاء: {formatDate(deployment.cancelledAt)}</span>
              </div>
            )}
          </div>

          {/* Assigned To */}
          {deployment.assignedTo && (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="text-xs bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                  {deployment.assignedTo.name?.slice(0, 2) || 'م'}
                </AvatarFallback>
              </Avatar>
              <div>
                <p className="text-sm font-medium">{deployment.assignedTo.name || 'غير معروف'}</p>
                <p className="text-[11px] text-muted-foreground">تم التعيين</p>
              </div>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Status Change Actions */}
      {isActive && deployment.status !== 'creator_selected' && (
        <motion.div variants={itemAnim}>
          <GlassCard variant="admin" className="space-y-3">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Play className="w-4 h-4 text-admin" />
              إجراءات الحالة
            </h3>
            <div className="flex flex-wrap gap-2">
              {deployment.status === 'open' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => setStatusChangeTarget({ status: 'cancelled', label: 'ملغي' })}
                >
                  <Ban className="w-3.5 h-3.5" /> إلغاء التكليف
                </Button>
              )}
              {deployment.status === 'admin_approved' && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                  onClick={() => setStatusChangeTarget({ status: 'cancelled', label: 'ملغي' })}
                >
                  <Ban className="w-3.5 h-3.5" /> إلغاء
                </Button>
              )}
              {deployment.status === 'assigned' && (
                <>
                  <Button
                    size="sm"
                    className="gap-1.5 bg-sky-600 hover:bg-sky-700 text-white"
                    onClick={() => setStatusChangeTarget({ status: 'in_progress', label: 'قيد التنفيذ' })}
                  >
                    <Play className="w-3.5 h-3.5" /> بدء التنفيذ
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-1.5 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                    onClick={() => setStatusChangeTarget({ status: 'cancelled', label: 'ملغي' })}
                  >
                    <Ban className="w-3.5 h-3.5" /> إلغاء
                  </Button>
                </>
              )}
              {deployment.status === 'in_progress' && (
                <Button
                  size="sm"
                  className="gap-1.5 bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => setStatusChangeTarget({ status: 'completed', label: 'مكتمل' })}
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> إكمال التكليف
                </Button>
              )}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* Applications */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin" className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-sm flex items-center gap-2">
              <Users className="w-4 h-4 text-admin" />
              التقديمات
              <Badge variant="secondary" className="text-[10px]">
                {toArabicNum(deployment.applications.length)}
              </Badge>
            </h3>
          </div>

          {deployment.applications.length === 0 ? (
            <EmptyState
              icon={<Users className="w-8 h-8 text-muted-foreground" />}
              title="لا توجد تقديمات"
              description="لم يتقدم أحد على هذا التكليف بعد"
              className="py-8"
            />
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {deployment.applications.map((app) => (
                <div
                  key={app._id || app.applicantId}
                  className={`p-3 rounded-xl border bg-card space-y-2 ${
                    app.status === 'selected_by_creator' || app.status === 'admin_approved' || app.status === 'payment_pending' || app.status === 'payment_submitted' || app.status === 'payment_verified' || app.status === 'accepted'
                      ? 'border-amber-300 dark:border-amber-700/50 bg-amber-50/50 dark:bg-amber-900/5'
                      : ''
                  }`}
                >
                  {/* Applicant Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Avatar className="w-9 h-9">
                        <AvatarFallback className="text-[10px] bg-admin/10 text-admin">
                          {app.applicantName?.slice(0, 2) || '؟'}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="text-sm font-medium flex items-center gap-1.5">
                          {app.applicantName}
                          {app.applicantVerificationStatus === 'verified' && (
                            <BadgeCheck className="w-3.5 h-3.5 text-green-500" />
                          )}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          تقديم {formatDate(app.appliedAt)}
                        </p>
                      </div>
                    </div>
                    <BadgeStatus
                      status={applicationStatusMap[app.status] || 'pending'}
                      label={applicationStatusLabel[app.status] || app.status}
                      size="sm"
                    />
                  </div>

                  {/* Applicant Info: Specialization, Experience, Rating, Completed Jobs */}
                  {(app.applicantSpecialization?.length || app.applicantExperience !== undefined || app.applicantRating !== undefined || app.applicantCompletedJobs !== undefined) && (
                    <div className="flex flex-wrap items-center gap-2 text-[11px]">
                      {/* Specialization tags */}
                      {app.applicantSpecialization?.length ? (
                        <div className="flex flex-wrap gap-1">
                          {app.applicantSpecialization.map((spec, i) => (
                            <Badge key={i} variant="outline" className="text-[9px] px-1.5 py-0 h-4">
                              {spec}
                            </Badge>
                          ))}
                        </div>
                      ) : null}
                      {/* Experience */}
                      {app.applicantExperience !== undefined && (
                        <span className="flex items-center gap-0.5 text-muted-foreground">
                          <TrendingUp className="w-3 h-3" />
                          {toArabicNum(app.applicantExperience)} سنوات
                        </span>
                      )}
                      {/* Rating */}
                      {app.applicantRating !== undefined && (
                        <span className="flex items-center gap-0.5">
                          <StarRating rating={app.applicantRating} />
                          <span className="text-muted-foreground">{toArabicNum(app.applicantRating)}</span>
                        </span>
                      )}
                      {/* Completed Jobs */}
                      {app.applicantCompletedJobs !== undefined && (
                        <span className="flex items-center gap-0.5 text-muted-foreground">
                          <Award className="w-3 h-3" />
                          {toArabicNum(app.applicantCompletedJobs)} تكليف
                        </span>
                      )}
                      {/* Verification Status */}
                      {app.applicantVerificationStatus && (
                        <span className={`flex items-center gap-0.5 ${app.applicantVerificationStatus === 'verified' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'}`}>
                          {app.applicantVerificationStatus === 'verified' ? (
                            <><BadgeCheck className="w-3 h-3" /> موثق</>
                          ) : (
                            <>{app.applicantVerificationStatus}</>
                          )}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Cover letter */}
                  {app.coverLetter && (
                    <div className="p-2 rounded-lg bg-muted/40 text-xs">
                      <p className="text-muted-foreground mb-0.5 font-medium">رسالة التقديم:</p>
                      <p className="leading-relaxed">{app.coverLetter}</p>
                    </div>
                  )}

                  {/* Service Fee */}
                  {app.serviceFee > 0 && (
                    <div className="flex items-center justify-between text-xs px-1">
                      <span className="text-muted-foreground">رسوم التقديم</span>
                      <span className="font-medium">{toArabicNum(app.serviceFee)} ر.ي</span>
                    </div>
                  )}

                  {/* Payment proof info */}
                  {app.hasPaymentProof && app.paymentSubmittedAt && (
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Wallet className="w-3 h-3" />
                      <span>تم تقديم الدفع: {formatDate(app.paymentSubmittedAt)}</span>
                    </div>
                  )}

                  {/* Rejected reason */}
                  {app.rejectedReason && (
                    <div className="p-2 rounded-lg bg-red-50 dark:bg-red-900/10 text-xs text-red-600 dark:text-red-400">
                      {app.rejectedReason}
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-2 pt-1">
                    {/* View payment proof */}
                    {(app.hasPaymentProof || app.paymentProofImage) && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-7 text-[11px] gap-1"
                        onClick={() => setViewingPayment(app)}
                      >
                        <Eye className="w-3 h-3" /> عرض الدفع
                      </Button>
                    )}

                    {/* Verify / Reject payment */}
                    {app.status === 'payment_submitted' && (
                      <>
                        <Button
                          size="sm"
                          className="h-7 text-[11px] gap-1 bg-green-600 hover:bg-green-700 text-white"
                          onClick={() => setVerifyingApp(app)}
                        >
                          <ShieldCheck className="w-3 h-3" /> تحقق من الدفع
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px] gap-1 border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={() => {
                            setVerifyingApp(app);
                          }}
                        >
                          <ShieldX className="w-3 h-3" /> رفض
                        </Button>
                      </>
                    )}

                    {/* Accept verified application (old flow fallback) */}
                    {app.status === 'payment_verified' && (deployment.status === 'open' || deployment.status === 'admin_approved') && (
                      <Button
                        size="sm"
                        className="h-7 text-[11px] gap-1 bg-admin hover:bg-admin/90 text-white"
                        onClick={() => setAcceptingApp(app)}
                      >
                        <CheckCircle2 className="w-3 h-3" /> قبول
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* ═══════════════ ADMIN APPROVE DIALOG ═══════════════ */}
      <AlertDialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-amber-600" />
              الموافقة على الاختيار
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد الموافقة على اختيار{' '}
              <span className="font-semibold">{selectedApplicant?.applicantName || 'المتقدم'}</span>
              ؟ سيتم إرسال إشعار للمتقدم بدفع رسوم التقديم.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={handleAdminApprove}
              disabled={isApproving}
            >
              {isApproving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              الموافقة على الاختيار
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════════════ VERIFY PAYMENT DIALOG ═══════════════ */}
      <Dialog open={!!verifyingApp} onOpenChange={(open) => { if (!open) setVerifyingApp(null); }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-green-600" />
              التحقق من الدفع
            </DialogTitle>
            <DialogDescription>
              هل تريد التحقق من دفع {verifyingApp?.applicantName}؟ سيتم تعيينه على التكليف وكشف معلومات التواصل.
            </DialogDescription>
          </DialogHeader>

          {verifyingApp && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-muted/40 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">المتقدم</span>
                  <span className="font-medium">{verifyingApp.applicantName}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">رسوم التقديم</span>
                  <span className="font-medium">{toArabicNum(verifyingApp.serviceFee)} ر.ي</span>
                </div>
              </div>
              {/* Payment proof image */}
              {verifyingApp.paymentProofImage && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground font-medium">صورة إثبات الدفع</p>
                  <img
                    src={verifyingApp.paymentProofImage}
                    alt="إثبات الدفع"
                    className="max-w-full rounded-lg border"
                  />
                </div>
              )}
              {verifyingApp.paymentProofData && (
                <div className="p-3 rounded-xl bg-green-50 dark:bg-green-900/10 border border-green-200 dark:border-green-900/30">
                  <p className="text-[10px] text-muted-foreground mb-1 font-medium">إثبات الدفع</p>
                  <p className="text-sm">{verifyingApp.paymentProofData}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              className="border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
              onClick={() => handleVerifyPayment(false)}
              disabled={isVerifying}
            >
              {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldX className="w-4 h-4" />}
              رفض
            </Button>
            <Button
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
              onClick={() => handleVerifyPayment(true)}
              disabled={isVerifying}
            >
              {isVerifying ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
              تحقق وقبول الدفع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ ACCEPT APPLICATION DIALOG ═══════════════ */}
      <AlertDialog open={!!acceptingApp} onOpenChange={(open) => { if (!open) setAcceptingApp(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-admin" />
              قبول التقديم
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد قبول تقديم {acceptingApp?.applicantName} على هذا التكليف؟ سيتم رفض باقي التقديمات تلقائياً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-admin hover:bg-admin/90 text-white"
              onClick={handleAcceptApplication}
              disabled={isAccepting}
            >
              {isAccepting ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              قبول التقديم
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════════════ STATUS CHANGE DIALOG ═══════════════ */}
      <AlertDialog open={!!statusChangeTarget} onOpenChange={(open) => { if (!open) setStatusChangeTarget(null); }}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {statusChangeTarget?.status === 'cancelled' ? (
                <Ban className="w-5 h-5 text-red-600" />
              ) : statusChangeTarget?.status === 'in_progress' ? (
                <Play className="w-5 h-5 text-sky-600" />
              ) : (
                <CheckCircle2 className="w-5 h-5 text-green-600" />
              )}
              تأكيد تغيير الحالة
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد تغيير حالة التكليف إلى &quot;{statusChangeTarget?.label}&quot;؟
              {statusChangeTarget?.status === 'cancelled' && ' سيتم إلغاء التكليف وإشعار جميع المتقدمين.'}
              {statusChangeTarget?.status === 'in_progress' && ' سيتم بدء تنفيذ التكليف.'}
              {statusChangeTarget?.status === 'completed' && ' سيتم إكمال التكليف وإشعار المكلف.'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className={
                statusChangeTarget?.status === 'cancelled'
                  ? 'bg-red-600 hover:bg-red-700 text-white'
                  : statusChangeTarget?.status === 'completed'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-admin hover:bg-admin/90 text-white'
              }
              onClick={handleStatusChange}
              disabled={isChangingStatus}
            >
              {isChangingStatus ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ═══════════════ VIEW PAYMENT PROOF DIALOG ═══════════════ */}
      <Dialog open={!!viewingPayment} onOpenChange={(open) => { if (!open) setViewingPayment(null); }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Wallet className="w-5 h-5 text-orange-600" />
              إثبات الدفع
            </DialogTitle>
            <DialogDescription>
              إثبات دفع {viewingPayment?.applicantName}
            </DialogDescription>
          </DialogHeader>

          {viewingPayment && (
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-muted/40 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">المتقدم</span>
                  <span className="font-medium">{viewingPayment.applicantName}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">رسوم التقديم</span>
                  <span className="font-medium">{toArabicNum(viewingPayment.serviceFee)} ر.ي</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">تاريخ الدفع</span>
                  <span className="font-medium">{formatDate(viewingPayment.paymentSubmittedAt)}</span>
                </div>
              </div>
              {/* Payment proof image */}
              {viewingPayment.paymentProofImage && (
                <div className="space-y-1.5">
                  <p className="text-[10px] text-muted-foreground font-medium">صورة إثبات الدفع</p>
                  <img
                    src={viewingPayment.paymentProofImage}
                    alt="إثبات الدفع"
                    className="max-w-full rounded-lg border"
                  />
                </div>
              )}
              {viewingPayment.paymentProofData && (
                <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30">
                  <p className="text-[10px] text-muted-foreground mb-1.5 font-medium">تفاصيل إثبات الدفع</p>
                  <p className="text-sm leading-relaxed whitespace-pre-wrap">{viewingPayment.paymentProofData}</p>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setViewingPayment(null)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
