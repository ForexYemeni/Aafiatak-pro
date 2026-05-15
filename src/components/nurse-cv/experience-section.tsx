'use client';

import { motion } from 'framer-motion';
import { Briefcase, Edit3, Calendar, Building2, Tag } from 'lucide-react';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { toArabicNum } from '@/components/common/date-formatter';
import { cn } from '@/lib/utils';

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

interface ExperienceSectionProps {
  experiences: ExperienceData[];
  isOwnView?: boolean;
  onEdit?: () => void;
}

export function ExperienceSection({ experiences, isOwnView, onEdit }: ExperienceSectionProps) {
  const sortedExperiences = [...(experiences || [])].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.2 }}
    >
      <GlassCard variant="nurse" className="p-0 overflow-hidden">
        <GlassCardHeader className="flex flex-row items-center justify-between px-5 pt-5 pb-0 mb-0">
          <GlassCardTitle className="flex items-center gap-2">
            <Briefcase className="w-4 h-4 text-nurse" />
            الخبرات العملية
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
          {sortedExperiences.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              {isOwnView ? 'أضف خبراتك العملية لتعزيز سيرتك الذاتية' : 'لا توجد خبرات مسجلة'}
            </p>
          ) : (
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute right-[7px] top-2 bottom-2 w-[2px] bg-nurse/20" />

              <div className="space-y-5">
                {sortedExperiences.map((exp, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.08 }}
                    className="relative pr-6"
                  >
                    {/* Timeline dot */}
                    <div className={cn(
                      'absolute right-0 top-1.5 w-4 h-4 rounded-full border-[3px] border-background',
                      index === 0 ? 'bg-nurse' : 'bg-nurse/40'
                    )} />

                    <div className="space-y-1.5">
                      {exp.title && (
                        <h4 className="text-sm font-semibold">{exp.title}</h4>
                      )}
                      {exp.facility && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Building2 className="w-3 h-3 text-nurse/60" />
                          <span>{exp.facility}</span>
                        </div>
                      )}
                      {exp.duration && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Calendar className="w-3 h-3 text-nurse/60" />
                          <span>{exp.duration}</span>
                        </div>
                      )}
                      {exp.casesType && (
                        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                          <Tag className="w-3 h-3 text-nurse/60" />
                          <span>{exp.casesType}</span>
                        </div>
                      )}
                      {exp.description && (
                        <p className="text-xs text-muted-foreground leading-relaxed mt-1.5 bg-muted/30 rounded-lg p-2">
                          {exp.description}
                        </p>
                      )}
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
}
