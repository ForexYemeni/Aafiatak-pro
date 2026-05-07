'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Stethoscope,
  Eye,
  ShieldCheck,
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Phone,
  Star,
  MapPin,
} from 'lucide-react';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { SearchInput } from '@/components/common/search-input';
import { BadgeStatus } from '@/components/common/badge-status';
import { EmptyState } from '@/components/common/empty-state';
import { DateFormatter } from '@/components/common/date-formatter';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
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
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import type { ColumnDef } from '@tanstack/react-table';

interface NurseItem {
  id: string;
  name: string;
  phone: string;
  specialization: string;
  verificationStatus: string;
  isActive: boolean;
  isAvailable: boolean;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  governorate: string | null;
  experience: number;
  bio: string | null;
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

  // View drawer
  const [viewTarget, setViewTarget] = useState<NurseItem | null>(null);

  // Toggle confirm
  const [toggleTarget, setToggleTarget] = useState<NurseItem | null>(null);

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
        setNurses(json.data as NurseItem[]);
        if (json.pagination) setTotalPages(json.pagination.totalPages);
      }
    } catch {
      toast.error('فشل تحميل بيانات الممرضين');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, page, search, statusFilter, specFilter]);

  useEffect(() => {
    void fetchNurses();
  }, [fetchNurses]);

  const handleVerify = async () => {
    if (!verifyTarget) return;
    setIsVerifying(true);
    try {
      const res = await authFetch(`/api/admin/nurses/${verifyTarget.id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({
          verificationStatus: verifyAction === 'verify' ? 'verified' : 'rejected',
          ...(verifyAction === 'reject' ? { rejectedReason } : {}),
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
            <p className="font-medium text-sm">{row.original.name}</p>
            <p className="text-xs text-muted-foreground">{row.original.phone}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'specialization',
      header: 'التخصص',
      cell: ({ row }) => specializationLabels[row.original.specialization] ?? row.original.specialization,
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
      cell: ({ row }) => <BadgeStatus status={row.original.isActive ? 'active' : 'inactive'} />,
    },
  ];

  const rowActions = [
    {
      label: 'عرض التفاصيل',
      onClick: (row: Record<string, unknown>) => setViewTarget(row as unknown as NurseItem),
    },
    {
      label: 'توثيق',
      onClick: (row: Record<string, unknown>) => {
        setVerifyTarget(row as unknown as NurseItem);
        setVerifyAction('verify');
      },
    },
    {
      label: 'رفض التوثيق',
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
          <h3 className="text-lg font-semibold">{nurse.name}</h3>
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
          <p className="text-sm font-medium">{specializationLabels[nurse.specialization] ?? nurse.specialization}</p>
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
      {nurse.governorate && (
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span>{nurse.governorate}</span>
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
      <div className="text-xs text-muted-foreground">
        تاريخ التسجيل: <DateFormatter date={nurse.createdAt} format="date" />
      </div>
    </div>
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <PageHeader title="إدارة الممرضين" description="إدارة وتوثيق الممرضين المسجلين" />
      </motion.div>

      <motion.div variants={itemAnim}>
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
      </motion.div>

      <motion.div variants={itemAnim}>
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
      </motion.div>

      {/* View Drawer/Dialog */}
      {viewTarget && (
        isMobile ? (
          <Drawer open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>تفاصيل الممرض/ـة</DrawerTitle>
              </DrawerHeader>
              <ViewContent nurse={viewTarget} />
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader>
                <DialogTitle>تفاصيل الممرض/ـة</DialogTitle>
              </DialogHeader>
              <ViewContent nurse={viewTarget} />
            </DialogContent>
          </Dialog>
        )
      )}

      {/* Verify/Reject Dialog */}
      <Dialog open={!!verifyTarget} onOpenChange={(open) => { if (!open) setVerifyTarget(null); }}>
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
    </motion.div>
  );
}
