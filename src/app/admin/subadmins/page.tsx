'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Shield, Plus, Edit, RefreshCw } from 'lucide-react';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard } from '@/components/common/glass-card';
import { SearchInput } from '@/components/common/search-input';
import { BadgeStatus } from '@/components/common/badge-status';
import { DateFormatter } from '@/components/common/date-formatter';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
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
import type { SubAdminPermission } from '@/types';

interface SubAdminItem {
  id: string;
  name: string;
  phone: string;
  email: string;
  permissions: SubAdminPermission[];
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

const permissionLabels: Record<SubAdminPermission, string> = {
  manage_nurses: 'إدارة الممرضين',
  manage_beneficiaries: 'إدارة المستفيدين',
  manage_orders: 'إدارة الطلبات',
  manage_payments: 'إدارة المدفوعات',
  manage_emergencies: 'إدارة الطوارئ',
  view_reports: 'عرض التقارير',
  manage_services: 'إدارة الخدمات',
  manage_chat: 'إدارة المحادثات',
  manage_settings: 'إدارة الإعدادات',
};

const allPermissions: SubAdminPermission[] = [
  'manage_nurses',
  'manage_beneficiaries',
  'manage_orders',
  'manage_payments',
  'manage_emergencies',
  'view_reports',
  'manage_services',
  'manage_chat',
  'manage_settings',
];

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const defaultForm = {
  name: '',
  phone: '',
  email: '',
  password: '',
  permissions: [] as SubAdminPermission[],
  isActive: true,
};

export default function AdminSubAdminsPage() {
  const authFetch = useAuthFetch();
  const [subadmins, setSubAdmins] = useState<SubAdminItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTarget, setEditingTarget] = useState<SubAdminItem | null>(null);
  const [form, setForm] = useState(defaultForm);
  const [isSaving, setIsSaving] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState<SubAdminItem | null>(null);

