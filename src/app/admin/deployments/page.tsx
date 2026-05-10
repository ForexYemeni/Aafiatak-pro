'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Eye, Plus, RefreshCw, Clock, DollarSign,
  Loader2, Search, Filter, Users, CheckCircle2, XCircle,
  Flame, BarChart3, FileText, MapPin, Navigation, Building2,
  Wallet, Percent, Hash, Landmark, ShieldCheck, Star,
  Zap, Activity, Heart, Stethoscope, Tag
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard } from '@/components/common/glass-card';
import { BadgeStatus } from '@/components/common/badge-status';
import { EmptyState } from '@/components/common/empty-state';
import { CardSkeleton } from '@/components/common/loading-skeleton';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
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
  status: 'pending' | 'selected_by_creator' | 'admin_approved' | 'payment_pending' | 'payment_submitted' | 'payment_verified' | 'accepted' | 'rejected';
  appliedAt: string;
  hasPaymentProof: boolean;
  paymentProofData?: string;
  paymentProofImage?: string;
  serviceFee: number;
  coverLetter?: string;
  rejectedReason?: string;
  applicantSpecialization?: string[];
  applicantExperience?: number;
  applicantRating?: number;
  applicantCompletedJobs?: number;
  applicantVerificationStatus?: string;
}

