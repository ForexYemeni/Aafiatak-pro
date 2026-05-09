'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ScrollText, RefreshCw, Filter, Search, Clock, User, Shield,
  Stethoscope, Users, ClipboardList, AlertTriangle, CreditCard,
  Tag, MessageSquare, Settings, Activity, ChevronDown, X
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { EmptyState } from '@/components/common/empty-state';
import { ListSkeleton } from '@/components/common/loading-skeleton';
import { BadgeStatus } from '@/components/common/badge-status';
import { DateFormatter } from '@/components/common/date-formatter';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';

interface ActivityItem {
  id: string;
  userId: string;
  userName: string;
  userRole: string;
  action: string;
  entity: string;
  entityId: string | null;
  details: string;
  createdAt: string;
}

const actionLabels: Record<string, string> = {
  login: 'تسجيل دخول',
  logout: 'تسجيل خروج',
  create: 'إنشاء',
  update: 'تحديث',
  delete: 'حذف',
  verify: 'توثيق',
  reject: 'رفض',
  assign: 'تعيين',
  complete: 'إكمال',
  cancel: 'إلغاء',
  resolve: 'حل',
  payment: 'دفع',
  register: 'تسجيل',
};

const actionColors: Record<string, string> = {
  login: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  logout: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
  create: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  update: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400',
  delete: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  verify: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  reject: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  assign: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  complete: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400',
  cancel: 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400',
  resolve: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400',
  payment: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  register: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
};

const entityLabels: Record<string, string> = {
  nurse: 'ممرض/ـة',
  beneficiary: 'مستفيد/ـة',
  order: 'طلب',
  emergency: 'طوارئ',
  service: 'خدمة',
  payment: 'دفعة',
  coupon: 'كوبون',
  complaint: 'شكوى',
  subadmin: 'مدير فرعي',
  settings: 'إعدادات',
};

const entityIcons: Record<string, any> = {
  nurse: Stethoscope,
  beneficiary: Users,
  order: ClipboardList,
  emergency: AlertTriangle,
  service: Tag,
  payment: CreditCard,
  coupon: Tag,
  complaint: MessageSquare,
  subadmin: Shield,
  settings: Settings,
};

const entityColors: Record<string, string> = {
  nurse: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  beneficiary: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
  order: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400',
  emergency: 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400',
  service: 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400',
  payment: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  coupon: 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400',
  complaint: 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400',
  subadmin: 'bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400',
  settings: 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400',
};

const roleColors: Record<string, string> = {
  admin: 'bg-admin/15 text-admin',
  subadmin: 'bg-admin/15 text-admin',
  nurse: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  beneficiary: 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400',
};