  const fetchSubAdmins = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '10', search });
      const res = await authFetch(`/api/admin/subadmins?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        const items = json.data.subadmins ?? json.data;
        setSubAdmins(Array.isArray(items) ? items : []);
        if (json.data.pages) setTotalPages(json.data.pages);
      }
    } catch {
      toast.error('فشل تحميل المديرين الفرعيين');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, page, search]);

  useEffect(() => {
    void fetchSubAdmins();
  }, [fetchSubAdmins]);

  const handleSave = async () => {
    if (!form.name || !form.phone) {
      toast.error('يرجى ملء الاسم ورقم الهاتف');
      return;
    }
    if (!editingTarget && !form.password) {
      toast.error('يرجى إدخال كلمة المرور للمدير الفرعي الجديد');
      return;
    }
    if (!editingTarget && form.password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }
    setIsSaving(true);
    try {
      if (editingTarget) {
        const res = await authFetch(`/api/admin/subadmins/${editingTarget.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            permissions: form.permissions,
            isActive: form.isActive,
          }),
        });
        const json = await res.json();
        if (json.success) {
          toast.success('تم تحديث المدير الفرعي');
        } else {
          toast.error(json.error?.message ?? json.message ?? 'فشل التحديث');
        }
      } else {
        const res = await authFetch('/api/admin/subadmins', {
          method: 'POST',
          body: JSON.stringify(form),
        });
        const json = await res.json();
        if (json.success) {
          toast.success('تم إضافة المدير الفرعي');
        } else {
          toast.error(json.error?.message ?? json.message ?? 'فشل الإضافة');
        }
      }
      setDialogOpen(false);
      setEditingTarget(null);
      setForm(defaultForm);
      void fetchSubAdmins();
    } catch {
      toast.error('حدث خطأ أثناء الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeactivate = async () => {
    if (!deactivateTarget) return;
    try {
      const res = await authFetch(`/api/admin/subadmins/${deactivateTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !deactivateTarget.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(deactivateTarget.isActive ? 'تم تعطيل المدير الفرعي' : 'تم تفعيل المدير الفرعي');
        void fetchSubAdmins();
      }
    } catch {
      toast.error('فشل تغيير الحالة');
    } finally {
      setDeactivateTarget(null);
    }
  };

  const openEdit = (sa: SubAdminItem) => {
    setEditingTarget(sa);
    setForm({
      name: sa.name,
      phone: sa.phone,
      email: sa.email,
      password: '',
      permissions: sa.permissions,
      isActive: sa.isActive,
    });
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditingTarget(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const togglePermission = (perm: SubAdminPermission) => {
    setForm((prev) => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter((p) => p !== perm)
        : [...prev.permissions, perm],
    }));
  };

  const columns: ColumnDef<SubAdminItem, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'الاسم',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.name}</p>
          <p className="text-xs text-muted-foreground">{row.original.email}</p>
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'الهاتف',
    },
    {
      accessorKey: 'permissions',
      header: 'الصلاحيات',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.permissions.slice(0, 3).map((p) => (
            <span key={p} className="text-[10px] px-1.5 py-0.5 rounded-full bg-accent text-accent-foreground">
              {permissionLabels[p]}
            </span>
          ))}
          {row.original.permissions.length > 3 && (
            <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground">
              +{row.original.permissions.length - 3}
            </span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'الحالة',
      cell: ({ row }) => <BadgeStatus status={row.original.isActive ? 'active' : 'inactive'} />,
    },
    {
      accessorKey: 'lastLoginAt',
      header: 'آخر دخول',
      cell: ({ row }) => (
        row.original.lastLoginAt
          ? <DateFormatter date={row.original.lastLoginAt} format="relative" />
          : <span className="text-muted-foreground text-xs">لم يسجل دخول</span>
      ),
    },
  ];

  const rowActions = [
    {
      label: 'تعديل الصلاحيات',
      onClick: (row: Record<string, unknown>) => openEdit(row as unknown as SubAdminItem),
    },
    {
      label: (row: Record<string, unknown>) => ((row as unknown as SubAdminItem).isActive ? 'تعطيل' : 'تفعيل'),
      onClick: (row: Record<string, unknown>) => setDeactivateTarget(row as unknown as SubAdminItem),
      variant: 'destructive' as const,
    },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <PageHeader
          title="المديرون الفرعيون"
          description="إدارة المديرين الفرعيين وصلاحياتهم"
          action={{ label: 'إضافة مدير فرعي', onClick: openAdd, icon: <Plus className="w-4 h-4" /> }}
        />
      </motion.div>

      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <SearchInput placeholder="بحث بالاسم أو الهاتف..." onChange={setSearch} className="flex-1" />
            <Button variant="outline" size="icon" onClick={() => void fetchSubAdmins()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={itemAnim}>
        <DataTable
          columns={columns}
          data={subadmins}
          isLoading={isLoading}
          emptyMessage="لا يوجد مديرون فرعيون"
          emptyAction={{ label: 'إضافة مدير فرعي', onClick: openAdd }}
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
            <DialogTitle>{editingTarget ? 'تعديل المدير الفرعي' : 'إضافة مدير فرعي جديد'}</DialogTitle>
            <DialogDescription>
              {editingTarget ? 'قم بتعديل بيانات وصلاحيات المدير الفرعي' : 'أدخل بيانات المدير الفرعي الجديد'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>الهاتف *</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" disabled={!!editingTarget} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>البريد الإلكتروني</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" type="email" />
              </div>
              {!editingTarget && (
                <div className="space-y-2">
                  <Label>كلمة المرور *</Label>
                  <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" dir="ltr" />
                </div>
              )}
            </div>
            <div className="space-y-2">
              <Label>الصلاحيات</Label>
              <div className="grid grid-cols-2 gap-2">
                {allPermissions.map((perm) => (
                  <div key={perm} className="flex items-center gap-2">
                    <Switch
                      checked={form.permissions.includes(perm)}
                      onCheckedChange={() => togglePermission(perm)}
                    />
                    <span className="text-sm">{permissionLabels[perm]}</span>
                  </div>
                ))}
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
              {isSaving ? 'جارٍ الحفظ...' : editingTarget ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deactivateTarget}
        onOpenChange={(open) => { if (!open) setDeactivateTarget(null); }}
        title={deactivateTarget?.isActive ? 'تعطيل المدير الفرعي' : 'تفعيل المدير الفرعي'}
        description={`هل أنت متأكد من ${deactivateTarget?.isActive ? 'تعطيل' : 'تفعيل'} "${deactivateTarget?.name ?? ''}"؟`}
        confirmLabel={deactivateTarget?.isActive ? 'تعطيل' : 'تفعيل'}
        variant={deactivateTarget?.isActive ? 'warning' : 'info'}
        onConfirm={handleDeactivate}
      />
    </motion.div>
  );
}
