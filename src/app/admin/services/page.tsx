'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Edit, Trash2, AlertTriangle, RefreshCw,
  Stethoscope, Heart, Activity, Brain, Baby, Pill,
  Syringe, Ambulance, LayoutGrid, List, CheckCircle2,
  ToggleLeft, ToggleRight, Eye,
  Loader2, Tag, Hash, Info,
} from 'lucide-react';
import { GlassCard } from '@/components/common/glass-card';
import { SearchInput } from '@/components/common/search-input';
import { BadgeStatus } from '@/components/common/badge-status';
import { Currency } from '@/components/common/currency';
import { EmptyState } from '@/components/common/empty-state';
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
import { cn } from '@/lib/utils';

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

const categoryGradients: Record<string, string> = {
  medical: 'from-blue-400 to-blue-600',
  nursing: 'from-rose-400 to-rose-600',
  physiotherapy: 'from-emerald-400 to-emerald-600',
  elderly_care: 'from-amber-400 to-amber-600',
  pediatric: 'from-violet-400 to-violet-600',
  post_surgery: 'from-orange-400 to-orange-600',
  lab: 'from-cyan-400 to-cyan-600',
  emergency: 'from-red-500 to-red-700',
  therapy: 'from-purple-400 to-purple-600',
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
const statCardVariants = {
  hidden: { opacity: 0, scale: 0.9 },
  show: { opacity: 1, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 25 } },
};
const cardHover = {
  scale: 1.015,
  transition: { type: 'spring', stiffness: 400, damping: 25 },
};

