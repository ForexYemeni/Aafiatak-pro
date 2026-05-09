'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Star, Eye, RefreshCw, User, Stethoscope, AlertTriangle } from 'lucide-react';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { BadgeStatus } from '@/components/common/badge-status';
import { DateFormatter } from '@/components/common/date-formatter';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';

interface RatingItem {
  id: string;
  fromUserName: string;
  toUserName: string;
  toUserSpecialization: string;
  fromRole: string;
  toRole: string;
  ratingType: 'service' | 'emergency';
  score: number;
  comment: string | null;
  tags: string[];
  isAnonymous: boolean;
  serviceName: string | null;
  emergencyType?: string | null;
  emergencyOutcome?: string | null;
  nurseRating: number;
  createdAt: string;
}

const tagLabels: Record<string, string> = {
  punctual: 'منتظم',
  professional: 'محترف',
  friendly: 'ودود',
  knowledgeable: 'مطلع',
  clean: 'نظيف',
  communicative: 'متواصل',
  patient: 'صبور',
  thorough: 'دقيق',
  late: 'متأخر',
  unprofessional: 'غير محترف',
  unclean: 'غير نظيف',
  uncommunicative: 'غير متواصل',
  skilled: 'ماهر',
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function AdminRatingsPage() {
  const authFetch = useAuthFetch();
  const [ratings, setRatings] = useState<RatingItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [scoreFilter, setScoreFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [viewTarget, setViewTarget] = useState<RatingItem | null>(null);
  const [avgRating, setAvgRating] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [serviceCount, setServiceCount] = useState(0);
  const [emergencyCount, setEmergencyCount] = useState(0);

  const fetchRatings = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        ...(scoreFilter !== 'all' ? { score: scoreFilter } : {}),
        ...(typeFilter !== 'all' ? { ratingType: typeFilter } : {}),
      });
      const res = await authFetch(`/api/admin/ratings?${params.toString()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setRatings(json.data.ratings || []);
        setTotalPages(json.data.pages || 1);
        if (json.data.summary) {
          setAvgRating(json.data.summary.averageRating || 0);
          setTotalCount(json.data.summary.totalCount || 0);
          setServiceCount(json.data.summary.serviceCount || 0);
          setEmergencyCount(json.data.summary.emergencyCount || 0);
        }
      }
    } catch {
      toast.error('فشل تحميل التقييمات');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, page, scoreFilter, typeFilter]);

  useEffect(() => {
    void fetchRatings();
  }, [fetchRatings]);

  const renderStars = (score: number) => {
    return (
      <div className="flex items-center gap-0.5">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star
            key={i}
            className={`w-3.5 h-3.5 ${i < score ? 'text-yellow-500 fill-yellow-500' : 'text-gray-300'}`}
          />
        ))}
      </div>
    );
  };

  const columns: ColumnDef<RatingItem, unknown>[] = [
    {
      accessorKey: 'fromUserName',
      header: 'من (المستفيد)',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Avatar className="w-7 h-7">
            <AvatarFallback className="text-[10px] bg-beneficiary/10 text-beneficiary">
              {row.original.isAnonymous ? '?' : row.original.fromUserName?.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm">
            {row.original.isAnonymous ? 'مجهول' : row.original.fromUserName}
          </span>
        </div>
      ),
    },
    {
      accessorKey: 'toUserName',
      header: 'إلى (الممرض)',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Avatar className="w-7 h-7">
            <AvatarFallback className="text-[10px] bg-nurse/10 text-nurse">
              {row.original.toUserName?.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <span className="text-sm font-medium">{row.original.toUserName}</span>
            {row.original.nurseRating > 0 && (
              <div className="flex items-center gap-1">
                <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                <span className="text-[10px] text-muted-foreground">{row.original.nurseRating.toFixed(1)}</span>
              </div>
            )}
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'score',
      header: 'التقييم',
      cell: ({ row }) => renderStars(row.original.score),
    },
    {
      accessorKey: 'ratingType',
      header: 'النوع',
      cell: ({ row }) => (
        row.original.ratingType === 'emergency' ? (
          <Badge variant="destructive" className="text-[10px] gap-1">
            <AlertTriangle className="w-3 h-3" />
            طوارئ
          </Badge>
        ) : (
          <Badge variant="secondary" className="text-[10px]">
            خدمة
          </Badge>
        )
      ),
    },
    {
      accessorKey: 'serviceName',
      header: 'الخدمة',
      cell: ({ row }) => (
        <div className="max-w-[120px]">
          <span className="text-xs text-muted-foreground line-clamp-1">
            {row.original.serviceName || '—'}
          </span>
          {row.original.ratingType === 'emergency' && row.original.emergencyOutcome && (
            <p className="text-[10px] text-green-600 dark:text-green-400 line-clamp-1">
              {row.original.emergencyOutcome}
            </p>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'comment',
      header: 'التعليق',
      cell: ({ row }) => (
        <span className="text-sm text-muted-foreground line-clamp-1">
          {row.original.comment ?? '—'}
        </span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'التاريخ',
      cell: ({ row }) => <DateFormatter date={row.original.createdAt} format="short" />,
    },
  ];

  const rowActions = [
    {
      label: 'عرض التفاصيل',
      onClick: (row: Record<string, unknown>) => setViewTarget(row as unknown as RatingItem),
    },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <PageHeader title="إدارة التقييمات" description="عرض وإدارة تقييمات الخدمات والطوارئ" />
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={itemAnim} className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <GlassCard variant="admin" className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center shrink-0">
              <Star className="w-6 h-6 text-yellow-500 fill-yellow-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">متوسط التقييم العام</p>
              <div className="flex items-center gap-2">
                <p className="text-2xl font-bold">{avgRating > 0 ? avgRating.toFixed(1) : '—'}</p>
                {avgRating > 0 && renderStars(Math.round(avgRating))}
              </div>
            </div>
          </div>
        </GlassCard>

        <GlassCard variant="admin" className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center shrink-0">
              <Stethoscope className="w-6 h-6 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي التقييمات</p>
              <p className="text-2xl font-bold">{totalCount}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard variant="admin" className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
              <Stethoscope className="w-6 h-6 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">تقييمات الخدمات</p>
              <p className="text-2xl font-bold">{serviceCount}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard variant="admin" className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center shrink-0">
              <AlertTriangle className="w-6 h-6 text-red-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">تقييمات الطوارئ</p>
              <p className="text-2xl font-bold">{emergencyCount}</p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="النوع" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="service">خدمات</SelectItem>
                <SelectItem value="emergency">طوارئ</SelectItem>
              </SelectContent>
            </Select>
            <Select value={scoreFilter} onValueChange={(v) => { setScoreFilter(v); setPage(1); }}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="التقييم" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="5">٥ نجوم</SelectItem>
                <SelectItem value="4">٤ نجوم</SelectItem>
                <SelectItem value="3">٣ نجوم</SelectItem>
                <SelectItem value="2">٢ نجوم</SelectItem>
                <SelectItem value="1">نجمة واحدة</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => void fetchRatings()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={itemAnim}>
        <DataTable
          columns={columns}
          data={ratings}
          isLoading={isLoading}
          emptyMessage="لا توجد تقييمات"
          emptyAction={{ label: 'تحديث', onClick: () => void fetchRatings() }}
          rowActions={rowActions as never}
          currentPage={page}
          pageCount={totalPages || 1}
          onPageChange={setPage}
        />
      </motion.div>

      {/* View Details */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>تفاصيل التقييم</DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                {renderStars(viewTarget.score)}
                <span className="text-2xl font-bold">{viewTarget.score}/5</span>
                {viewTarget.ratingType === 'emergency' && (
                  <Badge variant="destructive" className="gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    طوارئ
                  </Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">من (المستفيد)</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-[8px] bg-beneficiary/10 text-beneficiary">
                        {viewTarget.isAnonymous ? '?' : viewTarget.fromUserName?.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-sm font-medium">{viewTarget.isAnonymous ? 'مجهول' : viewTarget.fromUserName}</p>
                  </div>
                </div>
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">إلى (الممرض)</p>
                  <div className="flex items-center gap-2 mt-1">
                    <Avatar className="w-6 h-6">
                      <AvatarFallback className="text-[8px] bg-nurse/10 text-nurse">
                        {viewTarget.toUserName?.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="text-sm font-medium">{viewTarget.toUserName}</p>
                      {viewTarget.nurseRating > 0 && (
                        <div className="flex items-center gap-1">
                          <Star className="w-2.5 h-2.5 text-yellow-500 fill-yellow-500" />
                          <span className="text-[10px] text-muted-foreground">{viewTarget.nurseRating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              {viewTarget.serviceName && (
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">
                    {viewTarget.ratingType === 'emergency' ? 'نوع الطوارئ' : 'الخدمة'}
                  </p>
                  <p className="text-sm font-medium">{viewTarget.serviceName}</p>
                </div>
              )}
              {viewTarget.ratingType === 'emergency' && viewTarget.emergencyOutcome && (
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">نتيجة الحالة</p>
                  <p className="text-sm font-medium text-green-700 dark:text-green-400">{viewTarget.emergencyOutcome}</p>
                </div>
              )}
              {viewTarget.comment && (
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-muted-foreground mb-1">التعليق</p>
                  <p className="text-sm">{viewTarget.comment}</p>
                </div>
              )}
              {viewTarget.tags.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-2">العلامات</p>
                  <div className="flex flex-wrap gap-1">
                    {viewTarget.tags.map((tag) => (
                      <span key={tag} className="text-xs px-2 py-1 rounded-full bg-accent text-accent-foreground">
                        {tagLabels[tag] ?? tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                <DateFormatter date={viewTarget.createdAt} format="full" />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