interface DeploymentItem {
  id: string;
  createdBy: { id?: string; name?: string; phone?: string } | null;
  creatorRole: 'admin' | 'nurse';
  creatorPhone?: string;
  creatorServiceFee?: number;
  applicantServiceFee?: number;
  contactRevealed?: boolean;
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

const specializationLabels: Record<string, string> = {
  general_nursing: 'تمريض عام',
  critical_care: 'الرعاية الحرجة',
  pediatric: 'طب الأطفال',
  elderly_care: 'رعاية المسنين',
  lab_technician: 'مخبري',
  emergency: 'الطوارئ',
  anesthesia: 'التخدير',
  radiology: 'الأشعة',
  pharmacy: 'الصيدلة',
  dentistry: 'طب الأسنان',
  obstetrics: 'التوليد والنساء',
  cardiology_nursing: 'تمريض القلب',
  dialysis_nursing: 'تمريض الكلى والغسيل',
  respiratory_therapy: 'العلاج التنفسي',
  nutrition: 'التغذية العلاجية',
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

const deploymentStatusLabel: Record<string, string> = {
  open: 'متاح',
  creator_selected: 'بانتظار الموافقة',
  admin_approved: 'موافقة الإدارة',
  assigned: 'تم التعيين',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
};

/* ─────────────── Animation ─────────────── */
const containerAnim = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

/* ════════════════════════════════════════════════════════════════ */
/* ═══════════════ MAIN COMPONENT ════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════ */
export default function AdminDeploymentsPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();

  // Data
  const [deployments, setDeployments] = useState<DeploymentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Create dialog
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    type: 'nursing',
    specialization: '',
    hours: 0,
    governorate: '',
    district: '',
    amount: 0,
    requirements: '',
    notes: '',
    department: '',
    gender: '',
    requirementTags: [] as string[],
  });
  const [customReq, setCustomReq] = useState('');
  const [adminCommissionPercent, setAdminCommissionPercent] = useState(15);
  const [isCreating, setIsCreating] = useState(false);

  /* ── Fetch deployments ── */
  const fetchDeployments = useCallback(async () => {
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (statusFilter !== 'all') params.set('status', statusFilter);
      if (typeFilter !== 'all') params.set('type', typeFilter);

      const res = await authFetch(`/api/deployments?${params}`);
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
  }, [authFetch, statusFilter, typeFilter]);

  useEffect(() => {
    setIsLoading(true);
    void fetchDeployments();
  }, [fetchDeployments]);

  /* ── Fetch settings ── */
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await authFetch('/api/admin/settings');
        const json = await res.json();
        if (json.success && json.data) {
          setAdminCommissionPercent(json.data.commissionRate ?? 15);
        }
      } catch {
        // Use default
      }
    };
    void fetchSettings();
  }, [authFetch]);

  /* ── Derived state ── */
  const totalCount = deployments.length;
  const openCount = deployments.filter((d) => d.status === 'open').length;
  const creatorSelectedCount = deployments.filter((d) => d.status === 'creator_selected').length;
  const assignedCount = deployments.filter((d) => d.status === 'assigned').length;
  const inProgressCount = deployments.filter((d) => d.status === 'in_progress').length;
  const completedCount = deployments.filter((d) => d.status === 'completed').length;

  // Filter by search
  const filteredDeployments = searchQuery
    ? deployments.filter((d) =>
        d.title?.includes(searchQuery) ||
        d.description?.includes(searchQuery) ||
        d.createdBy?.name?.includes(searchQuery) ||
        (typeLabels[d.type] || d.type)?.includes(searchQuery)
      )
    : deployments;

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
          specialization: createForm.specialization || undefined,
          hours: createForm.hours,
          location: {
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
        void fetchDeployments();
        setShowCreateDialog(false);
        setCreateForm({
          type: 'nursing',
          specialization: '',
          hours: 0,
          governorate: '',
          district: '',
          amount: 0,
          requirements: '',
          notes: '',
          department: '',
          gender: '',
          requirementTags: [],
        });
        setCustomReq('');
      } else {
        toast.error(json.message ?? 'فشل إنشاء التكليف');
      }
    } catch {
      toast.error('حدث خطأ أثناء إنشاء التكليف');
    } finally {
      setIsCreating(false);
    }
  };

  /* ═══════════════ RENDER ═══════════════ */
  return (
    <motion.div variants={containerAnim} initial="hidden" animate="show" className="space-y-6">
      {/* Header */}
      <motion.div variants={itemAnim}>
        <PageHeader
          title="إدارة التكليفات"
          description="متابعة وإدارة التكليفات والطلبات"
          action={{
            label: 'تكليف جديد',
            icon: <Plus className="w-4 h-4" />,
            onClick: () => setShowCreateDialog(true),
          }}
        />
      </motion.div>

      {/* Stats Row */}
      <motion.div variants={itemAnim} className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <GlassCard variant="admin" className="p-4 border-r-4 border-teal-500">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center">
              <Briefcase className="w-5 h-5 text-teal-600 dark:text-teal-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-teal-600 dark:text-teal-400">{toArabicNum(totalCount)}</p>
              <p className="text-[11px] text-muted-foreground font-medium">إجمالي التكليفات</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard variant="admin" className="p-4 border-r-4 border-yellow-500">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-yellow-600 dark:text-yellow-400">{toArabicNum(openCount)}</p>
              <p className="text-[11px] text-muted-foreground font-medium">متاحة</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard variant="admin" className="p-4 border-r-4 border-amber-500">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <ShieldCheck className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-amber-600 dark:text-amber-400">{toArabicNum(creatorSelectedCount)}</p>
              <p className="text-[11px] text-muted-foreground font-medium">بانتظار الموافقة</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard variant="admin" className="p-4 border-r-4 border-purple-500">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-purple-600 dark:text-purple-400">{toArabicNum(assignedCount)}</p>
              <p className="text-[11px] text-muted-foreground font-medium">تم التعيين</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard variant="admin" className="p-4 border-r-4 border-sky-500">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
              <BarChart3 className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-sky-600 dark:text-sky-400">{toArabicNum(inProgressCount)}</p>
              <p className="text-[11px] text-muted-foreground font-medium">قيد التنفيذ</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard variant="admin" className="p-4 border-r-4 border-green-500">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-green-600 dark:text-green-400">{toArabicNum(completedCount)}</p>
              <p className="text-[11px] text-muted-foreground font-medium">مكتملة</p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Filter Bar */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin" className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالعنوان، الوصف، المنشئ..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {[
                { key: 'all', label: 'الكل', count: totalCount },
                { key: 'open', label: 'متاح', count: openCount },
                { key: 'creator_selected', label: 'بانتظار الموافقة', count: creatorSelectedCount },
                { key: 'assigned', label: 'معيَّن', count: assignedCount },
                { key: 'in_progress', label: 'قيد التنفيذ', count: inProgressCount },
                { key: 'completed', label: 'مكتمل', count: completedCount },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    statusFilter === tab.key
                      ? 'bg-admin text-white shadow-sm'
                      : 'bg-muted/60 hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {tab.label}
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                    statusFilter === tab.key ? 'bg-white/20' : 'bg-muted'
                  }`}>
                    {toArabicNum(tab.count)}
                  </span>
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" className="shrink-0" onClick={() => { setIsLoading(true); void fetchDeployments(); }}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </GlassCard>
      </motion.div>

      {/* Deployments List */}
      {isLoading ? (
        <div className="space-y-3">
          <CardSkeleton />
          <CardSkeleton />
          <CardSkeleton />
        </div>
      ) : filteredDeployments.length === 0 ? (
        <EmptyState
          icon={<Briefcase className="w-10 h-10 text-muted-foreground" />}
          title="لا توجد تكليفات"
          description="لم يتم العثور على تكليفات مطابقة للفلاتر المحددة"
          action={{
            label: 'إنشاء تكليف',
            onClick: () => setShowCreateDialog(true),
          }}
        />
      ) : (
        <motion.div variants={containerAnim} initial="hidden" animate="show" className="space-y-3">
          {filteredDeployments.map((dep) => {
            const tc = typeColors[dep.type] || typeColors.other;
            return (
              <motion.div key={dep.id} variants={itemAnim} whileHover={{ scale: 1.005 }} whileTap={{ scale: 0.995 }}>
                <GlassCard variant="admin" className="p-4">
                  <div className="flex items-center gap-4">
                    {/* Type icon */}
                    <div className={`w-11 h-11 rounded-xl ${tc.icon} flex items-center justify-center shrink-0`}>
                      <Briefcase className={`w-5 h-5 ${tc.text}`} />
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-bold text-sm truncate">{dep.title || typeLabels[dep.type] || dep.type}</p>
                        <BadgeStatus
                          status={deploymentStatusMap[dep.status] || 'pending'}
                          label={deploymentStatusLabel[dep.status] || dep.status}
                          size="sm"
                        />
                      </div>
                      <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
                        <span>{typeLabels[dep.type] || dep.type}</span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          {dep.creatorRole === 'admin' ? (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-admin/10 text-admin">إدارة</Badge>
                          ) : (
                            <Badge variant="secondary" className="text-[9px] px-1.5 py-0 h-4 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400">ممرض/ـة</Badge>
                          )}
                          {dep.createdBy?.name || 'غير معروف'}
                        </span>
                        <span>•</span>
                        <span>{toArabicNum(dep.hours)} ساعة</span>
                        <span>•</span>
                        <span>{toArabicNum(dep.amount.toLocaleString())} ر.ي</span>
                        {dep.applications.length > 0 && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-0.5 text-admin font-medium">
                              <Users className="w-3 h-3" />
                              {toArabicNum(dep.applications.length)} تقديم
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1"
                        onClick={() => router.push(`/admin/deployments/${dep.id}`)}
                      >
                        <Eye className="w-3.5 h-3.5" /> التفاصيل
                      </Button>
                    </div>
                  </div>
                </GlassCard>
              </motion.div>
            );
          })}
        </motion.div>
      )}

      {/* ═══════════════ CREATE DEPLOYMENT - FULL PAGE SHEET ═══════════════ */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[95vh] overflow-y-auto p-0 gap-0">
          {/* Gradient Header */}
          <div className="relative bg-gradient-to-l from-admin via-admin/90 to-amber-600 p-6 pb-5 rounded-t-lg overflow-hidden">
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-2 left-8 w-20 h-20 rounded-full bg-white/20 blur-xl" />
              <div className="absolute bottom-1 right-12 w-16 h-16 rounded-full bg-white/15 blur-lg" />
            </div>
            <div className="relative flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center border border-white/20 shadow-lg">
                <Briefcase className="w-7 h-7 text-white" />
              </div>
              <div className="flex-1">
                <DialogTitle className="text-xl font-black text-white mb-0.5">إنشاء تكليف جديد</DialogTitle>
                <DialogDescription className="text-white/80 text-sm">أنشئ تكليفاً جديداً للبحث عن ممرض/ـة مناسب/ـة</DialogDescription>
              </div>
              <div className="flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-xl px-3 py-1.5 border border-white/20">
                <Hash className="w-4 h-4 text-white/80" />
                <span className="text-xs font-bold text-white/90">تكليف جديد</span>
              </div>
            </div>
          </div>

          <div className="p-6 space-y-1">
            {/* ── Step 1: نوع التكليف ── */}
            <div className="rounded-2xl border-2 border-admin/20 bg-gradient-to-b from-admin/5 to-transparent p-5 space-y-4 hover:border-admin/30 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-admin text-white flex items-center justify-center text-sm font-black shadow-md shadow-admin/30">١</div>
                <div>
                  <h4 className="font-bold text-admin text-base">نوع التكليف</h4>
                  <p className="text-[11px] text-muted-foreground">اختر نوع وقسم التكليف</p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-sm font-semibold flex items-center gap-1.5">
                    <Tag className="w-3.5 h-3.5 text-admin" />
                    نوع التكليف <span className="text-red-500">*</span>
                  </Label>
                  <Select
                    value={createForm.type}
                    onValueChange={(val) => setCreateForm((p) => ({ ...p, type: val as any }))}
                  >
                    <SelectTrigger className="w-full h-12 text-sm font-medium border-admin/20 focus:border-admin">
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

            {/* ── Step 2: عدد الساعات والمبلغ ── */}
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
                  <Label htmlFor="admin-dep-hours" className="text-sm font-semibold flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-emerald-600" />
                    عدد الساعات <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="admin-dep-hours"
                      type="number"
                      min={0}
                      value={createForm.hours || ''}
                      placeholder="0"
                      className={`h-12 text-lg font-bold text-center border-emerald-200 dark:border-emerald-900/50 focus:border-emerald-500 ${createForm.hours === 0 ? 'text-muted-foreground/30 placeholder:text-muted-foreground/30' : 'text-emerald-700 dark:text-emerald-400'}`}
                      onChange={(e) => setCreateForm((p) => ({ ...p, hours: parseInt(e.target.value) || 0 }))}
                    />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-medium text-emerald-600/70 bg-emerald-50 dark:bg-emerald-900/30 px-2 py-1 rounded-md border border-emerald-200 dark:border-emerald-800/50">ساعة</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="admin-dep-amount" className="text-sm font-semibold flex items-center gap-1.5">
                    <DollarSign className="w-3.5 h-3.5 text-emerald-600" />
                    المبلغ <span className="text-red-500">*</span>
                  </Label>
                  <div className="relative">
                    <Input
                      id="admin-dep-amount"
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
                        <span>الإجمالي مع العمولة</span>
                        <span className="text-admin text-lg">
                          {toArabicNum((createForm.amount + Math.round((createForm.amount * adminCommissionPercent) / 100)).toLocaleString())} ر.ي
                        </span>
                      </div>
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
                          ? 'bg-admin/10 border-admin/40 text-admin shadow-md shadow-admin/10'
                          : 'bg-card border-border text-muted-foreground hover:border-amber-300 dark:hover:border-amber-800/50 hover:bg-amber-50/50 dark:hover:bg-amber-950/10'
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute -top-1.5 -left-1.5 w-5 h-5 rounded-full bg-admin flex items-center justify-center">
                          <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                        </div>
                      )}
                      <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${
                        isSelected ? 'bg-admin/15' : 'bg-muted/50'
                      }`}>
                        <ReqIcon className={`w-4.5 h-4.5 ${isSelected ? 'text-admin' : ''}`} />
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
                      <Badge key={idx} variant="secondary" className="gap-1 px-2.5 py-1 text-xs bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
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

            {/* ── Step 4: الموقع ── */}
            <div className="rounded-2xl border-2 border-sky-200 dark:border-sky-900/40 bg-gradient-to-b from-sky-50/50 dark:from-sky-950/10 to-transparent p-5 space-y-4 hover:border-sky-300 dark:hover:border-sky-800/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center text-sm font-black shadow-md shadow-sky-500/30">٤</div>
                <div>
                  <h4 className="font-bold text-sky-700 dark:text-sky-400 text-base">الموقع</h4>
                  <p className="text-[11px] text-muted-foreground">اختياري - حدد موقع التكليف</p>
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
                    <SelectTrigger className="w-full h-11 border-sky-200 dark:border-sky-900/50 focus:border-sky-500">
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
                  <Label htmlFor="admin-dep-district" className="text-sm font-semibold flex items-center gap-1.5">
                    <Navigation className="w-3.5 h-3.5 text-sky-600" />
                    المديرية
                  </Label>
                  <Input
                    id="admin-dep-district"
                    placeholder="اسم المديرية"
                    value={createForm.district}
                    onChange={(e) => setCreateForm((p) => ({ ...p, district: e.target.value }))}
                    className="h-11 border-sky-200 dark:border-sky-900/50 focus:border-sky-500"
                  />
                </div>
              </div>
            </div>

            {/* ── Step 5: ملاحظات ── */}
            <div className="rounded-2xl border-2 border-gray-200 dark:border-gray-800/40 bg-gradient-to-b from-gray-50/50 dark:from-gray-950/10 to-transparent p-5 space-y-4 hover:border-gray-300 dark:hover:border-gray-700/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gray-500 text-white flex items-center justify-center text-sm font-black shadow-md shadow-gray-500/20">٥</div>
                <div>
                  <h4 className="font-bold text-gray-700 dark:text-gray-400 text-base">ملاحظات</h4>
                  <p className="text-[11px] text-muted-foreground">اختياري - أضف ملاحظات إضافية</p>
                </div>
              </div>
              <Textarea
                id="admin-dep-notes"
                placeholder="ملاحظات إضافية..."
                rows={2}
                value={createForm.notes}
                onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
                className="border-gray-200 dark:border-gray-800/50 focus:border-gray-400"
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-5 pt-0 flex items-center justify-between border-t bg-muted/20 -mx-0 -mb-0 rounded-b-lg">
            <Button
              variant="ghost"
              onClick={() => setShowCreateDialog(false)}
              className="gap-2 text-muted-foreground hover:text-foreground"
            >
              إلغاء
            </Button>
            <div className="flex items-center gap-2">
              {createForm.type && createForm.gender && createForm.department && createForm.hours > 0 && createForm.amount > 0 && (
                <span className="text-[10px] text-emerald-600 font-medium flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" /> جاهز للإنشاء
                </span>
              )}
              <Button
                className="gap-2 bg-gradient-to-l from-admin to-amber-600 hover:from-admin/90 hover:to-amber-600/90 text-white shadow-lg shadow-admin/20 px-6 h-11 font-bold"
                onClick={handleCreateDeployment}
                disabled={isCreating}
              >
                {isCreating ? <Loader2 className="w-5 h-5 animate-spin" /> : <Plus className="w-5 h-5" />}
                إنشاء التكليف
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
