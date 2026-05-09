'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Shield, Plus, Edit, RefreshCw, Users, ShieldCheck, ShieldX, Mail, Phone, Clock, Eye, Trash2 } from 'lucide-react';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { SearchInput } from '@/components/common/search-input';
import { BadgeStatus } from '@/components/common/badge-status';
import { DateFormatter } from '@/components/common/date-formatter';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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

const permissionColors: Record<SubAdminPermission, string> = {
  manage_nurses: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  manage_beneficiaries: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  manage_orders: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  manage_payments: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  manage_emergencies: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  view_reports: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  manage_services: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  manage_chat: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  manage_settings: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
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

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = useState<SubAdminItem | null>(null);
  const [adminPassword, setAdminPassword] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);

  // View permissions dialog
  const [viewPermsTarget, setViewPermsTarget] = useState<SubAdminItem | null>(null);

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

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (!adminPassword) {
      toast.error('يرجى إدخال كلمة مرور المدير');
      return;
    }
    setIsDeleting(true);
    try {
      const res = await authFetch(`/api/admin/subadmins/${deleteTarget.id}`, {
        method: 'DELETE',
        body: JSON.stringify({ adminPassword }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم حذف المدير الفرعي بنجاح');
        setDeleteTarget(null);
        setAdminPassword('');
        void fetchSubAdmins();
      } else {
        toast.error(json.error?.message ?? json.message ?? 'فشل الحذف');
      }
    } catch {
      toast.error('حدث خطأ أثناء الحذف');
    } finally {
      setIsDeleting(false);
    }
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
        <div className="flex items-center gap-3">
          <Avatar className="w-10 h-10">
            <AvatarFallback className={`text-xs font-bold ${row.original.isActive ? 'bg-admin/15 text-admin' : 'bg-muted text-muted-foreground'}`}>
              {row.original.name.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{row.original.name}</p>
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Mail className="w-3 h-3" />
              <span dir="ltr">{row.original.email || '—'}</span>
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'الهاتف',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5 text-sm">
          <Phone className="w-3.5 h-3.5 text-muted-foreground" />
          <span dir="ltr">{row.original.phone}</span>
        </div>
      ),
    },
    {
      accessorKey: 'permissions',
      header: 'الصلاحيات',
      cell: ({ row }) => (
        <div className="flex flex-wrap gap-1">
          {row.original.permissions.slice(0, 2).map((p) => (
            <span key={p} className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${permissionColors[p]}`}>
              {permissionLabels[p]}
            </span>
          ))}
          {row.original.permissions.length > 2 && (
            <button
              onClick={() => setViewPermsTarget(row.original)}
              className="text-[10px] px-2 py-0.5 rounded-full bg-admin/10 text-admin hover:bg-admin/20 transition-colors cursor-pointer font-medium"
            >
              +{row.original.permissions.length - 2}
            </button>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'isActive',
      header: 'الحالة',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          {row.original.isActive ? (
            <ShieldCheck className="w-4 h-4 text-green-500" />
          ) : (
            <ShieldX className="w-4 h-4 text-red-400" />
          )}
          <BadgeStatus status={row.original.isActive ? 'active' : 'inactive'} />
        </div>
      ),
    },
    {
      accessorKey: 'lastLoginAt',
      header: 'آخر دخول',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <Clock className="w-3.5 h-3.5 text-muted-foreground" />
          {row.original.lastLoginAt
            ? <DateFormatter date={row.original.lastLoginAt} format="relative" />
            : <span className="text-muted-foreground text-xs">لم يسجل دخول</span>
          }
        </div>
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
    {
      label: 'حذف',
      onClick: (row: Record<string, unknown>) => {
        setDeleteTarget(row as unknown as SubAdminItem);
        setAdminPassword('');
      },
      variant: 'destructive' as const,
    },
  ];

  // Stats
  const activeCount = subadmins.filter(s => s.isActive).length;
  const inactiveCount = subadmins.filter(s => !s.isActive).length;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-admin/20 to-admin/5 flex items-center justify-center border border-admin/20">
            <Shield className="w-6 h-6 text-admin" />
          </div>
          <div className="flex-1">
            <h2 className="text-2xl font-bold tracking-tight">المديرون الفرعيون</h2>
            <p className="text-muted-foreground text-sm">إدارة المديرين الفرعيين وصلاحياتهم</p>
          </div>
          <Button onClick={openAdd} className="bg-admin hover:bg-admin/90 gap-2">
            <Plus className="w-4 h-4" />
            إضافة مدير فرعي
          </Button>
        </div>
      </motion.div>

      {/* Mini Stats */}
      <motion.div variants={itemAnim} className="grid grid-cols-3 gap-3">
        <div className="glass rounded-2xl p-4 text-center hover:shadow-md transition-all">
          <div className="w-10 h-10 rounded-xl bg-admin/10 flex items-center justify-center mx-auto mb-2">
            <Users className="w-5 h-5 text-admin" />
          </div>
          <p className="text-2xl font-bold">{subadmins.length}</p>
          <p className="text-xs text-muted-foreground">إجمالي المديرين</p>
        </div>
        <div className="glass rounded-2xl p-4 text-center hover:shadow-md transition-all">
          <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-2">
            <ShieldCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
          </div>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{activeCount}</p>
          <p className="text-xs text-muted-foreground">فعّال</p>
        </div>
        <div className="glass rounded-2xl p-4 text-center hover:shadow-md transition-all">
          <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-2">
            <ShieldX className="w-5 h-5 text-red-500 dark:text-red-400" />
          </div>
          <p className="text-2xl font-bold text-red-500 dark:text-red-400">{inactiveCount}</p>
          <p className="text-xs text-muted-foreground">معطّل</p>
        </div>
      </motion.div>

      {/* Search & Filter */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="flex-1">
              <SearchInput placeholder="بحث بالاسم أو الهاتف..." onChange={setSearch} className="w-full" />
            </div>
            <Button variant="outline" size="icon" onClick={() => void fetchSubAdmins()} className="shrink-0 border-admin/20 hover:bg-admin/5">
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

      {/* View Permissions Dialog */}
      <Dialog open={!!viewPermsTarget} onOpenChange={(open) => { if (!open) setViewPermsTarget(null); }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="w-5 h-5 text-admin" />
              صلاحيات {viewPermsTarget?.name}
            </DialogTitle>
            <DialogDescription>
              جميع الصلاحيات الممنوحة لهذا المدير الفرعي
            </DialogDescription>
          </DialogHeader>
          {viewPermsTarget && (
            <div className="space-y-2 py-2">
              {viewPermsTarget.permissions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد صلاحيات ممنوحة</p>
              ) : (
                viewPermsTarget.permissions.map((p) => (
                  <div key={p} className={`flex items-center gap-2 p-3 rounded-xl ${permissionColors[p]}`}>
                    <ShieldCheck className="w-4 h-4 shrink-0" />
                    <span className="text-sm font-medium">{permissionLabels[p]}</span>
                  </div>
                ))
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-admin/10 flex items-center justify-center">
                {editingTarget ? <Edit className="w-4 h-4 text-admin" /> : <Plus className="w-4 h-4 text-admin" />}
              </div>
              {editingTarget ? 'تعديل المدير الفرعي' : 'إضافة مدير فرعي جديد'}
            </DialogTitle>
            <DialogDescription>
              {editingTarget ? 'قم بتعديل بيانات وصلاحيات المدير الفرعي' : 'أدخل بيانات المدير الفرعي الجديد'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">الاسم *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="bg-background/50" />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">الهاتف *</Label>
                <Input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} dir="ltr" disabled={!!editingTarget} className="bg-background/50" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">البريد الإلكتروني</Label>
                <Input value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} dir="ltr" type="email" className="bg-background/50" />
              </div>
              {!editingTarget && (
                <div className="space-y-2">
                  <Label className="text-sm font-medium">كلمة المرور *</Label>
                  <Input value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} type="password" dir="ltr" className="bg-background/50" />
                </div>
              )}
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-medium">الصلاحيات</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {allPermissions.map((perm) => (
                  <button
                    key={perm}
                    type="button"
                    onClick={() => togglePermission(perm)}
                    className={`flex items-center gap-2.5 p-2.5 rounded-xl border transition-all text-right ${
                      form.permissions.includes(perm)
                        ? `border-transparent ${permissionColors[perm]}`
                        : 'border-border hover:border-admin/20 bg-background/30'
                    }`}
                  >
                    <Switch
                      checked={form.permissions.includes(perm)}
                      onCheckedChange={() => togglePermission(perm)}
                      className="pointer-events-none"
                    />
                    <span className="text-sm">{permissionLabels[perm]}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex items-center justify-between p-3 rounded-xl glass">
              <div>
                <p className="font-medium text-sm">حساب فعّال</p>
                <p className="text-xs text-muted-foreground">تفعيل أو تعطيل حساب المدير الفرعي</p>
              </div>
              <Switch checked={form.isActive} onCheckedChange={(v) => setForm({ ...form, isActive: v })} />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>إلغاء</Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-admin hover:bg-admin/90 gap-2 min-w-32">
              {isSaving ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  جارٍ الحفظ...
                </>
              ) : editingTarget ? 'تحديث' : 'إضافة'}
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

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setAdminPassword(''); } }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              حذف المدير الفرعي
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف "{deleteTarget?.name ?? ''}"؟ لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-950/20 p-4">
              <p className="text-sm text-red-700 dark:text-red-400 font-medium">تأكيد كلمة مرور المدير</p>
              <p className="text-xs text-red-600/70 dark:text-red-400/70 mt-1">يرجى إدخال كلمة مرور المدير الرئيسي لتأكيد الحذف</p>
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-medium">كلمة مرور المدير *</Label>
              <Input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                placeholder="أدخل كلمة مرور المدير"
                dir="ltr"
                className="bg-background/50"
                disabled={isDeleting}
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setDeleteTarget(null); setAdminPassword(''); }}
              disabled={isDeleting}
            >
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={isDeleting || !adminPassword}
              className="gap-2 min-w-32"
            >
              {isDeleting ? (
                <>
                  <RefreshCw className="w-4 h-4 animate-spin" />
                  جارٍ الحذف...
                </>
              ) : (
                <>
                  <Trash2 className="w-4 h-4" />
                  حذف
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
