'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Plus, Edit, ToggleLeft, ToggleRight, RefreshCw, Search } from 'lucide-react';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { SearchInput } from '@/components/common/search-input';
import { BadgeStatus } from '@/components/common/badge-status';
import { Currency } from '@/components/common/currency';
import { EmptyState } from '@/components/common/empty-state';
import { useAuthFetch } from '@/hooks/use-auth';
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
  nameEn: '',
  descriptionAr: '',
  basePrice: 0,
  category: 'nursing',
  duration: 60,
  isActive: true,
  isEmergency: false,
  sortOrder: 0,
};

export default function AdminServicesPage() {
  const authFetch = useAuthFetch();
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingService, setEditingService] = useState<ServiceItem | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [isSaving, setIsSaving] = useState(false);

  // Toggle confirm
  const [toggleTarget, setToggleTarget] = useState<ServiceItem | null>(null);

  const fetchServices = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        search,
        ...(categoryFilter !== 'all' ? { category: categoryFilter } : {}),
      });
      const res = await authFetch(`/api/admin/services?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        const items = json.data.services ?? json.data;
        setServices(Array.isArray(items) ? items : []);
        if (json.data.pages) setTotalPages(json.data.pages);
      }
    } catch {
      toast.error('فشل تحميل الخدمات');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, page, search, categoryFilter]);

  useEffect(() => {
    void fetchServices();
  }, [fetchServices]);

  const handleSave = async () => {
    if (!form.nameAr || !form.basePrice) {
      toast.error('يرجى ملء الحقول المطلوبة');
      return;
    }
    setIsSaving(true);
    try {
      if (editingService) {
        const res = await authFetch(`/api/admin/services/${editingService.id}`, {
          method: 'PATCH',
          body: JSON.stringify(form),
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
          body: JSON.stringify(form),
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
        toast.success(toggleTarget.isActive ? 'تم تعطيل الخدمة' : 'تم تفعيل الخدمة');
        void fetchServices();
      }
    } catch {
      toast.error('فشل تغيير حالة الخدمة');
    } finally {
      setToggleTarget(null);
    }
  };

  const openEdit = (svc: ServiceItem) => {
    setEditingService(svc);
    setForm({
      nameAr: svc.nameAr,
      nameEn: svc.nameEn,
      descriptionAr: svc.descriptionAr,
      basePrice: svc.basePrice,
      category: svc.category,
      duration: svc.duration,
      isActive: svc.isActive,
      isEmergency: svc.isEmergency,
      sortOrder: svc.sortOrder,
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
          <p className="text-xs text-muted-foreground">{row.original.nameEn}</p>
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
      accessorKey: 'duration',
      header: 'المدة',
      cell: ({ row }) => `${row.original.duration} دقيقة`,
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
      onClick: (row: Record<string, unknown>) => openEdit(row as unknown as ServiceItem),
    },
    {
      label: (row: Record<string, unknown>) => ((row as unknown as ServiceItem).isActive ? 'تعطيل' : 'تفعيل'),
      onClick: (row: Record<string, unknown>) => setToggleTarget(row as unknown as ServiceItem),
      variant: 'default' as const,
    },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <PageHeader
          title="إدارة الخدمات"
          description="إضافة وتعديل وإدارة خدمات المنصة"
          action={{ label: 'إضافة خدمة', onClick: openAdd, icon: <Plus className="w-4 h-4" /> }}
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
          currentPage={page}
          pageCount={totalPages}
          onPageChange={setPage}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم بالعربية *</Label>
                <Input
                  value={form.nameAr}
                  onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                  placeholder="مثال: تمريض منزلي"
                />
              </div>
              <div className="space-y-2">
                <Label>الاسم بالإنجليزية</Label>
                <Input
                  value={form.nameEn}
                  onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
                  placeholder="Home Nursing"
                  dir="ltr"
                />
              </div>
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
                  onChange={(e) => setForm({ ...form, basePrice: Number(e.target.value) })}
                  min={0}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المدة (دقيقة)</Label>
                <Input
                  type="number"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: Number(e.target.value) })}
                  min={1}
                />
              </div>
              <div className="space-y-2">
                <Label>ترتيب العرض</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: Number(e.target.value) })}
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
                <Label>فعّال</Label>
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
        title={toggleTarget?.isActive ? 'تعطيل الخدمة' : 'تفعيل الخدمة'}
        description={
          toggleTarget?.isActive
            ? `هل أنت متأكد من تعطيل خدمة "${toggleTarget.nameAr}"؟`
            : `هل أنت متأكد من تفعيل خدمة "${toggleTarget?.nameAr ?? ''}"؟`
        }
        confirmLabel={toggleTarget?.isActive ? 'تعطيل' : 'تفعيل'}
        variant={toggleTarget?.isActive ? 'warning' : 'info'}
        onConfirm={handleToggle}
      />
    </motion.div>
  );
}
