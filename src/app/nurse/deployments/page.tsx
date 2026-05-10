'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, FileText, CheckCircle2, Plus, MapPin, Clock, DollarSign,
  Loader2, Upload, X, Eye, RefreshCw, Filter, Search, Navigation,
  Building2, Landmark, Hash, Percent, FileCheck, Wallet, Star,
  User, ShieldCheck, Award, BriefcaseMedical, Phone, CheckCircle,
  CreditCard, MessageSquare
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard } from '@/components/common/glass-card';
import { BadgeStatus } from '@/components/common/badge-status';
import { EmptyState } from '@/components/common/empty-state';
import { CardSkeleton } from '@/components/common/loading-skeleton';
import { GpsLocationButton } from '@/components/common/gps-location-button';
import { useAuthFetch } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  serviceFee: number;
  coverLetter?: string;
  rejectedReason?: string;
}

interface DeploymentItem {
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

const specializationOptions = [
  { id: 'general_nursing', label: 'تمريض عام' },
  { id: 'critical_care', label: 'رعاية حرجة' },
  { id: 'pediatric', label: 'أطفال' },
  { id: 'surgical', label: 'جراحي' },
  { id: 'obstetrics', label: 'توليد' },
  { id: 'mental_health', label: 'صحة نفسية' },
  { id: 'community_health', label: 'صحة مجتمع' },
  { id: 'emergency', label: 'طوارئ' },
  { id: 'lab_tech', label: 'مختبر' },
  { id: 'midwife', label: 'قابلة' },
];

const governorateOptions = [
  'أمانة العاصمة', 'عدن', 'تعز', 'الحديدة', 'إب', 'ذمار', 'حضرموت',
  'المكلا', 'عمران', 'صعدة', 'البيضاء', 'مأرب', 'لحج', 'أبين',
  'شبوة', 'حجة', 'صنعاء', 'الضالع', 'ريمة', 'سقطرى',
];

const deploymentStatusMap: Record<string, string> = {
  open: 'pending',
  creator_selected: 'creator_selected',
  admin_approved: 'admin_approved',
  assigned: 'assigned',
  in_progress: 'in_progress',
  completed: 'completed',
  cancelled: 'cancelled',
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

const deploymentStatusLabel: Record<string, string> = {
  open: 'متاح',
  creator_selected: 'تم اختيار مكلف',
  admin_approved: 'موافقة الإدارة',
  assigned: 'تم التعيين',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

/* ─────────────── Animation ─────────────── */
const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

/* ════════════════════════════════════════════════════════════════ */
/* ═══════════════ MAIN COMPONENT ════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════ */
export default function NurseDeploymentsPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const authUser = useAuthStore((s) => s.user);
  const currentUserId = authUser?.id || '';

  // Data state
  const [deployments, setDeployments] = useState<DeploymentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('available');

  // Apply modal state
  const [applyTarget, setApplyTarget] = useState<DeploymentItem | null>(null);
  const [isApplying, setIsApplying] = useState(false);
  const [coverLetter, setCoverLetter] = useState('');

  // Payment proof modal state
  const [paymentTarget, setPaymentTarget] = useState<DeploymentItem | null>(null);
  const [paymentProof, setPaymentProof] = useState('');
  const [paymentProofImage, setPaymentProofImage] = useState('');
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Manage applicants modal state
  const [manageTarget, setManageTarget] = useState<DeploymentItem | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // Create deployment form state
  const [createForm, setCreateForm] = useState({
    title: '',
    description: '',
    type: 'nursing',
    specialization: [] as string[],
    hours: 1,
    location: {} as DeploymentLocation,
    governorate: '',
    district: '',
    amount: 0,
    requirements: '',
    notes: '',
  });
  const [adminCommissionPercent, setAdminCommissionPercent] = useState(15);
  const [creatorServiceFee, setCreatorServiceFee] = useState(0);
  const [applicantServiceFee, setApplicantServiceFee] = useState(500);
  const [isCreating, setIsCreating] = useState(false);

  /* ── Fetch deployments ── */
  const fetchDeployments = useCallback(async () => {
    try {
      const res = await authFetch('/api/deployments?limit=100');
      const json = await res.json();
      if (json.success && json.data) {
        const deps = json.data.deployments ?? json.data;
        setDeployments(Array.isArray(deps) ? deps : []);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchDeployments();
  }, [fetchDeployments]);

  /* ── Fetch admin settings for commission ── */
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await authFetch('/api/settings/pricing');
        const json = await res.json();
        if (json.success && json.data) {
          setAdminCommissionPercent(json.data.commissionRate ?? 15);
          setCreatorServiceFee(json.data.deploymentCreatorFee ?? 0);
          setApplicantServiceFee(json.data.deploymentApplicantFee ?? 500);
        }
      } catch {
        // Use defaults
      }
    };
    void fetchSettings();
  }, [authFetch]);

