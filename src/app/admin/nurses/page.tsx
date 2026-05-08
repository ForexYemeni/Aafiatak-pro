'use client';

import { useEffect, useState, useCallback } from 'react';
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
} from 'lucide-react';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
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
import type { ColumnDef } from '@tanstack/react-table';

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

const specializationLabels: Record<string, string> = {
  general_nursing: 'تمريض عام',
  critical_care: 'رعاية حرجة',
  pediatric: 'طب الأطفال',
  elderly_care: 'رعاية المسنين',
  physiotherapy: 'علاج طبيعي',
  wound_care: 'علاج الجروح',
  iv_therapy: 'العلاج الوريدي',
  mental_health: 'صحة نفسية',
  post_surgery: 'ما بعد الجراحة',
  emergency: 'طوارئ',
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

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
  const [docData, setDocData] = useState<{ identityDocumentData: string | null; licenseDocumentData: string | null; identityDocumentUrl: string | null; licenseDocumentUrl: string | null } | null>(null);

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

  // Withdrawal detail dialog
  const [withdrawalDetail, setWithdrawalDetail] = useState<WithdrawalItem | null>(null);

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
      const res = await authFetch(`/api/admin/nurses/${deleteTarget.id}`, {
        method: 'DELETE',
      });
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

  // Handle withdrawal approve/reject
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
        toast.success(withdrawalActionType === 'approve' ? 'تم تحويل الأموال للممرض بنجاح' : 'تم رفض طلب السحب وإرجاع المبلغ');
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

  const columns: ColumnDef<NurseItem, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'الاسم',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 text-xs">
              {row.original.name.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <div className="flex items-center gap-1.5">
              <p className="font-medium text-sm">{row.original.name}</p>
              {row.original.isBlocked && <Ban className="w-3 h-3 text-red-500" />}
            </div>
            <p className="text-xs text-muted-foreground">{row.original.phone}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'specialization',
      header: 'التخصص',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {(row.original.specialization || []).slice(0, 2).map((s) => (
            <Badge key={s} variant="outline" className="text-[10px] h-5">
              {specializationLabels[s] ?? s}
            </Badge>
          ))}
          {(row.original.specialization || []).length > 2 && (
            <Badge variant="outline" className="text-[10px] h-5">+{(row.original.specialization || []).length - 2}</Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'verificationStatus',
      header: 'حالة التوثيق',
      cell: ({ row }) => <BadgeStatus status={row.original.verificationStatus} />,
    },
    {
      accessorKey: 'rating',
      header: 'التقييم',
      cell: ({ row }) => (
        <div className="flex items-center gap-1">
          <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
          <span className="text-sm">{row.original.rating.toFixed(1)}</span>
          <span className="text-xs text-muted-foreground">({row.original.reviewCount})</span>
        </div>
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'الحالة',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <BadgeStatus status={row.original.isActive ? 'active' : 'inactive'} />
          {row.original.isBlocked && (
            <Badge variant="destructive" className="text-[9px] h-4 px-1">محظور</Badge>
          )}
        </div>
      ),
    },
  ];

  const user = useAuthStore((s) => s.user);
  const isSubadmin = user?.role === 'subadmin';

  const rowActions = [
    {
      label: 'عرض التفاصيل',
      icon: <Eye className="w-4 h-4" />,
      onClick: (row: Record<string, unknown>) => handleViewNurse(row as unknown as NurseItem),
    },
    {
      label: 'توثيق',
      icon: <ShieldCheck className="w-4 h-4" />,
      onClick: (row: Record<string, unknown>) => {
        setVerifyTarget(row as unknown as NurseItem);
        setVerifyAction('verify');
      },
    },
    {
      label: 'رفض التوثيق',
      icon: <X className="w-4 h-4" />,
      onClick: (row: Record<string, unknown>) => {
        setVerifyTarget(row as unknown as NurseItem);
        setVerifyAction('reject');
      },
      variant: 'destructive' as const,
    },
    {
      label: (row: Record<string, unknown>) => ((row as unknown as NurseItem).isActive ? 'تعطيل' : 'تفعيل'),
      onClick: (row: Record<string, unknown>) => setToggleTarget(row as unknown as NurseItem),
    },
    {
      label: (row: Record<string, unknown>) => ((row as unknown as NurseItem).isBlocked ? 'إلغاء الحظر' : 'حظر'),
      icon: <Ban className="w-4 h-4" />,
      onClick: (row: Record<string, unknown>) => setBlockTarget(row as unknown as NurseItem),
    },
    ...(!isSubadmin ? [{
      label: 'حذف نهائي',
      icon: <Trash2 className="w-4 h-4" />,
      onClick: (row: Record<string, unknown>) => setDeleteTarget(row as unknown as NurseItem),
      variant: 'destructive' as const,
    }] : []),
  ];

  const ViewContent = ({ nurse }: { nurse: NurseItem }) => (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-4">
        <Avatar className="w-16 h-16">
          <AvatarFallback className="bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400 text-xl">
            {nurse.name.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold">{nurse.name}</h3>
            {nurse.isBlocked && <Badge variant="destructive" className="text-[10px]"><Ban className="w-3 h-3 ml-0.5" />محظور</Badge>}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{nurse.phone}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
            <span className="text-sm">{nurse.rating.toFixed(1)} ({nurse.reviewCount} تقييم)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-muted-foreground">التخصص</p>
          <p className="text-sm font-medium">{(nurse.specialization || []).map((s) => specializationLabels[s] ?? s).join('، ') || 'غير محدد'}</p>
        </div>
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-muted-foreground">الخبرة</p>
          <p className="text-sm font-medium">{nurse.experience} سنوات</p>
        </div>
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-muted-foreground">الوظائف المكتملة</p>
          <p className="text-sm font-medium">{nurse.completedJobs}</p>
        </div>
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-muted-foreground">حالة التوثيق</p>
          <BadgeStatus status={nurse.verificationStatus} size="sm" />
        </div>
      </div>

      {(nurse.governorate || nurse.lat) && (
        <div className="glass rounded-xl p-3 space-y-2">
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
              className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800"
            >
              <MapPin className="w-3 h-3" />
              عرض على الخريطة ({Number(nurse.lat).toFixed(4)}, {Number(nurse.lng).toFixed(4)})
            </a>
          )}
        </div>
      )}
      {nurse.bio && (
        <div>
          <p className="text-xs text-muted-foreground mb-1">نبذة</p>
          <p className="text-sm">{nurse.bio}</p>
        </div>
      )}
      {nurse.rejectedReason && (
        <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-3">
          <p className="text-xs text-red-600 dark:text-red-400 mb-1">سبب الرفض</p>
          <p className="text-sm">{nurse.rejectedReason}</p>
        </div>
      )}
      {nurse.isBlocked && nurse.blockedReason && (
        <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-3">
          <p className="text-xs text-red-600 dark:text-red-400 mb-1">سبب الحظر</p>
          <p className="text-sm">{nurse.blockedReason}</p>
        </div>
      )}

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">المستندات</p>
          {!docData && !docLoading && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleLoadDocuments(nurse.id)}
              className="text-xs h-7"
            >
              <Eye className="w-3 h-3 ml-1" />
              عرض المستندات
            </Button>
          )}
        </div>

        {docLoading && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            <span className="mr-2 text-xs text-muted-foreground">جاري تحميل المستندات...</span>
          </div>
        )}

        {docData && (
          <div className="grid grid-cols-2 gap-3">
            {(() => {
              const identitySrc = docData.identityDocumentData || (docData.identityDocumentUrl && !docData.identityDocumentUrl.startsWith('data:stored/') ? docData.identityDocumentUrl : null);
              const licenseSrc = docData.licenseDocumentData || (docData.licenseDocumentUrl && !docData.licenseDocumentUrl.startsWith('data:stored/') ? docData.licenseDocumentUrl : null);

              if (!identitySrc && !licenseSrc) {
                return (
                  <div className="col-span-2 text-center py-4 text-muted-foreground">
                    <FileText className="w-6 h-6 mx-auto mb-1 opacity-30" />
                    <p className="text-xs">لم يتم رفع مستندات بعد</p>
                  </div>
                );
              }

              return (
                <>
                  {identitySrc ? (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">الهوية الوطنية</p>
                      <div
                        className="relative rounded-xl overflow-hidden border border-border aspect-[4/3] cursor-pointer group"
                        onClick={() => setLightboxImage({ src: identitySrc, alt: 'الهوية الوطنية' })}
                      >
                        <img src={identitySrc} alt="الهوية الوطنية" className="w-full h-full object-contain bg-muted/20" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                          <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-all" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">الهوية الوطنية</p>
                      <div className="rounded-xl border-2 border-dashed border-border/50 aspect-[4/3] flex items-center justify-center">
                        <p className="text-[10px] text-muted-foreground">لم يتم الرفع</p>
                      </div>
                    </div>
                  )}
                  {licenseSrc ? (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">مزاولة المهنة</p>
                      <div
                        className="relative rounded-xl overflow-hidden border border-border aspect-[4/3] cursor-pointer group"
                        onClick={() => setLightboxImage({ src: licenseSrc, alt: 'مزاولة المهنة' })}
                      >
                        <img src={licenseSrc} alt="مزاولة المهنة" className="w-full h-full object-contain bg-muted/20" />
                        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                          <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-all" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <p className="text-[10px] text-muted-foreground">مزاولة المهنة</p>
                      <div className="rounded-xl border-2 border-dashed border-border/50 aspect-[4/3] flex items-center justify-center">
                        <p className="text-[10px] text-muted-foreground">لم يتم الرفع</p>
                      </div>
                    </div>
                  )}
                </>
              );
            })()}
          </div>
        )}
      </div>

      <div className="text-xs text-muted-foreground">
        تاريخ التسجيل: <DateFormatter date={nurse.createdAt} format="date" />
      </div>
    </div>
  );

  // Withdrawal status helpers
  const wStatusLabels: Record<string, string> = {
    pending: 'قيد المراجعة',
    approved: 'تمت الموافقة',
    rejected: 'مرفوض',
    processed: 'تم التحويل',
  };

  const wStatusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-200 dark:border-yellow-800',
    approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    processed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-200 dark:border-green-800',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-200 dark:border-red-800',
  };

  // Count pending withdrawals
  const pendingCount = withdrawals.filter(w => w.status === 'pending').length;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Image Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
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
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-2 rounded-full">
                {lightboxImage.alt}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.div variants={itemAnim}>
        <PageHeader title="إدارة الممرضين" description="إدارة الممرضين وطلبات السحب" />
      </motion.div>

      {/* Tabs */}
      <motion.div variants={itemAnim}>
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="w-full grid grid-cols-2">
            <TabsTrigger value="nurses" className="gap-2">
              <Stethoscope className="w-4 h-4" />
              الممرضون
            </TabsTrigger>
            <TabsTrigger value="withdrawals" className="gap-2 relative">
              <Wallet className="w-4 h-4" />
              طلبات السحب
              {pendingCount > 0 && (
                <Badge className="absolute -top-2 -left-2 h-5 w-5 p-0 flex items-center justify-center text-[10px] bg-red-500 text-white">
                  {pendingCount}
                </Badge>
              )}
            </TabsTrigger>
          </TabsList>

          {/* ===== Nurses Tab ===== */}
          <TabsContent value="nurses" className="space-y-4">
            <GlassCard variant="admin">
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
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
                    {Object.entries(specializationLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => void fetchNurses()}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </GlassCard>

            <DataTable
              columns={columns}
              data={nurses}
              isLoading={isLoading}
              emptyMessage="لا يوجد ممرضون"
              emptyAction={{ label: 'تحديث', onClick: () => void fetchNurses() }}
              rowActions={rowActions as never}
              currentPage={page}
              pageCount={totalPages}
              onPageChange={setPage}
            />
          </TabsContent>

          {/* ===== Withdrawals Tab ===== */}
          <TabsContent value="withdrawals" className="space-y-4">
            {/* Filters */}
            <GlassCard variant="admin">
              <div className="flex flex-col sm:flex-row gap-4 mb-4">
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
                <Button variant="outline" size="icon" onClick={() => void fetchWithdrawals()}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </GlassCard>

            {/* Withdrawal Cards */}
            {withdrawalsLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-8 h-8 animate-spin text-admin" />
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
              <div className="space-y-3">
                {withdrawals.map((w) => (
                  <motion.div
                    key={w.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={`rounded-2xl border p-4 transition-all ${
                      w.status === 'pending' ? 'border-yellow-300 dark:border-yellow-800 bg-yellow-50/50 dark:bg-yellow-950/10' :
                      'border-border bg-card'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      {/* Nurse info */}
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${
                          w.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                          w.status === 'processed' ? 'bg-green-100 dark:bg-green-900/30' :
                          w.status === 'approved' ? 'bg-blue-100 dark:bg-blue-900/30' :
                          'bg-red-100 dark:bg-red-900/30'
                        }`}>
                          <Wallet className={`w-5 h-5 ${
                            w.status === 'pending' ? 'text-yellow-600' :
                            w.status === 'processed' ? 'text-green-600' :
                            w.status === 'approved' ? 'text-blue-600' :
                            'text-red-600'
                          }`} />
                        </div>
                        <div>
                          <p className="font-semibold text-sm">{w.nurseName}</p>
                          <p className="text-xs text-muted-foreground" dir="ltr">{w.nursePhone}</p>
                        </div>
                      </div>

                      {/* Status badge */}
                      <Badge className={`text-[10px] shrink-0 ${wStatusColors[w.status] || ''}`} variant="outline">
                        {wStatusLabels[w.status] || w.status}
                      </Badge>
                    </div>

                    {/* Amount & Wallet Details */}
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="rounded-xl bg-muted/30 p-2.5">
                        <p className="text-[10px] text-muted-foreground">مبلغ السحب</p>
                        <p className="text-sm font-bold"><Currency amount={w.amount} /></p>
                      </div>
                      <div className="rounded-xl bg-muted/30 p-2.5">
                        <p className="text-[10px] text-muted-foreground">رسوم السحب</p>
                        <p className="text-sm font-bold text-red-600">-<Currency amount={w.withdrawalFee} /></p>
                      </div>
                      <div className="rounded-xl bg-muted/30 p-2.5">
                        <p className="text-[10px] text-muted-foreground">صافي التحويل</p>
                        <p className="text-sm font-bold text-green-600"><Currency amount={w.netAmount} /></p>
                      </div>
                      <div className="rounded-xl bg-muted/30 p-2.5">
                        <p className="text-[10px] text-muted-foreground">تاريخ الطلب</p>
                        <p className="text-sm font-medium"><DateFormatter date={w.createdAt} format="date" /></p>
                      </div>
                    </div>

                    {/* Wallet Info */}
                    <div className="mt-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                      <p className="text-[10px] text-muted-foreground mb-1.5">تفاصيل المحفظة</p>
                      <div className="grid grid-cols-3 gap-2 text-xs">
                        <div>
                          <span className="text-muted-foreground">النوع: </span>
                          <span className="font-medium">{w.walletType}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">الرقم: </span>
                          <span className="font-medium" dir="ltr">{w.walletNumber}</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">الاسم: </span>
                          <span className="font-medium">{w.walletHolderName}</span>
                        </div>
                      </div>
                    </div>

                    {/* Rejected Reason */}
                    {w.status === 'rejected' && w.rejectedReason && (
                      <div className="mt-3 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                        <p className="text-[10px] text-red-600 dark:text-red-400">سبب الرفض: {w.rejectedReason}</p>
                      </div>
                    )}

                    {/* Processed Notice */}
                    {w.status === 'processed' && (
                      <div className="mt-3 p-2.5 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                        <p className="text-[10px] text-green-700 dark:text-green-400">
                          تم تحويل الأموال إلى محفظة {w.walletType} باسم {w.walletHolderName} رقم {w.walletNumber}
                          {w.processedAt && ` في ${new Date(w.processedAt).toLocaleDateString('ar')}`}
                        </p>
                      </div>
                    )}

                    {/* Actions for pending */}
                    {w.status === 'pending' && (
                      <div className="mt-3 flex items-center gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 gap-1.5 flex-1"
                          onClick={() => {
                            setWithdrawalAction(w);
                            setWithdrawalActionType('approve');
                          }}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          تحويل الأموال
                        </Button>
                        <Button
                          size="sm"
                          variant="destructive"
                          className="gap-1.5 flex-1"
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

                {/* Pagination */}
                {withdrawalTotalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={withdrawalPage <= 1}
                      onClick={() => setWithdrawalPage(p => p - 1)}
                    >
                      السابق
                    </Button>
                    <span className="text-sm text-muted-foreground">
                      {withdrawalPage} / {withdrawalTotalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={withdrawalPage >= withdrawalTotalPages}
                      onClick={() => setWithdrawalPage(p => p + 1)}
                    >
                      التالي
                    </Button>
                  </div>
                )}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* View Drawer/Dialog */}
      {viewTarget && (
        isMobile ? (
          <Drawer open={!!viewTarget} onOpenChange={(open) => { if (!open) { setViewTarget(null); setDocData(null); } }}>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>تفاصيل الممرض/ـة</DrawerTitle>
              </DrawerHeader>
              {viewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-admin" />
                </div>
              ) : (
                <ViewContent nurse={viewTarget} />
              )}
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) { setViewTarget(null); setDocData(null); } }}>
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader>
                <DialogTitle>تفاصيل الممرض/ـة</DialogTitle>
              </DialogHeader>
              {viewLoading ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="w-8 h-8 animate-spin text-admin" />
                </div>
              ) : (
                <ViewContent nurse={viewTarget} />
              )}
            </DialogContent>
          </Dialog>
        )
      )}

      {/* Verify/Reject Dialog */}
      <Dialog open={!!verifyTarget} onOpenChange={(open) => { if (!open) { setVerifyTarget(null); setRejectedReason(''); } }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {verifyAction === 'verify' ? 'توثيق الممرض/ـة' : 'رفض توثيق الممرض/ـة'}
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
              className={verifyAction === 'reject' ? 'bg-destructive hover:bg-destructive/90' : 'bg-admin hover:bg-admin/90'}
            >
              {isVerifying ? 'جارٍ التنفيذ...' : verifyAction === 'verify' ? 'توثيق' : 'رفض'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toggle Confirm */}
      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(open) => { if (!open) setToggleTarget(null); }}
        title={toggleTarget?.isActive ? 'تعطيل الممرض/ـة' : 'تفعيل الممرض/ـة'}
        description={`هل أنت متأكد من ${toggleTarget?.isActive ? 'تعطيل' : 'تفعيل'} "${toggleTarget?.name ?? ''}"؟`}
        confirmLabel={toggleTarget?.isActive ? 'تعطيل' : 'تفعيل'}
        variant={toggleTarget?.isActive ? 'warning' : 'info'}
        onConfirm={handleToggle}
      />

      {/* Block Dialog */}
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

      {/* Delete Dialog */}
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
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
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

      {/* Withdrawal Action Dialog */}
      <Dialog open={!!withdrawalAction} onOpenChange={(open) => {
        if (!open) {
          setWithdrawalAction(null);
          setWithdrawalAdminNotes('');
          setWithdrawalRejectReason('');
        }
      }}>
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
                : `سيتم رفض طلب السحب وإرجاع المبلغ (${withdrawalAction ? <Currency amount={withdrawalAction.amount} /> : ''}) إلى رصيد الممرض`}
            </DialogDescription>
          </DialogHeader>

          {/* Withdrawal Details Summary */}
          {withdrawalAction && (
            <div className="p-3 rounded-xl bg-muted/30 border border-border/50 space-y-2">
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
              <div className="flex items-center justify-between text-sm font-semibold">
                <span>صافي التحويل</span>
                <span className="text-green-600"><Currency amount={withdrawalAction.netAmount} /></span>
              </div>
              <Separator />
              <div className="text-xs space-y-1">
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
            <Button variant="outline" onClick={() => { setWithdrawalAction(null); setWithdrawalAdminNotes(''); setWithdrawalRejectReason(''); }} disabled={withdrawalActionLoading}>
              إلغاء
            </Button>
            <Button
              onClick={handleWithdrawalAction}
              disabled={withdrawalActionLoading || (withdrawalActionType === 'reject' && !withdrawalRejectReason)}
              className={withdrawalActionType === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-destructive hover:bg-destructive/90'}
            >
              {withdrawalActionLoading ? 'جارٍ التنفيذ...' : withdrawalActionType === 'approve' ? 'تأكيد التحويل' : 'رفض الطلب'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
