'use client';

import { motion } from 'framer-motion';
import { Sparkles, Edit3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { cn } from '@/lib/utils';

export interface SkillData {
  name: string;
  level: string;
  order: number;
}

interface SkillsSectionProps {
  skills: SkillData[];
  isOwnView?: boolean;
  onEdit?: () => void;
}

// Level labels in Arabic
const levelLabels: Record<string, string> = {
  beginner: 'مبتدئ',
  intermediate: 'متوسط',
  advanced: 'متقدم',
  expert: 'خبير',
};

// Level to percentage
const levelToPercent: Record<string, number> = {
  beginner: 25,
  intermediate: 50,
  advanced: 75,
  expert: 100,
};

// Level colors
const levelColors: Record<string, string> = {
  beginner: 'bg-slate-400',
  intermediate: 'bg-sky-400',
  advanced: 'bg-sky-500',
  expert: 'bg-nurse',
};

const badgeLevelColors: Record<string, string> = {
  beginner: 'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400',
  intermediate: 'bg-sky-50 text-sky-600 dark:bg-sky-900/25 dark:text-sky-400',
  advanced: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  expert: 'bg-nurse/15 text-nurse dark:bg-nurse/20',
};

export function SkillsSection({ skills, isOwnView, onEdit }: SkillsSectionProps) {
  const sortedSkills = [...(skills || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.15 }}
    >
      <GlassCard variant="nurse" className="p-0 overflow-hidden">
        <GlassCardHeader className="flex flex-row items-center justify-between px-5 pt-5 pb-0 mb-0">
          <GlassCardTitle className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-nurse" />
            المهارات
          </GlassCardTitle>
          {isOwnView && onEdit && (
            <button
              onClick={onEdit}
              className="text-nurse hover:text-nurse/80 text-xs font-medium flex items-center gap-1"
            >
              <Edit3 className="w-3.5 h-3.5" />
              تعديل
            </button>
          )}
        </GlassCardHeader>
        <GlassCardContent className="px-5 pb-5 pt-3">
          {sortedSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {isOwnView ? 'أضف مهاراتك لتعزيز ملفك المهني' : 'لا توجد مهارات مسجلة'}
            </p>
          ) : (
            <div className="space-y-3">
              {sortedSkills.map((skill, index) => (
                <motion.div
                  key={skill.name + index}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.3, delay: index * 0.05 }}
                  className="space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{skill.name}</span>
                    <Badge
                      variant="secondary"
                      className={cn('text-[10px] px-1.5 py-0', badgeLevelColors[skill.level] || badgeLevelColors.intermediate)}
                    >
                      {levelLabels[skill.level] || skill.level}
                    </Badge>
                  </div>
                  {/* Progress bar */}
                  <div className="h-2 bg-muted/60 rounded-full overflow-hidden">
                    <motion.div
                      className={cn('h-full rounded-full', levelColors[skill.level] || levelColors.intermediate)}
                      initial={{ width: 0 }}
                      animate={{ width: `${levelToPercent[skill.level] || 50}%` }}
                      transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 + index * 0.05 }}
                    />
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
}