  /* ── Derived state ── */
  // Helper: Compare IDs safely (handles string vs ObjectId mismatch)
  const idMatches = (a: string | undefined | null, b: string): boolean => {
    if (!a || !b) return false;
    return a.toString() === b.toString();
  };

  // A) Updated filter: Show ALL open deployments (both admin-created AND nurse-created)
  const availableDeployments = deployments.filter(
    (d) => d.status === 'open' && !idMatches(d.createdBy?.id, currentUserId) && !d.applications.some((a) => idMatches(a.applicantId, currentUserId))
  );

  const myApplications = deployments.filter(
    (d) => d.applications.some((a) => idMatches(a.applicantId, currentUserId))
  );

  const activeDeployments = deployments.filter(
    (d) => idMatches(d.assignedTo?.id, currentUserId) && ['assigned', 'in_progress'].includes(d.status)
  );

  // B) My Created tab: deployments created by the current nurse
  const myCreatedDeployments = deployments.filter(
    (d) => {
      // Defensive ID comparison: handle both populated and unpopulated createdBy
      const creatorId = d.createdBy?.id || (typeof d.createdBy === 'string' ? d.createdBy : null);
      return idMatches(creatorId, currentUserId) && d.creatorRole === 'nurse';
    }
  );

  // Completed tab: completed/cancelled deployments the user is related to
  const completedDeployments = deployments.filter(
    (d) => ['completed', 'cancelled'].includes(d.status)
      && (idMatches(d.createdBy?.id, currentUserId)
          || d.applications.some((a) => idMatches(a.applicantId, currentUserId))
          || idMatches(d.assignedTo?.id, currentUserId))
  );

