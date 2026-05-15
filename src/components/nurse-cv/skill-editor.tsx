'use client';

import { useState } from 'react';
import { Plus, Trash2, ChevronUp, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GlassCard } from '@/components/common/glass-card';

export interface SkillData {
  name: string;
  level: string;
  order: number;
}

interface SkillEditorProps {
  skills: SkillData[];
  onSave: (skills: SkillData[]) => Promise<void>;
  onCancel: () => void;
}

const SUGGESTED_SKILLS = [
  'العناية المركزة', 'الطوارئ', 'الرقود', 'رعاية كبار السن',
  'إعطاء الأدوية', 'تركيب المحاليل', 'العناية المنزلية',
  'متابعة الحالات المزمنة', 'الإنعاش القلبي', 'العناية بالجروح',
  'سحب العينات', 'رعاية الأطفال', 'الرعاية بعد العمليات',
];

const levelLabels: Record<string, string> = {
  beginner: 'مبتدئ',
  intermediate: 'متوسط',
  advanced: 'متقدم',
  expert: 'خبير',
};

export function SkillEditor({ skills: initialSkills, onSave, onCancel }: SkillEditorProps) {
  const [skills, setSkills] = useState<SkillData[]>(initialSkills);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillLevel, setNewSkillLevel] = useState('intermediate');
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = () => {
    if (!newSkillName.trim()) return;
    if (skills.some(s => s.name === newSkillName.trim())) return;

    setSkills(prev => [...prev, {
      name: newSkillName.trim(),
      level: newSkillLevel,
      order: prev.length,
    }]);
    setNewSkillName('');
    setNewSkillLevel('intermediate');
  };

  const handleAddSuggestion = (name: string) => {
    if (skills.some(s => s.name === name)) return;
    setSkills(prev => [...prev, { name, level: 'intermediate', order: prev.length }]);
  };

  const handleRemove = (index: number) => {
    setSkills(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, order: i })));
  };

  const handleLevelChange = (index: number, level: string) => {
    setSkills(prev => prev.map((s, i) => i === index ? { ...s, level } : s));
  };

  const handleMoveUp = (index: number) => {
    if (index === 0) return;
    setSkills(prev => {
      const arr = [...prev];
      [arr[index - 1], arr[index]] = [arr[index], arr[index - 1]];
      return arr.map((s, i) => ({ ...s, order: i }));
    });
  };

  const handleMoveDown = (index: number) => {
    if (index === skills.length - 1) return;
    setSkills(prev => {
      const arr = [...prev];
      [arr[index], arr[index + 1]] = [arr[index + 1], arr[index]];
      return arr.map((s, i) => ({ ...s, order: i }));
    });
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(skills);
    } finally {
      setIsSaving(false);
    }
  };

  // Filter out already-added suggestions
  const availableSuggestions = SUGGESTED_SKILLS.filter(s => !skills.some(sk => sk.name === s));

  return (
    <GlassCard variant="nurse" className="p-4 space-y-4">
      <h3 className="font-semibold text-sm flex items-center gap-2">تعديل المهارات</h3>

      {/* Current skills */}
      <div className="space-y-2 max-h-64 overflow-y-auto custom-scrollbar">
        {skills.map((skill, index) => (
          <div key={skill.name + index} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            <div className="flex flex-col gap-0.5">
              <button onClick={() => handleMoveUp(index)} className="p-0.5 hover:text-nurse" disabled={index === 0}>
                <ChevronUp className="w-3 h-3" />
              </button>
              <button onClick={() => handleMoveDown(index)} className="p-0.5 hover:text-nurse" disabled={index === skills.length - 1}>
                <ChevronDown className="w-3 h-3" />
              </button>
            </div>
            <span className="flex-1 text-sm font-medium">{skill.name}</span>
            <Select value={skill.level} onValueChange={(v) => handleLevelChange(index, v)}>
              <SelectTrigger className="w-24 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(levelLabels).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <button onClick={() => handleRemove(index)} className="p-1 text-red-500 hover:text-red-600">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
      </div>

      {/* Add new skill */}
      <div className="space-y-2">
        <Label className="text-xs">إضافة مهارة جديدة</Label>
        <div className="flex gap-2">
          <Input
            value={newSkillName}
            onChange={(e) => setNewSkillName(e.target.value)}
            placeholder="اسم المهارة"
            className="flex-1 h-9 text-sm"
          />
          <Select value={newSkillLevel} onValueChange={setNewSkillLevel}>
            <SelectTrigger className="w-24 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(levelLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleAdd} disabled={!newSkillName.trim()} className="bg-nurse hover:bg-nurse/90">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Suggestions */}
      {availableSuggestions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">اقتراحات سريعة</Label>
          <div className="flex flex-wrap gap-1.5">
            {availableSuggestions.map((name) => (
              <button
                key={name}
                onClick={() => handleAddSuggestion(name)}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-medium bg-nurse/10 text-nurse hover:bg-nurse/20 transition-colors"
              >
                <Plus className="w-3 h-3" />
                {name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
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
