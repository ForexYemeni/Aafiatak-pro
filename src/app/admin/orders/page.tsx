'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Eye, UserPlus, RefreshCw } from 'lucide-react';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard } from '@/components/common/glass-card';
import { SearchInput } from '@/components/common/search-input';
import { BadgeStatus } from '@/components/common/badge-status';
import { DateFormatter } from '@/components/common/date-formatter';
import { Currency } from '@/components/common/currency';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';

interface OrderItem {
  id: string;
  beneficiaryName: string;
  nurseName: string | null;
  serviceName: string;
  status: string;
  totalPrice: number;
  isEmergency: boolean;
  scheduledAt: string | null;
  createdAt: string;
  beneficiaryId: string;
  nurseId: string | null;
}

interface NurseOption {
  id: string;
  name: string;
  specialization: string;
  rating: number;
}

const statusLabels: Record<string, string> = {
  pending: 'معلق',
  assigned: 'مُعيَّن',
  accepted: 'مقبول',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  rejected: 'مرفوض',
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function AdminOrdersPage() {
  const authFetch = useAuthFetch();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusTab, setStatusTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Assign dialog
  const [assignTarget, setAssignTarget] = useState<OrderItem | null>(null);
  const [nurses, setNurses] = useState<NurseOption[]>([]);
  const [selectedNurse, setSelectedNurse] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // View dialog
  const [viewTarget, setViewTarget] = useState<OrderItem | null>(null);

  // Status update
  const [statusTarget, setStatusTarget] = useState<OrderItem | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

  const fetchOrders = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        search,
        ...(statusTab !== 'all' ? { status: statusTab } : {}),
      });
      const res = await authFetch(`/api/admin/orders?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        setOrders(json.data as OrderItem[]);
        if (json.pagination) setTotalPages(json.pagination.totalPages);
      }
    } catch {
      toast.error('فشل تحميل الطلبات');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, page, search, statusTab]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders]);

  const fetchAvailableNurses = async () => {
    try {
      const res = await authFetch('/api/admin/nurses?limit=50&status=active');
      const json = await res.json();
      if (json.success && json.data) {
        setNurses(json.data.map((n: Record<string, unknown>) => ({
          id: String(n.id),
          name: String(n.name),
          specialization: String(n.specialization ?? ''),
          rating: Number(n.rating ?? 0),
        })));
      }
    } catch {
      toast.error('فشل تحميل قائمة الممرضين');
    }
  };

  const handleAssign = async () => {
    if (!assignTarget || !selectedNurse) return;
    setIsAssigning(true);
    try {
      const res = await authFetch(`/api/admin/orders/${assignTarget.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ nurseId: selectedNurse }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تعيين الممرض/ـة بنجاح');
        void fetchOrders();
      } else {
        toast.error(json.message ?? 'فشل التعيين');
      }
    } catch {
      toast.error('حدث خطأ أثناء التعيين');
    } finally {
      setIsAssigning(false);
      setAssignTarget(null);
      setSelectedNurse('');
    }
  };

  const handleStatusUpdate = async () => {
    if (!statusTarget || !newStatus) return;
    setIsUpdating(true);
    try {
      const res = await authFetch(`/api/admin/orders/${statusTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تحديث حالة الطلب');
        void fetchOrders();
      } else {
        toast.error(json.message ?? 'فشل التحديث');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setIsUpdating(false);
      setStatusTarget(null);
      setNewStatus('');
    }
  };

  const columns: ColumnDef<OrderItem, unknown>[] = [
    {
      accessorKey: 'beneficiaryName',
      header: 'المستفيد',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.beneficiaryName}</p>
          {row.original.isEmergency && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400">
              طوارئ
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'serviceName',
      header: 'الخدمة',
    },
    {
      accessorKey: 'nurseName',
      header: 'الممرض/ـة',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.nurseName ?? 'غير معيَّن'}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'الحالة',
      cell: ({ row }) => <BadgeStatus status={row.original.status} />,
    },
    {
      accessorKey: 'totalPrice',
      header: 'المبلغ',
      cell: ({ row }) => <Currency amount={row.original.totalPrice} />,
    },
    {
      accessorKey: 'createdAt',
      header: 'التاريخ',
      cell: ({ row }) => <DateFormatter date={row.original.createdAt} format="short" />,
    },
  ];

  const rowActions = [
    {
      label: 'عرض التفاصيل',
      onClick: (row: Record<string, unknown>) => setViewTarget(row as unknown as OrderItem),
    },
    {
      label: 'تعيين ممرض/ـة',
      onClick: (row: Record<string, unknown>) => {
        setAssignTarget(row as unknown as OrderItem);
        void fetchAvailableNurses();
      },
    },
    {
      label: 'تحديث الحالة',
      onClick: (row: Record<string, unknown>) => {
        setStatusTarget(row as unknown as OrderItem);
        setNewStatus((row as unknown as OrderItem).status);
      },
    },
  ];

  const tabs = [
    { value: 'all', label: 'الكل' },
    { value: 'pending', label: 'معلق' },
    { value: 'assigned', label: 'مُعيَّن' },
    { value: 'in_progress', label: 'قيد التنفيذ' },
    { value: 'completed', label: 'مكتمل' },
    { value: 'cancelled', label: 'ملغي' },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <PageHeader title="إدارة الطلبات" description="عرض وإدارة طلبات الخدمة" />
      </motion.div>

      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <SearchInput placeholder="بحث..." onChange={setSearch} className="flex-1" />
              <Button variant="outline" size="icon" onClick={() => void fetchOrders()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            <Tabs value={statusTab} onValueChange={setStatusTab}>
              <TabsList className="flex-wrap h-auto gap-1">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={itemAnim}>
        <DataTable
          columns={columns}
          data={orders}
          isLoading={isLoading}
          emptyMessage="لا توجد طلبات"
          emptyAction={{ label: 'تحديث', onClick: () => void fetchOrders() }}
          rowActions={rowActions as never}
          currentPage={page}
          pageCount={totalPages}
          onPageChange={setPage}
        />
      </motion.div>

      {/* View Order Dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>تفاصيل الطلب</DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">المستفيد</p>
                  <p className="text-sm font-medium">{viewTarget.beneficiaryName}</p>
                </div>
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">الخدمة</p>
                  <p className="text-sm font-medium">{viewTarget.serviceName}</p>
                </div>
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">الممرض/ـة</p>
                  <p className="text-sm font-medium">{viewTarget.nurseName ?? 'غير معيَّن'}</p>
                </div>
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">المبلغ</p>
                  <p className="text-sm font-medium"><Currency amount={viewTarget.totalPrice} /></p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">الحالة:</span>
                <BadgeStatus status={viewTarget.status} size="md" />
              </div>
              {viewTarget.isEmergency && (
                <div className="bg-red-50 dark:bg-red-950/20 rounded-xl p-3 text-sm text-red-700 dark:text-red-400">
                  ⚠️ طلب طوارئ
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                تاريخ الإنشاء: <DateFormatter date={viewTarget.createdAt} format="full" />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Assign Nurse Dialog */}
      <Dialog open={!!assignTarget} onOpenChange={(open) => { if (!open) setAssignTarget(null); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعيين ممرض/ـة</DialogTitle>
            <DialogDescription>
              اختر ممرض/ـة لتعيينه/ا للطلب
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Select value={selectedNurse} onValueChange={setSelectedNurse}>
              <SelectTrigger>
                <SelectValue placeholder="اختر ممرض/ـة" />
              </SelectTrigger>
              <SelectContent>
                {nurses.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.name} - {n.specialization} ({n.rating.toFixed(1)} ⭐)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)} disabled={isAssigning}>
              إلغاء
            </Button>
            <Button
              onClick={handleAssign}
              disabled={isAssigning || !selectedNurse}
              className="bg-admin hover:bg-admin/90"
            >
              {isAssigning ? 'جارٍ التعيين...' : 'تعيين'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={!!statusTarget} onOpenChange={(open) => { if (!open) setStatusTarget(null); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تحديث حالة الطلب</DialogTitle>
            <DialogDescription>
              اختر الحالة الجديدة للطلب
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Label>الحالة الجديدة</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTarget(null)} disabled={isUpdating}>
              إلغاء
            </Button>
            <Button
              onClick={handleStatusUpdate}
              disabled={isUpdating}
              className="bg-admin hover:bg-admin/90"
            >
              {isUpdating ? 'جارٍ التحديث...' : 'تحديث'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