  /* ── Apply for deployment ── */
  const handleApply = async () => {
    if (!applyTarget) return;
    setIsApplying(true);
    try {
      const res = await authFetch(`/api/deployments/${applyTarget.id}/apply`, {
        method: 'POST',
        body: JSON.stringify({ coverLetter }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم التقديم بنجاح. سيتم إشعارك عند اختيارك من قبل صاحب التكليف');
        void fetchDeployments();
        setApplyTarget(null);
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
    if (!paymentTarget || (!paymentProof && !paymentProofImage)) return;
    setIsSubmittingPayment(true);
    try {
      const res = await authFetch(`/api/deployments/${paymentTarget.id}/submit-payment`, {
        method: 'POST',
        body: JSON.stringify({
          paymentProofData: paymentProof || undefined,
          paymentProofImage: paymentProofImage || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تقديم إثبات الدفع بنجاح. سيتم مراجعته قريباً');
        void fetchDeployments();
        setPaymentTarget(null);
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

  /* ── Select applicant ── */
  const handleSelectApplicant = async (deploymentId: string, applicationId: string) => {
    setIsSelecting(true);
    try {
      const res = await authFetch(`/api/deployments/${deploymentId}/select-applicant`, {
        method: 'PATCH',
        body: JSON.stringify({ applicationId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`تم اختيار المتقدم. بانتظار موافقة الإدارة`);
        void fetchDeployments();
        setManageTarget(null);
      } else {
        toast.error(json.message ?? 'فشل اختيار المتقدم');
      }
    } catch {
      toast.error('حدث خطأ أثناء اختيار المتقدم');
    } finally {
      setIsSelecting(false);
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

  /* ── Create deployment ── */
  const handleCreateDeployment = async () => {
    if (!createForm.title || !createForm.description || !createForm.hours || !createForm.amount) {
      toast.error('العنوان والوصف وعدد الساعات والمبلغ مطلوبة');
      return;
    }
    setIsCreating(true);
    try {
      const res = await authFetch('/api/deployments', {
        method: 'POST',
        body: JSON.stringify({
          title: createForm.title,
          description: createForm.description,
          type: createForm.type,
          specialization: createForm.specialization,
          hours: createForm.hours,
          location: {
            ...createForm.location,
            governorate: createForm.governorate || undefined,
            district: createForm.district || undefined,
          },
          amount: createForm.amount,
          requirements: createForm.requirements || undefined,
          notes: createForm.notes || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم إنشاء التكليف بنجاح');
        await fetchDeployments();
        setCreateForm({
          title: '',
          description: '',
          type: 'nursing',
          specialization: [],
          hours: 1,
          location: {},
          governorate: '',
          district: '',
          amount: 0,
          requirements: '',
          notes: '',
        });
        setActiveTab('mycreated');
      } else {
        toast.error(json.message ?? 'فشل إنشاء التكليف');
      }
    } catch {
      toast.error('حدث خطأ أثناء إنشاء التكليف');
    } finally {
      setIsCreating(false);
    }
  };

  /* ── Toggle specialization ── */
  const toggleSpecialization = (specId: string) => {
    setCreateForm((prev) => ({
      ...prev,
      specialization: prev.specialization.includes(specId)
        ? prev.specialization.filter((s) => s !== specId)
        : [...prev.specialization, specId],
    }));
  };

  /* ── Get current user's application for a deployment ── */
  const getMyApplication = (deployment: DeploymentItem): DeploymentApplication | undefined => {
    return deployment.applications.find((a) => idMatches(a.applicantId, currentUserId));
  };

  /* ── Render deployment card ── */
  const renderDeploymentCard = (dep: DeploymentItem, showActions: 'apply' | 'view' | 'payment' = 'view') => {
    const tc = typeColors[dep.type] || typeColors.other;
    return (
      <motion.div key={dep.id} variants={itemAnim} className="rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all">
        <div className={`h-1.5 rounded-t-2xl ${tc.bg}`} />
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-xl ${tc.icon} flex items-center justify-center`}>
                <Briefcase className={`w-5 h-5 ${tc.text}`} />
              </div>
              <div>
                <p className="font-bold text-sm line-clamp-1">{dep.title}</p>
                <span className="text-[11px] text-muted-foreground">{typeLabels[dep.type] || dep.type}</span>
              </div>
            </div>
            <BadgeStatus
              status={deploymentStatusMap[dep.status] || 'pending'}
              label={deploymentStatusLabel[dep.status] || dep.status}
              size="sm"
            />
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>{toArabicNum(dep.hours)} ساعة</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <DollarSign className="w-3.5 h-3.5" />
              <span>{toArabicNum(dep.amount.toLocaleString())} ر.ي</span>
            </div>
            {dep.location?.address && (
              <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="truncate">{dep.location.address}</span>
              </div>
            )}
            {dep.applicantServiceFee > 0 && (
              <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 col-span-2">
                <Wallet className="w-3.5 h-3.5" />
                <span>رسوم المتقدم: {toArabicNum(dep.applicantServiceFee)} ر.ي</span>
              </div>
            )}
          </div>

          {/* My application status */}
          {showActions === 'view' && (() => {
            const myApp = getMyApplication(dep);
            if (!myApp) return null;
            return (
              <div className="p-2 rounded-lg bg-muted/40">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">حالة تقديمك</span>
                  <BadgeStatus
                    status={applicationStatusMap[myApp.status] || 'pending'}
                    label={applicationStatusLabel[myApp.status] || myApp.status}
                    size="sm"
                  />
                </div>
                {/* Show status-specific messages */}
                {myApp.status === 'selected_by_creator' && (
                  <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1 font-medium">
                    تم اختيارك! بانتظار موافقة الإدارة
                  </p>
                )}
                {myApp.status === 'admin_approved' && (
                  <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1 font-medium">
                    تمت موافقة الإدارة! يرجى دفع رسوم التقديم
                  </p>
                )}
              </div>
            );
          })()}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs gap-1 flex-1"
              onClick={() => router.push(`/nurse/deployments/${dep.id}`)}
            >
              <Eye className="w-3.5 h-3.5" /> التفاصيل
            </Button>
            {showActions === 'apply' && dep.status === 'open' && (
              <Button
                size="sm"
                className="h-8 text-xs gap-1 flex-1 bg-nurse hover:bg-nurse/90 text-white"
                onClick={() => {
                  setApplyTarget(dep);
                  setCoverLetter('');
                }}
              >
                <FileText className="w-3.5 h-3.5" /> تقديم
              </Button>
            )}
            {showActions === 'payment' && (() => {
              const myApp = getMyApplication(dep);
              if (myApp?.status === 'payment_pending') {
                return (
                  <Button
                    size="sm"
                    className="h-8 text-xs gap-1 flex-1 bg-orange-600 hover:bg-orange-700 text-white"
                    onClick={() => {
                      setPaymentTarget(dep);
                      setPaymentProof('');
                      setPaymentProofImage('');
                    }}
                  >
                    <Upload className="w-3.5 h-3.5" /> إثبات الدفع
                  </Button>
                );
              }
              return null;
            })()}
          </div>
        </div>
      </motion.div>
    );
  };

  /* ── Render created deployment card with applicants ── */
  const renderCreatedDeploymentCard = (dep: DeploymentItem) => {
    const tc = typeColors[dep.type] || typeColors.other;
    const pendingCount = dep.applications.filter((a) => a.status === 'pending').length;
    const selectedApp = dep.applications.find((a) => a.status === 'selected_by_creator' || a.status === 'admin_approved' || a.status === 'payment_pending' || a.status === 'payment_submitted' || a.status === 'payment_verified' || a.status === 'accepted');

    return (
      <motion.div key={dep.id} variants={itemAnim} className="rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all">
        <div className={`h-1.5 rounded-t-2xl ${tc.bg}`} />
        <div className="p-4 space-y-3">
          {/* Header */}
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <div className={`w-10 h-10 rounded-xl ${tc.icon} flex items-center justify-center`}>
                <Briefcase className={`w-5 h-5 ${tc.text}`} />
              </div>
              <div>
                <p className="font-bold text-sm line-clamp-1">{dep.title}</p>
                <span className="text-[11px] text-muted-foreground">{typeLabels[dep.type] || dep.type}</span>
              </div>
            </div>
            <BadgeStatus
              status={deploymentStatusMap[dep.status] || 'pending'}
              label={deploymentStatusLabel[dep.status] || dep.status}
              size="sm"
            />
          </div>

          {/* Details */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <DollarSign className="w-3.5 h-3.5" />
              <span>{toArabicNum(dep.amount.toLocaleString())} ر.ي</span>
            </div>
            <div className="flex items-center gap-1.5 text-muted-foreground">
              <Clock className="w-3.5 h-3.5" />
              <span>{toArabicNum(dep.hours)} ساعة</span>
            </div>
          </div>

          {/* Applicants summary */}
          <div className="p-2 rounded-lg bg-muted/40 space-y-1.5">
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">عدد المتقدمين</span>
              <span className="font-medium">{toArabicNum(dep.applications.length)}</span>
            </div>
            {pendingCount > 0 && (
              <div className="flex items-center justify-between text-xs">
                <span className="text-yellow-600 dark:text-yellow-400">بانتظار الاختيار</span>
                <span className="font-medium text-yellow-600 dark:text-yellow-400">{toArabicNum(pendingCount)}</span>
              </div>
            )}
          </div>

          {/* Status messages for created deployments */}
          {dep.status === 'creator_selected' && (
            <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <p className="text-xs text-amber-700 dark:text-amber-300 font-medium">بانتظار موافقة الإدارة</p>
              </div>
              {selectedApp && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 mt-1">
                  المكلف: {selectedApp.applicantName}
                </p>
              )}
            </div>
          )}
          {dep.status === 'admin_approved' && (
            <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30">
              <div className="flex items-center gap-1.5">
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                <p className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">بانتظار دفع المكلف</p>
              </div>
              {selectedApp && (
                <p className="text-[11px] text-emerald-600 dark:text-emerald-400 mt-1">
                  المكلف: {selectedApp.applicantName}
                </p>
              )}
            </div>
          )}
          {dep.status === 'assigned' && selectedApp && (
            <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-900/30">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />
                <p className="text-xs text-purple-700 dark:text-purple-300 font-medium">
                  تم التعيين: {selectedApp.applicantName}
                  {dep.contactRevealed && ' • تم الكشف عن بيانات التواصل'}
                </p>
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs gap-1 flex-1"
              onClick={() => router.push(`/nurse/deployments/${dep.id}`)}
            >
              <Eye className="w-3.5 h-3.5" /> التفاصيل
            </Button>
            {dep.status === 'open' && dep.applications.length > 0 && (
              <Button
                size="sm"
                className="h-8 text-xs gap-1 flex-1 bg-nurse hover:bg-nurse/90 text-white"
                onClick={() => setManageTarget(dep)}
              >
                <User className="w-3.5 h-3.5" /> إدارة المتقدمين ({toArabicNum(dep.applications.length)})
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemAnim}>
        <PageHeader
          title="التكليفات"
          description="تصفح التكليفات المتاحة وتقدم لها أو أنشئ تكليفاً خاصاً بك"
          action={{
            label: 'تحديث',
            icon: <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />,
            onClick: () => { setIsLoading(true); void fetchDeployments(); },
          }}
        />
      </motion.div>

      {/* Tabs - Updated to 6 tabs */}
      <motion.div variants={itemAnim}>
        <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
          <TabsList className="w-full grid grid-cols-6 h-auto p-1 gap-1">
            <TabsTrigger value="available" className="text-xs py-2 data-[state=active]:bg-nurse data-[state=active]:text-white">
              المتاحة
              {availableDeployments.length > 0 && (
                <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0">
                  {toArabicNum(availableDeployments.length)}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="applications" className="text-xs py-2">
              تقديماتي
              {myApplications.length > 0 && (
                <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0">
                  {toArabicNum(myApplications.length)}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active" className="text-xs py-2">
              النشطة
              {activeDeployments.length > 0 && (
                <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0">
                  {toArabicNum(activeDeployments.length)}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="mycreated" className="text-xs py-2">
              تكليفاتي
              {myCreatedDeployments.length > 0 && (
                <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0">
                  {toArabicNum(myCreatedDeployments.length)}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="completed" className="text-xs py-2">
              مكتملة
              {completedDeployments.length > 0 && (
                <Badge variant="secondary" className="mr-1 text-[10px] px-1.5 py-0">
                  {toArabicNum(completedDeployments.length)}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="create" className="text-xs py-2">
              <Plus className="w-3.5 h-3.5" /> إنشاء
            </TabsTrigger>
          </TabsList>

          {/* ── Tab 1: Available Deployments ── */}
          <TabsContent value="available" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                <CardSkeleton />
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : availableDeployments.length === 0 ? (
              <EmptyState
                icon={<Briefcase className="w-10 h-10 text-muted-foreground" />}
                title="لا توجد تكليفات متاحة"
                description="لا توجد تكليفات مفتوحة للتقديم حالياً. تحقق لاحقاً"
              />
            ) : (
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {availableDeployments.map((dep) => renderDeploymentCard(dep, 'apply'))}
              </motion.div>
            )}
          </TabsContent>

          {/* ── Tab 2: My Applications ── */}
          <TabsContent value="applications" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : myApplications.length === 0 ? (
              <EmptyState
                icon={<FileText className="w-10 h-10 text-muted-foreground" />}
                title="لا توجد تقديمات"
                description="لم تتقدم على أي تكليف بعد. تصفح التكليفات المتاحة وتقدم لها"
                action={{
                  label: 'تصفح التكليفات',
                  onClick: () => setActiveTab('available'),
                }}
              />
            ) : (
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myApplications.map((dep) => {
                  const myApp = getMyApplication(dep);
                  const showPaymentButton = myApp?.status === 'payment_pending';
                  return renderDeploymentCard(dep, showPaymentButton ? 'payment' : 'view');
                })}
              </motion.div>
            )}
          </TabsContent>

          {/* ── Tab 3: Active Deployments ── */}
          <TabsContent value="active" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : activeDeployments.length === 0 ? (
              <EmptyState
                icon={<CheckCircle2 className="w-10 h-10 text-muted-foreground" />}
                title="لا توجد تكليفات نشطة"
                description="لم يتم تعيينك على أي تكليف نشط حالياً"
                action={{
                  label: 'تصفح التكليفات',
                  onClick: () => setActiveTab('available'),
                }}
              />
            ) : (
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {activeDeployments.map((dep) => renderDeploymentCard(dep, 'view'))}
              </motion.div>
            )}
          </TabsContent>

          {/* ── Tab 4: My Created Deployments (تكليفاتي) ── */}
          <TabsContent value="mycreated" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : myCreatedDeployments.length === 0 ? (
              <EmptyState
                icon={<BriefcaseMedical className="w-10 h-10 text-muted-foreground" />}
                title="لا توجد تكليفات منشأة"
                description="لم تنشئ أي تكليف بعد. أنشئ تكليفاً لعرضه على الممرضين الآخرين"
                action={{
                  label: 'إنشاء تكليف',
                  onClick: () => setActiveTab('create'),
                }}
              />
            ) : (
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {myCreatedDeployments.map((dep) => renderCreatedDeploymentCard(dep))}
              </motion.div>
            )}
          </TabsContent>

          {/* ── Tab 5: Completed Deployments ── */}
          <TabsContent value="completed" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : completedDeployments.length === 0 ? (
              <EmptyState
                icon={<CheckCircle className="w-10 h-10 text-muted-foreground" />}
                title="لا توجد تكليفات مكتملة"
                description="لم تكمل أو تلغِ أي تكليف بعد"
              />
            ) : (
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {completedDeployments.map((dep) => renderDeploymentCard(dep, 'view'))}
              </motion.div>
            )}
          </TabsContent>

          {/* ── Tab 6: Create Deployment ── */}
          <TabsContent value="create" className="mt-4">
            <GlassCard variant="nurse" className="space-y-5">
              <div className="flex items-center gap-2">
                <div className="w-10 h-10 rounded-xl bg-nurse/10 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-nurse" />
                </div>
                <div>
                  <h3 className="font-bold">إنشاء تكليف جديد</h3>
                  <p className="text-xs text-muted-foreground">أنشئ تكليفاً لعرض خدماتك على الآخرين</p>
                </div>
              </div>

              <Separator />

              {/* Title */}
              <div className="space-y-2">
                <Label htmlFor="dep-title" className="text-sm font-medium">
                  عنوان التكليف <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="dep-title"
                  placeholder="مثال: ممرض/ة للرعاية المنزلية"
                  value={createForm.title}
                  onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
                />
              </div>

              {/* Description */}
              <div className="space-y-2">
                <Label htmlFor="dep-desc" className="text-sm font-medium">
                  الوصف <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  id="dep-desc"
                  placeholder="اكتب وصفاً تفصيلياً للتكليف..."
                  rows={3}
                  value={createForm.description}
                  onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
                />
              </div>

              {/* Type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">نوع التكليف</Label>
                <Select
                  value={createForm.type}
                  onValueChange={(val) => setCreateForm((p) => ({ ...p, type: val as any }))}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="اختر النوع" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Specialization multi-select */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">التخصصات المطلوبة</Label>
                <div className="flex flex-wrap gap-2">
                  {specializationOptions.map((spec) => {
                    const isSelected = createForm.specialization.includes(spec.id);
                    return (
                      <button
                        key={spec.id}
                        type="button"
                        onClick={() => toggleSpecialization(spec.id)}
                        className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-nurse text-white shadow-sm'
                            : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                        }`}
                      >
                        {spec.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Hours & Amount row */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="dep-hours" className="text-sm font-medium">
                    عدد الساعات <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dep-hours"
                    type="number"
                    min={1}
                    value={createForm.hours}
                    onChange={(e) => setCreateForm((p) => ({ ...p, hours: parseInt(e.target.value) || 1 }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dep-amount" className="text-sm font-medium">
                    المبلغ (ر.ي) <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    id="dep-amount"
                    type="number"
                    min={0}
                    value={createForm.amount}
                    onChange={(e) => setCreateForm((p) => ({ ...p, amount: parseInt(e.target.value) || 0 }))}
                  />
                </div>
              </div>

              {/* D) Commission display - Updated to show BOTH fees */}
              {createForm.amount > 0 && (
                <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-900/30 space-y-1.5">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">المبلغ الأساسي</span>
                    <span className="font-medium">{toArabicNum(createForm.amount.toLocaleString())} ر.ي</span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">نسبة العمولة ({toArabicNum(adminCommissionPercent)}%)</span>
                    <span className="font-medium text-orange-600">
                      {toArabicNum(Math.round((createForm.amount * adminCommissionPercent) / 100).toLocaleString())} ر.ي → للإدارة
                    </span>
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between text-sm font-bold">
                    <span>صافيك</span>
                    <span className="text-green-600">
                      {toArabicNum((createForm.amount - Math.round((createForm.amount * adminCommissionPercent) / 100)).toLocaleString())} ر.ي
                    </span>
                  </div>
                  {creatorServiceFee > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">رسوم صاحب التكليف</span>
                      <span className="font-medium text-blue-600">
                        {toArabicNum(creatorServiceFee)} ر.ي
                      </span>
                    </div>
                  )}
                  {applicantServiceFee > 0 && (
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-muted-foreground">رسوم المتقدم</span>
                      <span className="font-medium text-orange-600">
                        {toArabicNum(applicantServiceFee)} ر.ي
                      </span>
                    </div>
                  )}
                </div>
              )}

              {/* Location */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">الموقع</Label>
                <GpsLocationButton
                  onLocationDetected={(loc) => {
                    setCreateForm((p) => ({
                      ...p,
                      location: {
                        lat: loc.latitude,
                        lng: loc.longitude,
                        address: loc.address || `${loc.latitude.toFixed(6)}, ${loc.longitude.toFixed(6)}`,
                      },
                    }));
                  }}
                  value={createForm.location.address || ''}
                  placeholder="حدد موقعك الجغرافي"
                />
              </div>

              {/* Governorate & District */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">المحافظة</Label>
                  <Select
                    value={createForm.governorate}
                    onValueChange={(val) => setCreateForm((p) => ({ ...p, governorate: val }))}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="اختر المحافظة" />
                    </SelectTrigger>
                    <SelectContent>
                      {governorateOptions.map((gov) => (
                        <SelectItem key={gov} value={gov}>{gov}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="dep-district" className="text-sm font-medium">المديرية</Label>
                  <Input
                    id="dep-district"
                    placeholder="اسم المديرية"
                    value={createForm.district}
                    onChange={(e) => setCreateForm((p) => ({ ...p, district: e.target.value }))}
                  />
                </div>
              </div>

              {/* Requirements */}
              <div className="space-y-2">
                <Label htmlFor="dep-reqs" className="text-sm font-medium">المتطلبات</Label>
                <Textarea
                  id="dep-reqs"
                  placeholder="المتطلبات اللازمة للتكليف..."
                  rows={2}
                  value={createForm.requirements}
                  onChange={(e) => setCreateForm((p) => ({ ...p, requirements: e.target.value }))}
                />
              </div>

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="dep-notes" className="text-sm font-medium">ملاحظات</Label>
                <Textarea
                  id="dep-notes"
                  placeholder="ملاحظات إضافية..."
                  rows={2}
                  value={createForm.notes}
                  onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
                />
              </div>

              {/* Submit */}
              <Button
                className="w-full gap-2 bg-nurse hover:bg-nurse/90 text-white"
                onClick={handleCreateDeployment}
                disabled={isCreating}
              >
                {isCreating ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                إنشاء التكليف
              </Button>
            </GlassCard>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* ═══════════════ APPLY DIALOG ═══════════════ */}
      <Dialog open={!!applyTarget} onOpenChange={(open) => { if (!open) { setApplyTarget(null); setCoverLetter(''); } }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-nurse" />
              التقديم على التكليف
            </DialogTitle>
            <DialogDescription>
              {applyTarget?.title}
            </DialogDescription>
          </DialogHeader>

          {applyTarget && (
            <div className="space-y-4">
              {/* Deployment summary */}
              <div className="p-3 rounded-xl bg-muted/40 space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">النوع</span>
                  <span className="font-medium">{typeLabels[applyTarget.type]}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">الساعات</span>
                  <span className="font-medium">{toArabicNum(applyTarget.hours)} ساعة</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">المبلغ</span>
                  <span className="font-medium">{toArabicNum(applyTarget.amount.toLocaleString())} ر.ي</span>
                </div>
                {/* Show admin commission info */}
                <div className="flex items-center justify-between text-sm text-orange-600 dark:text-orange-400">
                  <span>منها {toArabicNum(applyTarget.adminCommissionAmount?.toLocaleString() ?? Math.round((applyTarget.amount * adminCommissionPercent) / 100).toLocaleString())} للإدارة</span>
                </div>
              </div>

              {/* Info note: no payment at apply time */}
              <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30">
                <p className="text-xs text-blue-700 dark:text-blue-300">
                  التقديم مجاني. سيتم طلب رسوم التقديم فقط عند اختيارك وموافقة الإدارة.
                </p>
              </div>

              {/* Cover letter */}
              <div className="space-y-2">
                <Label htmlFor="cover-letter" className="text-sm font-medium">رسالة التقديم (اختياري)</Label>
                <Textarea
                  id="cover-letter"
                  placeholder="اكتب رسالة تشرح فيها لماذا أنت مناسب لهذا التكليف..."
                  rows={3}
                  value={coverLetter}
                  onChange={(e) => setCoverLetter(e.target.value)}
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setApplyTarget(null); setCoverLetter(''); }}
            >
              إلغاء
            </Button>
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
      <Dialog open={!!paymentTarget} onOpenChange={(open) => { if (!open) { setPaymentTarget(null); setPaymentProof(''); setPaymentProofImage(''); } }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-orange-600" />
              تقديم إثبات الدفع
            </DialogTitle>
            <DialogDescription>
              {paymentTarget?.title}
            </DialogDescription>
          </DialogHeader>

          {paymentTarget && (() => {
            const myApp = getMyApplication(paymentTarget);
            return (
              <div className="space-y-4">
                <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900/30">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-orange-700 dark:text-orange-300">رسوم التقديم</span>
                    <span className="font-bold text-orange-700 dark:text-orange-300">{toArabicNum(myApp?.serviceFee ?? paymentTarget.applicantServiceFee ?? paymentTarget.serviceFee)} ر.ي</span>
                  </div>
                </div>

                {/* Payment Details in Modal */}
                {(paymentTarget.paymentMethod || paymentTarget.walletNumber || paymentTarget.walletOwnerName) && (
                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 space-y-2">
                    <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-1.5">
                      <Wallet className="w-3.5 h-3.5" />
                      تفاصيل الدفع
                    </p>
                    {paymentTarget.paymentMethod && (
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-600 dark:text-blue-400">طريقة الدفع</span>
                        <span className="font-medium text-blue-800 dark:text-blue-200">{paymentTarget.paymentMethod}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-blue-600 dark:text-blue-400">المبلغ</span>
                      <span className="font-medium text-blue-800 dark:text-blue-200">{toArabicNum(myApp?.serviceFee ?? paymentTarget.applicantServiceFee ?? paymentTarget.serviceFee)} ر.ي</span>
                    </div>
                    {paymentTarget.walletNumber && (
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-600 dark:text-blue-400">رقم المحفظة</span>
                        <span className="font-medium text-blue-800 dark:text-blue-200 font-mono" dir="ltr">{paymentTarget.walletNumber}</span>
                      </div>
                    )}
                    {paymentTarget.walletOwnerName && (
                      <div className="flex justify-between text-xs">
                        <span className="text-blue-600 dark:text-blue-400">اسم صاحب المحفظة</span>
                        <span className="font-medium text-blue-800 dark:text-blue-200">{paymentTarget.walletOwnerName}</span>
                      </div>
                    )}
                    {paymentTarget.walletNumber && (
                      <div className="flex gap-2 pt-1">
                        <a
                          href={`https://wa.me/${paymentTarget.walletNumber.replace(/^0+/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[10px] font-medium"
                        >
                          تحويل واتساب
                        </a>
                        <button
                          onClick={() => { navigator.clipboard.writeText(paymentTarget.walletNumber); toast.success('تم نسخ رقم المحفظة'); }}
                          className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-medium"
                        >
                          نسخ الرقم
                        </button>
                      </div>
                    )}
                  </div>
                )}

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
                  <Label htmlFor="payment-proof-text" className="text-sm font-medium">
                    أو أدخل رقم العملية (اختياري)
                  </Label>
                  <Textarea
                    id="payment-proof-text"
                    placeholder="أدخل رقم العملية أو معلومات التحويل البنكي..."
                    rows={2}
                    value={paymentProof}
                    onChange={(e) => setPaymentProof(e.target.value)}
                  />
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setPaymentTarget(null); setPaymentProof(''); setPaymentProofImage(''); }}
            >
              إلغاء
            </Button>
            <Button
              className="gap-2 bg-orange-600 hover:bg-orange-700 text-white"
              onClick={handleSubmitPayment}
              disabled={isSubmittingPayment || (!paymentProof && !paymentProofImage)}
            >
              {isSubmittingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              إرسال إثبات الدفع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ MANAGE APPLICANTS DIALOG ═══════════════ */}
      <Dialog open={!!manageTarget} onOpenChange={(open) => { if (!open) setManageTarget(null); }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <User className="w-5 h-5 text-nurse" />
              إدارة المتقدمين
            </DialogTitle>
            <DialogDescription>
              {manageTarget?.title} — {toArabicNum(manageTarget?.applications.length ?? 0)} متقدم
            </DialogDescription>
          </DialogHeader>

          {manageTarget && (
            <div className="space-y-3">
              {manageTarget.applications.length === 0 ? (
                <div className="py-8 text-center">
                  <User className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">لا يوجد متقدمين بعد</p>
                </div>
              ) : (
                manageTarget.applications.map((app) => (
                  <div
                    key={app._id || app.applicantId}
                    className="p-3 rounded-xl border bg-card space-y-2"
                  >
                    {/* Applicant header */}
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

                    {/* Cover letter */}
                    {app.coverLetter && (
                      <div className="p-2 rounded-lg bg-muted/40">
                        <p className="text-[10px] text-muted-foreground mb-0.5">رسالة التقديم</p>
                        <p className="text-[11px] leading-relaxed">{app.coverLetter}</p>
                      </div>
                    )}

                    {/* Select button for pending applicants */}
                    {app.status === 'pending' && manageTarget.status === 'open' && (
                      <Button
                        size="sm"
                        className="w-full h-8 text-xs gap-1 bg-nurse hover:bg-nurse/90 text-white"
                        onClick={() => handleSelectApplicant(manageTarget.id, app._id!)}
                        disabled={isSelecting}
                      >
                        {isSelecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                        اختيار
                      </Button>
                    )}

                    {/* Status-specific messages */}
                    {app.status === 'selected_by_creator' && (
                      <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30">
                        <p className="text-[11px] text-amber-700 dark:text-amber-300 font-medium">
                          بانتظار موافقة الإدارة
                        </p>
                      </div>
                    )}
                    {app.status === 'admin_approved' && (
                      <div className="p-2 rounded-lg bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30">
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-medium">
                          تمت الموافقة — بانتظار دفع المكلف
                        </p>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
