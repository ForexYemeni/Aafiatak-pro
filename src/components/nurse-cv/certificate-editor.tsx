'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
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

export interface CertificateData {
  name: string;
  issuer?: string;
  date?: string;
  type: string;
  verified: boolean;
  order: number;
}

interface CertificateEditorProps {
  certificates: CertificateData[];
  onSave: (certificates: CertificateData[]) => Promise<void>;
  onCancel: () => void;
}

const typeLabels: Record<string, string> = {
  certificate: 'شهادة',
  course: 'دورة',
  license: 'ترخيص',
  training: 'تدريب',
};

const emptyCert: CertificateData = {
  name: '',
  issuer: '',
  date: '',
  type: 'certificate',
  verified: false,
  order: 0,
};

export function CertificateEditor({ certificates: initialCerts, onSave, onCancel }: CertificateEditorProps) {
  const [certificates, setCertificates] = useState<CertificateData[]>(
    initialCerts.length > 0 ? initialCerts : [{ ...emptyCert }]
  );
  const [isSaving, setIsSaving] = useState(false);

  const handleAdd = () => {
    setCertificates(prev => [...prev, { ...emptyCert, order: prev.length }]);
  };

  const handleRemove = (index: number) => {
    setCertificates(prev => prev.filter((_, i) => i !== index).map((c, i) => ({ ...c, order: i })));
  };

  const handleChange = (index: number, field: keyof CertificateData, value: string | boolean) => {
    setCertificates(prev => prev.map((c, i) => i === index ? { ...c, [field]: value } : c));
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const filtered = certificates.filter(c => c.name.trim());
      await onSave(filtered);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <GlassCard variant="nurse" className="p-4 space-y-4">
      <h3 className="font-semibold text-sm">تعديل الشهادات والدورات</h3>

      <div className="space-y-3 max-h-80 overflow-y-auto custom-scrollbar">
        {certificates.map((cert, index) => (
          <div key={index} className="p-3 rounded-lg bg-muted/20 space-y-3 relative">
            {certificates.length > 1 && (
              <button
                onClick={() => handleRemove(index)}
                className="absolute top-2 left-2 p-1 text-red-500 hover:text-red-600"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">اسم الشهادة</Label>
                <Input
                  value={cert.name}
                  onChange={(e) => handleChange(index, 'name', e.target.value)}
                  placeholder="مثال: شهادة الإنعاش القلبي"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">الجهة المانحة</Label>
                <Input
                  value={cert.issuer || ''}
                  onChange={(e) => handleChange(index, 'issuer', e.target.value)}
                  placeholder="مثال: وزارة الصحة"
                  className="h-9 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">تاريخ الحصول</Label>
                <Input
                  value={cert.date || ''}
                  onChange={(e) => handleChange(index, 'date', e.target.value)}
                  placeholder="مثال: ٢٠٢٣"
                  className="h-9 text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">النوع</Label>
                <Select
                  value={cert.type}
                  onValueChange={(v) => handleChange(index, 'type', v)}
                >
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(typeLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        ))}
      </div>

      <Button variant="outline" size="sm" onClick={handleAdd} className="w-full gap-2">
        <Plus className="w-4 h-4" />
        إضافة شهادة جديدة
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
