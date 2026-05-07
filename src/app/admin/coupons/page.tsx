'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Tags, Plus, Edit, RefreshCw } from 'lucide-react';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard } from '@/components/common/glass-card';
import { SearchInput } from '@/components/common/search-input';
import { BadgeStatus } from '@/components/common/badge-status';
import { DateFormatter } from '@/components/common/date-formatter';
import { Currency } from '@/components/common/currency';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';

interface CouponItem {
  id: string;
  code: string;
  discountPercent: number;
  maxUses: number;
  usedCount: number;
  minOrderAmount: number;
  maxDiscountAmount: number | null;
  expiresAt: string;
  isActive: boolean;
  applicableCategories: string[];
  createdAt: string;
}

const categoryLabels: Record<string, string> = {
  medical: 'طبية',
  nursing: 'تمريض',
  physiotherapy: 'علاج طبيعي',
  elderly_care: 'رعاية المسنين',
  pediatric: 'طب الأطفال',
  post_surgery: 'ما بعد الجراحة',
  lab: 'مختبرات',
  emergency: 'طوارئ',
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const defaultForm = {
  code: '',
  discountPercent: 10,
  maxUses: 100,
  minOrderAmount: 0,
  maxDiscountAmount: 0,
  expiresAt: '',
  isActive: true,
  applicableCategories: [] as string[],
};

export default function AdminCouponsPage() {
  const authFetch = useAuthFetch();
  const [coupons, setCoupons] = useState<CouponItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<CouponItem | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [isSaving, setIsSaving] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<CouponItem | null>(null);

  const fetchCoupons = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10', search });
      const res = await authFetch(`/api/admin/coupons?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        const items = json.data.coupons ?? json.data;
        setCoupons(Array.isArray(items) ? items : []);
        if (json.data.pages) setTotalPages(json.data.pages);
      }
    } catch {
      toast.error('فشل تحميل الكوبونات');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, page, search]);

  useEffect(() => {
    void fetchCoupons();
  }, [fetchCoupons]);

  const handleSave = async () => {
    if (!form.code || !form.discountPercent) {
      toast.error('يرجى ملء الحقول المطلوبة');
      return;
    }
    setIsSaving(true);
    try {
      if (editingCoupon) {
        const res = await authFetch(`/api/admin/coupons/${editingCoupon.id}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
        });
        const json = await res.json();
        if (json.success) {
          toast.success('تم تحديث الكوبون');
        } else {
          toast.error(json.message ?? 'فشل التحديث');
        }
      } else {
        const res = await authFetch('/api/admin/coupons', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        const json = await res.json();
        if (json.success) {
          toast.success('تم إضافة الكوبون');
        } else {
          toast.error(json.message ?? 'فشل الإضافة');
        }
      }
      setDialogOpen(false);
      setEditingCoupon(null);
      setForm(defaultForm);
      void fetchCoupons();
    } catch {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      const res = await authFetch(`/api/admin/coupons/${deactivateTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: false }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تعطيل الكوبون');
        void fetchCoupons();
      }
    } catch {
      toast.error('فشل تعطيل الكوبون');
    } finally {
      setDeactivateTarget(null);
    }
  };

  const openEdit = (c: CouponItem) => {
    setEditingCoupon(c);
    setForm({
      code: c.code,
      discountPercent: c.discountPercent,
      maxUses: c.maxUses,
      minOrderAmount: c.minOrderAmount,
      maxDiscountAmount: c.maxDiscountAmount ?? 0,
      expiresAt: c.expiresAt.split('T')[0],
      isActive: c.isActive,
      applicableCategories: c.applicableCategories,
    });
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditingCoupon(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const columns: ColumnDef<CouponItem, unknown>[] = [
    {
      accessorKey: 'code',
      header: 'الكود',
      cell: ({ row }) => <span className="font-mono font-semibold text-admin">{row.original.code}</span>,
    },
    {
      accessorKey: 'discountPercent',
      header: 'الخصم',
      cell: ({ row }) => <span>{row.original.discountPercent}%</span>,
    },
    {
      accessorKey: 'usedCount',
      header: 'الاستخدام',
      cell: ({ row }) => <span>{row.original.usedCount} / {row.original.maxUses}</span>,
    },
    {
      accessorKey: 'minOrderAmount',
      header: 'الحد الأدنى',
      cell: ({ row }) => <Currency amount={row.original.minOrderAmount} />,
    },
    {
      accessorKey: 'expiresAt',
      header: 'تاريخ الانتهاء',
      cell: ({ row }) => <DateFormatter date={row.original.expiresAt} format="date" />,
    },
    {
      accessorKey: 'isActive',
      header: 'الحالة',
      cell: ({ row }) => <BadgeStatus status={row.original.isActive ? 'active' : 'inactive'} />,
    },
  ];

  const rowActions = [
    {
      label: 'تعديل',
      onClick: (row: Record<string, unknown>) => openEdit(row as unknown as CouponItem),
    },
    {
      label: 'تعطيل',
      onClick: (row: Record<string, unknown>) => setDeactivateTarget(row as unknown as CouponItem),
      variant: 'destructive' as const,
    },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <PageHeader
          title="إدارة الكوبونات"
          description="إنشاء وإدارة كوبونات الخصم"
          action={{ label: 'إضافة كوبون', onClick: openAdd, icon: <Plus className="w-4 h-4" /> }}
        />
      </motion.div>

      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <SearchInput placeholder="بحث بكود الكوبون..." onChange={setSearch} className="flex-1" />
            <Button variant="outline" size="icon" onClick={() => void fetchCoupons()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={itemAnim}>
        <DataTable
          columns={columns}
          data={coupons}
          isLoading={isLoading}
          emptyMessage="لا توجد كوبونات"
          emptyAction={{ label: 'إضافة كوبون', onClick: openAdd }}
          rowActions={rowActions as never}
          currentPage={page}
          pageCount={totalPages}
          onPageChange={setPage}
        />
      </motion.div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{editingCoupon ? 'تعديل الكوبون' : 'إضافة كوبون جديد'}</DialogTitle>
            <DialogDescription>
              {editingCoupon ? 'قم بتعديل بيانات الكوبون' : 'أدخل بيانات الكوبون الجديد'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>كود الكوبون *</Label>
                <Input
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                  placeholder="SUMMER2024"
                  className="font-mono"
                  dir="ltr"
                />
              </div>
              <div className="space-y-2">
                <Label>نسبة الخصم % *</Label>
                <Input
                  type="number"
                  value={form.discountPercent}
                  onChange={(e) => setForm({ ...form, discountPercent: Number(e.target.value) })}
                  min={1}
                  max={100}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الحد الأقصى للاستخدام</Label>
                <Input
                  type="number"
                  value={form.maxUses}
                  onChange={(e) => setForm({ ...form, maxUses: Number(e.target.value) })}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>الحد الأدنى للطلب (ر.ي)</Label>
                <Input
                  type="number"
                  value={form.minOrderAmount}
                  onChange={(e) => setForm({ ...form, minOrderAmount: Number(e.target.value) })}
                  min={0}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>أقصى قيمة خصم (ر.ي)</Label>
                <Input
                  type="number"
                  value={form.maxDiscountAmount}
                  onChange={(e) => setForm({ ...form, maxDiscountAmount: Number(e.target.value) })}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label>تاريخ الانتهاء *</Label>
                <Input
                  type="date"
                  value={form.expiresAt}
                  onChange={(e) => setForm({ ...form, expiresAt: e.target.value })}
                  dir="ltr"
                />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
              <Label>فعّال</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>إلغاء</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-admin hover:bg-admin/90">
              {isSaving ? 'جارٍ الحفظ...' : editingCoupon ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => { if (!open) setDeactivateTarget(null); }}
        title="تعطيل الكوبون"
        description={`هل أنت متأكد من تعطيل الكوبون "${deactivateTarget?.code ?? ''}"؟`}
        confirmLabel="تعطيل"
        variant="warning"
        onConfirm={handleDeactivate}
      />
    </motion.div>
  );
}
