'use client';

import { useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { GlassCard } from '@/components/common/glass-card';

export interface LanguageData {
  name: string;
  level: string;
}

interface LanguageEditorProps {
  languages: LanguageData[];
  onSave: (languages: LanguageData[]) => Promise<void>;
  onCancel: () => void;
}

const SUGGESTED_LANGUAGES = [
  'العربية', 'الإنجليزية', 'الفرنسية', 'الأردية', 'الهندية',
];

const levelLabels: Record<string, string> = {
  native: 'لغة أم',
  fluent: 'ممتاز',
  advanced: 'متقدم',
  intermediate: 'متوسط',
  basic: 'أساسي',
};

export function LanguageEditor({ languages: initialLangs, onSave, onCancel }: LanguageEditorProps) {
  const [languages, setLanguages] = useState<LanguageData[]>(initialLangs);
  const [newLangName, setNewLangName] = useState('');
  const [newLangLevel, setNewLangLevel] = useState('intermediate');
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = () => {
    if (!newLangName.trim()) return;
    if (languages.some(l => l.name === newLangName.trim())) return;

    setLanguages(prev => [...prev, { name: newLangName.trim(), level: newLangLevel }]);
    setNewLangName('');
    setNewLangLevel('intermediate');
  };

  const handleAddSuggestion = (name: string) => {
    if (languages.some(l => l.name === name)) return;
    setLanguages(prev => [...prev, { name, level: 'intermediate' }]);
  };

  const handleRemove = (index: number) => {
    setLanguages(prev => prev.filter((_, i) => i !== index));
  };

  const handleLevelChange = (index: number, level: string) => {
    setLanguages(prev => prev.map((l, i) => i === index ? { ...l, level } : l));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await onSave(languages);
    } finally {
      setIsSaving(false);
    }
  };

  const availableSuggestions = SUGGESTED_LANGUAGES.filter(s => !languages.some(l => l.name === s));

  return (
    <GlassCard variant="nurse" className="p-4 space-y-4">
      <h3 className="font-semibold text-sm">تعديل اللغات</h3>

      {/* Current languages */}
      <div className="space-y-2">
        {languages.map((lang, index) => (
          <div key={lang.name + index} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
            <span className="flex-1 text-sm font-medium">{lang.name}</span>
            <Select value={lang.level} onValueChange={(v) => handleLevelChange(index, v)}>
              <SelectTrigger className="w-28 h-8 text-xs">
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

      {/* Add new language */}
      <div className="space-y-2">
        <Label className="text-xs">إضافة لغة جديدة</Label>
        <div className="flex gap-2">
          <Select value={newLangName} onValueChange={setNewLangName}>
            <SelectTrigger className="flex-1 h-9 text-sm">
              <SelectValue placeholder="اختر اللغة" />
            </SelectTrigger>
            <SelectContent>
              {SUGGESTED_LANGUAGES.map((name) => (
                <SelectItem key={name} value={name}>{name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={newLangLevel} onValueChange={setNewLangLevel}>
            <SelectTrigger className="w-28 h-9 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(levelLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={handleAdd} disabled={!newLangName} className="bg-nurse hover:bg-nurse/90">
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Quick suggestions */}
      {availableSuggestions.length > 0 && (
        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">إضافة سريعة</Label>
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
