'use client';

import { YEMEN_GOVERNORATES } from '@/lib/constants';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, FileText, CheckCircle2, Plus, MapPin, Clock, DollarSign,
  Loader2, Upload, X, Eye, RefreshCw, Navigation,
  Building2, Hash, Wallet, Star,
  User, ShieldCheck, Award, BriefcaseMedical, Phone, CheckCircle,
  CreditCard, MessageSquare, Activity, Heart, Zap, Stethoscope, XCircle,
  Tag, CircleCheck, PlayCircle, Sparkles
} from 'lucide-react';
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
import {
  ProfileHeader, BioSection, SkillsSection, ExperienceSection,
  CertificatesSection, LanguagesSection, StatisticsSection,
} from '@/components/nurse-cv';
import type { NurseProfileData } from '@/components/nurse-cv';
import { ContactGuard } from '@/components/nurse-cv';

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

const typeColors: Record<string, { bg: string; text: string; icon: string; gradient: string }> = {
  nursing:    { bg: 'bg-teal-500',    text: 'text-teal-600 dark:text-teal-400',    icon: 'bg-teal-100 dark:bg-teal-900/30',    gradient: 'from-teal-500 to-teal-600' },
  lab:        { bg: 'bg-purple-500',  text: 'text-purple-600 dark:text-purple-400', icon: 'bg-purple-100 dark:bg-purple-900/30', gradient: 'from-purple-500 to-purple-600' },
  midwife:    { bg: 'bg-pink-500',    text: 'text-pink-600 dark:text-pink-400',     icon: 'bg-pink-100 dark:bg-pink-900/30',    gradient: 'from-pink-500 to-pink-600' },
  home_care:  { bg: 'bg-amber-500',   text: 'text-amber-600 dark:text-amber-400',   icon: 'bg-amber-100 dark:bg-amber-900/30',  gradient: 'from-amber-500 to-amber-600' },
  lab_nurse:  { bg: 'bg-cyan-500',    text: 'text-cyan-600 dark:text-cyan-400',     icon: 'bg-cyan-100 dark:bg-cyan-900/30',    gradient: 'from-cyan-500 to-cyan-600' },
  medical_sector: { bg: 'bg-rose-500', text: 'text-rose-600 dark:text-rose-400',   icon: 'bg-rose-100 dark:bg-rose-900/30',    gradient: 'from-rose-500 to-rose-600' },
  other:      { bg: 'bg-gray-500',    text: 'text-gray-600 dark:text-gray-400',     icon: 'bg-gray-100 dark:bg-gray-900/30',    gradient: 'from-gray-500 to-gray-600' },
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

const governorateOptions = YEMEN_GOVERNORATES;

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
const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.07 } } } as const;
const itemAnim = { hidden: { opacity: 0, y: 24, scale: 0.97 }, show: { opacity: 1, y: 0, scale: 1, transition: { ease: 'easeOut' as const, duration: 0.4 } } } as const;
const cardHover = { y: -2, scale: 1.005, transition: { ease: 'easeOut' as const, duration: 0.2 } } as const;
const fadeIn = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0, transition: { ease: 'easeOut' as const } } } as const;
const scaleIn = { hidden: { opacity: 0, scale: 0.95 }, show: { opacity: 1, scale: 1, transition: { ease: 'easeOut' as const } } } as const;

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

  // Mandatory (non-dismissible) payment dialog state
  const [mandatoryPaymentDep, setMandatoryPaymentDep] = useState<DeploymentItem | null>(null);
  const [mandatoryPaymentProof, setMandatoryPaymentProof] = useState('');
  const [mandatoryPaymentProofImage, setMandatoryPaymentProofImage] = useState('');
  const [isSubmittingMandatoryPayment, setIsSubmittingMandatoryPayment] = useState(false);
  const mandatoryFileInputRef = useRef<HTMLInputElement>(null);

  // Manage applicants modal state
  const [manageTarget, setManageTarget] = useState<DeploymentItem | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  // CV modal state
  const [cvApplicantId, setCvApplicantId] = useState<string | null>(null);
  const [cvData, setCvData] = useState<NurseProfileData | null>(null);
  const [isLoadingCV, setIsLoadingCV] = useState(false);

  // Task execution loading state
  const [execLoading, setExecLoading] = useState<string | null>(null);

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
  const idMatches = (a: string | undefined | null, b: string): boolean => {
    if (!a || !b) return false;
    return a.toString() === b.toString();
  };

  const availableDeployments = deployments.filter(
    (d) => d.status === 'open' && !idMatches(d.createdBy?.id, currentUserId) && !d.applications.some((a) => idMatches(a.applicantId, currentUserId))
  );

  const myApplications = deployments.filter(
    (d) => d.applications.some((a) => idMatches(a.applicantId, currentUserId))
  );

  const activeDeployments = deployments.filter(
    (d) => idMatches(d.assignedTo?.id, currentUserId) && ['assigned', 'in_progress'].includes(d.status)
  );

  const myCreatedDeployments = deployments.filter(
    (d) => {
      const creatorId = d.createdBy?.id || (typeof d.createdBy === 'string' ? d.createdBy : null);
      return idMatches(creatorId, currentUserId) && d.creatorRole === 'nurse';
    }
  );

  const completedDeployments = deployments.filter(
    (d) => ['completed', 'cancelled'].includes(d.status)
      && (idMatches(d.createdBy?.id, currentUserId)
          || d.applications.some((a) => idMatches(a.applicantId, currentUserId))
          || idMatches(d.assignedTo?.id, currentUserId))
  );

  /* ── Auto-show mandatory payment dialog when nurse has payment_pending status ── */
  useEffect(() => {
    if (!currentUserId || deployments.length === 0) return;
    const dep = deployments.find((d) => {
      const myApp = d.applications.find((a) => idMatches(a.applicantId, currentUserId));
      return myApp && myApp.status === 'payment_pending';
    });
    if (dep) {
      setMandatoryPaymentDep(dep);
    } else {
      setMandatoryPaymentDep(null);
      setMandatoryPaymentProof('');
      setMandatoryPaymentProofImage('');
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deployments, currentUserId]);

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
        toast.success(`تم اختيار المتقدم وتعيينه على التكليف. يرجى تقديم إشعار الدفع`);
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

  /* ── Start deployment execution ── */
  const handleStartDeployment = async (deploymentId: string) => {
    setExecLoading(deploymentId);
    try {
      const res = await authFetch(`/api/deployments/${deploymentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'in_progress' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم بدء تنفيذ التكليف');
        void fetchDeployments();
      } else {
        toast.error(json.message ?? 'فشل بدء التنفيذ');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setExecLoading(null);
    }
  };

  /* ── Complete deployment ── */
  const handleCompleteDeployment = async (deploymentId: string) => {
    setExecLoading(deploymentId);
    try {
      const res = await authFetch(`/api/deployments/${deploymentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم إكمال التكليف بنجاح!');
        void fetchDeployments();
      } else {
        toast.error(json.message ?? 'فشل إكمال التكليف');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setExecLoading(null);
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

  /* ── Handle mandatory payment image upload ── */
  const handleMandatoryImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast.error('يرجى اختيار ملف صورة فقط'); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error('حجم الصورة يجب أن يكون أقل من 5 ميجابايت'); return; }
    const reader = new FileReader();
    reader.onloadend = () => { setMandatoryPaymentProofImage(reader.result as string); };
    reader.readAsDataURL(file);
  };

  /* ── Submit mandatory payment proof ── */
  const handleSubmitMandatoryPayment = async () => {
    if (!mandatoryPaymentDep || (!mandatoryPaymentProof && !mandatoryPaymentProofImage)) return;
    setIsSubmittingMandatoryPayment(true);
    try {
      const res = await authFetch(`/api/deployments/${mandatoryPaymentDep.id}/submit-payment`, {
        method: 'POST',
        body: JSON.stringify({
          paymentProofData: mandatoryPaymentProof || undefined,
          paymentProofImage: mandatoryPaymentProofImage || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تقديم إثبات الدفع بنجاح. سيتم مراجعته قريباً');
        void fetchDeployments();
        setMandatoryPaymentProof('');
        setMandatoryPaymentProofImage('');
      } else {
        toast.error(json.message ?? 'فشل تقديم إثبات الدفع');
      }
    } catch {
      toast.error('حدث خطأ أثناء تقديم إثبات الدفع');
    } finally {
      setIsSubmittingMandatoryPayment(false);
    }
  };

  /* ── Get current user's application for a deployment ── */
  const getMyApplication = (deployment: DeploymentItem): DeploymentApplication | undefined => {
    return deployment.applications.find((a) => idMatches(a.applicantId, currentUserId));
  };

  /* ── Fetch CV data for an applicant ── */
  const handleViewCV = async (applicantId: string) => {
    setCvApplicantId(applicantId);
    setCvData(null);
    setIsLoadingCV(true);
    try {
      const res = await authFetch(`/api/nurse/${applicantId}/profile`);
      const json = await res.json();
      if (json.success && json.data) {
        setCvData(json.data as NurseProfileData);
      } else {
        toast.error('لم يتم العثور على السيرة الذاتية');
        setCvApplicantId(null);
      }
    } catch {
      toast.error('حدث خطأ أثناء جلب السيرة الذاتية');
      setCvApplicantId(null);
    } finally {
      setIsLoadingCV(false);
    }
  };

  /* ── Render payment details section (reusable) ── */
  const renderPaymentDetails = (dep: DeploymentItem, myApp: DeploymentApplication | undefined) => (
    <div className="p-4 rounded-2xl bg-gradient-to-br from-sky-50/80 to-sky-100/40 dark:from-sky-950/30 dark:to-sky-900/10 border border-sky-200/60 dark:border-sky-800/30 space-y-2.5">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center shadow-sm">
          <CreditCard className="w-4 h-4 text-white" />
        </div>
        <p className="text-sm font-bold text-sky-700 dark:text-sky-300">
          تفاصيل الدفع
        </p>
      </div>
      {dep.paymentMethod && (
        <div className="flex items-center justify-between py-2 border-b border-sky-100 dark:border-sky-800/30">
          <span className="text-xs text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
            <Wallet className="w-3 h-3" />
            طريقة الدفع
          </span>
          <span className="text-sm font-bold text-sky-800 dark:text-sky-200">
            {dep.paymentMethod}
          </span>
        </div>
      )}
      <div className="flex items-center justify-between py-2 border-b border-sky-100 dark:border-sky-800/30">
        <span className="text-xs text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
          <DollarSign className="w-3 h-3" />
          المبلغ
        </span>
        <span className="text-sm font-black text-sky-800 dark:text-sky-200">
          {toArabicNum(myApp?.serviceFee ?? dep.applicantServiceFee ?? dep.serviceFee)} ر.ي
        </span>
      </div>
      {dep.walletNumber && (
        <div className="flex items-center justify-between py-2 border-b border-sky-100 dark:border-sky-800/30">
          <span className="text-xs text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
            <Phone className="w-3 h-3" />
            رقم المحفظة
          </span>
          <span className="text-sm font-bold font-mono text-sky-800 dark:text-sky-200" dir="ltr">
            {dep.walletNumber}
          </span>
        </div>
      )}
      {dep.walletOwnerName && (
        <div className="flex items-center justify-between py-2">
          <span className="text-xs text-sky-600 dark:text-sky-400 flex items-center gap-1.5">
            <User className="w-3 h-3" />
            اسم صاحب المحفظة
          </span>
          <span className="text-sm font-bold text-sky-800 dark:text-sky-200">
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
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-[11px] font-bold transition-all shadow-sm"
          >
            <MessageSquare className="w-3.5 h-3.5" /> تحويل واتساب
          </a>
          <button
            onClick={() => { navigator.clipboard.writeText(dep.walletNumber); toast.success('تم نسخ رقم المحفظة'); }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gradient-to-r from-sky-600 to-sky-700 hover:from-sky-700 hover:to-sky-800 text-white text-[11px] font-bold transition-all shadow-sm"
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
    const needsPayment = myApp && myApp.status === 'payment_pending';
    const isPaymentTarget = paymentTarget?.id === dep.id;
    const contactVisible = myApp?.status === 'accepted' && dep.contactRevealed && !!(dep.createdBy?.phone || dep.creatorPhone);

    return (
      <motion.div key={dep.id} variants={itemAnim} whileHover={cardHover} className="relative group">
        <GlassCard variant="nurse" noPadding hoverable className="overflow-hidden">
          {/* Top gradient accent bar */}
          <div className={`h-1.5 bg-gradient-to-l ${tc.gradient}`} />

          <div className="p-4 space-y-3.5">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className={`w-11 h-11 rounded-2xl ${tc.icon} flex items-center justify-center shrink-0 shadow-sm group-hover:scale-105 transition-transform`}>
                <Briefcase className={`w-5 h-5 ${tc.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm line-clamp-1 leading-tight tracking-tight">{dep.title || typeLabels[dep.type] || dep.type}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-2">
                  <span className={`inline-flex items-center text-[10px] px-2.5 py-0.5 rounded-full font-bold ${tc.bg} text-white shadow-sm`}>{typeLabels[dep.type] || dep.type}</span>
                  {dep.gender && (
                    <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-semibold ${dep.gender === 'male' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' : 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400'}`}>
                      {dep.gender === 'male' ? '♂ ذكر' : '♀ أنثى'}
                    </span>
                  )}
                  {dep.department && (
                    <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-semibold bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                      {departmentLabels[dep.department] || dep.department}
                    </span>
                  )}
                </div>
              </div>
              <BadgeStatus
                status={deploymentStatusMap[dep.status] || 'pending'}
                label={deploymentStatusLabel[dep.status] || dep.status}
                size="sm"
              />
            </div>

            {/* Key metrics strip */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/50 dark:from-emerald-900/10 dark:to-emerald-900/5 border border-emerald-200/50 dark:border-emerald-800/20">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center">
                  <DollarSign className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 leading-none font-medium">الأجر</p>
                  <p className="text-sm font-black text-emerald-700 dark:text-emerald-300 leading-tight mt-0.5">{toArabicNum(dep.amount.toLocaleString())} ر.ي</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-gradient-to-br from-sky-50 to-sky-100/50 dark:from-sky-900/10 dark:to-sky-900/5 border border-sky-200/50 dark:border-sky-800/20">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500/20 to-sky-600/10 flex items-center justify-center">
                  <Clock className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <p className="text-[10px] text-sky-600/70 dark:text-sky-400/70 leading-none font-medium">المدة</p>
                  <p className="text-sm font-black text-sky-700 dark:text-sky-300 leading-tight mt-0.5">{toArabicNum(dep.hours)} ساعة</p>
                </div>
              </div>
            </div>

            {/* Location + fee info */}
            <div className="space-y-1.5">
              {(dep.location?.governorate || dep.location?.district) && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">{[dep.location.governorate, dep.location.district].filter(Boolean).join(' - ')}</span>
                </div>
              )}
              {dep.location?.address && !dep.location?.governorate && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                  <MapPin className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  <span className="truncate">{dep.location.address}</span>
                </div>
              )}
              {dep.applicantServiceFee > 0 && !needsPayment && (
                <div className="flex items-center gap-2 text-xs text-orange-600 dark:text-orange-400">
                  <Wallet className="w-3.5 h-3.5 shrink-0" />
                  <span>رسوم التقديم: {toArabicNum(dep.applicantServiceFee)} ر.ي</span>
                </div>
              )}
            </div>

            {/* My application status chip */}
            {(showActions === 'view' || showActions === 'payment') && myApp && (
              <motion.div
                variants={scaleIn}
                initial="hidden"
                animate="show"
                className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-xs ${
                  myApp.status === 'accepted'      ? 'bg-emerald-50 dark:bg-emerald-900/10 border-emerald-200 dark:border-emerald-800/30' :
                  myApp.status === 'rejected'      ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-800/30' :
                  myApp.status === 'payment_pending' ? 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/30' :
                  myApp.status === 'payment_submitted' ? 'bg-sky-50 dark:bg-sky-900/10 border-sky-200 dark:border-sky-800/30' :
                  myApp.status === 'selected_by_creator' ? 'bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30' :
                  'bg-muted/40 border-border'
                }`}
              >
                <span className="text-muted-foreground font-medium">حالة تقديمك</span>
                <div className="flex items-center gap-1.5">
                  <BadgeStatus
                    status={applicationStatusMap[myApp.status] || 'pending'}
                    label={applicationStatusLabel[myApp.status] || myApp.status}
                    size="sm"
                  />
                  {myApp.status === 'accepted' && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />}
                </div>
              </motion.div>
            )}

            {/* Creator contact — ONLY shown when API returns phone AND payment verified */}
            {contactVisible && (
              <motion.div
                variants={scaleIn}
                initial="hidden"
                animate="show"
                className="p-3.5 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/30 dark:from-emerald-900/10 dark:to-emerald-800/5 border border-emerald-200 dark:border-emerald-800/30 space-y-2.5"
              >
                <p className="text-[11px] font-bold text-emerald-700 dark:text-emerald-400 flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5" />
                  بيانات صاحب التكليف — مكشوفة
                </p>
                {dep.createdBy?.name && (
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">الاسم</span>
                    <span className="font-semibold">{dep.createdBy.name}</span>
                  </div>
                )}
                <div className="flex items-center justify-between text-xs gap-2">
                  <span className="text-muted-foreground shrink-0">الهاتف</span>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-emerald-800 dark:text-emerald-200 text-xs" dir="ltr">
                      {dep.createdBy?.phone || dep.creatorPhone}
                    </span>
                    <a href={`tel:${dep.createdBy?.phone || dep.creatorPhone}`} className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition-colors" title="اتصال">
                      <Phone className="w-3 h-3" />
                    </a>
                    <a href={`https://wa.me/${(dep.createdBy?.phone || dep.creatorPhone || '').replace(/^0/, '967')}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg bg-[#25D366] hover:bg-[#1ebe5d] text-white transition-colors" title="واتساب">
                      <MessageSquare className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              </motion.div>
            )}

            {/* Contact blocked — shown when assigned but payment not yet verified */}
            {!contactVisible && myApp && myApp.status === 'payment_submitted' && (
              <ContactGuard
                message="بانتظار مراجعة إثبات الدفع — سيتم كشف بيانات التواصل بعد التحقق"
              />
            )}

            {/* Inline Payment Section for payment_pending */}
            {needsPayment && (
              <div className="space-y-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-red-50 to-red-100/30 dark:from-red-900/10 dark:to-red-800/5 border border-red-200 dark:border-red-900/30">
                  <p className="text-xs font-bold text-red-700 dark:text-red-300 flex items-center gap-2">
                    <div className="w-5 h-5 rounded-lg bg-red-500 flex items-center justify-center">
                      <CreditCard className="w-3 h-3 text-white" />
                    </div>
                    يجب تقديم إشعار الدفع للمتابعة
                  </p>
                </div>

                {myApp.status === 'payment_pending' && (
                  <div className="p-3.5 rounded-xl bg-gradient-to-br from-orange-50 to-orange-100/30 dark:from-orange-900/10 dark:to-orange-800/5 border border-orange-200 dark:border-orange-900/30">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
                        <Wallet className="w-4 h-4 text-white" />
                      </div>
                      <div>
                        <p className="text-sm font-bold text-orange-700 dark:text-orange-300">
                          يرجى دفع رسوم التقديم
                        </p>
                        <p className="text-xs text-orange-600 dark:text-orange-400 mt-0.5">
                          المبلغ المطلوب: {toArabicNum(myApp.serviceFee ?? dep.applicantServiceFee ?? dep.serviceFee)} ر.ي
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {renderPaymentDetails(dep, myApp)}

                {/* Payment proof upload inline */}
                <div className="space-y-2.5">
                  <p className="text-xs font-bold flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
                      <Upload className="w-3 h-3 text-orange-600" />
                    </div>
                    إثبات الدفع
                  </p>
                  {isPaymentTarget && paymentProofImage ? (
                    <div className="relative rounded-xl overflow-hidden border border-border shadow-sm">
                      <img
                        src={paymentProofImage}
                        alt="إثبات الدفع"
                        className="w-full h-40 object-cover"
                      />
                      <Button
                        variant="destructive"
                        size="icon"
                        className="absolute top-2 left-2 w-7 h-7 rounded-full shadow-md"
                        onClick={() => setPaymentProofImage('')}
                      >
                        <X className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div
                      className="border-2 border-dashed border-muted-foreground/25 dark:border-muted-foreground/15 rounded-xl p-5 flex flex-col items-center gap-2 cursor-pointer hover:border-orange-400 dark:hover:border-orange-600/50 hover:bg-orange-50/50 dark:hover:bg-orange-900/10 transition-all"
                      onClick={() => {
                        setPaymentTarget(dep);
                        setPaymentProof('');
                        setPaymentProofImage('');
                        setTimeout(() => fileInputRef.current?.click(), 100);
                      }}
                    >
                      <div className="w-10 h-10 rounded-xl bg-muted/50 flex items-center justify-center">
                        <Upload className="w-5 h-5 text-muted-foreground" />
                      </div>
                      <p className="text-xs font-medium text-muted-foreground">اضغط لرفع صورة إثبات الدفع</p>
                      <p className="text-[10px] text-muted-foreground/70">PNG, JPG حتى 5MB</p>
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
                  {isPaymentTarget && (
                    <div className="space-y-1.5">
                      <p className="text-[10px] text-muted-foreground font-medium">أو أدخل رقم العملية (اختياري)</p>
                      <Input
                        placeholder="رقم العملية أو معلومات التحويل..."
                        value={paymentProof}
                        onChange={(e) => setPaymentProof(e.target.value)}
                        className="h-9 text-xs rounded-xl"
                      />
                    </div>
                  )}
                </div>

                {isPaymentTarget && (paymentProof || paymentProofImage) && (
                  <Button
                    className="w-full gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white h-10 rounded-xl font-bold shadow-sm"
                    onClick={handleSubmitPayment}
                    disabled={isSubmittingPayment}
                  >
                    {isSubmittingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                    إرسال إثبات الدفع
                  </Button>
                )}
              </div>
            )}

            {/* Task Execution Buttons */}
            {idMatches(dep.assignedTo?.id, currentUserId) && dep.status === 'assigned' && (
              <motion.div variants={fadeIn} initial="hidden" animate="show" className="p-3.5 rounded-xl bg-gradient-to-r from-sky-50/50 to-teal-50/50 dark:from-sky-950/20 dark:to-teal-950/10 border border-sky-200/50 dark:border-sky-800/30 space-y-2.5">
                <div className="flex items-center gap-2">
                  <PlayCircle className="w-4 h-4 text-sky-600" />
                  <p className="text-xs font-bold text-sky-700 dark:text-sky-400">جاهز للتنفيذ</p>
                </div>
                <Button
                  size="sm"
                  className="w-full h-10 text-xs gap-2 font-bold bg-gradient-to-r from-sky-500 to-teal-600 hover:from-sky-600 hover:to-teal-700 text-white border-0 shadow-sm rounded-xl"
                  onClick={() => handleStartDeployment(dep.id)}
                  disabled={execLoading === dep.id}
                >
                  {execLoading === dep.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <PlayCircle className="w-4 h-4" />}
                  بدء تنفيذ التكليف
                </Button>
              </motion.div>
            )}
            {idMatches(dep.assignedTo?.id, currentUserId) && dep.status === 'in_progress' && (
              <motion.div variants={fadeIn} initial="hidden" animate="show" className="p-3.5 rounded-xl bg-gradient-to-r from-teal-50/50 to-emerald-50/50 dark:from-teal-950/20 dark:to-emerald-950/10 border border-teal-200/50 dark:border-teal-800/30 space-y-2.5">
                <div className="flex items-center gap-2">
                  <Activity className="w-4 h-4 text-teal-600 animate-pulse" />
                  <p className="text-xs font-bold text-teal-700 dark:text-teal-400">قيد التنفيذ الآن</p>
                </div>
                <Button
                  size="sm"
                  className="w-full h-10 text-xs gap-2 font-bold bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700 text-white border-0 shadow-sm rounded-xl"
                  onClick={() => handleCompleteDeployment(dep.id)}
                  disabled={execLoading === dep.id}
                >
                  {execLoading === dep.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  إكمال التكليف
                </Button>
              </motion.div>
            )}

            {/* Actions */}
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-xs gap-1.5 flex-1 rounded-xl font-medium border border-border/50 hover:border-border"
                onClick={() => router.push(`/nurse/deployments/${dep.id}`)}
              >
                <Eye className="w-3.5 h-3.5" /> التفاصيل
              </Button>
              {showActions === 'apply' && dep.status === 'open' && (
                <Button
                  size="sm"
                  className="h-9 text-xs gap-1.5 flex-1 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white rounded-xl font-bold shadow-sm"
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
        </GlassCard>
      </motion.div>
    );
  };

  /* ── Render created deployment card with applicants ── */
  const renderCreatedDeploymentCard = (dep: DeploymentItem) => {
    const tc = typeColors[dep.type] || typeColors.other;
    const pendingCount = dep.applications.filter((a) => a.status === 'pending').length;
    const selectedApp = dep.applications.find((a) => ['selected_by_creator','admin_approved','payment_pending','payment_submitted','payment_verified','accepted'].includes(a.status));

    const statusBand = dep.status === 'open'
      ? { bg: 'bg-emerald-50 dark:bg-emerald-900/10', border: 'border-emerald-200 dark:border-emerald-800/30', text: 'text-emerald-700 dark:text-emerald-300', icon: <CircleCheck className="w-3.5 h-3.5 text-emerald-600" />, label: 'مفتوح للتقديم' }
      : dep.status === 'creator_selected'
      ? { bg: 'bg-amber-50 dark:bg-amber-900/10', border: 'border-amber-200 dark:border-amber-800/30', text: 'text-amber-700 dark:text-amber-300', icon: <Clock className="w-3.5 h-3.5 text-amber-600" />, label: 'بانتظار موافقة الإدارة' }
      : dep.status === 'admin_approved'
      ? { bg: 'bg-sky-50 dark:bg-sky-900/10', border: 'border-sky-200 dark:border-sky-800/30', text: 'text-sky-700 dark:text-sky-300', icon: <Wallet className="w-3.5 h-3.5 text-sky-600" />, label: 'بانتظار دفع المكلف' }
      : dep.status === 'assigned'
      ? { bg: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-200 dark:border-purple-800/30', text: 'text-purple-700 dark:text-purple-300', icon: <CheckCircle2 className="w-3.5 h-3.5 text-purple-600" />, label: 'تم التعيين' }
      : dep.status === 'in_progress'
      ? { bg: 'bg-teal-50 dark:bg-teal-900/10', border: 'border-teal-200 dark:border-teal-800/30', text: 'text-teal-700 dark:text-teal-300', icon: <Activity className="w-3.5 h-3.5 text-teal-600" />, label: 'قيد التنفيذ' }
      : dep.status === 'completed'
      ? { bg: 'bg-slate-50 dark:bg-slate-900/10', border: 'border-slate-200 dark:border-slate-800/30', text: 'text-slate-700 dark:text-slate-300', icon: <CheckCircle className="w-3.5 h-3.5 text-slate-600" />, label: 'مكتمل' }
      : { bg: 'bg-red-50 dark:bg-red-900/10', border: 'border-red-200 dark:border-red-800/30', text: 'text-red-700 dark:text-red-300', icon: <XCircle className="w-3.5 h-3.5 text-red-600" />, label: 'ملغي' };

    return (
      <motion.div key={dep.id} variants={itemAnim} className="group">
        <GlassCard variant="nurse" noPadding hoverable className="overflow-hidden">
          <div className={`h-1.5 bg-gradient-to-l ${tc.gradient}`} />
          <div className="p-4 space-y-3.5">
            {/* Header */}
            <div className="flex items-start gap-3">
              <div className={`w-10 h-10 rounded-xl ${tc.icon} flex items-center justify-center shrink-0`}>
                <Briefcase className={`w-4.5 h-4.5 ${tc.text}`} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm line-clamp-1 leading-tight">{dep.title || typeLabels[dep.type] || dep.type}</p>
                <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                  <span className={`inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-bold ${tc.bg} text-white`}>{typeLabels[dep.type] || dep.type}</span>
                  {dep.department && (
                    <span className="inline-flex items-center text-[10px] px-2 py-0.5 rounded-full font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">
                      {departmentLabels[dep.department] || dep.department}
                    </span>
                  )}
                </div>
              </div>
              <BadgeStatus
                status={deploymentStatusMap[dep.status] || 'pending'}
                label={deploymentStatusLabel[dep.status] || dep.status}
                size="sm"
              />
            </div>

            {/* Metrics */}
            <div className="grid grid-cols-2 gap-2.5">
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-gradient-to-br from-emerald-50 to-emerald-100/30 dark:from-emerald-900/10 dark:to-emerald-900/5 border border-emerald-200/50 dark:border-emerald-800/20">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <p className="text-[10px] text-emerald-600/70 dark:text-emerald-400/70 leading-none font-medium">الأجر</p>
                  <p className="text-xs font-black text-emerald-700 dark:text-emerald-300 leading-tight mt-0.5">{toArabicNum(dep.amount.toLocaleString())} ر.ي</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5 p-3 rounded-xl bg-gradient-to-br from-sky-50 to-sky-100/30 dark:from-sky-900/10 dark:to-sky-900/5 border border-sky-200/50 dark:border-sky-800/20">
                <div className="w-8 h-8 rounded-lg bg-sky-500/10 flex items-center justify-center">
                  <User className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <p className="text-[10px] text-sky-600/70 dark:text-sky-400/70 leading-none font-medium">المتقدمون</p>
                  <p className="text-xs font-black text-sky-700 dark:text-sky-300 leading-tight mt-0.5">
                    {toArabicNum(dep.applications.length)}
                    {pendingCount > 0 && <span className="text-amber-500 font-bold"> ({toArabicNum(pendingCount)} جديد)</span>}
                  </p>
                </div>
              </div>
            </div>

            {/* Status band */}
            <div className={`flex items-center gap-2.5 px-3.5 py-3 rounded-xl border ${statusBand.bg} ${statusBand.border}`}>
              {statusBand.icon}
              <p className={`text-xs font-bold ${statusBand.text}`}>{statusBand.label}</p>
              {selectedApp && (
                <span className={`mr-auto text-[11px] font-medium ${statusBand.text} opacity-80`}>
                  {selectedApp.applicantName}
                </span>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-2 pt-0.5">
              <Button
                size="sm"
                variant="ghost"
                className="h-9 text-xs gap-1.5 flex-1 rounded-xl font-medium border border-border/50 hover:border-border"
                onClick={() => router.push(`/nurse/deployments/${dep.id}`)}
              >
                <Eye className="w-3.5 h-3.5" /> التفاصيل
              </Button>
              {dep.status === 'open' && dep.applications.length > 0 && (
                <Button
                  size="sm"
                  className="h-9 text-xs gap-1.5 flex-1 bg-gradient-to-r from-sky-500 to-sky-600 hover:from-sky-600 hover:to-sky-700 text-white rounded-xl font-bold shadow-sm"
                  onClick={() => setManageTarget(dep)}
                >
                  <User className="w-3.5 h-3.5" /> إدارة ({toArabicNum(dep.applications.length)})
                </Button>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>
    );
  };

  /* ═══════════════ RENDER ═══════════════ */
  const tabItems = [
    { value: 'available', label: 'المتاحة', count: availableDeployments.length, icon: Briefcase },
    { value: 'applications', label: 'تقديماتي', count: myApplications.length, icon: FileText },
    { value: 'active', label: 'النشطة', count: activeDeployments.length, icon: Activity },
    { value: 'mycreated', label: 'تكليفاتي', count: myCreatedDeployments.length, icon: BriefcaseMedical },
    { value: 'completed', label: 'مكتملة', count: completedDeployments.length, icon: CheckCircle2 },
    { value: 'create', label: 'إنشاء', count: -1, icon: Plus },
  ];

  return (
    <>
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-5">
      {/* Hero Header */}
      <motion.div variants={itemAnim}>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-bl from-sky-600 via-sky-500 to-teal-500 p-6 text-white shadow-xl shadow-sky-500/20">
          <div className="absolute inset-0 opacity-[0.12]">
            <div className="absolute top-0 left-10 w-32 h-32 rounded-full bg-white/30 blur-3xl" />
            <div className="absolute bottom-0 right-6 w-28 h-28 rounded-full bg-white/20 blur-2xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full bg-teal-300/20 blur-3xl" />
          </div>
          <div className="relative flex items-center justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-sky-200" />
                <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/60">منصة التكليفات</p>
              </div>
              <h1 className="text-2xl font-black leading-tight">التكليفات المهنية</h1>
              <p className="text-sm text-white/75 mt-1.5">تصفح وتقدم لأحدث التكليفات المتاحة</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center backdrop-blur-sm">
                <Briefcase className="w-5 h-5 text-white" />
              </div>
              <button
                onClick={() => { setIsLoading(true); void fetchDeployments(); }}
                className="w-11 h-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center hover:bg-white/25 transition-colors backdrop-blur-sm"
              >
                <RefreshCw className={`w-4 h-4 text-white ${isLoading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>
          {/* Stats row */}
          <div className="relative mt-5 grid grid-cols-3 gap-2.5">
            {[
              { label: 'متاحة', value: availableDeployments.length },
              { label: 'نشطة', value: activeDeployments.length },
              { label: 'تقديماتي', value: myApplications.length },
            ].map((stat) => (
              <div key={stat.label} className="text-center bg-white/10 rounded-2xl py-3 border border-white/15 backdrop-blur-sm">
                <p className="text-xl font-black text-white leading-none">{toArabicNum(stat.value)}</p>
                <p className="text-[10px] text-white/70 mt-1 font-medium">{stat.label}</p>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Tabs - Animated pill indicator */}
      <motion.div variants={itemAnim}>
        <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
          <div className="relative p-1.5 rounded-2xl bg-muted/60 border border-border/50 backdrop-blur-sm overflow-x-auto">
            <div className="flex gap-1 min-w-max">
              {tabItems.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.value;
                return (
                  <button
                    key={tab.value}
                    onClick={() => setActiveTab(tab.value)}
                    className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-colors whitespace-nowrap ${
                      isActive ? 'text-white' : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="nurseDepTabPill"
                        className="absolute inset-0 rounded-xl bg-gradient-to-l from-sky-500 to-teal-500 shadow-lg shadow-sky-500/25"
                        transition={{ type: 'spring', bounce: 0.15, duration: 0.5 }}
                      />
                    )}
                    <Icon className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">{tab.label}</span>
                    {tab.count >= 0 && tab.count > 0 && (
                      <span className={`relative z-10 text-[10px] min-w-[20px] h-[20px] flex items-center justify-center rounded-full px-1.5 font-black ${
                        isActive ? 'bg-white/25 text-white' : 'bg-sky-500/15 text-sky-600 dark:text-sky-400'
                      }`}>
                        {toArabicNum(tab.count)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

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
                icon={<Briefcase className="w-12 h-12 text-muted-foreground" />}
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
                icon={<FileText className="w-12 h-12 text-muted-foreground" />}
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
                icon={<CheckCircle2 className="w-12 h-12 text-muted-foreground" />}
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

          {/* ── Tab 4: My Created Deployments ── */}
          <TabsContent value="mycreated" className="mt-4">
            {isLoading ? (
              <div className="space-y-3">
                <CardSkeleton />
                <CardSkeleton />
              </div>
            ) : myCreatedDeployments.length === 0 ? (
              <EmptyState
                icon={<BriefcaseMedical className="w-12 h-12 text-muted-foreground" />}
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
                icon={<CheckCircle className="w-12 h-12 text-muted-foreground" />}
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
            <motion.div variants={container} initial="hidden" animate="show" className="space-y-4">
              {/* Gradient Header */}
              <motion.div variants={itemAnim}>
                <div className="relative bg-gradient-to-l from-sky-500 via-sky-500/95 to-teal-500 p-6 pb-5 rounded-2xl overflow-hidden shadow-lg shadow-sky-500/15">
                  <div className="absolute inset-0 opacity-10">
                    <div className="absolute top-2 left-8 w-24 h-24 rounded-full bg-white/20 blur-xl" />
                    <div className="absolute bottom-1 right-16 w-20 h-20 rounded-full bg-white/15 blur-lg" />
                  </div>
                  <div className="relative flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                      <Briefcase className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-xl font-black text-white mb-0.5">إنشاء تكليف جديد</h3>
                      <p className="text-white/80 text-sm">أنشئ تكليفاً جديداً للبحث عن ممرض/ـة مناسب/ـة</p>
                    </div>
                    <div className="hidden sm:flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-white/20">
                      <Hash className="w-4 h-4 text-white/80" />
                      <span className="text-xs font-bold text-white/90">تكليف جديد</span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* ── Step 1: نوع التكليف ── */}
              <motion.div variants={itemAnim}>
                <GlassCard variant="nurse" className="border-2 border-sky-200/40 dark:border-sky-800/30 space-y-5 hover:border-sky-300/50 dark:hover:border-sky-700/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-sky-600 text-white flex items-center justify-center text-sm font-black shadow-md shadow-sky-500/25">١</div>
                    <div>
                      <h4 className="font-bold text-sky-700 dark:text-sky-400 text-base">نوع التكليف</h4>
                      <p className="text-[11px] text-muted-foreground">اختر نوع وقسم التكليف</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-1.5">
                        <Tag className="w-3.5 h-3.5 text-sky-600" />
                        نوع التكليف <span className="text-red-500">*</span>
                      </Label>
                      <Select
                        value={createForm.type}
                        onValueChange={(val) => setCreateForm((p) => ({ ...p, type: val as DeploymentItem['type'] }))}
                      >
                        <SelectTrigger className="w-full h-12 text-sm font-medium rounded-xl border-sky-200/50 dark:border-sky-800/40 focus:border-sky-500 focus:ring-sky-500/20">
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
                        <SelectTrigger className="w-full h-12 text-sm font-medium rounded-xl border-teal-200/50 dark:border-teal-800/40 focus:border-teal-500 focus:ring-teal-500/20">
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
                        <SelectTrigger className="w-full h-12 text-sm font-medium rounded-xl border-pink-200/50 dark:border-pink-800/40 focus:border-pink-500 focus:ring-pink-500/20">
                          <SelectValue placeholder="اختر الجنس" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="male">ذكر</SelectItem>
                          <SelectItem value="female">أنثى</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>

              {/* ── Step 2: الوقت والأجر ── */}
              <motion.div variants={itemAnim}>
                <GlassCard variant="nurse" className="border-2 border-emerald-200/40 dark:border-emerald-800/30 space-y-5 hover:border-emerald-300/50 dark:hover:border-emerald-700/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-emerald-600 text-white flex items-center justify-center text-sm font-black shadow-md shadow-emerald-500/25">٢</div>
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
                          className={`h-12 text-lg font-bold text-center rounded-xl border-emerald-200/50 dark:border-emerald-800/40 focus:border-emerald-500 ${createForm.hours === 0 ? 'text-muted-foreground/30 placeholder:text-muted-foreground/30' : 'text-emerald-700 dark:text-emerald-400'}`}
                          onChange={(e) => setCreateForm((p) => ({ ...p, hours: parseInt(e.target.value) || 0 }))}
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600/70 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-lg border border-emerald-200/50 dark:border-emerald-800/50">ساعة</span>
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
                          className={`h-12 text-lg font-bold text-center pl-20 rounded-xl border-emerald-200/50 dark:border-emerald-800/40 focus:border-emerald-500 ${createForm.amount === 0 ? 'text-muted-foreground/30 placeholder:text-muted-foreground/30' : 'text-emerald-700 dark:text-emerald-400'}`}
                          onChange={(e) => setCreateForm((p) => ({ ...p, amount: parseInt(e.target.value) || 0 }))}
                        />
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-emerald-600/70 bg-emerald-50 dark:bg-emerald-900/30 px-2.5 py-1 rounded-lg border border-emerald-200/50 dark:border-emerald-800/50">ر.ي</span>
                      </div>
                    </div>
                  </div>

                  {/* Commission preview */}
                  {createForm.amount > 0 && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="overflow-hidden">
                      <div className="p-4 rounded-2xl bg-gradient-to-l from-emerald-50 to-emerald-100/50 dark:from-emerald-950/20 dark:to-emerald-900/10 border border-emerald-200/50 dark:border-emerald-900/40 space-y-3">
                        <div className="flex items-center gap-2.5 mb-1">
                          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-emerald-500/20 to-emerald-600/10 flex items-center justify-center">
                            <Wallet className="w-4 h-4 text-emerald-600" />
                          </div>
                          <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">معاينة العمولة</span>
                        </div>
                        <div className="space-y-2.5 text-sm">
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
                          <Separator className="bg-emerald-200/50 dark:bg-emerald-800/40" />
                          <div className="flex items-center justify-between font-black text-base">
                            <span>صافيك</span>
                            <span className="text-sky-600 dark:text-sky-400 text-lg">
                              {toArabicNum((createForm.amount - Math.round((createForm.amount * adminCommissionPercent) / 100)).toLocaleString())} ر.ي
                            </span>
                          </div>
                          {creatorServiceFee > 0 && (
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">رسوم صاحب التكليف</span>
                              <span className="font-medium text-sky-600">{toArabicNum(creatorServiceFee)} ر.ي</span>
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
                </GlassCard>
              </motion.div>

              {/* ── Step 3: المتطلبات اللازمة ── */}
              <motion.div variants={itemAnim}>
                <GlassCard variant="nurse" className="border-2 border-amber-200/40 dark:border-amber-800/30 space-y-5 hover:border-amber-300/50 dark:hover:border-amber-700/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 text-white flex items-center justify-center text-sm font-black shadow-md shadow-amber-500/25">٣</div>
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
                          className={`relative flex flex-col items-center gap-2 p-3.5 rounded-xl text-center transition-all border-2 ${
                            isSelected
                              ? 'bg-sky-50 dark:bg-sky-900/15 border-sky-400/50 dark:border-sky-600/40 text-sky-700 dark:text-sky-300 shadow-md shadow-sky-500/10'
                              : 'bg-card border-border text-muted-foreground hover:border-amber-300/60 dark:hover:border-amber-700/40 hover:bg-amber-50/50 dark:hover:bg-amber-950/10'
                          }`}
                        >
                          {isSelected && (
                            <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-gradient-to-br from-sky-500 to-sky-600 flex items-center justify-center shadow-sm">
                              <CheckCircle2 className="w-3 h-3 text-white" />
                            </div>
                          )}
                          <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                            isSelected ? 'bg-sky-500/15' : 'bg-muted/50'
                          }`}>
                            <ReqIcon className={`w-4 h-4 ${isSelected ? 'text-sky-600 dark:text-sky-400' : ''}`} />
                          </div>
                          <span className="text-[11px] font-semibold leading-tight">{req.label}</span>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Custom requirements input */}
                  <div className="space-y-2.5">
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
                        className="rounded-xl border-amber-200/50 dark:border-amber-800/40 focus:border-amber-500"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="shrink-0 gap-1.5 rounded-xl border-amber-300/50 dark:border-amber-700/40 text-amber-700 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-amber-950/20"
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
                          <Badge key={idx} variant="secondary" className="gap-1.5 px-3 py-1.5 text-xs bg-sky-100 text-sky-800 dark:bg-sky-900/30 dark:text-sky-300 rounded-lg">
                            {tag}
                            <button
                              type="button"
                              onClick={() => setCreateForm((p) => ({ ...p, requirementTags: p.requirementTags.filter((_, i) => i !== idx) }))}
                              className="hover:text-red-500 transition-colors"
                            >
                              <XCircle className="w-3.5 h-3.5" />
                            </button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                </GlassCard>
              </motion.div>

              {/* ── Step 4: الموقع وملاحظات ── */}
              <motion.div variants={itemAnim}>
                <GlassCard variant="nurse" className="border-2 border-sky-200/40 dark:border-sky-800/30 space-y-5 hover:border-sky-300/50 dark:hover:border-sky-700/40 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500 to-teal-500 text-white flex items-center justify-center text-sm font-black shadow-md shadow-sky-500/25">٤</div>
                    <div>
                      <h4 className="font-bold text-sky-700 dark:text-sky-400 text-base">الموقع وملاحظات</h4>
                      <p className="text-[11px] text-muted-foreground">حدد موقع التكليف وأي ملاحظات إضافية</p>
                    </div>
                  </div>

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
                        <SelectTrigger className="w-full h-12 text-sm font-medium rounded-xl border-sky-200/50 dark:border-sky-800/40 focus:border-sky-500 focus:ring-sky-500/20">
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
                        className="h-12 rounded-xl border-sky-200/50 dark:border-sky-800/40 focus:border-sky-500"
                      />
                    </div>
                  </div>

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
                      className="rounded-xl border-sky-200/50 dark:border-sky-800/40 focus:border-sky-500"
                    />
                  </div>
                </GlassCard>
              </motion.div>

              {/* Submit */}
              <motion.div variants={itemAnim}>
                <Button
                  className="w-full gap-2.5 bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 text-white h-12 text-base font-bold rounded-2xl shadow-lg shadow-sky-500/20"
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
              </motion.div>
            </motion.div>
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* ═══════════════ APPLY DIALOG ═══════════════ */}
      <Dialog open={!!applyTarget} onOpenChange={(open) => { if (!open) { setApplyTarget(null); setCoverLetter(''); } }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center">
                <FileText className="w-4.5 h-4.5 text-white" />
              </div>
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
                {/* Deployment Header with Badges */}
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={`text-xs px-3 py-1 ${tc.bg} text-white font-bold rounded-lg`}>
                    {typeLabels[applyTarget.type] || applyTarget.type}
                  </Badge>
                  {applyTarget.gender && (
                    <Badge className={`text-xs px-3 py-1 font-semibold rounded-lg ${
                      applyTarget.gender === 'male'
                        ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400'
                        : 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400'
                    }`}>
                      {applyTarget.gender === 'male' ? 'ذكر' : 'أنثى'}
                    </Badge>
                  )}
                  {applyTarget.department && (
                    <Badge className="text-xs px-3 py-1 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 font-semibold rounded-lg">
                      {departmentLabels[applyTarget.department] || applyTarget.department}
                    </Badge>
                  )}
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { icon: <Tag className="w-3.5 h-3.5" />, label: 'النوع', value: typeLabels[applyTarget.type] || applyTarget.type },
                    { icon: <svg xmlns="http://www.w3.org/2000/svg" className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>, label: 'الجنس', value: applyTarget.gender === 'male' ? 'ذكر' : applyTarget.gender === 'female' ? 'أنثى' : '-' },
                    { icon: <Building2 className="w-3.5 h-3.5" />, label: 'القسم', value: applyTarget.department ? (departmentLabels[applyTarget.department] || applyTarget.department) : '-' },
                    { icon: <Clock className="w-3.5 h-3.5" />, label: 'عدد الساعات', value: `${toArabicNum(applyTarget.hours)} ساعة` },
                    { icon: <DollarSign className="w-3.5 h-3.5" />, label: 'المبلغ', value: `${toArabicNum(applyTarget.amount.toLocaleString())} ر.ي` },
                    ...(locationStr ? [{ icon: <MapPin className="w-3.5 h-3.5 text-rose-500" />, label: 'الموقع', value: locationStr }] : []),
                  ].map((detail, idx) => (
                    <div key={idx} className="p-3 rounded-xl bg-muted/30 border border-border/30 space-y-1">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        {detail.icon}
                        <span className="text-[11px] font-medium">{detail.label}</span>
                      </div>
                      <p className="text-sm font-bold truncate">{detail.value}</p>
                    </div>
                  ))}
                </div>

                {/* المتطلبات Section */}
                {reqList.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <ShieldCheck className="w-4 h-4 text-amber-600" />
                      <span className="text-sm font-bold text-amber-700 dark:text-amber-400">المتطلبات</span>
                    </div>
                    <div className="space-y-2">
                      {reqList.map((req, idx) => {
                        const arabicLabel = requirementLabelMap[req] || req;
                        const isKnown = !!requirementLabelMap[req];
                        return (
                          <div key={idx} className={`flex items-center gap-2.5 p-2.5 rounded-xl ${
                            isKnown
                              ? 'bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-900/30'
                              : 'bg-muted/30 border border-border/30'
                          }`}>
                            <div className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                              isKnown
                                ? 'bg-gradient-to-br from-amber-500 to-amber-600 text-white'
                                : 'bg-sky-500 text-white'
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

                {/* ملاحظات */}
                {applyTarget.notes && (
                  <div className="space-y-2.5">
                    <div className="flex items-center gap-2.5">
                      <FileText className="w-4 h-4 text-sky-600" />
                      <span className="text-sm font-bold text-sky-700 dark:text-sky-400">ملاحظات</span>
                    </div>
                    <div className="p-3.5 rounded-xl bg-sky-50 dark:bg-sky-900/10 border border-sky-200/50 dark:border-sky-900/30">
                      <p className="text-sm text-sky-800 dark:text-sky-300 whitespace-pre-wrap leading-relaxed">{applyTarget.notes}</p>
                    </div>
                  </div>
                )}

                {/* رسوم التقديم info box */}
                <div className="p-3.5 rounded-xl bg-gradient-to-r from-sky-50 to-sky-100/30 dark:from-sky-950/20 dark:to-sky-900/10 border border-sky-200/50 dark:border-sky-900/30">
                  <p className="text-xs text-sky-700 dark:text-sky-300 font-medium leading-relaxed">
                    التقديم مجاني. سيتم طلب رسوم التقديم فقط عند اختيارك وموافقة الإدارة.
                  </p>
                </div>

                {/* رسالة التقديم */}
                <div className="space-y-2.5">
                  <Label htmlFor="cover-letter" className="text-sm font-bold flex items-center gap-2">
                    <MessageSquare className="w-3.5 h-3.5 text-sky-600" />
                    رسالة التقديم (اختياري)
                  </Label>
                  <Textarea
                    id="cover-letter"
                    placeholder="اكتب رسالة تشرح فيها لماذا أنت مناسب لهذا التكليف..."
                    rows={4}
                    value={coverLetter}
                    onChange={(e) => setCoverLetter(e.target.value)}
                    className="rounded-xl border-sky-200/50 dark:border-sky-800/40 focus:border-sky-500 min-h-[100px] resize-none"
                  />
                </div>
              </div>
            );
          })()}

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="outline"
              className="rounded-xl font-medium"
              onClick={() => { setApplyTarget(null); setCoverLetter(''); }}
            >
              إلغاء
            </Button>
            <Button
              className="gap-2 bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 text-white rounded-xl font-bold shadow-sm"
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
        <DialogContent dir="rtl" className="max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center">
                <User className="w-4.5 h-4.5 text-white" />
              </div>
              إدارة المتقدمين
            </DialogTitle>
            <DialogDescription>
              {manageTarget?.title} — {toArabicNum(manageTarget?.applications.length ?? 0)} متقدم
            </DialogDescription>
          </DialogHeader>

          {manageTarget && (
            <div className="space-y-3">
              {manageTarget.applications.length === 0 ? (
                <div className="py-10 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                    <User className="w-7 h-7 text-muted-foreground" />
                  </div>
                  <p className="text-sm font-medium text-muted-foreground">لا يوجد متقدمين بعد</p>
                </div>
              ) : (
                manageTarget.applications.map((app) => (
                  <GlassCard key={app._id || app.applicantId} variant="nurse" className="space-y-3">
                    {/* Applicant header */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-sky-500/20 to-sky-600/10 flex items-center justify-center">
                          <User className="w-4 h-4 text-sky-600 dark:text-sky-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-sm font-bold">{app.applicantName}</p>
                            {app.applicantVerificationStatus === 'verified' && (
                              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                            )}
                          </div>
                        </div>
                      </div>
                      <BadgeStatus
                        status={applicationStatusMap[app.status] || 'pending'}
                        label={applicationStatusLabel[app.status] || app.status}
                        size="sm"
                      />
                    </div>

                    {/* Applicant details */}
                    <div className="grid grid-cols-2 gap-2 text-[11px]">
                      {app.applicantSpecialization && app.applicantSpecialization.length > 0 && (
                        <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-lg">
                          <BriefcaseMedical className="w-3 h-3 shrink-0" />
                          <span className="truncate">{app.applicantSpecialization.slice(0, 2).join('، ')}</span>
                        </div>
                      )}
                      {app.applicantExperience !== undefined && app.applicantExperience > 0 && (
                        <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-lg">
                          <Award className="w-3 h-3 shrink-0" />
                          <span>{toArabicNum(app.applicantExperience)} سنوات خبرة</span>
                        </div>
                      )}
                      {app.applicantRating !== undefined && app.applicantRating > 0 && (
                        <div className="flex items-center gap-1.5 text-amber-600 bg-amber-50 dark:bg-amber-900/10 px-2.5 py-1.5 rounded-lg">
                          <Star className="w-3 h-3 fill-amber-500 shrink-0" />
                          <span className="font-medium">{toArabicNum(app.applicantRating)}</span>
                        </div>
                      )}
                      {app.applicantCompletedJobs !== undefined && app.applicantCompletedJobs > 0 && (
                        <div className="flex items-center gap-1.5 text-muted-foreground bg-muted/30 px-2.5 py-1.5 rounded-lg">
                          <CheckCircle2 className="w-3 h-3 shrink-0" />
                          <span>{toArabicNum(app.applicantCompletedJobs)} تكليف مكتمل</span>
                        </div>
                      )}
                    </div>

                    {/* Cover letter */}
                    {app.coverLetter && (
                      <div className="p-3 rounded-xl bg-muted/30 border border-border/30">
                        <p className="text-[10px] text-muted-foreground font-medium mb-1">رسالة التقديم</p>
                        <p className="text-xs leading-relaxed">{app.coverLetter}</p>
                      </div>
                    )}

                    {/* Select button for pending applicants */}
                    {app.status === 'pending' && manageTarget.status === 'open' && (
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="flex-1 h-10 text-xs gap-2 rounded-xl font-medium"
                          onClick={() => handleViewCV(app.applicantId)}
                        >
                          <Eye className="w-4 h-4" />
                          عرض السيرة الذاتية
                        </Button>
                        <Button
                          size="sm"
                          className="flex-1 h-10 text-xs gap-2 bg-gradient-to-r from-sky-500 to-teal-500 hover:from-sky-600 hover:to-teal-600 text-white rounded-xl font-bold shadow-sm"
                          onClick={() => handleSelectApplicant(manageTarget.id, app._id!)}
                          disabled={isSelecting}
                        >
                          {isSelecting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          اختيار
                        </Button>
                      </div>
                    )}

                    {/* View CV for non-pending applicants too */}
                    {app.status !== 'pending' && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full h-9 text-xs gap-2 rounded-xl font-medium"
                        onClick={() => handleViewCV(app.applicantId)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                        عرض السيرة الذاتية
                      </Button>
                    )}

                    {/* Status-specific messages */}
                    {app.status === 'payment_pending' && (
                      <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/10 border border-orange-200/50 dark:border-orange-900/30">
                        <p className="text-xs text-orange-700 dark:text-orange-300 font-bold">
                          تم التعيين — بانتظار دفع المكلف
                        </p>
                      </div>
                    )}
                    {app.status === 'payment_submitted' && (
                      <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-900/10 border border-sky-200/50 dark:border-sky-900/30">
                        <p className="text-xs text-sky-700 dark:text-sky-300 font-bold">
                          تم تقديم إثبات الدفع — بانتظار مراجعة الإدارة
                        </p>
                      </div>
                    )}
                    {app.status === 'accepted' && (
                      <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200/50 dark:border-emerald-900/30">
                        <p className="text-xs text-emerald-700 dark:text-emerald-300 font-bold">
                          تم التحقق من الدفع — تمكين التواصل
                        </p>
                      </div>
                    )}
                  </GlassCard>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* ══════════════════════════════════════════════════════════════════════
          MANDATORY (NON-DISMISSIBLE) PAYMENT DIALOG
          Auto-shows when nurse has payment_pending status.
          Cannot be closed without submitting payment proof.
      ══════════════════════════════════════════════════════════════════════ */}
      {mandatoryPaymentDep && (() => {
        const myApp = getMyApplication(mandatoryPaymentDep);
        const fee = myApp?.serviceFee ?? mandatoryPaymentDep.serviceFee ?? 0;
        return (
          <Dialog open={true} onOpenChange={() => {}}>
            <DialogContent
              dir="rtl"
              className="max-w-xs gap-0 p-0 overflow-hidden [&>button]:hidden rounded-2xl"
              onPointerDownOutside={(e) => e.preventDefault()}
              onEscapeKeyDown={(e) => e.preventDefault()}
              onInteractOutside={(e) => e.preventDefault()}
            >
              {/* Header */}
              <div className="flex items-center gap-2.5 px-4 py-3 border-b bg-gradient-to-l from-amber-500/10 to-amber-600/5 dark:from-amber-900/20 dark:to-amber-800/10">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 flex items-center justify-center shrink-0 shadow-sm">
                  <CreditCard className="w-4 h-4 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <DialogTitle className="text-sm font-bold leading-none">رسوم التقديم مطلوبة</DialogTitle>
                  <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{mandatoryPaymentDep.title || typeLabels[mandatoryPaymentDep.type] || 'تكليف'}</p>
                </div>
                <span className="shrink-0 text-base font-black text-amber-600 dark:text-amber-400 tabular-nums">
                  {toArabicNum(fee)} ر.ي
                </span>
              </div>

              <div className="p-4 space-y-3">
                {/* Payment info list */}
                {(mandatoryPaymentDep.paymentMethod || mandatoryPaymentDep.walletNumber || mandatoryPaymentDep.walletOwnerName) && (
                  <div className="rounded-xl border bg-muted/30 divide-y divide-border text-xs">
                    {mandatoryPaymentDep.paymentMethod && (
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <span className="text-muted-foreground flex items-center gap-1.5"><Wallet className="w-3 h-3" />طريقة الدفع</span>
                        <span className="font-bold">{mandatoryPaymentDep.paymentMethod}</span>
                      </div>
                    )}
                    {mandatoryPaymentDep.walletNumber && (
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <span className="text-muted-foreground flex items-center gap-1.5"><Phone className="w-3 h-3" />رقم المحفظة</span>
                        <span className="font-bold font-mono select-all" dir="ltr">{mandatoryPaymentDep.walletNumber}</span>
                      </div>
                    )}
                    {mandatoryPaymentDep.walletOwnerName && (
                      <div className="flex items-center justify-between px-3 py-2.5">
                        <span className="text-muted-foreground flex items-center gap-1.5"><User className="w-3 h-3" />اسم الحساب</span>
                        <span className="font-bold">{mandatoryPaymentDep.walletOwnerName}</span>
                      </div>
                    )}
                    <div className="flex items-center justify-between px-3 py-2.5">
                      <span className="text-muted-foreground flex items-center gap-1.5"><DollarSign className="w-3 h-3" />المبلغ</span>
                      <span className="font-black text-amber-600 dark:text-amber-400">{toArabicNum(fee)} ر.ي</span>
                    </div>
                    {mandatoryPaymentDep.walletNumber && (
                      <div className="flex gap-2 px-3 py-2.5">
                        <a
                          href={`https://wa.me/${mandatoryPaymentDep.walletNumber.replace(/^0+/, '')}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-gradient-to-r from-green-600 to-green-700 hover:from-green-700 hover:to-green-800 text-white text-[10px] font-bold transition-all"
                        >
                          <MessageSquare className="w-3 h-3" /> واتساب
                        </a>
                        <button
                          onClick={() => { navigator.clipboard.writeText(mandatoryPaymentDep.walletNumber); toast.success('تم نسخ الرقم'); }}
                          className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground text-[10px] font-bold border transition-colors"
                        >
                          نسخ الرقم
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {/* Upload proof section */}
                <div className="space-y-2.5">
                  <p className="text-xs font-bold flex items-center gap-2 text-muted-foreground">
                    <div className="w-6 h-6 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
                      <Upload className="w-3 h-3 text-amber-600" />
                    </div>
                    رفع إثبات الدفع
                  </p>

                  {mandatoryPaymentProofImage ? (
                    <div className="relative rounded-xl overflow-hidden border shadow-sm">
                      <img
                        src={mandatoryPaymentProofImage}
                        alt="إثبات الدفع"
                        className="w-full h-24 object-cover"
                      />
                      <button
                        onClick={() => { setMandatoryPaymentProofImage(''); if (mandatoryFileInputRef.current) mandatoryFileInputRef.current.value = ''; }}
                        className="absolute top-2 left-2 w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center shadow-md"
                      >
                        <X className="w-3 h-3" />
                      </button>
                      <div className="absolute bottom-2 right-2 bg-emerald-500 text-white text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 font-bold shadow-sm">
                        <CheckCircle className="w-2.5 h-2.5" /> تم الرفع
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => mandatoryFileInputRef.current?.click()}
                      className="w-full h-20 rounded-xl border-2 border-dashed border-border hover:border-amber-400 dark:hover:border-amber-600/50 bg-muted/20 hover:bg-amber-50/50 dark:hover:bg-amber-900/10 transition-all flex flex-col items-center justify-center gap-2 text-muted-foreground hover:text-amber-600"
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-[10px] font-bold">اضغط لرفع صورة إثبات الدفع</span>
                    </button>
                  )}
                  <input
                    ref={mandatoryFileInputRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleMandatoryImageUpload}
                  />

                  {!mandatoryPaymentProofImage && (
                    <Textarea
                      placeholder="أو أدخل رقم المعاملة / ملاحظة"
                      value={mandatoryPaymentProof}
                      onChange={(e) => setMandatoryPaymentProof(e.target.value)}
                      rows={2}
                      className="text-xs resize-none rounded-xl"
                      dir="rtl"
                    />
                  )}
                </div>

                {/* Notice */}
                <div className="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200/50 dark:border-amber-800/30">
                  <p className="text-[10px] text-amber-700 dark:text-amber-400 leading-relaxed font-medium">
                    يجب إرفاق إثبات الدفع لتأكيد التكليف والحصول على بيانات التواصل. لا يمكن إغلاق هذه النافذة قبل الإرسال.
                  </p>
                </div>

                {/* Submit button */}
                <Button
                  size="sm"
                  onClick={handleSubmitMandatoryPayment}
                  disabled={isSubmittingMandatoryPayment || (!mandatoryPaymentProof && !mandatoryPaymentProofImage)}
                  className="w-full h-10 gap-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-white font-bold rounded-xl shadow-sm"
                >
                  {isSubmittingMandatoryPayment ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> جاري الإرسال...</>
                  ) : (
                    <><Upload className="w-4 h-4" /> تقديم إثبات الدفع</>
                  )}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        );
      })()}
    </motion.div>

      {/* ═══════════════ CV MODAL DIALOG ═══════════════ */}
      <Dialog open={!!cvApplicantId} onOpenChange={(open) => { if (!open) { setCvApplicantId(null); setCvData(null); } }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[85vh] overflow-y-auto rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2.5 text-lg">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-sky-500 to-teal-500 flex items-center justify-center">
                <Eye className="w-4.5 h-4.5 text-white" />
              </div>
              السيرة الذاتية
            </DialogTitle>
            <DialogDescription>
              عرض البيانات المهنية للمتقدم
            </DialogDescription>
          </DialogHeader>

          {isLoadingCV && (
            <div className="py-10 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-sky-500 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">جاري تحميل السيرة الذاتية...</p>
            </div>
          )}

          {cvData && !isLoadingCV && (
            <div className="space-y-4">
              <ProfileHeader nurse={cvData} />
              {cvData.bio && <BioSection bio={cvData.bio} />}
              <SkillsSection skills={cvData.skills} />
              <ExperienceSection experiences={cvData.experiences} />
              <CertificatesSection certificates={cvData.certificates} />
              <LanguagesSection languages={cvData.languages} />
              <StatisticsSection
                rating={cvData.rating}
                reviewCount={cvData.reviewCount}
                completedJobs={cvData.completedJobs}
                emergencyCases={cvData.emergencyCases}
                responseRate={cvData.responseRate}
                complianceRate={cvData.complianceRate}
              />
            </div>
          )}

          {!isLoadingCV && !cvData && cvApplicantId && (
            <div className="py-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-3">
                <User className="w-7 h-7 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">لم يتم العثور على بيانات</p>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