const defaultForm = {
  nameAr: '',
  descriptionAr: '',
  basePrice: '' as string | number,
  category: 'nursing',
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
        const sorted = Array.isArray(items) ? items : [];
        sorted.sort((a: ServiceItem, b: ServiceItem) => {
          if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
          return a.nameAr.localeCompare(b.nameAr, 'ar');
        });
        setServices(sorted);
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
      icon: svc.icon || 'Stethoscope',
      isActive: svc.isActive,
      isEmergency: svc.isEmergency,
      sortOrder: svc.sortOrder || 0,
    });
    setDialogOpen(true);
  };

  const openAdd = () => {
    setEditingService(null);
    // Auto-calculate next sort order based on existing services
    const maxSortOrder = services.length > 0
      ? Math.max(...services.map(s => s.sortOrder || 0))
      : 0;
    setForm({ ...defaultForm, sortOrder: maxSortOrder + 1 });
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
      {/* ═══ Professional Gradient Header Banner ═══ */}
      <motion.div variants={item}>
        <div className="relative overflow-hidden rounded-2xl border border-admin/20 bg-gradient-to-l from-admin/8 via-admin/4 to-transparent p-5">
          <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-admin/8 blur-xl" />
          <div className="absolute -bottom-4 left-1/3 w-16 h-16 rounded-full bg-admin/5 blur-lg" />
          <div className="absolute top-2 right-12 w-10 h-10 rounded-full bg-admin/3 blur-md" />
          <div className="relative flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-admin/25 to-admin/10 flex items-center justify-center border border-admin/25 shadow-sm shadow-admin/20">
                <Stethoscope className="w-6 h-6 text-admin" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h1 className="text-xl font-black text-foreground">إدارة الخدمات</h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-admin/15 text-admin border border-admin/25">
                    عافيتك Pro
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">إضافة وتعديل وإدارة خدمات المنصة والأسعار</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-admin/10 border border-admin/20 rounded-xl px-3 py-1.5">
                <Stethoscope className="w-3.5 h-3.5 text-admin" />
                <span className="text-xs font-bold text-admin">{toArabicNum(totalServices)} خدمة</span>
              </div>
              <div className="flex items-center gap-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span className="text-xs font-bold text-emerald-600 dark:text-emerald-400">{toArabicNum(activeServices)} نشطة</span>
              </div>
              {!isSubadmin && (
                <Button
                  onClick={openAdd}
                  className="gap-1.5 bg-gradient-to-l from-admin to-admin/90 hover:from-admin/90 hover:to-admin/80 shadow-sm shadow-admin/25"
                  size="sm"
                >
                  <Plus className="w-4 h-4" />
                  إضافة خدمة
                </Button>
              )}
              <Button variant="outline" size="icon" className="border-admin/30 hover:bg-admin/8 hover:border-admin/50" onClick={() => void fetchServices()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ═══ Gradient Stat Cards ═══ */}
      <motion.div
        variants={container}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 md:grid-cols-4 gap-3"
      >
        <motion.div variants={statCardVariants}>
          <div className={cn('relative overflow-hidden rounded-2xl bg-gradient-to-br p-4 text-white shadow-lg', `from-sky-500 to-sky-700 shadow-sky-500/20`)}>
            <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8" />
            <Stethoscope className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{toArabicNum(totalServices)}</p>
            <p className="text-xs text-sky-100">إجمالي الخدمات</p>
          </div>
        </motion.div>
        <motion.div variants={statCardVariants}>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-white shadow-lg shadow-emerald-500/20">
            <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8" />
            <CheckCircle2 className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{toArabicNum(activeServices)}</p>
            <p className="text-xs text-emerald-100">خدمات نشطة</p>
          </div>
        </motion.div>
        <motion.div variants={statCardVariants}>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-red-500 to-red-700 p-4 text-white shadow-lg shadow-red-500/20">
            <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8" />
            <Ambulance className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{toArabicNum(emergencyServices)}</p>
            <p className="text-xs text-red-100">خدمات طوارئ</p>
          </div>
        </motion.div>
        <motion.div variants={statCardVariants}>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 p-4 text-white shadow-lg shadow-amber-500/20">
            <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8" />
            <Eye className="w-8 h-8 mb-2 opacity-80" />
            <p className="text-2xl font-bold">{toArabicNum(Object.keys(categoryCounts).length)}</p>
            <p className="text-xs text-amber-100">عدد الفئات</p>
          </div>
        </motion.div>
      </motion.div>

      {/* ═══ Category Filter & Search ═══ */}
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

      {/* ═══ Services Grid / Table View ═══ */}
      <motion.div variants={item}>
        {isLoading ? (
          <GlassCard variant="admin" className="p-16">
            <div className="flex flex-col items-center gap-3">
              <Loader2 className="w-10 h-10 animate-spin text-admin" />
              <p className="text-sm text-muted-foreground">جاري تحميل الخدمات...</p>
            </div>
          </GlassCard>
        ) : services.length === 0 ? (
          <GlassCard variant="admin" className="p-8">
            <EmptyState
              icon={<Stethoscope className="w-10 h-10 text-muted-foreground" />}
              title="لا توجد خدمات"
              description="لم يتم العثور على خدمات مطابقة لمعايير البحث"
              variant="admin"
              action={search || categoryFilter !== 'all' ? { label: 'إعادة تعيين', onClick: () => { setSearch(''); setCategoryFilter('all'); } } : undefined}
              secondaryAction={!isSubadmin ? { label: 'إضافة خدمة جديدة', onClick: openAdd } : undefined}
            />
          </GlassCard>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {services.map((service) => {
              const Icon = categoryIcons[service.category] || getIconComponent(service.icon);
              const gradient = categoryGradients[service.category] || 'from-gray-400 to-gray-500';
              const catColor = categoryColors[service.category] || 'bg-muted text-muted-foreground';
              return (
                <motion.div
                  key={service.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  whileHover={cardHover}
                  className={cn(
                    'group relative rounded-2xl border bg-card shadow-sm transition-all duration-300 hover:shadow-xl overflow-hidden',
                    !service.isActive && 'opacity-60'
                  )}
                >
                  {/* Gradient accent top bar */}
                  <div className={cn(
                    'h-1.5 w-full',
                    service.isEmergency
                      ? 'bg-gradient-to-l from-red-500 to-red-400'
                      : `bg-gradient-to-l ${gradient}`
                  )} />

                  <div className="p-4 space-y-3">
                    {/* Header with gradient icon and status */}
                    <div className="flex items-start justify-between">
                      <div className={cn('w-12 h-12 rounded-xl bg-gradient-to-br flex items-center justify-center shadow-sm', gradient)}>
                        <Icon className="w-5 h-5 text-white" />
                      </div>
                      <div className="flex items-center gap-1.5">
                        {service.isEmergency && (
                          <Badge variant="destructive" className="text-[10px] px-1.5 py-0 gap-0.5">
                            <Ambulance className="w-2.5 h-2.5" />
                            طوارئ
                          </Badge>
                        )}
                        <div className={cn(
                          'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium',
                          service.isActive
                            ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                            : 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400'
                        )}>
                          <div className={cn('w-1.5 h-1.5 rounded-full', service.isActive ? 'bg-green-500' : 'bg-gray-400')} />
                          {service.isActive ? 'نشطة' : 'متوقفة'}
                        </div>
                      </div>
                    </div>

                    {/* Service Name & Description */}
                    <div>
                      <h3 className="font-bold text-sm leading-tight line-clamp-2">{service.nameAr}</h3>
                      {service.descriptionAr && (
                        <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">{service.descriptionAr}</p>
                      )}
                    </div>

                    {/* Category & Duration Row */}
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge variant="outline" className={cn('text-[10px] gap-1', catColor.split(' ').slice(0, 1).join(' '), catColor.split(' ').slice(2).join(' '))}>
                        <Tag className="w-2.5 h-2.5" />
                        {categoryLabels[service.category] || service.category}
                      </Badge>
                      {service.sortOrder > 0 && (
                        <span className="text-[10px] text-muted-foreground bg-muted/80 px-1.5 py-0.5 rounded-full flex items-center gap-0.5">
                          <Hash className="w-2.5 h-2.5" />
                          {toArabicNum(service.sortOrder)}
                        </span>
                      )}
                    </div>

                    {/* Price Section */}
                    <div className="rounded-xl bg-muted/40 backdrop-blur-sm p-3 border border-border/30">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-[10px] text-muted-foreground mb-0.5">السعر الأساسي</p>
                          <div className="flex items-baseline gap-1">
                            <Currency amount={service.basePrice} className="text-base font-bold" />
                          </div>
                        </div>
                        <div className={cn('w-10 h-10 rounded-lg flex items-center justify-center', catColor.split(' ').slice(0, 1).join(' '))}>
                          <Icon className={cn('w-5 h-5', catColor.split(' ').slice(2).join(' '))} />
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    {!isSubadmin && (
                      <div className="flex items-center gap-1 pt-2 border-t border-border/30">
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1 hover:bg-admin/10 hover:text-admin" onClick={() => openEdit(service)}>
                          <Edit className="w-3.5 h-3.5" /> تعديل
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs gap-1" onClick={() => setToggleTarget(service)}>
                          {service.isActive ? (
                            <><ToggleRight className="w-3.5 h-3.5 text-orange-500" /> إيقاف</>
                          ) : (
                            <><ToggleLeft className="w-3.5 h-3.5 text-green-500" /> تفعيل</>
                          )}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/20 gap-1" onClick={() => setDeleteTarget(service)}>
                          <Trash2 className="w-3.5 h-3.5" /> حذف
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
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-right text-xs font-medium text-muted-foreground p-3">الخدمة</th>
                    <th className="text-right text-xs font-medium text-muted-foreground p-3">الفئة</th>
                    <th className="text-right text-xs font-medium text-muted-foreground p-3">السعر</th>
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
                          <div className="flex items-center gap-3">
                            <div className={cn('w-9 h-9 rounded-lg flex items-center justify-center shrink-0', catColor.split(' ').slice(0, 1).join(' '))}>
                              <Icon className={cn('w-4 h-4', catColor.split(' ').slice(2).join(' '))} />
                            </div>
                            <div className="min-w-0">
                              <p className="font-semibold text-sm truncate">{service.nameAr}</p>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {service.isEmergency && (
                                  <span className="text-[10px] text-red-500 font-medium flex items-center gap-0.5">
                                    <Ambulance className="w-2.5 h-2.5" />
                                    طوارئ
                                  </span>
                                )}
                                {service.sortOrder > 0 && (
                                  <span className="text-[10px] text-muted-foreground">#{service.sortOrder}</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant="outline" className="text-[10px] gap-1">
                            <Tag className="w-2.5 h-2.5" />
                            {categoryLabels[service.category] || service.category}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <div className="flex flex-col">
                            <Currency amount={service.basePrice} className="text-sm font-bold" />
                            <span className="text-[10px] text-muted-foreground">ر.ي</span>
                          </div>
                        </td>
                        <td className="p-3">
                          <BadgeStatus
                            status={service.isActive ? 'active' : 'inactive'}
                            label={service.isActive ? 'نشطة' : 'متوقفة'}
                          />
                        </td>
                        {!isSubadmin && (
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 hover:bg-admin/10 hover:text-admin" onClick={() => openEdit(service)}>
                                <Edit className="w-3.5 h-3.5" />
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => setToggleTarget(service)}>
                                {service.isActive ? <ToggleRight className="w-3.5 h-3.5 text-orange-500" /> : <ToggleLeft className="w-3.5 h-3.5 text-green-500" />}
                              </Button>
                              <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20" onClick={() => setDeleteTarget(service)}>
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

      {/* ═══ Add/Edit Dialog ═══ */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editingService ? (
                <>
                  <div className="w-8 h-8 rounded-lg bg-admin/10 flex items-center justify-center">
                    <Edit className="w-4 h-4 text-admin" />
                  </div>
                  تعديل الخدمة
                </>
              ) : (
                <>
                  <div className="w-8 h-8 rounded-lg bg-admin/10 flex items-center justify-center">
                    <Plus className="w-4 h-4 text-admin" />
                  </div>
                  إضافة خدمة جديدة
                </>
              )}
            </DialogTitle>
            <DialogDescription>
              {editingService ? 'قم بتعديل بيانات الخدمة' : 'أدخل بيانات الخدمة الجديدة'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="text-sm font-semibold">اسم الخدمة *</Label>
              <Input
                value={form.nameAr}
                onChange={(e) => setForm({ ...form, nameAr: e.target.value })}
                placeholder="مثال: تمريض منزلي"
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label className="text-sm font-semibold">الوصف</Label>
              <Textarea
                value={form.descriptionAr}
                onChange={(e) => setForm({ ...form, descriptionAr: e.target.value })}
                placeholder="وصف الخدمة..."
                rows={3}
                className="resize-none"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">الفئة *</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger className="h-11">
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
                <Label className="text-sm font-semibold flex items-center gap-1">
                  السعر الأساسي (ر.ي) *
                  <Info className="w-3 h-3 text-muted-foreground" />
                </Label>
                <Input
                  type="number"
                  value={form.basePrice}
                  onChange={(e) => setForm({ ...form, basePrice: e.target.value })}
                  placeholder="0"
                  min={0}
                  className="h-11"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-semibold">الأيقونة</Label>
                <Select value={form.icon} onValueChange={(v) => setForm({ ...form, icon: v })}>
                  <SelectTrigger className="h-11">
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
              <div className="space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  ترتيب الفرز
                  {!editingService && (
                    <span className="text-[10px] text-green-600 dark:text-green-400 font-normal">(تلقائي)</span>
                  )}
                </Label>
                <Input
                  type="number"
                  value={form.sortOrder}
                  onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
                  min={0}
                  className="h-11"
                />
              </div>
            </div>

            {/* Switches with better styling */}
            <div className="flex items-center gap-6 p-3 rounded-xl bg-muted/40 border border-border/30">
              <div className="flex items-center gap-2.5">
                <Switch
                  checked={form.isActive}
                  onCheckedChange={(v) => setForm({ ...form, isActive: v })}
                />
                <div>
                  <Label className="text-sm font-medium">نشطة</Label>
                  <p className="text-[10px] text-muted-foreground">تفعيل/إيقاف الخدمة</p>
                </div>
              </div>
              <div className="flex items-center gap-2.5">
                <Switch
                  checked={form.isEmergency}
                  onCheckedChange={(v) => setForm({ ...form, isEmergency: v })}
                />
                <div>
                  <Label className="text-sm font-medium">خدمة طوارئ</Label>
                  <p className="text-[10px] text-muted-foreground">متاحة للطوارئ</p>
                </div>
              </div>
            </div>

            {/* Enhanced Preview Card */}
            {form.nameAr && (
              <div className="space-y-2">
                <Label className="text-xs text-muted-foreground flex items-center gap-1">
                  <Eye className="w-3 h-3" />
                  معاينة البطاقة
                </Label>
                <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
                  {/* Preview gradient bar */}
                  <div className={cn('h-1.5 w-full bg-gradient-to-l', categoryGradients[form.category] || 'from-gray-400 to-gray-500')} />
                  <div className="p-3">
                    <div className="flex items-center gap-3">
                      <div className={cn('w-10 h-10 rounded-xl bg-gradient-to-br flex items-center justify-center', categoryGradients[form.category] || 'from-gray-400 to-gray-500')}>
                        {(() => {
                          const PreviewIcon = getIconComponent(form.icon);
                          return <PreviewIcon className="w-5 h-5 text-white" />;
                        })()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm">{form.nameAr}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0">
                            {categoryLabels[form.category]}
                          </Badge>
                          {form.isEmergency && (
                            <Badge variant="destructive" className="text-[9px] px-1.5 py-0">طوارئ</Badge>
                          )}
                        </div>
                      </div>
                      <div className="text-left">
                        <Currency amount={Number(form.basePrice) || 0} className="text-sm font-bold" />
                        <p className="text-[9px] text-muted-foreground">ر.ي</p>
                      </div>
                    </div>
                    {form.descriptionAr && (
                      <p className="text-[10px] text-muted-foreground mt-2 line-clamp-1">{form.descriptionAr}</p>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={isSaving}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={isSaving} className="bg-gradient-to-l from-admin to-admin/90 hover:from-admin/90 hover:to-admin/80 shadow-sm shadow-admin/25 gap-1.5">
              {isSaving ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الحفظ...</>
              ) : editingService ? (
                <><CheckCircle2 className="w-4 h-4" /> تحديث</>
              ) : (
                <><Plus className="w-4 h-4" /> إضافة</>
              )}
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
              <div className="w-8 h-8 rounded-lg bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                <Trash2 className="w-4 h-4" />
              </div>
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
              className="gap-1.5"
            >
              {isDeleting ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> جارٍ الحذف...</>
              ) : (
                <><Trash2 className="w-4 h-4" /> حذف نهائياً</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
