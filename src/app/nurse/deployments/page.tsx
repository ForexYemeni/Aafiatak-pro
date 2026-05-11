'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, FileText, CheckCircle2, Plus, MapPin, Clock, DollarSign,
  Loader2, Upload, X, Eye, RefreshCw, Filter, Search, Navigation,
  Building2, Landmark, Hash, Percent, FileCheck, Wallet, Star,
  User, ShieldCheck, Award, BriefcaseMedical, Phone, CheckCircle,
  CreditCard, MessageSquare, Activity, Heart, Zap, Stethoscope, XCircle,
  Tag, CircleCheck
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard } from '@/components/common/glass-card';
import { BadgeStatus } from '@/components/common/badge-status';
import { EmptyState } from '@/components/common/empty-state';
import { CardSkeleton } from '@/components/common/loading-skeleton';
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
  type: 'nursing' | 'lab' | 'midwife' | 'home_care' | 'lab_nurse' | 'medical_sector' | 'other';
  gender?: 'male' | 'female';
  department?: string;
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
  lab_nurse: 'ممرض مخبري',
  medical_sector: 'القطاع الطبي كامل',
  other: 'أخرى',
};

const typeColors: Record<string, { bg: string; text: string; icon: string }> = {
  nursing:    { bg: 'bg-teal-500',    text: 'text-teal-600 dark:text-teal-400',    icon: 'bg-teal-100 dark:bg-teal-900/30' },
  lab:        { bg: 'bg-purple-500',  text: 'text-purple-600 dark:text-purple-400', icon: 'bg-purple-100 dark:bg-purple-900/30' },
  midwife:    { bg: 'bg-pink-500',    text: 'text-pink-600 dark:text-pink-400',     icon: 'bg-pink-100 dark:bg-pink-900/30' },
  home_care:  { bg: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',   icon: 'bg-amber-100 dark:bg-amber-900/30' },
  lab_nurse:  { bg: 'bg-indigo-500',  text: 'text-indigo-600 dark:text-indigo-400', icon: 'bg-indigo-100 dark:bg-indigo-900/30' },
  medical_sector: { bg: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400',   icon: 'bg-rose-100 dark:bg-rose-900/30' },
  other:      { bg: 'bg-gray-500',    text: 'text-gray-600 dark:text-gray-400',      icon: 'bg-gray-100 dark:bg-gray-900/30' },
};

const departmentLabels: Record<string, string> = {
  inpatient: 'رقود',
  emergency: 'طوارئ',
  icu: 'عناية',
  nursery: 'حضانة',
  surgery: 'جراحة',
  outpatient: 'عيادات خارجية',
};

const requirementOptions = [
  { id: 'license', label: 'يوجد مزاولة', icon: ShieldCheck },
  { id: 'experience', label: 'خبرة سابقة', icon: Briefcase },
  { id: 'certificates', label: 'شهادات علمية', icon: FileText },
  { id: 'iv_therapy', label: 'شاطر في تركيب المحلول الوريدي', icon: Activity },
  { id: 'wound_care', label: 'شاطر في العناية بالجروح', icon: Heart },
  { id: 'cpr', label: 'شاطر في الإنعاش القلبي', icon: Zap },
  { id: 'medication', label: 'شاطر في إعطاء الأدوية', icon: Stethoscope },
  { id: 'patient_monitoring', label: 'شاطر في مراقبة المرضى', icon: Activity },
];

const requirementLabelMap: Record<string, string> = {
  license: 'يوجد مزاولة',
  experience: 'خبرة سابقة',
  certificates: 'شهادات علمية',
  iv_therapy: 'شاطر في تركيب المحلول الوريدي',
  wound_care: 'شاطر في العناية بالجروح',
  cpr: 'شاطر في الإنعاش القلبي',
  medication: 'شاطر في إعطاء الأدوية',
  patient_monitoring: 'شاطر في مراقبة المرضى',
};

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
    type: 'nursing',
    specialization: [] as string[],
    hours: 1,
    location: {} as DeploymentLocation,
    governorate: '',
    district: '',
    amount: 0,
    requirements: '',
    notes: '',
    gender: '',
    department: '',
    requirementTags: [] as string[],
  });
  const [customReq, setCustomReq] = useState('');
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
    if (!createForm.type || !createForm.hours || !createForm.amount) {
      toast.error('نوع التكليف وعدد الساعات والمبلغ مطلوبة');
      return;
    }
    if (!createForm.gender) {
      toast.error('الجنس مطلوب');
      return;
    }
    if (!createForm.department) {
      toast.error('القسم مطلوب');
      return;
    }
    setIsCreating(true);
    try {
      const res = await authFetch('/api/deployments', {
        method: 'POST',
        body: JSON.stringify({
          type: createForm.type,
          gender: createForm.gender,
          department: createForm.department,
          specialization: createForm.specialization,
          hours: createForm.hours,
          location: {
            ...createForm.location,
            governorate: createForm.governorate || undefined,
            district: createForm.district || undefined,
          },
          amount: createForm.amount,
          requirements: createForm.requirementTags.length > 0
            ? createForm.requirementTags.join(', ')
            : createForm.requirements || undefined,
          notes: createForm.notes || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم إنشاء التكليف بنجاح');
        await fetchDeployments();
        setCreateForm({
          type: 'nursing',
          specialization: [],
          hours: 1,
          location: {},
          governorate: '',
          district: '',
          amount: 0,
          requirements: '',
          notes: '',
          gender: '',
          department: '',
          requirementTags: [],
        });
        setCustomReq('');
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

  /* ── Render payment details section (reusable) ── */
  const renderPaymentDetails = (dep: DeploymentItem, myApp: DeploymentApplication | undefined) => (
    <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30 space-y-2">
      <div className="flex items-center gap-2 mb-2">
        <CreditCard className="w-4 h-4 text-blue-600" />
        <p className="text-sm font-semibold text-blue-700 dark:text-blue-300">
          تفاصيل الدفع
        </p>
      </div>
      {dep.paymentMethod && (
        <div className="flex items-center justify-between py-1.5 border-b border-blue-100 dark:border-blue-800/30">
          <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <Wallet className="w-3 h-3" />
            طريقة الدفع
          </span>
          <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
            {dep.paymentMethod}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between py-1.5 border-b border-blue-100 dark:border-blue-800/30">
        <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
          <DollarSign className="w-3 h-3" />
          المبلغ
        </span>
        <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
          {toArabicNum(myApp?.serviceFee ?? dep.applicantServiceFee ?? dep.serviceFee)} ر.ي
        </span>
      </div>
      {dep.walletNumber && (
        <div className="flex items-center justify-between py-1.5 border-b border-blue-100 dark:border-blue-800/30">
          <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <Phone className="w-3 h-3" />
            رقم المحفظة
          </span>
          <span className="text-sm font-bold font-mono text-blue-800 dark:text-blue-200" dir="ltr">
            {dep.walletNumber}
          </span>
        </div>
      )}
      {dep.walletOwnerName && (
        <div className="flex items-center justify-between py-1.5">
          <span className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5">
            <User className="w-3 h-3" />
            اسم صاحب المحفظة
          </span>
          <span className="text-sm font-bold text-blue-800 dark:text-blue-200">
            {dep.walletOwnerName}
          </span>
        </div>
      )}
      {dep.walletNumber && (
        <div className="flex gap-2 pt-1">
          <a
            href={`https://wa.me/${dep.walletNumber.replace(/^0+/, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-[10px] font-medium transition-colors"
          >
            <MessageSquare className="w-3 h-3" /> تحويل واتساب
          </a>
          <button
            onClick={() => { navigator.clipboard.writeText(dep.walletNumber); toast.success('تم نسخ رقم المحفظة'); }}
            className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-medium transition-colors"
          >
            نسخ الرقم
          </button>
        </div>
      )}
    </div>
  );

  /* ── Render deployment card ── */
  const renderDeploymentCard = (dep: DeploymentItem, showActions: 'apply' | 'view' | 'payment' = 'view') => {
    const tc = typeColors[dep.type] || typeColors.other;
    const myApp = getMyApplication(dep);
    const needsPayment = myApp && (myApp.status === 'admin_approved' || myApp.status === 'payment_pending');
    const isPaymentTarget = paymentTarget?.id === dep.id;

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
                <p className="font-bold text-sm line-clamp-1">{dep.title || typeLabels[dep.type] || dep.type}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 h-4 ${tc.bg} text-white`}>{typeLabels[dep.type] || dep.type}</Badge>
                  {dep.gender && (
                    <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 h-4 ${dep.gender === 'male' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'}`}>
                      {dep.gender === 'male' ? 'ذكر' : 'أنثى'}
                    </Badge>
                  )}
                  {dep.department && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                      {departmentLabels[dep.department] || dep.department}
                    </Badge>
                  )}
                </div>
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
            {(dep.location?.governorate || dep.location?.district) && (
              <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="truncate">{[dep.location.governorate, dep.location.district].filter(Boolean).join(' - ')}</span>
              </div>
            )}
            {dep.location?.address && !dep.location?.governorate && (
              <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                <span className="truncate">{dep.location.address}</span>
              </div>
            )}
            {dep.requirements && (
              <div className="flex items-center gap-1.5 text-muted-foreground col-span-2">
                <FileText className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">{dep.requirements}</span>
              </div>
            )}
            {dep.applicantServiceFee > 0 && !needsPayment && (
              <div className="flex items-center gap-1.5 text-orange-600 dark:text-orange-400 col-span-2">
                <Wallet className="w-3.5 h-3.5" />
                <span>رسوم المتقدم: {toArabicNum(dep.applicantServiceFee)} ر.ي</span>
              </div>
            )}
          </div>

          {/* My application status */}
          {(showActions === 'view' || showActions === 'payment') && myApp && (
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
              {myApp.status === 'payment_submitted' && (
                <p className="text-[11px] text-blue-600 dark:text-blue-400 mt-1 font-medium">
                  تم تقديم إثبات الدفع. جارٍ المراجعة...
                </p>
              )}
              {myApp.status === 'payment_verified' && (
                <p className="text-[11px] text-green-600 dark:text-green-400 mt-1 font-medium">
                  تم التحقق من الدفع. بانتظار القبول...
                </p>
              )}
              {myApp.status === 'accepted' && (
                <p className="text-[11px] text-green-600 dark:text-green-400 mt-1 font-medium">
                  تم قبولك! يمكنك التواصل مع صاحب التكليف
                </p>
              )}
              {myApp.status === 'rejected' && (
                <p className="text-[11px] text-red-600 dark:text-red-400 mt-1 font-medium">
                  {myApp.rejectedReason || 'تم رفض التقديم'}
                </p>
              )}
            </div>
          )}

          {/* ═══ Inline Payment Section for admin_approved / payment_pending ═══ */}
          {needsPayment && (
            <div className="space-y-3">
              {/* Approval/Payment message */}
              {myApp.status === 'admin_approved' && (
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-900/30">
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      تمت موافقة الإدارة! يرجى دفع رسوم التقديم
                    </p>
                  </div>
                  <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-1">
                    المبلغ المطلوب: {toArabicNum(myApp.serviceFee ?? dep.applicantServiceFee ?? dep.serviceFee)} ر.ي
                  </p>
                </div>
              )}
              {myApp.status === 'payment_pending' && (
                <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-200 dark:border-orange-900/30">
                  <div className="flex items-center gap-2">
                    <Wallet className="w-4 h-4 text-orange-600" />
                    <p className="text-sm font-medium text-orange-700 dark:text-orange-300">
                      يرجى دفع رسوم التقديم
                    </p>
                  </div>
                  <p className="text-xs text-orange-600 dark:text-orange-400 mt-1">
                    المبلغ المطلوب: {toArabicNum(myApp.serviceFee ?? dep.applicantServiceFee ?? dep.serviceFee)} ر.ي
                  </p>
                </div>
              )}

              {/* Payment details */}
              {renderPaymentDetails(dep, myApp)}

              {/* Payment proof upload inline */}
              <div className="space-y-2">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <Upload className="w-3.5 h-3.5 text-orange-600" />
                  إثبات الدفع
                </p>
                {isPaymentTarget && paymentProofImage ? (
                  <div className="relative rounded-xl overflow-hidden border border-border">
                    <img
                      src={paymentProofImage}
                      alt="إثبات الدفع"
                      className="w-full h-40 object-cover"
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
                    className="border-2 border-dashed border-muted-foreground/30 rounded-xl p-4 flex flex-col items-center gap-1.5 cursor-pointer hover:border-orange-400 transition-colors"
                    onClick={() => {
                      setPaymentTarget(dep);
                      setPaymentProof('');
                      setPaymentProofImage('');
                      setTimeout(() => fileInputRef.current?.click(), 100);
                    }}
                  >
                    <Upload className="w-6 h-6 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground">اضغط لرفع صورة إثبات الدفع</p>
                    <p className="text-[10px] text-muted-foreground">PNG, JPG حتى 5MB</p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    if (!paymentTarget) setPaymentTarget(dep);
                    handleImageUpload(e);
                  }}
                />
                {/* Text alternative */}
                {isPaymentTarget && (
                  <div className="space-y-1">
                    <p className="text-[10px] text-muted-foreground">أو أدخل رقم العملية (اختياري)</p>
                    <Input
                      placeholder="رقم العملية أو معلومات التحويل..."
                      value={paymentProof}
                      onChange={(e) => setPaymentProof(e.target.value)}
                      className="h-8 text-xs"
                    />
                  </div>
                )}
              </div>

              {/* Submit button inline */}
              {isPaymentTarget && (paymentProof || paymentProofImage) && (
                <Button
                  className="w-full gap-2 bg-orange-600 hover:bg-orange-700 text-white"
                  onClick={handleSubmitPayment}
                  disabled={isSubmittingPayment}
                >
                  {isSubmittingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                  إرسال إثبات الدفع
                </Button>
              )}
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
                <p className="font-bold text-sm line-clamp-1">{dep.title || typeLabels[dep.type] || dep.type}</p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 h-4 ${tc.bg} text-white`}>{typeLabels[dep.type] || dep.type}</Badge>
                  {dep.gender && (
                    <Badge variant="secondary" className={`text-[9px] px-1.5 py-0 h-4 ${dep.gender === 'male' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' : 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'}`}>
                      {dep.gender === 'male' ? 'ذكر' : 'أنثى'}
                    </Badge>
                  )}
                  {dep.department && (
                    <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                      {departmentLabels[dep.department] || dep.department}
                    </Badge>
                  )}
                </div>
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
              <motion.div variants={container} initial="hidden" animate="show" className="grid grid-cols-1 gap-4">
                {myApplications.map((dep) => renderDeploymentCard(dep, 'view'))}
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
            <div className="space-y-1">
              {/* Gradient Header */}
              <div className="relative bg-gradient-to-l from-nurse via-nurse/90 to-teal-600 p-6 pb-5 rounded-2xl overflow-hidden">
                <div className="absolute inset-0 opacity-10">
                  <div className="absolute top-2 left-8 w-20 h-20 rounded-full bg-white/20 blur-xl" />
                  <div className="absolute bottom-1 right-12 w-16 h-16 rounded-full bg-white/15 blur-lg" />
                </div>
                <div className="relative flex items-center gap-4">
                  <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                    <Briefcase className="w-7 h-7 text-white" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-black text-white mb-0.5">إنشاء تكليف جديد</h3>
                    <p className="text-white/80 text-sm">أنشئ تكليفاً جديداً للبحث عن ممرض/ـة مناسب/ـة</p>
                  </div>
                  <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-white/20">
                    <Hash className="w-4 h-4 text-white/80" />
                    <span className="text-xs font-bold text-white/90">تكليف جديد</span>
                  </div>
                </div>
              </div>

              {/* ── Step 1: نوع التكليف ── */}
              <div className="rounded-2xl border-2 border-nurse/20 bg-gradient-to-b from-nurse/5 to-transparent p-5 space-y-4 hover:border-nurse/30 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-nurse text-white flex items-center justify-center text-sm font-black shadow-md shadow-nurse/30">١</div>
                  <div>
                    <h4 className="font-bold text-nurse text-base">نوع التكليف</h4>
                    <p className="text-[11px] text-muted-foreground">اختر نوع وقسم التكليف</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-nurse" />
                      نوع التكليف <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={createForm.type}
                      onValueChange={(val) => setCreateForm((p) => ({ ...p, type: val as any }))}
                    >
                      <SelectTrigger className="w-full h-12 text-sm font-medium border-nurse/20 focus:border-nurse">
                        <SelectValue placeholder="اختر نوع التكليف" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(typeLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <Building2 className="w-3.5 h-3.5 text-teal-600" />
                      القسم <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={createForm.department}
                      onValueChange={(val) => setCreateForm((p) => ({ ...p, department: val }))}
                    >
                      <SelectTrigger className="w-full h-12 text-sm font-medium border-teal-200 dark:border-teal-900/50 focus:border-teal-500">
                        <SelectValue placeholder="اختر القسم" />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.entries(departmentLabels).map(([key, label]) => (
                          <SelectItem key={key} value={key}>{label}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5 text-pink-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
                      الجنس <span className="text-red-500">*</span>
                    </Label>
                    <Select
                      value={createForm.gender}
                      onValueChange={(val) => setCreateForm((p) => ({ ...p, gender: val }))}
                    >
                      <SelectTrigger className="w-full h-12 text-sm font-medium border-pink-200 dark:border-pink-900/50 focus:border-pink-500">
                        <SelectValue placeholder="اختر الجنس" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="male">ذكر</SelectItem>
                        <SelectItem value="female">أنثى</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>

              {/* ── Step 2: الوقت والأجر ── */}
              <div className="rounded-2xl border-2 border-emerald-200 dark:border-emerald-900/40 bg-gradient-to-b from-emerald-50/50 dark:from-emerald-950/10 to-transparent p-5 space-y-4 hover:border-emerald-300 dark:hover:border-emerald-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center text-sm font-black shadow-md shadow-emerald-600/30">٢</div>
                  <div>
                    <h4 className="font-bold text-emerald-700 dark:text-emerald-400 text-base">الوقت والأجر</h4>
                    <p className="text-[11px] text-muted-foreground">حدد عدد الساعات والمبلغ</p>
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="nurse-dep-hours" className="text-sm font-semibold flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-emerald-600" />
                      عدد الساعات <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="nurse-dep-hours"
                        type="number"
                        min={1}
                        value={createForm.hours || ''}
                        placeholder="0"
                        className={`h-12 text-lg font-bold text-center border-emerald-200 dark:border-emerald-900/50 focus:border-emerald-500 ${createForm.hours === 0 ? 'text-muted-foreground/30 placeholder:text-muted-foreground/30' : 'text-emerald-700 dark:text-emerald-400'}`}
                        onChange={(e) => setCreateForm((p) => ({ ...p, hours: parseInt(e.target.value) || 0 }))}
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-600/70 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800/50">ساعة</span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="nurse-dep-amount" className="text-sm font-semibold flex items-center gap-1.5">
                      <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                      المبلغ <span className="text-red-500">*</span>
                    </Label>
                    <div className="relative">
                      <Input
                        id="nurse-dep-amount"
                        type="number"
                        min={0}
                        value={createForm.amount || ''}
                        placeholder="0"
                        className={`h-12 text-lg font-bold text-center pl-20 border-emerald-200 dark:border-emerald-900/50 focus:border-emerald-500 ${createForm.amount === 0 ? 'text-muted-foreground/30 placeholder:text-muted-foreground/30' : 'text-emerald-700 dark:text-emerald-400'}`}
                        onChange={(e) => setCreateForm((p) => ({ ...p, amount: parseInt(e.target.value) || 0 }))}
                      />
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600/70 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-md border border-emerald-200 dark:border-emerald-800/50">ر.ي</span>
                    </div>
                  </div>
                </div>

                {/* Commission preview */}
                {createForm.amount > 0 && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                    <div className="p-4 rounded-xl bg-gradient-to-l from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10 border border-emerald-200 dark:border-emerald-900/40 space-y-2.5">
                      <div className="flex items-center gap-2 mb-1">
                        <Wallet className="w-4 h-4 text-emerald-600" />
                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">معاينة العمولة</span>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">المبلغ الأساسي</span>
                          <span className="font-bold">{toArabicNum(createForm.amount.toLocaleString())} ر.ي</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-muted-foreground">عمولة المنصة ({toArabicNum(adminCommissionPercent)}%)</span>
                          <span className="font-bold text-orange-600">
                            {toArabicNum(Math.round((createForm.amount * adminCommissionPercent) / 100).toLocaleString())} ر.ي
                          </span>
                        </div>
                        <Separator className="bg-emerald-200 dark:bg-emerald-800/40" />
                        <div className="flex items-center justify-between font-black text-base">
                          <span>صافيك</span>
                          <span className="text-nurse text-lg">
                            {toArabicNum((createForm.amount - Math.round((createForm.amount * adminCommissionPercent) / 100)).toLocaleString())} ر.ي
                          </span>
                        </div>
                        {creatorServiceFee > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">رسوم صاحب التكليف</span>
                            <span className="font-medium text-blue-600">{toArabicNum(creatorServiceFee)} ر.ي</span>
                          </div>
                        )}
                        {applicantServiceFee > 0 && (
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">رسوم المتقدم</span>
                            <span className="font-medium text-orange-600">{toArabicNum(applicantServiceFee)} ر.ي</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              {/* ── Step 3: المتطلبات اللازمة ── */}
              <div className="rounded-2xl border-2 border-amber-200 dark:border-amber-900/40 bg-gradient-to-b from-amber-50/50 dark:from-amber-950/10 to-transparent p-5 space-y-4 hover:border-amber-300 dark:hover:border-amber-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center text-sm font-black shadow-md shadow-amber-500/30">٣</div>
                  <div>
                    <h4 className="font-bold text-amber-700 dark:text-amber-400 text-base">المتطلبات اللازمة</h4>
                    <p className="text-[11px] text-muted-foreground">اختياري - حدد المتطلبات المطلوبة</p>
                  </div>
                </div>

                {/* Requirement Cards Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {requirementOptions.map((req) => {
                    const isSelected = createForm.requirementTags.includes(req.id);
                    const ReqIcon = req.icon;
                    return (
                      <motion.button
                        key={req.id}
                        type="button"
                        whileTap={{ scale: 0.95 }}
                        onClick={() => {
                          setCreateForm((p) => ({
                            ...p,
                            requirementTags: isSelected
                              ? p.requirementTags.filter((t) => t !== req.id)
                              : [...p.requirementTags, req.id],
                          }));
                        }}
                        className={`relative flex flex-col items-center gap-2 p-3 rounded-xl text-center transition-all border-2 ${
                          isSelected
                            ? 'bg-nurse/10 border-nurse/40 text-nurse shadow-md shadow-nurse/10'
                            : 'bg-card border-border text-muted-foreground hover:border-amber-300 dark:hover:border-amber-800/50 hover:bg-amber-50/50 dark:hover:bg-amber-950/10'
                        }`}
                      >
                        {isSelected && (
                          <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-nurse flex items-center justify-center">
                            <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                          </div>
                        )}
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                          isSelected ? 'bg-nurse/15' : 'bg-muted/50'
                        }`}>
                          <ReqIcon className={`w-4.5 h-4.5 ${isSelected ? 'text-nurse' : ''}`} />
                        </div>
                        <span className="text-[11px] font-semibold leading-tight">{req.label}</span>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Custom requirements input */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Input
                      placeholder="أضف متطلباً مخصصاً..."
                      value={customReq}
                      onChange={(e) => setCustomReq(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && customReq.trim()) {
                          e.preventDefault();
                          setCreateForm((p) => ({ ...p, requirementTags: [...p.requirementTags, customReq.trim()] }));
                          setCustomReq('');
                        }
                      }}
                      className="border-amber-200 dark:border-amber-900/50 focus:border-amber-500"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="shrink-0 gap-1 border-amber-300 dark:border-amber-800/50 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20"
                      onClick={() => {
                        if (customReq.trim()) {
                          setCreateForm((p) => ({ ...p, requirementTags: [...p.requirementTags, customReq.trim()] }));
                          setCustomReq('');
                        }
                      }}
                    >
                      <Plus className="w-3.5 h-3.5" /> إضافة
                    </Button>
                  </div>
                  {createForm.requirementTags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {createForm.requirementTags.map((tag, idx) => (
                        <Badge key={idx} variant="secondary" className="gap-1 px-2.5 py-1 text-xs bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-300">
                          {tag}
                          <button
                            type="button"
                            onClick={() => setCreateForm((p) => ({ ...p, requirementTags: p.requirementTags.filter((_, i) => i !== idx) }))}
                            className="hover:text-red-500 transition-colors"
                          >
                            <XCircle className="w-3 h-3" />
                          </button>
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── Step 4: الموقع وملاحظات ── */}
              <div className="rounded-2xl border-2 border-sky-200 dark:border-sky-900/40 bg-gradient-to-b from-sky-50/50 dark:from-sky-950/10 to-transparent p-5 space-y-4 hover:border-sky-300 dark:hover:border-sky-800/50 transition-colors">
                <div className="flex items-center gap-3">
                  <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center text-sm font-black shadow-md shadow-sky-500/30">٤</div>
                  <div>
                    <h4 className="font-bold text-sky-700 dark:text-sky-400 text-base">الموقع وملاحظات</h4>
                    <p className="text-[11px] text-muted-foreground">حدد موقع التكليف وأي ملاحظات إضافية</p>
                  </div>
                </div>

                {/* Governorate & District */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm font-semibold flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-sky-600" />
                      المحافظة
                    </Label>
                    <Select
                      value={createForm.governorate}
                      onValueChange={(val) => setCreateForm((p) => ({ ...p, governorate: val }))}
                    >
                      <SelectTrigger className="w-full h-12 text-sm font-medium border-sky-200 dark:border-sky-900/50 focus:border-sky-500">
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
                    <Label htmlFor="nurse-dep-district" className="text-sm font-semibold flex items-center gap-1.5">
                      <Navigation className="w-3.5 h-3.5 text-sky-600" />
                      المديرية
                    </Label>
                    <Input
                      id="nurse-dep-district"
                      placeholder="اسم المديرية"
                      value={createForm.district}
                      onChange={(e) => setCreateForm((p) => ({ ...p, district: e.target.value }))}
                      className="h-12 border-sky-200 dark:border-sky-900/50 focus:border-sky-500"
                    />
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-2">
                  <Label htmlFor="nurse-dep-notes" className="text-sm font-semibold flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-sky-600" />
                    ملاحظات
                  </Label>
                  <Textarea
                    id="nurse-dep-notes"
                    placeholder="ملاحظات إضافية..."
                    rows={3}
                    value={createForm.notes}
                    onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
                    className="border-sky-200 dark:border-sky-900/50 focus:border-sky-500"
                  />
                </div>
              </div>

              {/* Submit */}
              <Button
                className="w-full gap-2 bg-nurse hover:bg-nurse/90 text-white h-12 text-base font-bold"
                onClick={handleCreateDeployment}
                disabled={isCreating}
              >
                {isCreating ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Plus className="w-5 h-5" />
                )}
                إنشاء التكليف
              </Button>
            </div>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* ═══════════════ APPLY DIALOG ═══════════════ */}
      <Dialog open={!!applyTarget} onOpenChange={(open) => { if (!open) { setApplyTarget(null); setCoverLetter(''); } }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-nurse" />
              التقديم على التكليف
            </DialogTitle>
            <DialogDescription>
              راجع تفاصيل التكليف قبل التقديم
            </DialogDescription>
          </DialogHeader>

          {applyTarget && (() => {
            const tc = typeColors[applyTarget.type] || typeColors.other;
            const reqList = applyTarget.requirements
              ? applyTarget.requirements.split(',').map((r) => r.trim()).filter(Boolean)
              : [];
            const locationStr = [applyTarget.location?.governorate, applyTarget.location?.district].filter(Boolean).join(' - ');

            return (
              <div className="space-y-4">
                {/* ── Deployment Header with Badges ── */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`text-xs px-3 py-1 ${tc.bg} text-white font-semibold`}>
                    {typeLabels[applyTarget.type] || applyTarget.type}
                  </Badge>
                  {applyTarget.gender && (
                    <Badge className={`text-xs px-3 py-1 font-semibold ${
                      applyTarget.gender === 'male'
                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
                    }`}>
                      {applyTarget.gender === 'male' ? 'ذكر' : 'أنثى'}
                    </Badge>
                  )}
                  {applyTarget.department && (
                    <Badge className="text-xs px-3 py-1 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 font-semibold">
                      {departmentLabels[applyTarget.department] || applyTarget.department}
                    </Badge>
                  )}
                </div>

                {/* ── Details Grid ── */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-3 rounded-xl bg-muted/40 space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Tag className="w-3.5 h-3.5" />
                      <span className="text-[11px]">النوع</span>
                    </div>
                    <p className="text-sm font-bold">{typeLabels[applyTarget.type] || applyTarget.type}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/40 space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>
                      <span className="text-[11px]">الجنس</span>
                    </div>
                    <p className="text-sm font-bold">{applyTarget.gender === 'male' ? 'ذكر' : applyTarget.gender === 'female' ? 'أنثى' : '-'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/40 space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Building2 className="w-3.5 h-3.5" />
                      <span className="text-[11px]">القسم</span>
                    </div>
                    <p className="text-sm font-bold">{applyTarget.department ? (departmentLabels[applyTarget.department] || applyTarget.department) : '-'}</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/40 space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <Clock className="w-3.5 h-3.5" />
                      <span className="text-[11px]">عدد الساعات</span>
                    </div>
                    <p className="text-sm font-bold">{toArabicNum(applyTarget.hours)} ساعة</p>
                  </div>
                  <div className="p-3 rounded-xl bg-muted/40 space-y-1">
                    <div className="flex items-center gap-1.5 text-muted-foreground">
                      <DollarSign className="w-3.5 h-3.5" />
                      <span className="text-[11px]">المبلغ</span>
                    </div>
                    <p className="text-sm font-bold">{toArabicNum(applyTarget.amount.toLocaleString())} ر.ي</p>
                  </div>
                  {locationStr && (
                    <div className="p-3 rounded-xl bg-muted/40 space-y-1">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="w-3.5 h-3.5 text-red-500" />
                        <span className="text-[11px]">الموقع</span>
                      </div>
                      <p className="text-sm font-bold truncate">{locationStr}</p>
                    </div>
                  )}
                </div>

                {/* ── المتطلبات Section ── */}
                {reqList.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-bold text-amber-700 dark:text-amber-400">المتطلبات</span>
                    </div>
                    <div className="space-y-1.5">
                      {reqList.map((req, idx) => {
                        const arabicLabel = requirementLabelMap[req] || req;
                        const isKnown = !!requirementLabelMap[req];
                        return (
                          <div key={idx} className={`flex items-center gap-2.5 p-2.5 rounded-lg ${
                            isKnown
                              ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-900/30'
                              : 'bg-muted/40 border border-border'
                          }`}>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                              isKnown
                                ? 'bg-amber-500 text-white'
                                : 'bg-nurse text-white'
                            }`}>
                              <CheckCircle2 className="w-3 h-3" />
                            </div>
                            <span className={`text-sm font-medium ${
                              isKnown
                                ? 'text-amber-800 dark:text-amber-300'
                                : 'text-foreground'
                            }`}>
                              {arabicLabel}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* ── ملاحظات ── */}
                {applyTarget.notes && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-sky-600" />
                      <span className="text-sm font-bold text-sky-700 dark:text-sky-400">ملاحظات</span>
                    </div>
                    <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-900/10 border border-sky-200 dark:border-sky-900/30">
                      <p className="text-sm text-sky-800 dark:text-sky-300 whitespace-pre-wrap">{applyTarget.notes}</p>
                    </div>
                  </div>
                )}

                {/* ── رسوم التقديم info box ── */}
                <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-900/30">
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    التقديم مجاني. سيتم طلب رسوم التقديم فقط عند اختيارك وموافقة الإدارة.
                  </p>
                </div>

                {/* ── رسالة التقديم ── */}
                <div className="space-y-2">
                  <Label htmlFor="cover-letter" className="text-sm font-semibold flex items-center gap-1.5">
                    <MessageSquare className="w-3.5 h-3.5 text-nurse" />
                    رسالة التقديم (اختياري)
                  </Label>
                  <Textarea
                    id="cover-letter"
                    placeholder="اكتب رسالة تشرح فيها لماذا أنت مناسب لهذا التكليف..."
                    rows={3}
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    className="border-nurse/20 focus:border-nurse"
                  />
                </div>
              </div>
            );
          })()}

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
