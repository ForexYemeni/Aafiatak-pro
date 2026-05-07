'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, Eye, RefreshCw, MapPin, Phone, Heart } from 'lucide-react';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard } from '@/components/common/glass-card';
import { SearchInput } from '@/components/common/search-input';
import { BadgeStatus } from '@/components/common/badge-status';
import { DateFormatter } from '@/components/common/date-formatter';
import { Currency } from '@/components/common/currency';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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

interface BeneficiaryItem {
  id: string;
  name: string;
  phone: string;
  status: string;
  governorate: string | null;
  address: string | null;
  loyaltyPoints: number;
  loyaltyTier: string;
  totalSpent: number;
  orderCount: number;
  referralCode: string;
  gender: string | null;
  dateOfBirth: string | null;
  createdAt: string;
}

const tierLabels: Record<string, string> = {
  bronze: 'برونزي',
  silver: 'فضي',
  gold: 'ذهبي',
  platinum: 'بلاتيني',
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function AdminBeneficiariesPage() {
  const authFetch = useAuthFetch();
  const isMobile = useIsMobile();
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [viewTarget, setViewTarget] = useState<BeneficiaryItem | null>(null);
  const [toggleTarget, setToggleTarget] = useState<BeneficiaryItem | null>(null);

  const fetchBeneficiaries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        search,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      });
      const res = await authFetch(`/api/admin/beneficiaries?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        const items = json.data.beneficiaries ?? json.data;
        setBeneficiaries(Array.isArray(items) ? items : []);
        if (json.data.pages) setTotalPages(json.data.pages);
      }
    } catch {
      toast.error('فشل تحميل بيانات المستفيدين');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, page, search, statusFilter]);

  useEffect(() => {
    void fetchBeneficiaries();
  }, [fetchBeneficiaries]);

  const handleToggle = async () => {
    if (!toggleTarget) return;
    try {
      const res = await authFetch(`/api/admin/beneficiaries/${toggleTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: toggleTarget.status === 'active' ? false : true }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(toggleTarget.status === 'active' ? 'تم تعطيل المستفيد' : 'تم تفعيل المستفيد');
        void fetchBeneficiaries();
      }
    } catch {
      toast.error('فشل تغيير الحالة');
    } finally {
      setToggleTarget(null);
    }
  };

  const columns: ColumnDef<BeneficiaryItem, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'الاسم',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="w-8 h-8">
            <AvatarFallback className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs">
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
      accessorKey: 'loyaltyTier',
      header: 'المستوى',
      cell: ({ row }) => (
        <span className="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">
          {tierLabels[row.original.loyaltyTier] ?? row.original.loyaltyTier}
        </span>
      ),
    },
    {
      accessorKey: 'totalSpent',
      header: 'إجمالي الإنفاق',
      cell: ({ row }) => <Currency amount={row.original.totalSpent} />,
    },
    {
      accessorKey: 'orderCount',
      header: 'الطلبات',
      cell: ({ row }) => <span className="text-sm">{row.original.orderCount}</span>,
    },
    {
      accessorKey: 'status',
      header: 'الحالة',
      cell: ({ row }) => <BadgeStatus status={row.original.status} />,
    },
  ];

  const rowActions = [
    {
      label: 'عرض التفاصيل',
      onClick: (row: Record<string, unknown>) => setViewTarget(row as unknown as BeneficiaryItem),
    },
    {
      label: (row: Record<string, unknown>) => ((row as unknown as BeneficiaryItem).status === 'active' ? 'تعطيل' : 'تفعيل'),
      onClick: (row: Record<string, unknown>) => setToggleTarget(row as unknown as BeneficiaryItem),
    },
  ];

  const ViewContent = ({ ben }: { ben: BeneficiaryItem }) => (
    <div className="space-y-4 p-4">
      <div className="flex items-center gap-4">
        <Avatar className="w-16 h-16">
          <AvatarFallback className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xl">
            {ben.name.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div>
          <h3 className="text-lg font-semibold">{ben.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">{ben.phone}</span>
          </div>
          <BadgeStatus status={ben.status} size="md" />
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-muted-foreground">نقاط الولاء</p>
          <p className="text-sm font-medium">{ben.loyaltyPoints}</p>
        </div>
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-muted-foreground">المستوى</p>
          <p className="text-sm font-medium">{tierLabels[ben.loyaltyTier] ?? ben.loyaltyTier}</p>
        </div>
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-muted-foreground">إجمالي الإنفاق</p>
          <p className="text-sm font-medium"><Currency amount={ben.totalSpent} /></p>
        </div>
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-muted-foreground">عدد الطلبات</p>
          <p className="text-sm font-medium">{ben.orderCount}</p>
        </div>
      </div>
      {ben.governorate && (
        <div className="flex items-center gap-2 text-sm">
          <MapPin className="w-4 h-4 text-muted-foreground" />
          <span>{ben.governorate}</span>
          {ben.address && <span className="text-muted-foreground">- {ben.address}</span>}
        </div>
      )}
      <div className="glass rounded-xl p-3">
        <p className="text-xs text-muted-foreground">كود الإحالة</p>
        <p className="text-sm font-mono font-medium">{ben.referralCode}</p>
      </div>
      {ben.gender && (
        <div className="text-sm">
          الجنس: {ben.gender === 'male' ? 'ذكر' : 'أنثى'}
        </div>
      )}
      <div className="text-xs text-muted-foreground">
        تاريخ التسجيل: <DateFormatter date={ben.createdAt} format="date" />
      </div>
    </div>
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <PageHeader title="إدارة المستفيدين" description="عرض وإدارة حسابات المستفيدين" />
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
                <SelectItem value="suspended">موقوف</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => void fetchBeneficiaries()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={itemAnim}>
        <DataTable
          columns={columns}
          data={beneficiaries}
          isLoading={isLoading}
          emptyMessage="لا يوجد مستفيدون"
          emptyAction={{ label: 'تحديث', onClick: () => void fetchBeneficiaries() }}
          rowActions={rowActions as never}
          currentPage={page}
          pageCount={totalPages}
          onPageChange={setPage}
        />
      </motion.div>

      {viewTarget && (
        isMobile ? (
          <Drawer open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>تفاصيل المستفيد</DrawerTitle>
              </DrawerHeader>
              <ViewContent ben={viewTarget} />
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader>
                <DialogTitle>تفاصيل المستفيد</DialogTitle>
              </DialogHeader>
              <ViewContent ben={viewTarget} />
            </DialogContent>
          </Dialog>
        )
      )}

      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(open) => { if (!open) setToggleTarget(null); }}
        title={toggleTarget?.status === 'active' ? 'تعطيل المستفيد' : 'تفعيل المستفيد'}
        description={`هل أنت متأكد من ${toggleTarget?.status === 'active' ? 'تعطيل' : 'تفعيل'} "${toggleTarget?.name ?? ''}"؟`}
        confirmLabel={toggleTarget?.status === 'active' ? 'تعطيل' : 'تفعيل'}
        variant={toggleTarget?.status === 'active' ? 'warning' : 'info'}
        onConfirm={handleToggle}
      />
    </motion.div>
  );
}
