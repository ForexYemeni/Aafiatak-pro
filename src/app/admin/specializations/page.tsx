'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Search,
  Stethoscope, Save, X, ChevronDown, ChevronUp, AlertCircle, Check,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/common/glass-card';
import { useAuthFetch } from '@/hooks/use-auth';
import { toast } from 'sonner';
import { SPECIALIZATION_CATEGORIES } from '@/lib/constants';

interface SpecItem {
  _id?: string;
  id: string;
  label: string;
  category: string;
  isActive: boolean;
  isDefault: boolean;
  order: number;
}

const categoryColors: Record<string, string> = {
  'تمريض': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  'مختبر': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
  'أشعة': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  'طبي': 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  'توليد': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  'علاج': 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  'طوارئ': 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  'رعاية': 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  'أخرى': 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

export default function AdminSpecializationsPage() {
  const authFetch = useAuthFetch();
  const [specs, setSpecs] = useState<SpecItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [formId, setFormId] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [formCategory, setFormCategory] = useState('تمريض');
  const [formSaving, setFormSaving] = useState(false);

  const fetchSpecs = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/specializations');
      const data = await res.json();
      if (data.success) setSpecs(data.data);
    } catch {
      toast.error('فشل جلب التخصصات');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => { fetchSpecs(); }, [fetchSpecs]);

  const filtered = specs.filter((s) => {
    const matchSearch = !search ||
      s.label.includes(search) ||
      s.id.includes(search) ||
      s.category.includes(search);
    const matchCat = !selectedCategory || s.category === selectedCategory;
    return matchSearch && matchCat;
  });

  const grouped = SPECIALIZATION_CATEGORIES.reduce<Record<string, SpecItem[]>>((acc, cat) => {
    const items = filtered.filter((s) => s.category === cat);
    if (items.length > 0) acc[cat] = items;
    return acc;
  }, {});

  // Add any uncategorized
  filtered.forEach((s) => {
    if (!SPECIALIZATION_CATEGORIES.includes(s.category)) {
      grouped[s.category] = [...(grouped[s.category] || []), s];
    }
  });

  const handleAddNew = async () => {
    if (!formId.trim() || !formLabel.trim()) {
      toast.error('المعرف والاسم مطلوبان');
      return;
    }
    setFormSaving(true);
    try {
      const res = await authFetch('/api/admin/specializations', {
        method: 'POST',
        body: JSON.stringify({ id: formId.trim(), label: formLabel.trim(), category: formCategory }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('تم إضافة التخصص');
        setShowAdd(false);
        setFormId(''); setFormLabel(''); setFormCategory('تمريض');
        fetchSpecs();
      } else {
        toast.error(data.error?.message || data.message || 'فشل الإضافة');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setFormSaving(false);
    }
  };

  const handleToggle = async (spec: SpecItem) => {
    try {
      const res = await authFetch(`/api/admin/specializations/${spec.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !spec.isActive }),
      });
      const data = await res.json();
      if (data.success) {
        setSpecs((prev) => prev.map((s) => s.id === spec.id ? { ...s, isActive: !s.isActive } : s));
        toast.success(spec.isActive ? 'تم إلغاء التفعيل' : 'تم التفعيل');
      }
    } catch {
      toast.error('حدث خطأ');
    }
  };

  const handleSaveEdit = async (spec: SpecItem, newLabel: string, newCategory: string) => {
    if (!newLabel.trim()) return;
    setFormSaving(true);
    try {
      const res = await authFetch(`/api/admin/specializations/${spec.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ label: newLabel.trim(), category: newCategory }),
      });
      const data = await res.json();
      if (data.success) {
        setSpecs((prev) => prev.map((s) => s.id === spec.id ? { ...s, label: newLabel.trim(), category: newCategory } : s));
        setEditingId(null);
        toast.success('تم الحفظ');
      } else {
        toast.error('فشل الحفظ');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setFormSaving(false);
    }
  };

  const handleDelete = async (spec: SpecItem) => {
    if (spec.isDefault) {
      toast.error('لا يمكن حذف التخصصات الافتراضية — يمكنك إلغاء تفعيلها');
      setDeletingId(null);
      return;
    }
    try {
      const res = await authFetch(`/api/admin/specializations/${spec.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        setSpecs((prev) => prev.filter((s) => s.id !== spec.id));
        toast.success('تم الحذف');
      } else {
        toast.error(data.error?.message || data.message || 'فشل الحذف');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setDeletingId(null);
    }
  };

  const activeCount = specs.filter((s) => s.isActive).length;
  const totalCount = specs.length;

  return (
    <div className="space-y-6">
      {/* ── Header Banner ── */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-l from-admin/90 to-admin p-6 text-white">
        <div className="absolute inset-0 opacity-10"
          style={{ backgroundImage: 'radial-gradient(circle at 20% 50%, white 1px, transparent 1px)', backgroundSize: '24px 24px' }} />
        <div className="relative flex items-start justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/20 flex items-center justify-center">
              <Stethoscope className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-xl font-bold">إدارة التخصصات</h1>
              <p className="text-white/80 text-sm mt-0.5">تخصيص قائمة التخصصات الطبية والتمريضية</p>
            </div>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="px-3 py-1.5 rounded-xl bg-white/20 text-sm font-medium">
              {activeCount} / {totalCount} مفعّل
            </div>
            <Button
              onClick={() => setShowAdd(true)}
              className="bg-white text-admin hover:bg-white/90 gap-2 font-semibold"
            >
              <Plus className="w-4 h-4" /> إضافة تخصص
            </Button>
          </div>
        </div>
      </div>

      {/* ── Add Form ── */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <GlassCard variant="admin" className="p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Plus className="w-4 h-4 text-admin" /> إضافة تخصص جديد
                </h3>
                <Button variant="ghost" size="icon" onClick={() => setShowAdd(false)}>
                  <X className="w-4 h-4" />
                </Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs">المعرف الداخلي (بالإنجليزية)</Label>
                  <Input
                    value={formId}
                    onChange={(e) => setFormId(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                    placeholder="مثال: cardiac_care"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">اسم التخصص (بالعربية)</Label>
                  <Input
                    value={formLabel}
                    onChange={(e) => setFormLabel(e.target.value)}
                    placeholder="مثال: تمريض قلب"
                    dir="rtl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">الفئة</Label>
                  <select
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full h-9 px-3 rounded-md border bg-background text-sm"
                    dir="rtl"
                  >
                    {SPECIALIZATION_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <Button
                  size="sm"
                  className="bg-admin hover:bg-admin/90 gap-1.5"
                  onClick={handleAddNew}
                  disabled={formSaving || !formId || !formLabel}
                >
                  {formSaving ? <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  حفظ
                </Button>
                <Button size="sm" variant="outline" onClick={() => setShowAdd(false)}>إلغاء</Button>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Filters ── */}
      <GlassCard variant="admin" className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث في التخصصات..."
              className="pr-9"
              dir="rtl"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            <button
              onClick={() => setSelectedCategory('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${!selectedCategory ? 'bg-admin text-white border-admin' : 'border-border hover:bg-muted/50'}`}
            >
              الكل ({specs.length})
            </button>
            {SPECIALIZATION_CATEGORIES.filter((cat) =>
              specs.some((s) => s.category === cat)
            ).map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat === selectedCategory ? '' : cat)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors border ${selectedCategory === cat ? 'bg-admin text-white border-admin' : 'border-border hover:bg-muted/50'}`}
              >
                {cat} ({specs.filter((s) => s.category === cat).length})
              </button>
            ))}
          </div>
        </div>
      </GlassCard>

      {/* ── Specs List Grouped by Category ── */}
      {isLoading ? (
        <GlassCard variant="admin" className="p-8 text-center">
          <div className="w-8 h-8 border-2 border-admin/30 border-t-admin rounded-full animate-spin mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        </GlassCard>
      ) : Object.keys(grouped).length === 0 ? (
        <GlassCard variant="admin" className="p-8 text-center">
          <Stethoscope className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">لا توجد نتائج</p>
        </GlassCard>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([category, items]) => (
            <GlassCard key={category} variant="admin" className="p-4">
              <div className="flex items-center gap-2 mb-3 pb-3 border-b border-border">
                <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${categoryColors[category] || 'bg-gray-100 text-gray-700'}`}>
                  {category}
                </span>
                <span className="text-xs text-muted-foreground">{items.length} تخصص</span>
              </div>
              <div className="space-y-2">
                {items.map((spec) => (
                  <SpecRow
                    key={spec.id}
                    spec={spec}
                    isEditing={editingId === spec.id}
                    isDeleting={deletingId === spec.id}
                    onEdit={() => setEditingId(spec.id)}
                    onCancelEdit={() => setEditingId(null)}
                    onSaveEdit={handleSaveEdit}
                    onToggle={handleToggle}
                    onDeleteRequest={() => setDeletingId(spec.id)}
                    onDeleteConfirm={() => handleDelete(spec)}
                    onDeleteCancel={() => setDeletingId(null)}
                    formSaving={formSaving}
                    categoryColors={categoryColors}
                  />
                ))}
              </div>
            </GlassCard>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Spec Row Component ─────────────────────────────────────────────────────

interface SpecRowProps {
  spec: SpecItem;
  isEditing: boolean;
  isDeleting: boolean;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaveEdit: (spec: SpecItem, label: string, category: string) => void;
  onToggle: (spec: SpecItem) => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
  formSaving: boolean;
  categoryColors: Record<string, string>;
}

function SpecRow({
  spec, isEditing, isDeleting, onEdit, onCancelEdit, onSaveEdit,
  onToggle, onDeleteRequest, onDeleteConfirm, onDeleteCancel,
  formSaving, categoryColors,
}: SpecRowProps) {
  const [editLabel, setEditLabel] = useState(spec.label);
  const [editCategory, setEditCategory] = useState(spec.category);

  useEffect(() => {
    if (isEditing) { setEditLabel(spec.label); setEditCategory(spec.category); }
  }, [isEditing, spec.label, spec.category]);

  return (
    <div className={`rounded-xl border p-3 transition-colors ${spec.isActive ? 'bg-card' : 'bg-muted/30 opacity-60'}`}>
      {isEditing ? (
        <div className="space-y-2">
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-[10px] mb-1 block">الاسم</Label>
              <Input value={editLabel} onChange={(e) => setEditLabel(e.target.value)} className="h-8 text-sm" dir="rtl" />
            </div>
            <div>
              <Label className="text-[10px] mb-1 block">الفئة</Label>
              <select
                value={editCategory}
                onChange={(e) => setEditCategory(e.target.value)}
                className="w-full h-8 px-2 rounded-md border bg-background text-sm"
                dir="rtl"
              >
                {SPECIALIZATION_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" className="h-7 text-xs bg-admin hover:bg-admin/90 gap-1"
              onClick={() => onSaveEdit(spec, editLabel, editCategory)} disabled={formSaving || !editLabel.trim()}>
              {formSaving ? <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin" /> : <Check className="w-3 h-3" />}
              حفظ
            </Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onCancelEdit}>إلغاء</Button>
          </div>
        </div>
      ) : isDeleting ? (
        <div className="flex items-center gap-3 flex-wrap">
          <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
          <p className="text-sm flex-1">تأكيد حذف <span className="font-semibold">{spec.label}</span>؟</p>
          <div className="flex gap-2">
            <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={onDeleteConfirm}>حذف</Button>
            <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={onDeleteCancel}>إلغاء</Button>
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-medium text-sm">{spec.label}</span>
              {spec.isDefault && (
                <Badge variant="outline" className="text-[9px] h-4 px-1.5">افتراضي</Badge>
              )}
              {!spec.isActive && (
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">معطّل</Badge>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 font-mono">{spec.id}</p>
          </div>
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={onToggle}
              className={`p-1.5 rounded-lg transition-colors ${spec.isActive ? 'text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20' : 'text-muted-foreground hover:bg-muted/50'}`}
              title={spec.isActive ? 'إلغاء التفعيل' : 'تفعيل'}
            >
              {spec.isActive ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
            </button>
            <button
              onClick={onEdit}
              className="p-1.5 rounded-lg text-muted-foreground hover:text-admin hover:bg-admin/10 transition-colors"
              title="تعديل"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
            {!spec.isDefault && (
              <button
                onClick={onDeleteRequest}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
                title="حذف"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
