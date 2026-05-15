'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { GlassCard } from '@/components/common/glass-card';

export interface ExperienceData {
  facility?: string;
  title?: string;
  duration?: string;
  description?: string;
  casesType?: string;
  startDate?: string;
  endDate?: string;
  order: number;
}

interface ExperienceEditorProps {
  experiences: ExperienceData[];
  onSave: (experiences: ExperienceData[]) => Promise<void>;
  onCancel: () => void;
}

const emptyExperience: ExperienceData = {
  facility: '',
  title: '',
  duration: '',
  description: '',
  casesType: '',
  order: 0,
};

export function ExperienceEditor({ experiences: initialExperiences, onSave, onCancel }: ExperienceEditorProps) {
  const [experiences, setExperiences] = useState<ExperienceData[]>(
    initialExperiences.length > 0 ? initialExperiences : [{ ...emptyExperience }]
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = () => {
    setExperiences(prev => [...prev, { ...emptyExperience, order: prev.length }]);
  };

  const handleRemove = (index: number) => {
    setExperiences(prev => prev.filter((_, i) => i !== index).map((e, i) => ({ ...e, order: i })));
  };

  const handleChange = (index: number, field: keyof ExperienceData, value: string) => {
    setExperiences(prev => prev.map((e, i) => i === index ? { ...e, [field]: value } : e));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Filter out completely empty entries
      const filtered = experiences.filter(e => e.facility || e.title || e.description);
      await onSave(filtered);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <GlassCard variant="nurse" className="p-4 space-y-4">
      <h3 className="font-semibold text-sm">تعديل الخبرات العملية</h3>

      <div className="space-y-4 max-h-96 overflow-y-auto custom-scrollbar">
        {experiences.map((exp, index) => (
          <div key={index} className="p-3 rounded-lg bg-muted/20 space-y-3 relative">
            {experiences.length > 1 && (
              <button
                onClick={() => handleRemove(index)}
                className="absolute top-2 left-2 p-1 text-red-500 hover:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">المسمى الوظيفي</Label>
                <Input
                  value={exp.title || ''}
                  onChange={(e) => handleChange(index, 'title', e.target.value)}
                  placeholder="مثال: ممرض طوارئ"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">جهة العمل</Label>
                <Input
                  value={exp.facility || ''}
                  onChange={(e) => handleChange(index, 'facility', e.target.value)}
                  placeholder="مثال: مستشفى الثورة"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">مدة العمل</Label>
                <Input
                  value={exp.duration || ''}
                  onChange={(e) => handleChange(index, 'duration', e.target.value)}
                  placeholder="مثال: ٣ سنوات"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">نوع الحالات</Label>
                <Input
                  value={exp.casesType || ''}
                  onChange={(e) => handleChange(index, 'casesType', e.target.value)}
                  placeholder="مثال: حالات الطوارئ"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">وصف المهام</Label>
              <Textarea
                value={exp.description || ''}
                onChange={(e) => handleChange(index, 'description', e.target.value)}
                placeholder="وصف مختصر للمهام والمسؤوليات"
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={handleAdd} className="w-full gap-2">
        <Plus className="w-4 h-4" />
        إضافة خبرة جديدة
      </Button>

      <div className="flex gap-2 pt-2">
        <Button className="flex-1 bg-nurse hover:bg-nurse/90" onClick={handleSave} disabled={isSaving}>
          {isSaving ? (
            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin me-1" />
          ) : null}
          حفظ
        </Button>
        <Button variant="outline" className="flex-1" onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </GlassCard>
  );
}
