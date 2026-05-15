'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { FileText, Edit3, Save, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';

interface BioSectionProps {
  bio: string;
  isOwnView?: boolean;
  onSave?: (bio: string) => Promise<void>;
}

export function BioSection({ bio, isOwnView, onSave }: BioSectionProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(bio);
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!onSave) return;
    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
    } catch {
      // Error handled by parent
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <GlassCard variant="nurse" className="p-0 overflow-hidden">
        <GlassCardHeader className="flex flex-row items-center justify-between px-5 pt-5 pb-0 mb-0">
          <GlassCardTitle className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-nurse" />
            نبذة مهنية
          </GlassCardTitle>
          {isOwnView && !isEditing && (
            <Button variant="ghost" size="sm" onClick={() => { setEditValue(bio); setIsEditing(true); }}>
              <Edit3 className="w-3.5 h-3.5 me-1" />
              تعديل
            </Button>
          )}
        </GlassCardHeader>
        <GlassCardContent className="px-5 pb-5 pt-3">
          {isEditing ? (
            <div className="space-y-3">
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                rows={4}
                placeholder="اكتب نبذة مهنية عنك..."
                className="resize-none"
              />
              <div className="flex gap-2">
                <Button
                  size="sm"
                  className="bg-nurse hover:bg-nurse/90"
                  onClick={handleSave}
                  disabled={isSaving}
                >
                  {isSaving ? (
                    <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin me-1" />
                  ) : (
                    <Save className="w-3.5 h-3.5 me-1" />
                  )}
                  حفظ
                </Button>
                <Button size="sm" variant="outline" onClick={() => setIsEditing(false)}>
                  <X className="w-3.5 h-3.5 me-1" />
                  إلغاء
                </Button>
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-line">
              {bio || (isOwnView ? 'أضف نبذة مهنية لتعريف المستفيدين بخبراتك' : 'لا توجد نبذة مهنية')}
            </p>
          )}
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
}
