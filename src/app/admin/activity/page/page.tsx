'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ScrollText, RefreshCw, Filter } from 'lucide-react';
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

const roleColors: Record<string, string> = {
  admin: 'bg-admin/15 text-admin',
  subadmin: 'bg-admin/15 text-admin',
  nurse: 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400',
  beneficiary: 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400',
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
        setActivities(json.data as ActivityItem[]);
        if (json.pagination) setTotalPages(json.pagination.totalPages);
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

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <PageHeader title="سجل النشاط" description="سجل كافة الأنشطة والأحداث على المنصة" />
      </motion.div>

      {/* Filters */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Input
              placeholder="بحث بالاسم أو الإجراء..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="flex-1 text-right"
            />
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="w-full sm:w-40">
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
              <SelectTrigger className="w-full sm:w-40">
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
            <Button variant="outline" size="icon" onClick={() => void fetchActivities()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </GlassCard>
      </motion.div>

      {/* Activity List */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin" noPadding>
          {isLoading ? (
            <div className="p-6">
              <ListSkeleton items={8} />
            </div>
          ) : activities.length === 0 ? (
            <EmptyState
              icon={<ScrollText className="w-10 h-10 text-muted-foreground" />}
              title="لا توجد أنشطة"
              description="لم يتم تسجيل أي نشاط بعد"
            />
          ) : (
            <div className="divide-y divide-border max-h-[600px] overflow-y-auto custom-scrollbar">
              {activities.map((activity) => (
                <div key={activity.id} className="p-4 hover:bg-accent/20 transition-colors">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-9 h-9 shrink-0">
                      <AvatarFallback className={`text-xs ${roleColors[activity.userRole] ?? 'bg-muted text-muted-foreground'}`}>
                        {activity.userName.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{activity.userName}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${roleColors[activity.userRole] ?? 'bg-muted text-muted-foreground'}`}>
                          {activity.userRole === 'admin' ? 'مدير' :
                           activity.userRole === 'subadmin' ? 'مدير فرعي' :
                           activity.userRole === 'nurse' ? 'ممرض/ـة' : 'مستفيد/ـة'}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 text-sm">
                        <span className="text-xs px-2 py-0.5 rounded-full bg-accent text-accent-foreground">
                          {actionLabels[activity.action] ?? activity.action}
                        </span>
                        <span className="text-muted-foreground">
                          {entityLabels[activity.entity] ?? activity.entity}
                        </span>
                        {activity.entityId && (
                          <span className="text-xs text-muted-foreground font-mono">
                            #{activity.entityId.slice(0, 8)}
                          </span>
                        )}
                      </div>
                      {activity.details && (
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{activity.details}</p>
                      )}
                      <p className="text-xs text-muted-foreground mt-1">
                        <DateFormatter date={activity.createdAt} format="relative" />
                      </p>
                    </div>
                  </div>
                </div>
              ))}
              <div ref={bottomRef} />
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* Pagination */}
      {totalPages > 1 && (
        <motion.div variants={itemAnim} className="flex items-center justify-center gap-4">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            السابق
          </Button>
          <span className="text-sm text-muted-foreground">
            صفحة {page} من {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            التالي
          </Button>
        </motion.div>
      )}
    </motion.div>
  );
}
