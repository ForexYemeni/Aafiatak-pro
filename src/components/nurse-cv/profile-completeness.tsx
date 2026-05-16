'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, AlertCircle, Lightbulb } from 'lucide-react';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { toArabicNum } from '@/components/common/date-formatter';
import { cn } from '@/lib/utils';

interface ProfileCompletenessProps {
  completeness: number;
  missingItems: string[];
}

const tips = [
  'أضف صورة شخصية احترافية لزيادة مصداقيتك',
  'اكتب نبذة مهنية توضح خبراتك ومهاراتك',
  'أضف شهاداتك ودوراتك التدريبية',
  'حدد مهاراتك بدقة ليسهل العثور عليك',
  'أضف خبراتك العملية لتبني ثقة المستفيدين',
];

export function ProfileCompleteness({ completeness, missingItems }: ProfileCompletenessProps) {
  // FIX: Use deterministic tip selection instead of Math.random()
  // Math.random() causes hydration mismatch (SSR vs client produce different values)
  const [tipIndex, setTipIndex] = useState(0);
  useEffect(() => {
    setTipIndex(Math.floor(Math.random() * tips.length));
  }, []);

  const circumference = 2 * Math.PI * 42;
  const strokeDashoffset = circumference - (completeness / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.1 }}
    >
      <GlassCard variant="nurse" className="p-0 overflow-hidden">
        <GlassCardHeader className="px-5 pt-5 pb-0 mb-0">
          <GlassCardTitle className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-amber-500" />
            اكتمال الملف الشخصي
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="px-5 pb-5 pt-3">
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            {/* Circular progress */}
            <div className="relative shrink-0">
              <svg width="100" height="100" className="-rotate-90">
                <circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="6"
                  className="text-muted/40"
                />
                <motion.circle
                  cx="50"
                  cy="50"
                  r="42"
                  fill="none"
                  stroke="url(#completenessGradient)"
                  strokeWidth="6"
                  strokeLinecap="round"
                  strokeDasharray={circumference}
                  initial={{ strokeDashoffset: circumference }}
                  animate={{ strokeDashoffset }}
                  transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                />
                <defs>
                  <linearGradient id="completenessGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="oklch(0.65 0.17 220)" />
                    <stop offset="100%" stopColor="oklch(0.7 0.17 200)" />
                  </linearGradient>
                </defs>
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-lg font-bold text-nurse">{toArabicNum(completeness)}%</span>
              </div>
            </div>

            {/* Missing items checklist */}
            <div className="flex-1 space-y-2 w-full">
              {missingItems.length === 0 ? (
                <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-medium">ملفك الشخصي مكتمل!</span>
                </div>
              ) : (
                missingItems.map((item) => (
                  <div key={item} className="flex items-center gap-2">
                    <Circle className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                    <span className="text-sm text-muted-foreground">{item}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tips */}
          {completeness < 100 && (
            <div className="mt-4 p-3 rounded-xl bg-nurse/5 border border-nurse/10">
              <div className="flex items-start gap-2">
                <Lightbulb className="w-4 h-4 text-nurse shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {tips[tipIndex]}
                </p>
              </div>
            </div>
          )}
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
}
