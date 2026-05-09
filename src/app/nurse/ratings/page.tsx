'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Star, MessageSquare, Filter, AlertTriangle, Building2, Home, Ban, HelpCircle } from 'lucide-react';
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

interface EmergencyInfo {
  type: string;
  typeLabel: string;
  description?: string;
  outcome?: string;
  outcomeLabel?: string;
  resolvedNotes?: string;
}

interface ServiceRequestInfo {
  id: string;
  status: string;
  service: {
    nameAr: string;
    category?: string;
  };
}

interface RatingItem {
  id: string;
  score: number;
  comment: string | null;
  tags: string[];
  isAnonymous: boolean;
  fromRole: string;
  fromUserName?: string;
  ratingType: 'service' | 'emergency';
  createdAt: string;
  serviceRequest: ServiceRequestInfo | null;
  emergencyInfo: EmergencyInfo | null;
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
  skilled: 'ماهر',
  late: 'متأخر',
  unprofessional: 'غير محترف',
};

const outcomeIcons: Record<string, { icon: React.ElementType; color: string }> = {
  treated_on_site: { icon: Home, color: 'text-green-600 dark:text-green-400' },
  transferred_to_hospital: { icon: Building2, color: 'text-blue-600 dark:text-blue-400' },
  refused_treatment: { icon: Ban, color: 'text-amber-600 dark:text-amber-400' },
  other: { icon: HelpCircle, color: 'text-gray-600 dark:text-gray-400' },
};

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.06 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 15 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25 } },
};

type FilterType = 'all' | 'service' | 'emergency';

// ---- Component ----

export default function NurseRatingsPage() {
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterScore, setFilterScore] = useState<number | null>(null);
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [summary, setSummary] = useState<{ averageRating: number; reviewCount: number; completedJobs: number } | null>(null);
  const authFetch = useAuthFetch();
  const user = useAuthStore((s) => s.user);

  const fetchRatings = useCallback(async () => {
    try {
      const res = await authFetch('/api/nurse/ratings?limit=100');
      const data = await res.json();
      if (data.success && data.data) {
        const ratingsArray = Array.isArray(data.data) ? data.data : (data.data.ratings || []);
        setRatings(ratingsArray as RatingItem[]);
        if (data.data.summary) {
          setSummary(data.data.summary);
        }
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

  const chartData = distribution.map((d) => ({
    name: `${toArabicNum(d.score)} ★`,
    count: d.count,
  }));

  const averageRating = summary?.averageRating || (ratings.length > 0
    ? ratings.reduce((sum, r) => sum + r.score, 0) / ratings.length
    : 0);

  const filteredRatings = ratings.filter((r) => {
    if (filterScore !== null && r.score !== filterScore) return false;
    if (filterType === 'service' && r.ratingType === 'emergency') return false;
    if (filterType === 'emergency' && r.ratingType !== 'emergency') return false;
    return true;
  });

  const serviceCount = ratings.filter(r => r.ratingType !== 'emergency').length;
  const emergencyCount = ratings.filter(r => r.ratingType === 'emergency').length;

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
              {toArabicNum(summary?.reviewCount || ratings.length)} تقييم
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

      {/* Type Filter */}
      <GlassCard variant="nurse" className="p-4">
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none pb-1">
          <Filter className="w-4 h-4 text-muted-foreground shrink-0" />
          <Button
            variant={filterType === 'all' ? 'default' : 'outline'}
            size="sm"
            className="shrink-0 text-xs"
            onClick={() => setFilterType('all')}
          >
            الكل ({toArabicNum(ratings.length)})
          </Button>
          <Button
            variant={filterType === 'service' ? 'default' : 'outline'}
            size="sm"
            className="shrink-0 text-xs"
            onClick={() => setFilterType('service')}
          >
            خدمات ({toArabicNum(serviceCount)})
          </Button>
          <Button
            variant={filterType === 'emergency' ? 'default' : 'outline'}
            size="sm"
            className="shrink-0 text-xs gap-1"
            onClick={() => setFilterType('emergency')}
          >
            <AlertTriangle className="w-3 h-3" />
            طوارئ ({toArabicNum(emergencyCount)})
          </Button>
          <div className="w-px h-6 bg-border shrink-0" />
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
            {filteredRatings.map((rating) => {
              const isEmergency = rating.ratingType === 'emergency';

              return (
                <motion.div key={rating.id} variants={itemVariants}>
                  <GlassCard
                    variant="nurse"
                    className={`p-4 ${isEmergency ? 'border-red-200 dark:border-red-900/40 ring-1 ring-red-100 dark:ring-red-900/20' : ''}`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <div className="flex items-center gap-1.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star
                              key={s}
                              className={`w-4 h-4 ${s <= rating.score ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                            />
                          ))}
                          {isEmergency && (
                            <Badge variant="destructive" className="text-[9px] gap-0.5 h-4 px-1.5">
                              <AlertTriangle className="w-2.5 h-2.5" />
                              طوارئ
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          {isEmergency
                            ? rating.emergencyInfo?.typeLabel || 'طوارئ'
                            : rating.serviceRequest?.service?.nameAr ?? 'خدمة'}
                        </p>
                        {!isEmergency && rating.serviceRequest?.service?.category && (
                          <p className="text-[10px] text-muted-foreground/70 mt-0.5">
                            {rating.serviceRequest.service.category}
                          </p>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {getRelativeTime(new Date(rating.createdAt))}
                      </span>
                    </div>

                    {/* Emergency outcome info */}
                    {isEmergency && rating.emergencyInfo?.outcome && (
                      <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-red-50 dark:bg-red-900/10 border border-red-100 dark:border-red-900/20">
                        {(() => {
                          const oc = outcomeIcons[rating.emergencyInfo!.outcome!];
                          if (!oc) return null;
                          const IconComp = oc.icon;
                          return <IconComp className={`w-4 h-4 ${oc.color}`} />;
                        })()}
                        <span className="text-xs font-medium">
                          {rating.emergencyInfo.outcomeLabel || rating.emergencyInfo.outcome}
                        </span>
                      </div>
                    )}

                    {/* Emergency description */}
                    {isEmergency && rating.emergencyInfo?.description && (
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">
                        {rating.emergencyInfo.description}
                      </p>
                    )}

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

                    <div className="flex items-center justify-between mt-2">
                      {rating.isAnonymous ? (
                        <p className="text-[10px] text-muted-foreground">تقييم مجهول</p>
                      ) : rating.fromUserName ? (
                        <p className="text-[10px] text-muted-foreground">من: {rating.fromUserName}</p>
                      ) : (
                        <span />
                      )}
                      <p className="text-[10px] text-muted-foreground">
                        {formatDateOnly(new Date(rating.createdAt))}
                      </p>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </PullToRefresh>
    </div>
  );
}
