'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, Trash2, AlertTriangle, RefreshCw } from 'lucide-react';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { SearchInput } from '@/components/common/search-input';
import { BadgeStatus } from '@/components/common/badge-status';
import { Currency } from '@/components/common/currency';
import { useAuthFetch } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
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

interface ServiceItem {
  id: string;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  basePrice: number;
  category: string;
  duration: number;
  isActive: boolean;
  isEmergency: boolean;
  sortOrder: number;
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

const container = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.05 } },
};
const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const defaultForm = {
  nameAr: '',
  descriptionAr: '',
  basePrice: '' as string | number,
  category: 'nursing',
  isActive: true,
  isEmergency: false,
};

export default function AdminServicesPage() {
  const authFetch = useAuthFetch();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [isSaving, setIsSaving] = useState(false);

  // Toggle confirm
  const [toggleTarget, setToggleTarget] = useState<ServiceItem | null>(null);

  // Delete confirm
  const [deleteTarget, setDeleteTarget] = useState<ServiceItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        search,
        ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
      });
      const res = await authFetch(`/api/admin/services?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        const items = json.data.services ?? json.data;
        setServices(Array.isArray(items) ? items : []);
      }
    } catch {
      toast.error('فشل تحميل الخدمات');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, search, categoryFilter]);

  useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  const handleSave = async () => {
    if (!form.nameAr) {
      toast.error('يرجى إدخال اسم الخدمة');
      return;
    }
    const price = Number(form.basePrice);
    if (!price || price <= 0) {
      toast.error('يرجى إدخال السعر الأساسي');
      return;
    }

    setIsSaving(true);
    try {
      const payload = {
        nameAr: form.nameAr,
        nameEn: form.nameAr, // Use Arabic name as English name (not needed)
        descriptionAr: form.descriptionAr,
        basePrice: price,
        category: form.category,
        duration: 60, // Default duration
        isActive: form.isActive,
        isEmergency: form.isEmergency,
        sortOrder: 0,
      };

      if (editingService) {
        const res = await authFetch(`/api/admin/services/${editingService.id}`, {
          method: 'PATCH',
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success) {
          toast.success('تم تحديث الخدمة بنجاح');
        } else {
          toast.error(json.message ?? 'فشل التحديث');
        }
      } else {
        const res = await authFetch('/api/admin/services', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        const json = await res.json();
        if (json.success) {
          toast.success('تم إضافة الخدمة بنجاح');
        } else {
          toast.error(json.message ?? 'فشل الإضافة');
        }
      }
      setDialogOpen(false);
      setEditingService(null);
      setForm(defaultForm);
      void fetchServices();
    } catch {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = async () => {
    if (!toggleTarget) return;
    try {
      const res = await authFetch(`/api/admin/services/${toggleTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !toggleTarget.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(toggleTarget.isActive ? 'تم إيقاف الخدمة' : 'تم تفعيل الخدمة');
        void fetchServices();
      }
    } catch {
      toast.error('فشل تغيير حالة الخدمة');
    } finally {
      setToggleTarget(null);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await authFetch(`/api/admin/services/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم حذف الخدمة نهائياً');
        void fetchServices();
      } else {
        toast.error(json.message ?? 'فشل الحذف');
      }
    } catch {
      toast.error('حدث خطأ أثناء الحذف');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const openEdit = (svc: ServiceItem) => {
    setEditingService(svc);
    setForm({
      nameAr: svc.nameAr,
      descriptionAr: svc.descriptionAr || '',
      basePrice: svc.basePrice || '',
      category: svc.category,
      isActive: svc.isActive,
      isEmergency: svc.isEmergency,
    });
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditingService(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const columns: ColumnDef<ServiceItem, unknown>[] = [
    {
      accessorKey: 'nameAr',
      header: 'اسم الخدمة',
      cell: ({ row }) => (
        <div>
          <p className="font-medium">{row.original.nameAr}</p>
          {row.original.isEmergency && (
            <span className="text-[10px] text-red-500 font-medium">خدمة طوارئ</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'category',
      header: 'الفئة',
      cell: ({ row }) => categoryLabels[row.original.category] ?? row.original.category,
    },
    {
      accessorKey: 'basePrice',
      header: 'السعر',
      cell: ({ row }) => <Currency amount={row.original.basePrice} />,
    },
    {
      accessorKey: 'isActive',
      header: 'الحالة',
      cell: ({ row }) => (
        <BadgeStatus
          status={row.original.isActive ? 'active' : 'inactive'}
          label={row.original.isActive ? 'نشطة' : 'متوقفة'}
        />
      ),
    },
  ];

  const user = useAuthStore((s) => s.user);
  const isSubadmin = user?.role === 'subadmin';

  const rowActions = [
    ...(!isSubadmin ? [{
      label: 'تعديل',
      onClick: (row: Record<string, unknown>) => openEdit(row as unknown as ServiceItem),
    }] : []),
    {
      label: (row: Record<string, unknown>) => ((row as unknown as ServiceItem).isActive ? 'إيقاف' : 'تفعيل'),
      onClick: (row: Record<string, unknown>) => setToggleTarget(row as unknown as ServiceItem),
    },
    ...(!isSubadmin ? [{
      label: 'حذف نهائياً',
      onClick: (row: Record<string, unknown>) => setDeleteTarget(row as unknown as ServiceItem),
      variant: 'destructive' as const,
    }] : []),
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <PageHeader
          title="إدارة الخدمات"
          description="إضافة وتعديل وإدارة خدمات المنصة"
          {...(!isSubadmin ? { action: { label: 'إضافة خدمة', onClick: openAdd, icon: <Plus className="w-4 h-4" /> } } : {})}
        />
      </motion.div>

      <motion.div variants={item}>
        <GlassCard variant="admin">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <SearchInput
              placeholder="بحث عن خدمة..."
              onChange={setSearch}
              className="flex-1"
            />
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="الفئة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الفئات</SelectItem>
                {Object.entries(categoryLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => void fetchServices()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={item}>
        <DataTable
          columns={columns}
          data={services}
          isLoading={isLoading}
          emptyMessage="لا توجد خدمات"
          emptyAction={{ label: 'إضافة خدمة جديدة', onClick: openAdd }}
          rowActions={rowActions as never}
          currentPage={1}
          pageCount={1}
          onPageChange={() => {}}
        />
      </motion.div>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingService ? 'تعديل الخدمة' : 'إضافة خدمة جديدة'}</DialogTitle>
            <DialogDescription>
              {editingService ? 'قم بتعديل بيانات الخدمة' : 'أدخل بيانات الخدمة الجديدة'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>اسم الخدمة *</Label>
              <Input
                value={form.nameAr}
                onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                placeholder="مثال: تمريض منزلي"
              />
            </div>
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea
                value={form.descriptionAr}
                onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })}
                placeholder="وصف الخدمة..."
                rows={3}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الفئة *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(categoryLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>السعر الأساسي (ر.ي) *</Label>
                <Input
                  type="number"
                  value={form.basePrice}
                  onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                  placeholder="0"
                  min={0}
                />
              </div>
            </div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
                <Label>نشطة</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch
                  checked={form.isEmergency}
                  onCheckedChange={(v) => setForm({ ...form, isEmergency: v })}
                />
                <Label>خدمة طوارئ</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-admin hover:bg-admin/90">
              {isSaving ? 'جارٍ الحفظ...' : editingService ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Toggle Confirm */}
      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(open) => { if (!open) setToggleTarget(null); }}
        title={toggleTarget?.isActive ? 'إيقاف الخدمة' : 'تفعيل الخدمة'}
        description={
          toggleTarget?.isActive
            ? `هل أنت متأكد من إيقاف خدمة "${toggleTarget.nameAr}"؟ لن تكون متاحة للمستفيدين.`
            : `هل أنت متأكد من تفعيل خدمة "${toggleTarget?.nameAr ?? ''}"؟`
        }
        confirmLabel={toggleTarget?.isActive ? 'إيقاف' : 'تفعيل'}
        variant={toggleTarget?.isActive ? 'warning' : 'info'}
        onConfirm={handleToggle}
      />

      {/* Delete Confirm */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              حذف الخدمة نهائياً
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف خدمة &quot;{deleteTarget?.nameAr ?? ''}&quot; نهائياً؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-400">
                تحذير: سيتم حذف الخدمة نهائياً. أي طلبات مرتبطة بها قد تتأثر.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)} disabled={isDeleting}>
              إلغاء
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting}
              variant="destructive"
            >
              {isDeleting ? 'جارٍ الحذف...' : 'حذف نهائياً'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
