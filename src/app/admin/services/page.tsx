'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Edit, Trash2, AlertTriangle, RefreshCw,
  Stethoscope, Heart, Activity, Brain, Baby, Pill,
  Syringe, Ambulance, LayoutGrid, List, CheckCircle2,
  XCircle, Search, ToggleLeft, ToggleRight, Eye,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard } from '@/components/common/glass-card';
import { SearchInput } from '@/components/common/search-input';
import { BadgeStatus } from '@/components/common/badge-status';
import { Currency, formatYemeniRial } from '@/components/common/currency';
import { useAuthFetch } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
import { toArabicNum } from '@/components/common/date-formatter';

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
  icon: string;
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
  therapy: 'علاج نفسي',
};

const categoryIcons: Record<string, React.ElementType> = {
  medical: Stethoscope,
  nursing: Heart,
  physiotherapy: Activity,
  elderly_care: Brain,
  pediatric: Baby,
  post_surgery: Pill,
  lab: Syringe,
  emergency: Ambulance,
  therapy: Brain,
};

const categoryColors: Record<string, string> = {
  medical: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  nursing: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
  physiotherapy: 'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 dark:text-emerald-400',
  elderly_care: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
  pediatric: 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-400',
  post_surgery: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  lab: 'bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 dark:text-cyan-400',
  emergency: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
  therapy: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
};

