'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Eye,
  ShieldCheck,
  RefreshCw,
  Phone,
  Star,
  MapPin,
  Ban,
  Trash2,
  X,
  ZoomIn,
  AlertTriangle,
  FileText,
  Loader2,
  ArrowDownToLine,
  CheckCircle2,
  XCircle,
  Clock,
  Wallet,
  Search,
  Users,
  Shield,
  Activity,
  TrendingUp,
  ChevronLeft,
  ChevronRight,
  Power,
  PowerOff,
  Send,
  Banknote,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { SPECIALIZATION_LABELS, YEMEN_GOVERNORATES, SPECIALIZATION_CATEGORIES, DEFAULT_SPECIALIZATIONS } from '@/lib/constants';
import { GlassCard } from '@/components/common/glass-card';
import { SearchInput } from '@/components/common/search-input';
import { BadgeStatus } from '@/components/common/badge-status';
import { EmptyState } from '@/components/common/empty-state';
import { DateFormatter } from '@/components/common/date-formatter';
import { useAuthFetch } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { Currency } from '@/components/common/currency';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import { VerifiedBadge } from '@/components/common/verified-badge';

// ─── Types ───────────────────────────────────────────────────────
interface NurseItem {
  id: string;
  name: string;
  phone: string;
  specialization: string[];
  verificationStatus: string;
  isActive: boolean;
  isAvailable: boolean;
  isBlocked?: boolean;
  blockedReason?: string;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  governorate: string | null;
  bloodType?: string | null;
  experience: number;
  bio: string | null;
  rejectedReason: string | null;
  identityDocumentUrl: string | null;
  licenseDocumentUrl: string | null;
  identityDocumentData?: string | null;
  licenseDocumentData?: string | null;
  createdAt: string;
  licenseNumber?: string;
  lat?: number | null;
  lng?: number | null;
  district?: string | null;
  address?: string | null;
}

interface WithdrawalItem {
  id: string;
  nurseId: string;
  nurseName: string;
  nursePhone: string;
  amount: number;
  withdrawalFee: number;
  netAmount: number;
  walletType: string;
  walletNumber: string;
  walletHolderName: string;
  status: 'pending' | 'approved' | 'rejected' | 'processed';
  adminNotes: string;
  processedAt: string | null;
  rejectedReason: string | null;
  createdAt: string;
}

// ─── Constants ───────────────────────────────────────────────────
// SPECIALIZATION_LABELS is imported from @/lib/constants as SPECIALIZATION_LABELS

const wStatusLabels: Record<string, string> = {
  pending: 'قيد المراجعة',
  approved: 'تمت الموافقة',
  rejected: 'مرفوض',
  processed: 'تم التحويل',
};

const wStatusColors: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200 dark:border-amber-800',
  approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
  processed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
  rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
};

// ─── Animation Variants ──────────────────────────────────────────
const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.06 } },
};
const itemAnim = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 24 } },
};
const cardHover = {
  scale: 1.015,
  transition: { type: 'spring', stiffness: 400, damping: 25 },
};
const statCardVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 25 } },
};