const roleLabels: Record<string, string> = {
  admin: 'مدير',
  subadmin: 'مدير فرعي',
  nurse: 'ممرض/ـة',
  beneficiary: 'مستفيد/ـة',
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function AdminActivityPage() {
  const authFetch = useAuthFetch();
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchActivities = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
        search,
        ...(actionFilter !== 'all' ? { action: actionFilter } : {}),
        ...(roleFilter !== 'all' ? { userRole: roleFilter } : {}),
      });
      const res = await authFetch(`/api/admin/activity-log?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        const items = json.data.logs ?? json.data;
        setActivities(Array.isArray(items) ? items : []);
        if (json.data.pages) setTotalPages(json.data.pages);
      }
    } catch {
      toast.error('فشل تحميل سجل النشاط');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, page, search, actionFilter, roleFilter]);

  useEffect(() => {
    void fetchActivities();
  }, [fetchActivities]);

  // Scroll to bottom on new data
  useEffect(() => {
    if (activities.length > 0 && bottomRef.current) {
      bottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [activities]);

  const hasActiveFilters = actionFilter !== 'all' || roleFilter !== 'all' || search !== '';

  const clearFilters = () => {
    setActionFilter('all');
    setRoleFilter('all');
    setSearch('');
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-admin/20 to-admin/5 flex items-center justify-center border border-admin/20">
            <Activity className="w-6 h-6 text-admin" />
          </div>
          <div>
            <h2 className="text-2xl font-bold tracking-tight">سجل النشاط</h2>
            <p className="text-muted-foreground text-sm">سجل كافة الأنشطة والأحداث على المنصة</p>
          </div>
        </div>
      </motion.div>

      {/* Filters - Professional Design */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Filter className="w-4 h-4 text-admin" />
                <span className="text-sm font-medium">تصفية الأنشطة</span>
              </div>
              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="text-xs gap-1 text-muted-foreground hover:text-foreground">
                  <X className="w-3 h-3" />
                  مسح الفلاتر
                </Button>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالاسم أو الإجراء..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pr-9 bg-background/50"
                />
              </div>
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-full sm:w-44 bg-background/50">
                  <SelectValue placeholder="الإجراء" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الإجراءات</SelectItem>
                  <SelectItem value="login">تسجيل دخول</SelectItem>
                  <SelectItem value="create">إنشاء</SelectItem>
                  <SelectItem value="update">تحديث</SelectItem>
                  <SelectItem value="delete">حذف</SelectItem>
                  <SelectItem value="verify">توثيق</SelectItem>
                  <SelectItem value="assign">تعيين</SelectItem>
                  <SelectItem value="complete">إكمال</SelectItem>
                  <SelectItem value="cancel">إلغاء</SelectItem>
                </SelectContent>
              </Select>
              <Select value={roleFilter} onValueChange={setRoleFilter}>
                <SelectTrigger className="w-full sm:w-40 bg-background/50">
                  <SelectValue placeholder="الدور" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأدوار</SelectItem>
                  <SelectItem value="admin">مدير</SelectItem>
                  <SelectItem value="subadmin">مدير فرعي</SelectItem>
                  <SelectItem value="nurse">ممرض/ـة</SelectItem>
                  <SelectItem value="beneficiary">مستفيد/ـة</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" onClick={() => void fetchActivities()} className="shrink-0 border-admin/20 hover:bg-admin/5">
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            {/* Active filter badges */}
            {hasActiveFilters && (
              <div className="flex flex-wrap gap-1.5">
                {actionFilter !== 'all' && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    {actionLabels[actionFilter] ?? actionFilter}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setActionFilter('all')} />
                  </Badge>
                )}
                {roleFilter !== 'all' && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    {roleLabels[roleFilter] ?? roleFilter}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setRoleFilter('all')} />
                  </Badge>
                )}
                {search && (
                  <Badge variant="secondary" className="text-[10px] gap-1">
                    بحث: {search}
                    <X className="w-3 h-3 cursor-pointer" onClick={() => setSearch('')} />
                  </Badge>
                )}
              </div>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* Activity Timeline - Professional Design */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin" noPadding>
          {isLoading ? (
            <div className="p-6">
              <ListSkeleton items={8} />
            </div>
          ) : activities.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="w-12 h-12 text-muted-foreground" />}
              title="لا توجد أنشطة"
              description="لم يتم تسجيل أي نشاط بعد"
            />
          ) : (
            <div className="divide-y divide-border/50">
              {activities.map((activity, index) => {
                const EntityIcon = entityIcons[activity.entity] ?? ScrollText;
                return (
                  <div
                    key={activity.id}
                    className="p-4 hover:bg-accent/10 transition-colors group"
                  >
                    <div className="flex items-start gap-3">
                      {/* Timeline Dot & Icon */}
                      <div className="relative shrink-0">
                        <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${entityColors[activity.entity] ?? 'bg-muted text-muted-foreground'}`}>
                          <EntityIcon className="w-5 h-5" />
                        </div>
                        {index === 0 && (
                          <div className="absolute -top-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-background animate-pulse" />
                        )}
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="font-semibold text-sm">{activity.userName}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${roleColors[activity.userRole] ?? 'bg-muted text-muted-foreground'}`}>
                            {roleLabels[activity.userRole] ?? activity.userRole}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-xs px-2.5 py-1 rounded-lg font-medium ${actionColors[activity.action] ?? 'bg-muted text-muted-foreground'}`}>
                            {actionLabels[activity.action] ?? activity.action}
                          </span>
                          <span className="text-sm text-muted-foreground">
                            {entityLabels[activity.entity] ?? activity.entity}
                          </span>
                          {activity.entityId && (
                            <span className="text-[10px] text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                              #{activity.entityId.slice(0, 8)}
                            </span>
                          )}
                        </div>
                        {activity.details && (
                          <p className="text-xs text-muted-foreground mt-2 line-clamp-2 bg-muted/30 rounded-lg px-3 py-2">{activity.details}</p>
                        )}
                        <div className="flex items-center gap-1.5 mt-2 text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          <span className="text-[11px]">
                            <DateFormatter date={activity.createdAt} format="relative" />
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={bottomRef} />
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Pagination - Professional */}
      {totalPages > 1 && (
        <motion.div variants={itemAnim} className="flex items-center justify-center gap-3">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            className="gap-1 border-admin/20 hover:bg-admin/5"
          >
            السابق
          </Button>
          <div className="flex items-center gap-1">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              const pageNum = page <= 3 ? i + 1 : page + i - 2;
              if (pageNum > totalPages || pageNum < 1) return null;
              return (
                <button
                  key={pageNum}
                  onClick={() => setPage(pageNum)}
                  className={`w-8 h-8 rounded-lg text-sm font-medium transition-all ${
                    pageNum === page
                      ? 'bg-admin text-white shadow-md'
                      : 'hover:bg-admin/10 text-muted-foreground'
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
          </div>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            className="gap-1 border-admin/20 hover:bg-admin/5"
          >
            التالي
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