const iconOptions = [
  { value: 'Stethoscope', label: 'سماعة طبيب', icon: Stethoscope },
  { value: 'Heart', label: 'قلب', icon: Heart },
  { value: 'Activity', label: 'نشاط', icon: Activity },
  { value: 'Brain', label: 'دماغ', icon: Brain },
  { value: 'Baby', label: 'طفل', icon: Baby },
  { value: 'Pill', label: 'دواء', icon: Pill },
  { value: 'Syringe', label: 'حقنة', icon: Syringe },
  { value: 'Ambulance', label: 'إسعاف', icon: Ambulance },
];

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
  duration: 60,
  icon: 'Stethoscope',
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
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid');

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
        nameEn: form.nameAr,
        descriptionAr: form.descriptionAr,
        basePrice: price,
        category: form.category,
        duration: form.duration || 60,
        icon: form.icon,
        isActive: form.isActive,
        isEmergency: form.isEmergency,
        sortOrder: form.sortOrder || 0,
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
      duration: svc.duration || 60,
      icon: svc.icon || 'Stethoscope',
      isActive: svc.isActive,
      isEmergency: svc.isEmergency,
      sortOrder: svc.sortOrder || 0,
    });
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditingService(null);
    setForm(defaultForm);
    setDialogOpen(true);
  };

  const user = useAuthStore((s) => s.user);
  const isSubadmin = user?.role === 'subadmin';

  // Statistics
  const totalServices = services.length;
  const activeServices = services.filter(s => s.isActive).length;
  const emergencyServices = services.filter(s => s.isEmergency).length;
  const categoryCounts: Record<string, number> = {};
  services.forEach(s => {
    categoryCounts[s.category] = (categoryCounts[s.category] || 0) + 1;
  });

  // Get icon component
  const getIconComponent = (iconName: string): React.ElementType => {
    const found = iconOptions.find(o => o.value === iconName);
    return found?.icon || Stethoscope;
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={item}>
        <PageHeader
          title="إدارة الخدمات"
          description="إضافة وتعديل وإدارة خدمات المنصة"
          {...(!isSubadmin ? { action: { label: 'إضافة خدمة', onClick: openAdd, icon: <Plus className="w-4 h-4" /> } } : {})}
        />
      </motion.div>

      {/* Statistics Cards */}
      <motion.div variants={item} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <GlassCard variant="admin" className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-admin/10 flex items-center justify-center">
              <Stethoscope className="w-5 h-5 text-admin" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الخدمات</p>
              <p className="text-xl font-bold">{toArabicNum(totalServices)}</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard variant="admin" className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">خدمات نشطة</p>
              <p className="text-xl font-bold text-green-600">{toArabicNum(activeServices)}</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard variant="admin" className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Ambulance className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">خدمات طوارئ</p>
              <p className="text-xl font-bold text-red-600">{toArabicNum(emergencyServices)}</p>
            </div>
          </div>
        </GlassCard>
        <GlassCard variant="admin" className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Eye className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">عدد الفئات</p>
              <p className="text-xl font-bold">{toArabicNum(Object.keys(categoryCounts).length)}</p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Category Filter & Search */}
      <motion.div variants={item}>
        <GlassCard variant="admin" className="p-4">
          <div className="flex flex-col gap-4">
            {/* Search & View Toggle Row */}
            <div className="flex items-center gap-3">
              <SearchInput
                placeholder="بحث عن خدمة..."
                onChange={setSearch}
                className="flex-1"
              />
              <div className="flex items-center gap-1 p-1 rounded-xl bg-muted">
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'grid' ? 'bg-admin text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  onClick={() => setViewMode('table')}
                  className={`p-2 rounded-lg transition-all ${viewMode === 'table' ? 'bg-admin text-white shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
              <Button variant="outline" size="icon" onClick={() => void fetchServices()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>

            {/* Category Tabs */}
            <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
              <button
                onClick={() => setCategoryFilter('all')}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all shrink-0 ${
                  categoryFilter === 'all' ? 'bg-admin text-white shadow-sm' : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                }`}
              >
                الكل ({toArabicNum(totalServices)})
              </button>
              {Object.entries(categoryLabels).map(([key, label]) => {
                const Icon = categoryIcons[key] || Stethoscope;
                const count = categoryCounts[key] || 0;
                return (
                  <button
                    key={key}
                    onClick={() => setCategoryFilter(key)}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all shrink-0 ${
                      categoryFilter === key ? 'bg-admin text-white shadow-sm' : 'bg-muted/50 hover:bg-muted text-muted-foreground'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {label} ({toArabicNum(count)})
                  </button>
                );
              })}
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* Services Grid / Table View */}
      <motion.div variants={item}>
        {services.length === 0 ? (
          <GlassCard variant="admin" className="p-12 text-center">
            <Stethoscope className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
            <p className="text-muted-foreground">لا توجد خدمات</p>
            {!isSubadmin && (
              <Button className="mt-4 bg-admin hover:bg-admin/90" onClick={openAdd}>
                <Plus className="w-4 h-4 ml-2" /> إضافة خدمة جديدة
              </Button>
            )}
          </GlassCard>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {services.map((service) => {
              const Icon = categoryIcons[service.category] || getIconComponent(service.icon);
              const catColor = categoryColors[service.category] || 'bg-muted text-muted-foreground';
              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl border bg-card shadow-sm transition-all hover:shadow-md ${!service.isActive ? 'opacity-60' : ''}`}
                >
                  <div className="p-4 space-y-3">
                    {/* Header with icon and status */}
                    <div className="flex items-start justify-between">
                      <div className={`w-10 h-10 rounded-xl ${catColor.split(' ').slice(0, 1).join(' ')} flex items-center justify-center`}>
                        <Icon className={`w-5 h-5 ${catColor.split(' ').slice(2).join(' ')}`} />
                      </div>
                      <div className="flex items-center gap-1">
                        {service.isEmergency && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">طوارئ</Badge>
                        )}
                        <Badge variant={service.isActive ? 'default' : 'secondary'} className={`text-[10px] px-1.5 py-0 ${service.isActive ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' : ''}`}>
                          {service.isActive ? 'نشطة' : 'متوقفة'}
                        </Badge>
                      </div>
                    </div>

                    {/* Service Name */}
                    <div>
                      <h3 className="font-semibold text-sm leading-tight line-clamp-2">{service.nameAr}</h3>
                      {service.descriptionAr && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{service.descriptionAr}</p>
                      )}
                    </div>

                    {/* Category Badge */}
                    <Badge variant="outline" className="text-[10px]">
                      {categoryLabels[service.category] || service.category}
                    </Badge>

                    {/* Price & Duration */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/30">
                      <Currency amount={service.basePrice} className="text-sm font-bold" />
                      <span className="text-xs text-muted-foreground">{toArabicNum(service.duration)} د</span>
                    </div>

                    {/* Actions */}
                    {!isSubadmin && (
                      <div className="flex items-center gap-1 pt-2 border-t border-border/30">
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => openEdit(service)}>
                          <Edit className="w-3.5 h-3.5 ml-1" /> تعديل
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs" onClick={() => setToggleTarget(service)}>
                          {service.isActive ? (
                            <><ToggleRight className="w-3.5 h-3.5 ml-1 text-orange-500" /> إيقاف</>
                          ) : (
                            <><ToggleLeft className="w-3.5 h-3.5 ml-1 text-green-500" /> تفعيل</>
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-red-600 hover:text-red-700" onClick={() => setDeleteTarget(service)}>
                          <Trash2 className="w-3.5 h-3.5 ml-1" /> حذف
                        </Button>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
        ) : (
          /* Table View */
          <GlassCard variant="admin" noPadding className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-right text-xs font-medium text-muted-foreground p-3">الخدمة</th>
                    <th className="text-right text-xs font-medium text-muted-foreground p-3">الفئة</th>
                    <th className="text-right text-xs font-medium text-muted-foreground p-3">السعر</th>
                    <th className="text-right text-xs font-medium text-muted-foreground p-3">المدة</th>
                    <th className="text-right text-xs font-medium text-muted-foreground p-3">الحالة</th>
                    {!isSubadmin && <th className="text-right text-xs font-medium text-muted-foreground p-3">إجراءات</th>}
                  </tr>
                </thead>
                <tbody>
                  {services.map((service) => {
                    const Icon = categoryIcons[service.category] || getIconComponent(service.icon);
                    const catColor = categoryColors[service.category] || 'bg-muted text-muted-foreground';
                    return (
                      <tr key={service.id} className={`border-b border-border/50 hover:bg-muted/30 transition-colors ${!service.isActive ? 'opacity-60' : ''}`}>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-lg ${catColor.split(' ').slice(0, 1).join(' ')} flex items-center justify-center shrink-0`}>
                              <Icon className={`w-4 h-4 ${catColor.split(' ').slice(2).join(' ')}`} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium text-sm truncate">{service.nameAr}</p>
                              {service.isEmergency && (
                                <span className="text-[10px] text-red-500 font-medium">خدمة طوارئ</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px]">{categoryLabels[service.category] || service.category}</Badge>
                        </td>
                        <td className="p-3"><Currency amount={service.basePrice} className="text-sm" /></td>
                        <td className="p-3 text-sm text-muted-foreground">{toArabicNum(service.duration)} د</td>
                        <td className="p-3">
                          <BadgeStatus
                            status={service.isActive ? 'active' : 'inactive'}
                            label={service.isActive ? 'نشطة' : 'متوقفة'}
                          />
                        </td>
                        {!isSubadmin && (
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => openEdit(service)}>
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setToggleTarget(service)}>
                                {service.isActive ? <ToggleRight className="w-3.5 h-3.5 text-orange-500" /> : <ToggleLeft className="w-3.5 h-3.5 text-green-500" />}
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600" onClick={() => setDeleteTarget(service)}>
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </div>
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </GlassCard>
        )}
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
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>المدة (دقيقة)</Label>
                <Input
                  type="number"
                  value={form.duration}
                  onChange={(e) => setForm({ ...form, duration: parseInt(e.target.value) || 60 })}
                  min={5}
                  max={300}
                />
              </div>
              <div className="space-y-2">
                <Label>الأيقونة</Label>
                <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {iconOptions.map((opt) => (
                      <SelectItem key={opt.value} value={opt.value}>
                        <div className="flex items-center gap-2">
                          <opt.icon className="w-4 h-4" />
                          {opt.label}
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>ترتيب الفرز</Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </div>
              <div className="flex flex-col gap-3 justify-center">
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

            {/* Preview Card */}
            {form.nameAr && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground">معاينة البطاقة</Label>
                <div className="rounded-xl border bg-card p-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${categoryColors[form.category]?.split(' ').slice(0, 1).join(' ') || 'bg-muted'} flex items-center justify-center`}>
                      {(() => {
                        const PreviewIcon = getIconComponent(form.icon);
                        return <PreviewIcon className={`w-5 h-5 ${categoryColors[form.category]?.split(' ').slice(2).join(' ') || 'text-muted-foreground'}`} />;
                      })()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm">{form.nameAr}</p>
                      <p className="text-xs text-muted-foreground">{categoryLabels[form.category]} • {toArabicNum(form.duration || 60)} دقيقة</p>
                    </div>
                    <Currency amount={Number(form.basePrice) || 0} className="text-sm font-bold" />
                  </div>
                </div>
              </div>
            )}
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
