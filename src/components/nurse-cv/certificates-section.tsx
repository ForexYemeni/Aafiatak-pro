'use client';

import { motion } from 'framer-motion';
import { Award, Edit3, ShieldCheck } from 'lucide-react';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { VerifiedBadge } from '@/components/common/verified-badge';
import { cn } from '@/lib/utils';

export interface CertificateData {
  name: string;
  issuer?: string;
  date?: string;
  type: string;
  verified: boolean;
  order: number;
}

interface CertificatesSectionProps {
  certificates: CertificateData[];
  isOwnView?: boolean;
  onEdit?: () => void;
}

// Type icons (using text emojis as specified)
const typeIcons: Record<string, string> = {
  certificate: '📜',
  course: '📚',
  license: '📋',
  training: '🎓',
};

// Type labels
const typeLabels: Record<string, string> = {
  certificate: 'شهادة',
  course: 'دورة',
  license: 'ترخيص',
  training: 'تدريب',
};

// Type colors
const typeBadgeColors: Record<string, string> = {
  certificate: 'bg-amber-50 text-amber-700 dark:bg-amber-900/25 dark:text-amber-400',
  course: 'bg-blue-50 text-blue-700 dark:bg-blue-900/25 dark:text-blue-400',
  license: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/25 dark:text-emerald-400',
  training: 'bg-violet-50 text-violet-700 dark:bg-violet-900/25 dark:text-violet-400',
};

export function CertificatesSection({ certificates, isOwnView, onEdit }: CertificatesSectionProps) {
  const sortedCerts = [...(certificates || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.25 }}
    >
      <GlassCard variant="nurse" className="p-0 overflow-hidden">
        <GlassCardHeader className="flex flex-row items-center justify-between px-5 pt-5 pb-0 mb-0">
          <GlassCardTitle className="flex items-center gap-2">
            <Award className="w-4 h-4 text-nurse" />
            الشهادات والدورات
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
          {sortedCerts.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {isOwnView ? 'أضف شهاداتك ودوراتك لتعزيز مصداقيتك' : 'لا توجد شهادات مسجلة'}
            </p>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {sortedCerts.map((cert, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.3, delay: index * 0.06 }}
                  className="relative rounded-xl border border-border/60 bg-muted/20 p-3.5 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2">
                      <span className="text-xl shrink-0 mt-0.5">{typeIcons[cert.type] || '📜'}</span>
                      <div className="min-w-0">
                        <h4 className="text-sm font-semibold leading-tight">{cert.name}</h4>
                        {cert.issuer && (
                          <p className="text-xs text-muted-foreground mt-0.5">{cert.issuer}</p>
                        )}
                      </div>
                    </div>
                    {cert.verified && (
                      <VerifiedBadge size="sm" />
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      'inline-flex items-center rounded-full px-1.5 py-0.5 text-[10px] font-medium',
                      typeBadgeColors[cert.type] || typeBadgeColors.certificate
                    )}>
                      {typeLabels[cert.type] || cert.type}
                    </span>
                    {cert.date && (
                      <span className="text-[10px] text-muted-foreground">{cert.date}</span>
                    )}
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
