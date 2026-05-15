'use client';

import { motion } from 'framer-motion';
import { Star, MessageSquare, TrendingUp, Clock } from 'lucide-react';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { toArabicNum } from '@/components/common/date-formatter';
import { cn } from '@/lib/utils';

interface ReviewsSectionProps {
  rating: number;
  reviewCount: number;
  complianceRate: number;
  responseRate: number;
}

export function ReviewsSection({ rating, reviewCount, complianceRate, responseRate }: ReviewsSectionProps) {
  // Mock distribution (in a real app this would come from the API)
  const distribution = [
    { stars: 5, percent: rating >= 4.5 ? 70 : rating >= 4 ? 50 : 30 },
    { stars: 4, percent: rating >= 4.5 ? 20 : rating >= 4 ? 30 : 25 },
    { stars: 3, percent: rating >= 4.5 ? 7 : rating >= 4 ? 12 : 20 },
    { stars: 2, percent: rating >= 4.5 ? 2 : rating >= 4 ? 5 : 13 },
    { stars: 1, percent: rating >= 4.5 ? 1 : rating >= 4 ? 3 : 12 },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: 0.35 }}
    >
      <GlassCard variant="nurse" className="p-0 overflow-hidden">
        <GlassCardHeader className="px-5 pt-5 pb-0 mb-0">
          <GlassCardTitle className="flex items-center gap-2">
            <Star className="w-4 h-4 text-amber-500" />
            التقييمات والمراجعات
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="px-5 pb-5 pt-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Left: Overall Rating */}
            <div className="text-center sm:text-start space-y-3">
              <div className="flex items-center justify-center sm:justify-start gap-3">
                <span className="text-4xl font-bold text-foreground">{toArabicNum(rating.toFixed(1))}</span>
                <div className="text-start">
                  <div className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <Star
                        key={i}
                        className={cn(
                          'w-4 h-4',
                          i < Math.round(rating)
                            ? 'text-amber-500 fill-amber-500'
                            : 'text-muted-foreground/30'
                        )}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {toArabicNum(reviewCount)} تقييم
                  </p>
                </div>
              </div>

              {/* Quick stats */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                  <TrendingUp className="w-4 h-4 text-emerald-500 mx-auto mb-1" />
                  <p className="text-sm font-bold">{toArabicNum(complianceRate)}%</p>
                  <p className="text-[10px] text-muted-foreground">نسبة الالتزام</p>
                </div>
                <div className="rounded-lg bg-muted/30 p-2.5 text-center">
                  <Clock className="w-4 h-4 text-sky-500 mx-auto mb-1" />
                  <p className="text-sm font-bold">{toArabicNum(responseRate)}%</p>
                  <p className="text-[10px] text-muted-foreground">سرعة الاستجابة</p>
                </div>
              </div>
            </div>

            {/* Right: Distribution */}
            <div className="space-y-2">
              {distribution.map((item) => (
                <div key={item.stars} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-4 text-center">{toArabicNum(item.stars)}</span>
                  <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                  <div className="flex-1 h-2 bg-muted/60 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-amber-500 rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${item.percent}%` }}
                      transition={{ duration: 0.6, ease: 'easeOut', delay: 0.3 }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-8 text-start">{toArabicNum(item.percent)}%</span>
                </div>
              ))}
            </div>
          </div>
        </GlassCardContent>
      </GlassCard>
    </motion.div>
  );
}