// ─── Component ───────────────────────────────────────────────────
export default function AdminNursesPage() {
  const authFetch = useAuthFetch();
  const isMobile = useIsMobile();

  // Active tab
  const [activeTab, setActiveTab] = useState('nurses');

  // Nurses state
  const [nurses, setNurses] = useState<NurseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [specFilter, setSpecFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Verify dialog
  const [verifyTarget, setVerifyTarget] = useState<NurseItem | null>(null);
  const [verifyAction, setVerifyAction] = useState<'verify' | 'reject'>('verify');
  const [rejectedReason, setRejectedReason] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // View drawer/dialog
  const [viewTarget, setViewTarget] = useState<NurseItem | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [docData, setDocData] = useState<{
    identityDocumentData: string | null;
    licenseDocumentData: string | null;
    identityDocumentUrl: string | null;
    licenseDocumentUrl: string | null;
  } | null>(null);

  // Image lightbox
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);

  // Toggle confirm
  const [toggleTarget, setToggleTarget] = useState<NurseItem | null>(null);

  // Block dialog
  const [blockTarget, setBlockTarget] = useState<NurseItem | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<NurseItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  // Withdrawal state
  const [withdrawals, setWithdrawals] = useState<WithdrawalItem[]>([]);
  const [withdrawalsLoading, setWithdrawalsLoading] = useState(false);
  const [withdrawalStatusFilter, setWithdrawalStatusFilter] = useState('all');
  const [withdrawalSearch, setWithdrawalSearch] = useState('');
  const [withdrawalPage, setWithdrawalPage] = useState(1);
  const [withdrawalTotalPages, setWithdrawalTotalPages] = useState(1);

  // Withdrawal action dialog
  const [withdrawalAction, setWithdrawalAction] = useState<WithdrawalItem | null>(null);
  const [withdrawalActionType, setWithdrawalActionType] = useState<'approve' | 'reject'>('approve');
  const [withdrawalActionLoading, setWithdrawalActionLoading] = useState(false);
  const [withdrawalAdminNotes, setWithdrawalAdminNotes] = useState('');
  const [withdrawalRejectReason, setWithdrawalRejectReason] = useState('');

  const user = useAuthStore((s) => s.user);
  const isSubadmin = user?.role === 'subadmin';

  // ─── Computed Stats ──────────────────────────────────────────
  const nurseStats = useMemo(() => ({
    total: nurses.length,
    verified: nurses.filter(n => n.verificationStatus === 'verified').length,
    pending: nurses.filter(n => n.verificationStatus === 'pending' || n.verificationStatus === 'unverified').length,
    active: nurses.filter(n => n.isActive && !n.isBlocked).length,
  }), [nurses]);

  const withdrawalStats = useMemo(() => ({
    pendingAmount: withdrawals
      .filter(w => w.status === 'pending')
      .reduce((sum, w) => sum + w.netAmount, 0),
    processedAmount: withdrawals
      .filter(w => w.status === 'processed')
      .reduce((sum, w) => sum + w.netAmount, 0),
    pendingCount: withdrawals.filter(w => w.status === 'pending').length,
  }), [withdrawals]);

  const pendingCount = withdrawalStats.pendingCount;

  // ─── Data Fetching ───────────────────────────────────────────
  const handleViewNurse = useCallback(async (nurse: NurseItem) => {
    setViewTarget(nurse);
    setViewLoading(true);
    setDocData(null);
    try {
      const res = await authFetch(`/api/admin/nurses/${nurse.id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setViewTarget({ ...nurse, ...json.data });
      }
    } catch {
      setViewTarget(nurse);
    } finally {
      setViewLoading(false);
    }
  }, [authFetch]);

  const handleLoadDocuments = useCallback(async (nurseId: string) => {
    setDocLoading(true);
    try {
      const res = await authFetch(`/api/admin/nurses/${nurseId}/documents`);
      const json = await res.json();
      if (json.success && json.data) {
        setDocData(json.data);
      }
    } catch {
      toast.error('فشل تحميل المستندات');
    } finally {
      setDocLoading(false);
    }
  }, [authFetch]);

  const fetchNurses = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        search,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(specFilter !== 'all' ? { specialization: specFilter } : {}),
      });
      const res = await authFetch(`/api/admin/nurses?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        const items = json.data.nurses ?? json.data;
        setNurses(Array.isArray(items) ? items : []);
        if (json.data.pages) setTotalPages(json.data.pages);
      }
    } catch {
      toast.error('فشل تحميل بيانات الممرضين');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, page, search, statusFilter, specFilter]);

  const fetchWithdrawals = useCallback(async () => {
    setWithdrawalsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(withdrawalPage),
        limit: '10',
        ...(withdrawalStatusFilter !== 'all' ? { status: withdrawalStatusFilter } : {}),
        ...(withdrawalSearch ? { search: withdrawalSearch } : {}),
      });
      const res = await authFetch(`/api/admin/withdrawals?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        setWithdrawals(json.data.withdrawals || []);
        setWithdrawalTotalPages(json.data.pages || 1);
      }
    } catch {
      toast.error('فشل تحميل طلبات السحب');
    } finally {
      setWithdrawalsLoading(false);
    }
  }, [authFetch, withdrawalPage, withdrawalStatusFilter, withdrawalSearch]);

  useEffect(() => {
    void fetchNurses();
  }, [fetchNurses]);

  useEffect(() => {
    if (activeTab === 'withdrawals') {
      void fetchWithdrawals();
    }
  }, [activeTab, fetchWithdrawals]);

  // ─── Action Handlers ─────────────────────────────────────────
  const handleVerify = async () => {
    if (!verifyTarget) return;
    setIsVerifying(true);
    try {
      const res = await authFetch(`/api/admin/nurses/${verifyTarget.id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: verifyAction === 'verify' ? 'verified' : 'rejected',
          ...(verifyAction === 'reject' && rejectedReason ? { rejectedReason } : {}),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(verifyAction === 'verify' ? 'تم توثيق الممرض/ـة' : 'تم رفض الممرض/ـة');
        void fetchNurses();
      } else {
        toast.error(json.message ?? 'فشل العملية');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setIsVerifying(false);
      setVerifyTarget(null);
      setRejectedReason('');
    }
  };

  const handleToggle = async () => {
    if (!toggleTarget) return;
    try {
      const res = await authFetch(`/api/admin/nurses/${toggleTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !toggleTarget.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(toggleTarget.isActive ? 'تم تعطيل الممرض/ـة' : 'تم تفعيل الممرض/ـة');
        void fetchNurses();
      }
    } catch {
      toast.error('فشل تغيير الحالة');
    } finally {
      setToggleTarget(null);
    }
  };

  const handleBlock = async () => {
    if (!blockTarget) return;
    setIsBlocking(true);
    try {
      const isBlocked = !blockTarget.isBlocked;
      const res = await authFetch(`/api/admin/nurses/${blockTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          isBlocked,
          blockedReason: isBlocked ? blockReason : '',
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(isBlocked ? 'تم حظر الممرض/ـة' : 'تم إلغاء حظر الممرض/ـة');
        void fetchNurses();
      } else {
        toast.error(json.message ?? 'فشل العملية');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setIsBlocking(false);
      setBlockTarget(null);
      setBlockReason('');
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmName !== deleteTarget.name) {
      toast.error('يرجى كتابة اسم الممرض/ـة للتأكيد');
      return;
    }
    setIsDeleting(true);
    try {
      const res = await authFetch(`/api/admin/nurses/${deleteTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success('تم حذف الممرض/ـة نهائياً');
        setViewTarget(null);
        void fetchNurses();
      } else {
        toast.error(json.message ?? 'فشل الحذف');
      }
    } catch {
      toast.error('حدث خطأ أثناء الحذف');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
      setDeleteConfirmName('');
    }
  };

  const handleWithdrawalAction = async () => {
    if (!withdrawalAction) return;
    setWithdrawalActionLoading(true);
    try {
      const res = await authFetch(`/api/admin/withdrawals/${withdrawalAction.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: withdrawalActionType === 'approve' ? 'processed' : 'rejected',
          adminNotes: withdrawalAdminNotes || undefined,
          rejectedReason: withdrawalActionType === 'reject' ? withdrawalRejectReason : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(
          withdrawalActionType === 'approve'
            ? 'تم تحويل الأموال للممرض بنجاح'
            : 'تم رفض طلب السحب وإرجاع المبلغ'
        );
        void fetchWithdrawals();
      } else {
        toast.error(json.message ?? 'فشل العملية');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setWithdrawalActionLoading(false);
      setWithdrawalAction(null);
      setWithdrawalAdminNotes('');
      setWithdrawalRejectReason('');
    }
  };

  // ─── View Content ────────────────────────────────────────────
  const ViewContent = ({ nurse }: { nurse: NurseItem }) => (
    <div className="space-y-5 p-5">
      {/* Profile Header */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <Avatar className="w-20 h-20 ring-2 ring-primary/20 ring-offset-2 ring-offset-background">
            <AvatarFallback className="bg-gradient-to-br from-sky-400 to-sky-600 text-white text-2xl font-bold">
              {nurse.name.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          {nurse.isBlocked ? (
            <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-red-500 flex items-center justify-center ring-2 ring-background">
              <Ban className="w-3.5 h-3.5 text-white" />
            </div>
          ) : nurse.isActive ? (
            <div className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-green-500 flex items-center justify-center ring-2 ring-background">
              <Activity className="w-3.5 h-3.5 text-white" />
            </div>
          ) : null}
        </div>
        <div className="flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-xl font-bold flex items-center gap-1.5">{nurse.name}{nurse.verificationStatus === 'verified' && <VerifiedBadge size="md" />}</h3>
            {nurse.isBlocked && (
              <Badge variant="destructive" className="text-[10px]">
                <Ban className="w-3 h-3 ml-0.5" />محظور
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground" dir="ltr">{nurse.phone}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
            <span className="text-sm font-medium">{nurse.rating.toFixed(1)}</span>
            <span className="text-xs text-muted-foreground">({nurse.reviewCount} تقييم)</span>
            <Separator orientation="vertical" className="h-4 mx-1" />
            <span className="text-xs text-muted-foreground">{nurse.completedJobs} وظيفة مكتملة</span>
          </div>
        </div>
      </div>

      {/* Info Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-xl bg-muted/40 backdrop-blur-sm p-3 border border-border/30">
          <p className="text-[11px] text-muted-foreground mb-1">التخصص</p>
          <p className="text-sm font-medium">
            {(nurse.specialization || []).map((s) => SPECIALIZATION_LABELS[s] ?? s).join('، ') || 'غير محدد'}
          </p>
        </div>
        <div className="rounded-xl bg-muted/40 backdrop-blur-sm p-3 border border-border/30">
          <p className="text-[11px] text-muted-foreground mb-1">الخبرة</p>
          <p className="text-sm font-medium">{nurse.experience} سنوات</p>
        </div>
        <div className="rounded-xl bg-muted/40 backdrop-blur-sm p-3 border border-border/30">
          <p className="text-[11px] text-muted-foreground mb-1">الوظائف المكتملة</p>
          <p className="text-sm font-medium">{nurse.completedJobs}</p>
        </div>
        <div className="rounded-xl bg-muted/40 backdrop-blur-sm p-3 border border-border/30">
          <p className="text-[11px] text-muted-foreground mb-1">حالة التوثيق</p>
          <BadgeStatus status={nurse.verificationStatus} size="sm" />
        </div>
        {nurse.bloodType && (
          <div className="rounded-xl bg-muted/40 backdrop-blur-sm p-3 border border-border/30">
            <p className="text-[11px] text-muted-foreground mb-1">فصيلة الدم</p>
            <p className="text-sm font-bold text-red-600 dark:text-red-400">{nurse.bloodType}</p>
          </div>
        )}
      </div>

      {/* Location */}
      {(nurse.governorate || nurse.lat) && (
        <div className="rounded-xl bg-muted/40 backdrop-blur-sm p-3 border border-border/30 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-red-500" />
            <span className="font-medium">
              {nurse.governorate || 'غير محدد'}
              {nurse.district && <span className="text-muted-foreground"> - {nurse.district}</span>}
              {nurse.address && <span className="text-muted-foreground"> - {nurse.address}</span>}
            </span>
          </div>
          {nurse.lat && nurse.lng && (
            <a
              href={`https://www.google.com/maps?q=${nurse.lat},${nurse.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-primary hover:underline"
            >
              <MapPin className="w-3 h-3" />
              عرض على الخريطة ({Number(nurse.lat).toFixed(4)}, {Number(nurse.lng).toFixed(4)})
            </a>
          )}
        </div>
      )}

      {/* Bio */}
      {nurse.bio && (
        <div className="rounded-xl bg-muted/40 backdrop-blur-sm p-3 border border-border/30">
          <p className="text-[11px] text-muted-foreground mb-1">نبذة</p>
          <p className="text-sm leading-relaxed">{nurse.bio}</p>
        </div>
      )}

      {/* Rejected Reason */}
      {nurse.rejectedReason && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/20 p-3 border border-red-200/60 dark:border-red-800/60">
          <p className="text-[11px] text-red-600 dark:text-red-400 mb-1 font-medium">سبب الرفض</p>
          <p className="text-sm text-red-700 dark:text-red-300">{nurse.rejectedReason}</p>
        </div>
      )}

      {/* Block Reason */}
      {nurse.isBlocked && nurse.blockedReason && (
        <div className="rounded-xl bg-red-50 dark:bg-red-950/20 p-3 border border-red-200/60 dark:border-red-800/60">
          <p className="text-[11px] text-red-600 dark:text-red-400 mb-1 font-medium">سبب الحظر</p>
          <p className="text-sm text-red-700 dark:text-red-300">{nurse.blockedReason}</p>
        </div>
      )}

      {/* Documents */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">المستندات</p>
          {!docData && !docLoading && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleLoadDocuments(nurse.id)}
              className="text-xs h-7 gap-1"
            >
              <Eye className="w-3 h-3" />
              عرض المستندات
            </Button>
          )}
        </div>

        {docLoading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            <span className="mr-2 text-xs text-muted-foreground">جاري تحميل المستندات...</span>
          </div>
        )}

        {docData && (
          <div className="grid grid-cols-2 gap-3">
            {(() => {
              const identitySrc =
                docData.identityDocumentData ||
                (docData.identityDocumentUrl && !docData.identityDocumentUrl.startsWith('data:stored/')
                  ? docData.identityDocumentUrl
                  : null);
              const licenseSrc =
                docData.licenseDocumentData ||
                (docData.licenseDocumentUrl && !docData.licenseDocumentUrl.startsWith('data:stored/')
                  ? docData.licenseDocumentUrl
                  : null);

              if (!identitySrc && !licenseSrc) {
                return (
                  <div className="col-span-2 text-center py-6 text-muted-foreground">
                    <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-xs">لم يتم رفع مستندات بعد</p>
                  </div>
                );
              }

              return (
                <>
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-muted-foreground font-medium">الهوية الوطنية</p>
                    {identitySrc ? (
                      <div
                        className="relative rounded-xl overflow-hidden border border-border/50 aspect-[4/3] cursor-pointer group"
                        onClick={() => setLightboxImage({ src: identitySrc, alt: 'الهوية الوطنية' })}
                      >
                        <img src={identitySrc} alt="الهوية الوطنية" className="w-full h-full object-contain bg-muted/20" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
                          <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-all duration-200" />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-dashed border-border/40 aspect-[4/3] flex items-center justify-center">
                        <p className="text-[10px] text-muted-foreground">لم يتم الرفع</p>
                      </div>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[11px] text-muted-foreground font-medium">مزاولة المهنة</p>
                    {licenseSrc ? (
                      <div
                        className="relative rounded-xl overflow-hidden border border-border/50 aspect-[4/3] cursor-pointer group"
                        onClick={() => setLightboxImage({ src: licenseSrc, alt: 'مزاولة المهنة' })}
                      >
                        <img src={licenseSrc} alt="مزاولة المهنة" className="w-full h-full object-contain bg-muted/20" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-200 flex items-center justify-center">
                          <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-all duration-200" />
                        </div>
                      </div>
                    ) : (
                      <div className="rounded-xl border-2 border-dashed border-border/40 aspect-[4/3] flex items-center justify-center">
                        <p className="text-[10px] text-muted-foreground">لم يتم الرفع</p>
                      </div>
                    )}
                  </div>
                </>
              );
            })()}
          </div>
        )}
      </div>

      {/* Registration Date */}
      <div className="pt-2 border-t border-border/30">
        <p className="text-xs text-muted-foreground">
          تاريخ التسجيل: <DateFormatter date={nurse.createdAt} format="date" />
        </p>
      </div>
    </div>
  );

  // ─── Render ──────────────────────────────────────────────────
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* ═══ Image Lightbox ═══ */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setLightboxImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute -top-3 -left-3 w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-xl z-10 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={lightboxImage.src}
                alt={lightboxImage.alt}
                className="w-full h-full object-contain rounded-2xl shadow-2xl"
              />
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm text-white text-sm px-4 py-2 rounded-full">
                {lightboxImage.alt}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══ Page Header ═══ */}
      <motion.div variants={itemAnim}>
        <div className="relative overflow-hidden rounded-2xl border border-nurse/20 bg-gradient-to-l from-nurse/8 via-nurse/4 to-transparent p-5">
          <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-nurse/8 blur-xl" />
          <div className="absolute -bottom-4 left-1/3 w-16 h-16 rounded-full bg-nurse/5 blur-lg" />
          <div className="relative flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-nurse/25 to-nurse/10 flex items-center justify-center border border-nurse/25 shadow-sm shadow-nurse/20">
                <Stethoscope className="w-6 h-6 text-nurse" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h1 className="text-xl font-black text-foreground">إدارة الممرضين</h1>
                  {nurseStats.pending > 0 && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/25">
                      {nurseStats.pending} قيد المراجعة
                    </span>
                  )}
                </div>
                <p className="text-muted-foreground text-xs">إدارة الممرضين وطلبات السحب والتوثيق</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-nurse/10 border border-nurse/20 rounded-xl px-3 py-1.5">
                <Users className="w-3.5 h-3.5 text-nurse" />
                <span className="text-xs font-bold text-nurse">{nurseStats.total} ممرض</span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{nurseStats.verified} موثق</span>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ Tabs ═══ */}
      <motion.div variants={itemAnim}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="w-full grid grid-cols-2 h-12">
            <TabsTrigger value="nurses" className="gap-2 text-sm">
              <Stethoscope className="w-4 h-4" />
              الممرضون
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="gap-2 relative text-sm">
              <Wallet className="w-4 h-4" />
              طلبات السحب
              {pendingCount > 0 && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -top-2 -left-2 min-w-[20px] h-5 px-1 flex items-center justify-center text-[10px] bg-red-500 text-white rounded-full font-bold"
                >
                  {pendingCount}
                </motion.span>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ═══════════════════════════════════════════════════════
              NURSES TAB
              ═══════════════════════════════════════════════════════ */}
          <TabsContent value="nurses" className="space-y-5">
            {/* ─── Stats Cards ─── */}
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-2 md:grid-cols-4 gap-3"
            >
              <motion.div variants={statCardVariants}>
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 p-4 text-white shadow-lg shadow-sky-500/20">
                  <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8" />
                  <Users className="w-8 h-8 mb-2 opacity-80" />
                  <p className="text-2xl font-bold">{nurseStats.total}</p>
                  <p className="text-xs text-sky-100">إجمالي الممرضين</p>
                </div>
              </motion.div>
              <motion.div variants={statCardVariants}>
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-white shadow-lg shadow-emerald-500/20">
                  <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8" />
                  <ShieldCheck className="w-8 h-8 mb-2 opacity-80" />
                  <p className="text-2xl font-bold">{nurseStats.verified}</p>
                  <p className="text-xs text-emerald-100">موثقون</p>
                </div>
              </motion.div>
              <motion.div variants={statCardVariants}>
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 p-4 text-white shadow-lg shadow-amber-500/20">
                  <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8" />
                  <Shield className="w-8 h-8 mb-2 opacity-80" />
                  <p className="text-2xl font-bold">{nurseStats.pending}</p>
                  <p className="text-xs text-amber-100">قيد المراجعة</p>
                </div>
              </motion.div>
              <motion.div variants={statCardVariants}>
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-teal-500 to-teal-700 p-4 text-white shadow-lg shadow-teal-500/20">
                  <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8" />
                  <Activity className="w-8 h-8 mb-2 opacity-80" />
                  <p className="text-2xl font-bold">{nurseStats.active}</p>
                  <p className="text-xs text-teal-100">نشطون</p>
                </div>
              </motion.div>
            </motion.div>

            {/* ─── Search & Filters ─── */}
            <GlassCard variant="admin" className="backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row gap-3">
                <SearchInput placeholder="بحث بالاسم أو الهاتف..." onChange={setSearch} className="flex-1" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="active">نشط</SelectItem>
                    <SelectItem value="inactive">غير نشط</SelectItem>
                    <SelectItem value="pending">قيد المراجعة</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={specFilter} onValueChange={setSpecFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="التخصص" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع التخصصات</SelectItem>
                    {Object.entries(SPECIALIZATION_LABELS).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={() => void fetchNurses()}
                  className="shrink-0"
                >
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </GlassCard>

            {/* ─── Nurses Cards Grid ─── */}
            {isLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">جاري تحميل الممرضين...</p>
                </div>
              </div>
            ) : nurses.length === 0 ? (
              <GlassCard variant="admin" className="p-8">
                <EmptyState
                  icon={<Stethoscope className="w-10 h-10 text-muted-foreground" />}
                  title="لا يوجد ممرضون"
                  description="لم يتم العثور على ممرضين مطابقين لمعايير البحث"
                  action={{ label: 'تحديث', onClick: () => void fetchNurses() }}
                />
              </GlassCard>
            ) : (
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="grid grid-cols-1 md:grid-cols-2 gap-4"
              >
                {nurses.map((nurse) => (
                  <motion.div
                    key={nurse.id}
                    variants={itemAnim}
                    whileHover={cardHover}
                    className="group relative rounded-2xl border border-border/50 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-xl transition-shadow duration-300 overflow-hidden"
                  >
                    {/* Gradient accent top bar */}
                    <div
                      className={cn(
                        'h-1.5 w-full',
                        nurse.isBlocked
                          ? 'bg-gradient-to-l from-red-500 to-red-400'
                          : nurse.verificationStatus === 'verified'
                            ? 'bg-gradient-to-l from-emerald-500 to-emerald-400'
                            : nurse.verificationStatus === 'pending'
                              ? 'bg-gradient-to-l from-amber-500 to-amber-400'
                              : 'bg-gradient-to-l from-sky-500 to-sky-400'
                      )}
                    />

                    <div className="p-4">
                      {/* Card Header: Avatar + Info + Status */}
                      <div className="flex items-start gap-3">
                        <div className="relative shrink-0">
                          <Avatar className="w-14 h-14 ring-2 ring-offset-2 ring-offset-card group-hover:ring-primary/30 transition-all">
                            <AvatarFallback className="bg-gradient-to-br from-sky-400 to-sky-600 text-white text-lg font-bold">
                              {nurse.name.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          {/* Online indicator */}
                          <div
                            className={cn(
                              'absolute -bottom-0.5 -left-0.5 w-4 h-4 rounded-full ring-2 ring-card',
                              nurse.isActive && !nurse.isBlocked ? 'bg-green-500' : 'bg-gray-400'
                            )}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-bold text-base truncate flex items-center gap-1">{nurse.name}{nurse.verificationStatus === 'verified' && <VerifiedBadge size="sm" />}</h3>
                            {nurse.isBlocked && (
                              <Badge variant="destructive" className="text-[9px] h-4 px-1.5 shrink-0">
                                <Ban className="w-2.5 h-2.5 ml-0.5" />محظور
                              </Badge>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                            <Phone className="w-3 h-3" />
                            <span dir="ltr">{nurse.phone}</span>
                          </div>
                          {nurse.governorate && (
                            <div className="flex items-center gap-1.5 mt-0.5 text-xs text-muted-foreground">
                              <MapPin className="w-3 h-3" />
                              <span>{nurse.governorate}</span>
                            </div>
                          )}
                        </div>

                        {/* Verification Badge */}
                        <div className="shrink-0">
                          <BadgeStatus status={nurse.verificationStatus} size="sm" />
                        </div>
                      </div>

                      {/* Specialization Badges */}
                      <div className="flex flex-wrap gap-1.5 mt-3">
                        {(nurse.specialization || []).slice(0, 3).map((s) => (
                          <Badge
                            key={s}
                            variant="outline"
                            className="text-[10px] h-5 px-2 bg-muted/40 border-border/40"
                          >
                            {SPECIALIZATION_LABELS[s] ?? s}
                          </Badge>
                        ))}
                        {(nurse.specialization || []).length > 3 && (
                          <Badge variant="outline" className="text-[10px] h-5 px-2 bg-muted/40">
                            +{nurse.specialization.length - 3}
                          </Badge>
                        )}
                      </div>

                      {/* Stats Row */}
                      <div className="flex items-center gap-4 mt-3 pt-3 border-t border-border/30">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          <span className="text-sm font-semibold">{nurse.rating.toFixed(1)}</span>
                          <span className="text-[10px] text-muted-foreground">({nurse.reviewCount})</span>
                        </div>
                        <Separator orientation="vertical" className="h-4" />
                        <div className="text-[11px] text-muted-foreground">
                          {nurse.completedJobs} وظيفة
                        </div>
                        <Separator orientation="vertical" className="h-4" />
                        <div className="text-[11px] text-muted-foreground">
                          {nurse.experience} سنة خبرة
                        </div>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center gap-1.5 mt-3 pt-3 border-t border-border/30">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1 text-xs"
                          onClick={() => handleViewNurse(nurse)}
                        >
                          <Eye className="w-3.5 h-3.5" />
                          عرض
                        </Button>
                        {nurse.verificationStatus !== 'verified' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
                            onClick={() => {
                              setVerifyTarget(nurse);
                              setVerifyAction('verify');
                            }}
                          >
                            <ShieldCheck className="w-3.5 h-3.5" />
                            توثيق
                          </Button>
                        )}
                        {nurse.verificationStatus !== 'rejected' && nurse.verificationStatus !== 'verified' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={() => {
                              setVerifyTarget(nurse);
                              setVerifyAction('reject');
                            }}
                          >
                            <X className="w-3.5 h-3.5" />
                            رفض
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'h-8 gap-1 text-xs',
                            nurse.isActive
                              ? 'text-amber-600 hover:text-amber-700 hover:bg-amber-50 dark:hover:bg-amber-950/20'
                              : 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20'
                          )}
                          onClick={() => setToggleTarget(nurse)}
                        >
                          {nurse.isActive ? (
                            <><PowerOff className="w-3.5 h-3.5" />تعطيل</>
                          ) : (
                            <><Power className="w-3.5 h-3.5" />تفعيل</>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className={cn(
                            'h-8 gap-1 text-xs',
                            nurse.isBlocked
                              ? 'text-green-600 hover:text-green-700 hover:bg-green-50 dark:hover:bg-green-950/20'
                              : 'text-orange-600 hover:text-orange-700 hover:bg-orange-50 dark:hover:bg-orange-950/20'
                          )}
                          onClick={() => setBlockTarget(nurse)}
                        >
                          <Ban className="w-3.5 h-3.5" />
                          {nurse.isBlocked ? 'فك الحظر' : 'حظر'}
                        </Button>
                        {!isSubadmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 gap-1 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20"
                            onClick={() => setDeleteTarget(nurse)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            حذف
                          </Button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                ))}
              </motion.div>
            )}

            {/* Nurses Pagination */}
            {totalPages > 1 && !isLoading && nurses.length > 0 && (
              <div className="flex items-center justify-center gap-3 pt-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page <= 1}
                  onClick={() => setPage(p => p - 1)}
                  className="gap-1"
                >
                  <ChevronRight className="w-4 h-4" />
                  السابق
                </Button>
                <span className="text-sm text-muted-foreground font-medium">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                  className="gap-1"
                >
                  التالي
                  <ChevronLeft className="w-4 h-4" />
                </Button>
              </div>
            )}
          </TabsContent>

          {/* ═══════════════════════════════════════════════════════
              WITHDRAWALS TAB
              ═══════════════════════════════════════════════════════ */}
          <TabsContent value="withdrawals" className="space-y-5">
            {/* ─── Withdrawal Stats Cards ─── */}
            <motion.div
              variants={container}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 sm:grid-cols-3 gap-3"
            >
              <motion.div variants={statCardVariants}>
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 p-4 text-white shadow-lg shadow-amber-500/20">
                  <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8" />
                  <Clock className="w-8 h-8 mb-2 opacity-80" />
                  <p className="text-2xl font-bold"><Currency amount={withdrawalStats.pendingAmount} /></p>
                  <p className="text-xs text-amber-100">مبالغ قيد الانتظار ({withdrawalStats.pendingCount} طلب)</p>
                </div>
              </motion.div>
              <motion.div variants={statCardVariants}>
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-white shadow-lg shadow-emerald-500/20">
                  <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8" />
                  <TrendingUp className="w-8 h-8 mb-2 opacity-80" />
                  <p className="text-2xl font-bold"><Currency amount={withdrawalStats.processedAmount} /></p>
                  <p className="text-xs text-emerald-100">إجمالي التحويلات</p>
                </div>
              </motion.div>
              <motion.div variants={statCardVariants}>
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-sky-500 to-sky-700 p-4 text-white shadow-lg shadow-sky-500/20">
                  <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8" />
                  <Banknote className="w-8 h-8 mb-2 opacity-80" />
                  <p className="text-2xl font-bold">{withdrawals.length}</p>
                  <p className="text-xs text-sky-100">إجمالي الطلبات</p>
                </div>
              </motion.div>
            </motion.div>

            {/* ─── Withdrawal Filters ─── */}
            <GlassCard variant="admin" className="backdrop-blur-xl">
              <div className="flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="بحث بالاسم أو رقم المحفظة..."
                    value={withdrawalSearch}
                    onChange={(e) => setWithdrawalSearch(e.target.value)}
                    className="pr-10"
                  />
                </div>
                <Select value={withdrawalStatusFilter} onValueChange={setWithdrawalStatusFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">جميع الحالات</SelectItem>
                    <SelectItem value="pending">قيد المراجعة</SelectItem>
                    <SelectItem value="approved">تمت الموافقة</SelectItem>
                    <SelectItem value="processed">تم التحويل</SelectItem>
                    <SelectItem value="rejected">مرفوض</SelectItem>
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => void fetchWithdrawals()} className="shrink-0">
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </GlassCard>

            {/* ─── Withdrawal Cards ─── */}
            {withdrawalsLoading ? (
              <div className="flex items-center justify-center py-16">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-10 h-10 animate-spin text-primary" />
                  <p className="text-sm text-muted-foreground">جاري تحميل طلبات السحب...</p>
                </div>
              </div>
            ) : withdrawals.length === 0 ? (
              <GlassCard variant="admin" className="p-8">
                <EmptyState
                  icon={<ArrowDownToLine className="w-10 h-10 text-muted-foreground" />}
                  title="لا توجد طلبات سحب"
                  description="ستظهر طلبات السحب هنا عندما يطلب الممرضون سحب أرباحهم"
                />
              </GlassCard>
            ) : (
              <motion.div
                variants={container}
                initial="hidden"
                animate="show"
                className="space-y-3"
              >
                {withdrawals.map((w) => (
                  <motion.div
                    key={w.id}
                    variants={itemAnim}
                    whileHover={{ scale: 1.005 }}
                    className={cn(
                      'relative rounded-2xl border p-4 transition-all duration-300 overflow-hidden',
                      w.status === 'pending'
                        ? 'border-amber-300/60 dark:border-amber-800/60 bg-gradient-to-l from-amber-50/80 to-amber-50/30 dark:from-amber-950/20 dark:to-amber-950/5 shadow-sm hover:shadow-md'
                        : 'border-border/50 bg-card/80 backdrop-blur-sm shadow-sm hover:shadow-md'
                    )}
                  >
                    {/* Pending pulsing glow */}
                    {w.status === 'pending' && (
                      <div className="absolute top-0 right-0 w-3 h-3 m-3">
                        <span className="absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75 animate-ping" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500" />
                      </div>
                    )}

                    {/* Card Header */}
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          'w-12 h-12 rounded-xl flex items-center justify-center shrink-0',
                          w.status === 'pending' ? 'bg-amber-100 dark:bg-amber-900/30' :
                          w.status === 'processed' ? 'bg-green-100 dark:bg-green-900/30' :
                          w.status === 'approved' ? 'bg-blue-100 dark:bg-blue-900/30' :
                          'bg-red-100 dark:bg-red-900/30'
                        )}>
                          <Wallet className={cn(
                            'w-6 h-6',
                            w.status === 'pending' ? 'text-amber-600' :
                            w.status === 'processed' ? 'text-green-600' :
                            w.status === 'approved' ? 'text-blue-600' :
                            'text-red-600'
                          )} />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{w.nurseName}</p>
                          <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">{w.nursePhone}</p>
                        </div>
                      </div>
                      <Badge className={cn('text-[10px] shrink-0', wStatusColors[w.status] || '')} variant="outline">
                        {wStatusLabels[w.status] || w.status}
                      </Badge>
                    </div>

                    {/* Amount Grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3">
                      <div className="rounded-xl bg-muted/30 backdrop-blur-sm p-2.5">
                        <p className="text-[10px] text-muted-foreground">مبلغ السحب</p>
                        <p className="text-sm font-bold mt-0.5"><Currency amount={w.amount} /></p>
                      </div>
                      <div className="rounded-xl bg-muted/30 backdrop-blur-sm p-2.5">
                        <p className="text-[10px] text-muted-foreground">رسوم السحب</p>
                        <p className="text-sm font-bold text-red-600 mt-0.5">-<Currency amount={w.withdrawalFee} /></p>
                      </div>
                      <div className="rounded-xl bg-muted/30 backdrop-blur-sm p-2.5">
                        <p className="text-[10px] text-muted-foreground">صافي التحويل</p>
                        <p className="text-sm font-bold text-green-600 mt-0.5"><Currency amount={w.netAmount} /></p>
                      </div>
                      <div className="rounded-xl bg-muted/30 backdrop-blur-sm p-2.5">
                        <p className="text-[10px] text-muted-foreground">تاريخ الطلب</p>
                        <p className="text-sm font-medium mt-0.5"><DateFormatter date={w.createdAt} format="date" /></p>
                      </div>
                    </div>

                    {/* Wallet Details Mini-Card */}
                    <div className="mt-3 p-3 rounded-xl bg-muted/20 backdrop-blur-sm border border-border/30">
                      <div className="flex items-center gap-1.5 mb-2">
                        <Send className="w-3.5 h-3.5 text-muted-foreground" />
                        <p className="text-[11px] font-medium text-muted-foreground">تفاصيل المحفظة</p>
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        <div className="rounded-lg bg-background/50 p-2">
                          <p className="text-[9px] text-muted-foreground">النوع</p>
                          <p className="text-xs font-semibold mt-0.5">{w.walletType}</p>
                        </div>
                        <div className="rounded-lg bg-background/50 p-2">
                          <p className="text-[9px] text-muted-foreground">الرقم</p>
                          <p className="text-xs font-semibold mt-0.5 font-mono" dir="ltr">{w.walletNumber}</p>
                        </div>
                        <div className="rounded-lg bg-background/50 p-2">
                          <p className="text-[9px] text-muted-foreground">الاسم</p>
                          <p className="text-xs font-semibold mt-0.5 truncate">{w.walletHolderName}</p>
                        </div>
                      </div>
                    </div>

                    {/* Rejected Reason */}
                    {w.status === 'rejected' && w.rejectedReason && (
                      <div className="mt-3 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/60">
                        <div className="flex items-start gap-1.5">
                          <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
                          <p className="text-[11px] text-red-600 dark:text-red-400">سبب الرفض: {w.rejectedReason}</p>
                        </div>
                      </div>
                    )}

                    {/* Processed Notice */}
                    {w.status === 'processed' && (
                      <div className="mt-3 p-2.5 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200/60 dark:border-green-800/60">
                        <div className="flex items-start gap-1.5">
                          <CheckCircle2 className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                          <p className="text-[11px] text-green-700 dark:text-green-400">
                            تم تحويل الأموال إلى محفظة {w.walletType} باسم {w.walletHolderName} رقم {w.walletNumber}
                            {w.processedAt && ` في ${new Date(w.processedAt).toLocaleDateString('ar')}`}
                          </p>
                        </div>
                      </div>
                    )}

                    {/* Actions for Pending */}
                    {w.status === 'pending' && (
                      <div className="mt-3 pt-3 border-t border-border/30 flex items-center gap-2">
                        <Button
                          size="sm"
                          className="bg-gradient-to-l from-green-600 to-green-500 hover:from-green-700 hover:to-green-600 gap-1.5 flex-1 text-white shadow-md shadow-green-500/20"
                          onClick={() => {
                            setWithdrawalAction(w);
                            setWithdrawalActionType('approve');
                          }}
                        >
                          <Wallet className="w-4 h-4" />
                          تحويل الأموال
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="gap-1.5 flex-1 border-red-300 text-red-600 hover:bg-red-50 hover:text-red-700 dark:border-red-800 dark:hover:bg-red-950/20 dark:hover:text-red-400"
                          onClick={() => {
                            setWithdrawalAction(w);
                            setWithdrawalActionType('reject');
                          }}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          رفض
                        </Button>
                      </div>
                    )}
                  </motion.div>
                ))}

                {/* Withdrawal Pagination */}
                {withdrawalTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-3 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={withdrawalPage <= 1}
                      onClick={() => setWithdrawalPage(p => p - 1)}
                      className="gap-1"
                    >
                      <ChevronRight className="w-4 h-4" />
                      السابق
                    </Button>
                    <span className="text-sm text-muted-foreground font-medium">
                      {withdrawalPage} / {withdrawalTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={withdrawalPage >= withdrawalTotalPages}
                      onClick={() => setWithdrawalPage(p => p + 1)}
                      className="gap-1"
                    >
                      التالي
                      <ChevronLeft className="w-4 h-4" />
                    </Button>
                  </div>
                )}
              </motion.div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* ═══ View Drawer/Dialog ═══ */}
      {viewTarget && (
        isMobile ? (
          <Drawer open={!!viewTarget} onOpenChange={(open) => { if (!open) { setViewTarget(null); setDocData(null); } }}>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle className="flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-primary" />
                  تفاصيل الممرض/ـة
                </DrawerTitle>
              </DrawerHeader>
              {viewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <ViewContent nurse={viewTarget} />
              )}
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) { setViewTarget(null); setDocData(null); } }}>
            <DialogContent dir="rtl" className="max-w-lg">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Stethoscope className="w-5 h-5 text-primary" />
                  تفاصيل الممرض/ـة
                </DialogTitle>
              </DialogHeader>
              {viewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
              ) : (
                <ViewContent nurse={viewTarget} />
              )}
            </DialogContent>
          </Dialog>
        )
      )}

      {/* ═══ Verify/Reject Dialog ═══ */}
      <Dialog open={!!verifyTarget} onOpenChange={(open) => { if (!open) { setVerifyTarget(null); setRejectedReason(''); } }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {verifyAction === 'verify' ? (
                <><ShieldCheck className="w-5 h-5 text-emerald-600" />توثيق الممرض/ـة</>
              ) : (
                <><XCircle className="w-5 h-5 text-red-600" />رفض توثيق الممرض/ـة</>
              )}
            </DialogTitle>
            <DialogDescription>
              {verifyAction === 'verify'
                ? `هل أنت متأكد من توثيق "${verifyTarget?.name ?? ''}"؟`
                : `يرجى إدخال سبب رفض توثيق "${verifyTarget?.name ?? ''}"`}
            </DialogDescription>
          </DialogHeader>
          {verifyAction === 'reject' && (
            <div className="py-2">
              <Label>سبب الرفض *</Label>
              <Textarea
                value={rejectedReason}
                onChange={(e) => setRejectedReason(e.target.value)}
                placeholder="أدخل سبب الرفض..."
                rows={3}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyTarget(null)} disabled={isVerifying}>
              إلغاء
            </Button>
            <Button
              onClick={handleVerify}
              disabled={isVerifying || (verifyAction === 'reject' && !rejectedReason)}
              className={verifyAction === 'reject' ? 'bg-destructive hover:bg-destructive/90' : 'bg-emerald-600 hover:bg-emerald-700'}
            >
              {isVerifying ? 'جارٍ التنفيذ...' : verifyAction === 'verify' ? 'توثيق' : 'رفض'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Toggle Confirm ═══ */}
      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(open) => { if (!open) setToggleTarget(null); }}
        title={toggleTarget?.isActive ? 'تعطيل الممرض/ـة' : 'تفعيل الممرض/ـة'}
        description={`هل أنت متأكد من ${toggleTarget?.isActive ? 'تعطيل' : 'تفعيل'} "${toggleTarget?.name ?? ''}"؟`}
        confirmLabel={toggleTarget?.isActive ? 'تعطيل' : 'تفعيل'}
        variant={toggleTarget?.isActive ? 'warning' : 'info'}
        onConfirm={handleToggle}
      />

      {/* ═══ Block Dialog ═══ */}
      <Dialog open={!!blockTarget} onOpenChange={(open) => { if (!open) { setBlockTarget(null); setBlockReason(''); } }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-orange-600" />
              {blockTarget?.isBlocked ? 'إلغاء حظر الممرض/ـة' : 'حظر الممرض/ـة'}
            </DialogTitle>
            <DialogDescription>
              {blockTarget?.isBlocked
                ? `سيتم إلغاء حظر "${blockTarget?.name ?? ''}" وسيتمكن من استخدام المنصة مرة أخرى`
                : `سيتم حظر "${blockTarget?.name ?? ''}" ولن يتمكن من تسجيل الدخول أو استخدام المنصة`}
            </DialogDescription>
          </DialogHeader>
          {!blockTarget?.isBlocked && (
            <div className="py-2">
              <Label>سبب الحظر</Label>
              <Textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="أدخل سبب الحظر..."
                rows={3}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBlockTarget(null); setBlockReason(''); }} disabled={isBlocking}>
              إلغاء
            </Button>
            <Button
              onClick={handleBlock}
              disabled={isBlocking}
              className={blockTarget?.isBlocked ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}
            >
              {isBlocking ? 'جارٍ التنفيذ...' : blockTarget?.isBlocked ? 'إلغاء الحظر' : 'حظر'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Delete Dialog ═══ */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmName(''); } }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              حذف الممرض نهائياً
            </DialogTitle>
            <DialogDescription>
              هذا الإجراء لا يمكن التراجع عنه! سيتم حذف &quot;{deleteTarget?.name ?? ''}&quot; نهائياً.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200/60 dark:border-red-800/60">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-400">
                  تحذير: سيتم حذف جميع البيانات نهائياً. لا يمكن استعادة البيانات بعد الحذف.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>اكتب الاسم للتأكيد: <strong>{deleteTarget?.name}</strong></Label>
              <Input
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={deleteTarget?.name}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirmName(''); }} disabled={isDeleting}>
              إلغاء
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting || deleteConfirmName !== deleteTarget?.name}
              variant="destructive"
            >
              {isDeleting ? 'جارٍ الحذف...' : 'حذف نهائياً'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══ Withdrawal Action Dialog ═══ */}
      <Dialog
        open={!!withdrawalAction}
        onOpenChange={(open) => {
          if (!open) {
            setWithdrawalAction(null);
            setWithdrawalAdminNotes('');
            setWithdrawalRejectReason('');
          }
        }}
      >
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {withdrawalActionType === 'approve' ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                  تحويل الأموال
                </>
              ) : (
                <>
                  <XCircle className="w-5 h-5 text-red-600" />
                  رفض طلب السحب
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {withdrawalActionType === 'approve'
                ? `سيتم تحويل المبلغ إلى محفظة ${withdrawalAction?.walletType} باسم ${withdrawalAction?.walletHolderName}`
                : `سيتم رفض طلب السحب وإرجاع المبلغ إلى رصيد الممرض`}
            </DialogDescription>
          </DialogHeader>

          {/* Withdrawal Details Summary */}
          {withdrawalAction && (
            <div className="p-3 rounded-xl bg-muted/30 border border-border/30 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">الممرض</span>
                <span className="font-medium">{withdrawalAction.nurseName}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">مبلغ السحب</span>
                <span className="font-medium"><Currency amount={withdrawalAction.amount} /></span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">رسوم السحب</span>
                <span className="text-red-600">-<Currency amount={withdrawalAction.withdrawalFee} /></span>
              </div>
              <Separator />
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>صافي التحويل</span>
                <span className="text-green-600"><Currency amount={withdrawalAction.netAmount} /></span>
              </div>
              <Separator />
              <div className="text-xs space-y-1 pt-1">
                <p><span className="text-muted-foreground">المحفظة:</span> {withdrawalAction.walletType}</p>
                <p><span className="text-muted-foreground">الرقم:</span> <span dir="ltr">{withdrawalAction.walletNumber}</span></p>
                <p><span className="text-muted-foreground">الاسم:</span> {withdrawalAction.walletHolderName}</p>
              </div>
            </div>
          )}

          {withdrawalActionType === 'reject' && (
            <div className="space-y-2">
              <Label>سبب الرفض *</Label>
              <Textarea
                value={withdrawalRejectReason}
                onChange={(e) => setWithdrawalRejectReason(e.target.value)}
                placeholder="أدخل سبب رفض طلب السحب..."
                rows={3}
              />
            </div>
          )}

          {withdrawalActionType === 'approve' && (
            <div className="space-y-2">
              <Label>ملاحظات (اختياري)</Label>
              <Textarea
                value={withdrawalAdminNotes}
                onChange={(e) => setWithdrawalAdminNotes(e.target.value)}
                placeholder="ملاحظات إضافية..."
                rows={2}
              />
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setWithdrawalAction(null);
                setWithdrawalAdminNotes('');
                setWithdrawalRejectReason('');
              }}
              disabled={withdrawalActionLoading}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleWithdrawalAction}
              disabled={withdrawalActionLoading || (withdrawalActionType === 'reject' && !withdrawalRejectReason)}
              className={withdrawalActionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-destructive hover:bg-destructive/90'}
            >
              {withdrawalActionLoading
                ? 'جارٍ التنفيذ...'
                : withdrawalActionType === 'approve'
                  ? 'تأكيد التحويل'
                  : 'رفض الطلب'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
