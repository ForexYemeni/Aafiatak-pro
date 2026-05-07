'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Star, MessageSquare, Filter } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/common/glass-card';
import { EmptyState } from '@/components/common/empty-state';
import { PullToRefresh } from '@/components/common/pull-to-refresh';
import { CardSkeleton } from '@/components/common/loading-skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthFetch } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { toArabicNum, formatDateOnly, getRelativeTime } from '@/components/common/date-formatter';

// ---- Types ----

interface RatingItem {
  id: string;
  score: number;
  comment: string | null;
  tags: string[];
  isAnonymous: boolean;
  fromRole: string;
  createdAt: string;
  serviceRequest: {
    id: string;
    status: string;
    service: {
      nameAr: string;
    };
  };
}

// ---- Constants ----

const ratingTagLabels: Record<string, string> = {
  punctual: 'ملتزم بالوقت',
  professional: 'محترف',
  friendly: 'ودود',
  knowledgeable: 'مطلع',
  clean: 'نظيف',
  communicative: 'متواصل',
  patient: 'صبور',
  thorough: 'دقيق',
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

// ---- Component ----

export default function NurseRatingsPage() {
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterScore, setFilterScore] = useState<number | null>(null);
  const authFetch = useAuthFetch();
  const user = useAuthStore((s) => s.user);

  const fetchRatings = useCallback(async () => {
    try {
      const res = await authFetch('/api/nurse/ratings?limit=100');
      const data = await res.json();
      if (data.success && data.data) {
        setRatings(data.data as RatingItem[]);
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchRatings();
  }, [fetchRatings]);

  // Calculate rating distribution
  const distribution = [5, 4, 3, 2, 1].map((score) => ({
    score,
    count: ratings.filter((r) => r.score === score).length,
  }));

  const maxCount = Math.max(...distribution.map((d) => d.count), 1);

  const chartData = distribution.map((d) => ({
    name: `${toArabicNum(d.score)} ★`,
    count: d.count,
  }));

  const averageRating = ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
    : 0;

  const filteredRatings = filterScore !== null
    ? ratings.filter((r) => r.score === filterScore)
    : ratings;

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="التقييمات" description="تقييمات ومراجعات المستفيدين" />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="التقييمات" description="تقييمات ومراجعات المستفيدين" />

      {/* Average Rating Card */}
      <GlassCard variant="nurse" className="p-6">
        <div className="flex items-center gap-6">
          <div className="text-center">
            <p className="text-5xl font-bold text-nurse">{toArabicNum(averageRating.toFixed(1))}</p>
            <div className="flex items-center gap-0.5 mt-2 justify-center">
              {[1, 2, 3, 4, 5].map((s) => (
                <Star
                  key={s}
                  className={`w-5 h-5 ${s <= Math.round(averageRating) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                />
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {toArabicNum(ratings.length)} تقييم
            </p>
          </div>

          {/* Distribution Chart */}
          <div className="flex-1 h-32">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} layout="vertical" margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" hide />
                <YAxis
                  dataKey="name"
                  type="category"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  width={35}
                />
                <Tooltip
                  formatter={(value: number) => [`${value} تقييم`, 'العدد']}
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '8px',
                    direction: 'rtl',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="count" fill="oklch(0.65 0.17 220)" radius={[0, 4, 4, 0]} maxBarSize={16} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </GlassCard>

      {/* Filter by Score */}
      <GlassCard variant="nurse" className="p-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <Button
            variant={filterScore === null ? 'default' : 'outline'}
            size="sm"
            className="shrink-0 text-xs"
            onClick={() => setFilterScore(null)}
          >
            الكل
          </Button>
          {[5, 4, 3, 2, 1].map((score) => (
            <Button
              key={score}
              variant={filterScore === score ? 'default' : 'outline'}
              size="sm"
              className="shrink-0 text-xs gap-1"
              onClick={() => setFilterScore(score)}
            >
              {toArabicNum(score)}
              <Star className="w-3 h-3 fill-current" />
            </Button>
          ))}
        </div>
      </GlassCard>

      {/* Ratings List */}
      <PullToRefresh onRefresh={async () => { setIsLoading(true); await fetchRatings(); }}>
        {filteredRatings.length === 0 ? (
          <EmptyState
            icon={<Star className="w-10 h-10 text-muted-foreground" />}
            title="لا توجد تقييمات"
            description={filterScore !== null ? `لا توجد تقييمات بـ ${toArabicNum(filterScore)} نجوم` : 'ستظهر التقييمات هنا بعد إتمام الخدمات'}
          />
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            {filteredRatings.map((rating) => (
              <motion.div key={rating.id} variants={itemVariants}>
                <GlassCard variant="nurse" className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="flex items-center gap-1">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star
                            key={s}
                            className={`w-4 h-4 ${s <= rating.score ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                          />
                        ))}
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {rating.serviceRequest?.service?.nameAr ?? 'خدمة'}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {getRelativeTime(new Date(rating.createdAt))}
                    </span>
                  </div>

                  {rating.comment && (
                    <div className="flex items-start gap-2 mt-2">
                      <MessageSquare className="w-4 h-4 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-sm leading-relaxed">{rating.comment}</p>
                    </div>
                  )}

                  {rating.tags && rating.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-3">
                      {rating.tags.map((tag) => (
                        <Badge key={tag} variant="secondary" className="text-[10px]">
                          {ratingTagLabels[tag] ?? tag}
                        </Badge>
                      ))}
                    </div>
                  )}

                  {rating.isAnonymous && (
                    <p className="text-[10px] text-muted-foreground mt-2">تقييم مجهول</p>
                  )}
                </GlassCard>
              </motion.div>
            ))}
          </motion.div>
        )}
      </PullToRefresh>
    </div>
  );
}
