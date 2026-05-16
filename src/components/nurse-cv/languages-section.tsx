'use client';

import { motion } from 'framer-motion';
import { Globe, Edit3 } from 'lucide-react';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { cn } from '@/lib/utils';

export interface LanguageData {
  name: string;
  level: string;
}

interface LanguagesSectionProps {
  languages: LanguageData[];
  isOwnView?: boolean;
  onEdit?: () => void;
}

// Level labels in Arabic
const levelLabels: Record<string, string> = {
  native: 'لغة أم',
  fluent: 'ممتاز',
  advanced: 'متقدم',
  intermediate: 'متوسط',
  basic: 'أساسي',
};

// Level dot count
const levelDots: Record<string, number> = {
  native: 5,
  fluent: 5,
  advanced: 4,
  intermediate: 3,
  basic: 2,
};

// Level dot colors
const levelDotColors: Record<string, { filled: string; empty: string }> = {
  native: { filled: 'bg-nurse', empty: 'bg-nurse/20' },
  fluent: { filled: 'bg-nurse', empty: 'bg-nurse/20' },
  advanced: { filled: 'bg-sky-500', empty: 'bg-sky-500/20' },
  intermediate: { filled: 'bg-sky-400', empty: 'bg-sky-400/20' },
  basic: { filled: 'bg-slate-400', empty: 'bg-slate-400/20' },
};

export function LanguagesSection({ languages, isOwnView, onEdit }: LanguagesSectionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.3 }}
    >
      <GlassCard variant="nurse" className="p-0 overflow-hidden">
        <GlassCardHeader className="flex flex-row items-center justify-between px-5 pt-5 pb-0 mb-0">
          <GlassCardTitle className="flex items-center gap-2">
            <Globe className="w-4 h-4 text-nurse" />
            اللغات
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
          {!languages || languages.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {isOwnView ? 'أضف لغاتك لتعزيز ملفك المهني' : 'لا توجد لغات مسجلة'}
            </p>
          ) : (
            <div className="space-y-3">
              {languages.map((lang, index) => {
                const dots = levelDots[lang.level] || 3;
                const colors = levelDotColors[lang.level] || levelDotColors.intermediate;

                return (
                  <motion.div
                    key={lang.name + index}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.06 }}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{lang.name}</span>
                      <span className={cn(
                        'text-[10px] px-1.5 py-0.5 rounded-full font-medium',
                        lang.level === 'native' ? 'bg-nurse/15 text-nurse' :
                        lang.level === 'fluent' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/25 dark:text-emerald-400' :
                        lang.level === 'advanced' ? 'bg-sky-50 text-sky-600 dark:bg-sky-900/25 dark:text-sky-400' :
                        lang.level === 'intermediate' ? 'bg-amber-50 text-amber-600 dark:bg-amber-900/25 dark:text-amber-400' :
                        'bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-400'
                      )}>
                        {levelLabels[lang.level] || lang.level}
                      </span>
                    </div>

                    {/* Visual dots indicator */}
                    <div className="flex gap-1">
                      {Array.from({ length: 5 }).map((_, i) => (
                        <div
                          key={i}
                          className={cn(
                            'w-2 h-2 rounded-full',
                            i < dots ? colors.filled : colors.empty
                          )}
                        />
                      ))}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
}
