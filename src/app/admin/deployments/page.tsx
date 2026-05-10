'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Briefcase, Eye, Plus, RefreshCw, Clock, DollarSign,
  Loader2, Search, Filter, Users, CheckCircle2, XCircle,
  Flame, BarChart3, FileText, MapPin, Navigation, Building2,
  Wallet, Percent, Hash, Landmark, ShieldCheck, Star
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
    title: '',
    description: '',
    type: 'nursing',
    hours: 1,
    governorate: '',
    district: '',
    amount: 0,
    requirements: '',
    notes: '',
  });
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
          hours: createForm.hours,
          location: {
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
        void fetchDeployments();
        setShowCreateDialog(false);
        setCreateForm({
          title: '',
          description: '',
          type: 'nursing',
          hours: 1,
          governorate: '',
          district: '',
          amount: 0,
          requirements: '',
          notes: '',
        });
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
                        <p className="font-bold text-sm truncate">{dep.title}</p>
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

      {/* ═══════════════ CREATE DEPLOYMENT DIALOG ═══════════════ */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-admin" />
              إنشاء تكليف جديد
            </DialogTitle>
            <DialogDescription>
              أنشئ تكليفاً جديداً للبحث عن ممرض/ـة مناسب/ـة
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Title */}
            <div className="space-y-2">
              <Label htmlFor="admin-dep-title" className="text-sm font-medium">
                عنوان التكليف <span className="text-red-500">*</span>
              </Label>
              <Input
                id="admin-dep-title"
                placeholder="مثال: ممرض/ة لرعاية منزلية"
                value={createForm.title}
                onChange={(e) => setCreateForm((p) => ({ ...p, title: e.target.value }))}
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label htmlFor="admin-dep-desc" className="text-sm font-medium">
                الوصف <span className="text-red-500">*</span>
              </Label>
              <Textarea
                id="admin-dep-desc"
                placeholder="اكتب وصفاً تفصيلياً للتكليف..."
                rows={3}
                value={createForm.description}
                onChange={(e) => setCreateForm((p) => ({ ...p, description: e.target.value }))}
              />
            </div>

            {/* Type & Hours row */}
            <div className="grid grid-cols-2 gap-3">
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
              <div className="space-y-2">
                <Label htmlFor="admin-dep-hours" className="text-sm font-medium">
                  عدد الساعات <span className="text-red-500">*</span>
                </Label>
                <Input
                  id="admin-dep-hours"
                  type="number"
                  min={1}
                  value={createForm.hours}
                  onChange={(e) => setCreateForm((p) => ({ ...p, hours: parseInt(e.target.value) || 1 }))}
                />
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-2">
              <Label htmlFor="admin-dep-amount" className="text-sm font-medium">
                المبلغ (ر.ي) <span className="text-red-500">*</span>
              </Label>
              <Input
                id="admin-dep-amount"
                type="number"
                min={0}
                value={createForm.amount}
                onChange={(e) => setCreateForm((p) => ({ ...p, amount: parseInt(e.target.value) || 0 }))}
              />
            </div>

            {/* Commission preview */}
            {createForm.amount > 0 && (
              <div className="p-3 rounded-xl bg-muted/40 space-y-1.5 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">المبلغ</span>
                  <span className="font-medium">{toArabicNum(createForm.amount.toLocaleString())} ر.ي</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">عمولة المنصة ({toArabicNum(adminCommissionPercent)}%)</span>
                  <span className="font-medium text-orange-600">
                    {toArabicNum(Math.round((createForm.amount * adminCommissionPercent) / 100).toLocaleString())} ر.ي
                  </span>
                </div>
                <Separator />
                <div className="flex items-center justify-between font-bold text-sm">
                  <span>الإجمالي مع العمولة</span>
                  <span className="text-admin">
                    {toArabicNum((createForm.amount + Math.round((createForm.amount * adminCommissionPercent) / 100)).toLocaleString())} ر.ي
                  </span>
                </div>
              </div>
            )}

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
                <Label htmlFor="admin-dep-district" className="text-sm font-medium">المديرية</Label>
                <Input
                  id="admin-dep-district"
                  placeholder="اسم المديرية"
                  value={createForm.district}
                  onChange={(e) => setCreateForm((p) => ({ ...p, district: e.target.value }))}
                />
              </div>
            </div>

            {/* Requirements */}
            <div className="space-y-2">
              <Label htmlFor="admin-dep-reqs" className="text-sm font-medium">المتطلبات</Label>
              <Textarea
                id="admin-dep-reqs"
                placeholder="المتطلبات اللازمة للتكليف..."
                rows={2}
                value={createForm.requirements}
                onChange={(e) => setCreateForm((p) => ({ ...p, requirements: e.target.value }))}
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="admin-dep-notes" className="text-sm font-medium">ملاحظات</Label>
              <Textarea
                id="admin-dep-notes"
                placeholder="ملاحظات إضافية..."
                rows={2}
                value={createForm.notes}
                onChange={(e) => setCreateForm((p) => ({ ...p, notes: e.target.value }))}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              إلغاء
            </Button>
            <Button
              className="gap-2 bg-admin hover:bg-admin/90 text-white"
              onClick={handleCreateDeployment}
              disabled={isCreating}
            >
              {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
              إنشاء التكليف
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
