'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Stethoscope,
  Users,
  ClipboardList,
  Banknote,
  AlertTriangle,
  TrendingUp,
  Plus,
  ArrowLeft,
  RefreshCw,
} from 'lucide-react';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import { StatCard } from '@/components/common/stat-card';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { CardSkeleton, ChartSkeleton } from '@/components/common/loading-skeleton';
import { BadgeStatus } from '@/components/common/badge-status';
import { Currency } from '@/components/common/currency';
import { DateFormatter } from '@/components/common/date-formatter';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface DashboardData {
  totalBeneficiaries: number;
  totalNurses: number;
  totalActiveNurses: number;
  totalPendingNurses: number;
  totalServiceRequests: number;
  totalCompletedRequests: number;
  totalCancelledRequests: number;
  totalEmergencyRequests: number;
  totalRevenue: number;
  totalCommission: number;
  totalNursePayouts: number;
  totalReferrals: number;
  averageRating: number;
  beneficiaryGrowthRate: number;
  nurseGrowthRate: number;
  revenueGrowthRate: number;
  orderGrowthRate: number;
  pendingVerifications: number;
  activeEmergencies: number;
  todayRevenue: number;
  todayOrders: number;
  todayNewBeneficiaries: number;
  todayNewNurses: number;
  pendingOrders: number;
  activeOrders: number;
  revenueChartData: { date: string; revenue: number }[];
  ordersChartData: { date: string; orders: number }[];
}

interface RecentOrder {
  id: string;
  beneficiaryName: string;
  serviceName: string;
  status: string;
  totalPrice: number;
  createdAt: string;
}

interface RecentRegistration {
  id: string;
  name: string;
  type: 'nurse' | 'beneficiary';
  status: string;
  createdAt: string;
}

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

const arabicDayNames: Record<string, string> = {
  Sun: 'الأحد',
  Mon: 'الإثنين',
  Tue: 'الثلاثاء',
  Wed: 'الأربعاء',
  Thu: 'الخميس',
  Fri: 'الجمعة',
  Sat: 'السبت',
};

function formatDateLabel(dateStr: string): string {
  const date = new Date(dateStr);
  const dayName = arabicDayNames[date.toLocaleDateString('en', { weekday: 'short' })] ?? dateStr;
  const day = date.getDate();
  return `${dayName} ${day}`;
}

export default function AdminDashboardPage() {
  const authFetch = useAuthFetch();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentRegistrations, setRecentRegistrations] = useState<RecentRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/admin/dashboard');
      const json = await res.json();
      if (json.success && json.data) {
        setDashboard(json.data);
      } else {
        setError(json.message ?? 'فشل تحميل البيانات');
      }

      const ordersRes = await authFetch('/api/admin/orders?limit=5&page=1');
      const ordersJson = await ordersRes.json();
      if (ordersJson.success && ordersJson.data) {
        const orders = ordersJson.data.map((o: Record<string, unknown>) => ({
          id: String(o.id ?? ''),
          beneficiaryName: String((o.beneficiary as Record<string, unknown>)?.name ?? 'غير معروف'),
          serviceName: String((o.service as Record<string, unknown>)?.nameAr ?? 'خدمة'),
          status: String(o.status ?? 'pending'),
          totalPrice: Number(o.totalPrice ?? 0),
          createdAt: String(o.createdAt ?? new Date().toISOString()),
        }));
        setRecentOrders(orders);
      }

      const nursesRes = await authFetch('/api/admin/nurses?limit=3&page=1');
      const nursesJson = await nursesRes.json();
      const nurses: RecentRegistration[] = [];
      if (nursesJson.success && nursesJson.data) {
        for (const n of nursesJson.data as Record<string, unknown>[]) {
          nurses.push({
            id: String(n.id ?? ''),
            name: String(n.name ?? ''),
            type: 'nurse',
            status: String(n.verificationStatus ?? n.status ?? 'pending'),
            createdAt: String(n.createdAt ?? new Date().toISOString()),
          });
        }
      }

      const benRes = await authFetch('/api/admin/beneficiaries?limit=3&page=1');
      const benJson = await benRes.json();
      const beneficiaries: RecentRegistration[] = [];
      if (benJson.success && benJson.data) {
        for (const b of benJson.data as Record<string, unknown>[]) {
          beneficiaries.push({
            id: String(b.id ?? ''),
            name: String(b.name ?? ''),
            type: 'beneficiary',
            status: String(b.status ?? 'active'),
            createdAt: String(b.createdAt ?? new Date().toISOString()),
          });
        }
      }

      setRecentRegistrations(
        [...nurses, ...beneficiaries].sort(
          (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
        ).slice(0, 5)
      );
    } catch {
      setError('حدث خطأ أثناء تحميل البيانات');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    void fetchDashboard();
  }, []);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <ChartSkeleton />
          <ChartSkeleton />
        </div>
        <CardSkeleton />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <AlertTriangle className="w-16 h-16 text-destructive mb-4" />
        <h3 className="text-lg font-semibold mb-2">خطأ في التحميل</h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <Button onClick={fetchDashboard} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          إعادة المحاولة
        </Button>
      </div>
    );
  }

  if (!dashboard) return null;

  const revenueChartData = dashboard.revenueChartData.map((d) => ({
    name: formatDateLabel(d.date),
    revenue: d.revenue,
  }));

  const ordersChartData = dashboard.ordersChartData.map((d) => ({
    name: formatDateLabel(d.date),
    orders: d.orders,
  }));

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Page Header */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">لوحة التحكم</h1>
          <p className="text-muted-foreground text-sm mt-1">نظرة عامة على منصة عافيتك</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboard} className="gap-2">
          <RefreshCw className="w-4 h-4" />
          تحديث
        </Button>
      </motion.div>

      {/* Stat Cards */}
      <motion.div variants={item} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          icon={<Stethoscope className="w-6 h-6" />}
          value={dashboard.totalNurses}
          label="إجمالي الممرضين"
          variant="admin"
          trend={
            dashboard.nurseGrowthRate !== 0
              ? { value: Math.abs(dashboard.nurseGrowthRate), isPositive: dashboard.nurseGrowthRate >= 0 }
              : undefined
          }
        />
        <StatCard
          icon={<Users className="w-6 h-6" />}
          value={dashboard.totalBeneficiaries}
          label="إجمالي المستفيدين"
          variant="admin"
          trend={
            dashboard.beneficiaryGrowthRate !== 0
              ? { value: Math.abs(dashboard.beneficiaryGrowthRate), isPositive: dashboard.beneficiaryGrowthRate >= 0 }
              : undefined
          }
        />
        <StatCard
          icon={<ClipboardList className="w-6 h-6" />}
          value={dashboard.todayOrders}
          label="طلبات اليوم"
          variant="admin"
          trend={
            dashboard.orderGrowthRate !== 0
              ? { value: Math.abs(dashboard.orderGrowthRate), isPositive: dashboard.orderGrowthRate >= 0 }
              : undefined
          }
        />
        <StatCard
          icon={<Banknote className="w-6 h-6" />}
          value={<Currency amount={dashboard.todayRevenue} />}
          label="إيرادات اليوم"
          variant="admin"
        />
      </motion.div>

      {/* Quick Actions */}
      <motion.div variants={item}>
        <GlassCard variant="admin">
          <GlassCardHeader>
            <GlassCardTitle>إجراءات سريعة</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="flex flex-wrap gap-3">
              <Link href="/admin/nurses">
                <Button variant="outline" size="sm" className="gap-2">
                  <Stethoscope className="w-4 h-4" />
                  الممرضون المعلقون
                  {dashboard.pendingVerifications > 0 && (
                    <Badge variant="destructive" className="mr-1">{dashboard.pendingVerifications}</Badge>
                  )}
                </Button>
              </Link>
              <Link href="/admin/emergencies">
                <Button variant="outline" size="sm" className="gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  حالات الطوارئ
                  {dashboard.activeEmergencies > 0 && (
                    <Badge variant="destructive" className="mr-1">{dashboard.activeEmergencies}</Badge>
                  )}
                </Button>
              </Link>
              <Link href="/admin/orders">
                <Button variant="outline" size="sm" className="gap-2">
                  <ClipboardList className="w-4 h-4" />
                  الطلبات المعلقة
                  {dashboard.pendingOrders > 0 && (
                    <Badge variant="secondary" className="mr-1">{dashboard.pendingOrders}</Badge>
                  )}
                </Button>
              </Link>
              <Link href="/admin/services">
                <Button variant="outline" size="sm" className="gap-2">
                  <Plus className="w-4 h-4" />
                  إضافة خدمة
                </Button>
              </Link>
            </div>
          </GlassCardContent>
        </GlassCard>
      </motion.div>

      {/* Charts Row */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Chart */}
        <GlassCard variant="admin">
          <GlassCardHeader>
            <GlassCardTitle>الإيرادات - آخر ٧ أيام</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={revenueChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      direction: 'rtl',
                    }}
                    formatter={(value: number) => [`${value.toLocaleString()} ر.ي`, 'الإيرادات']}
                  />
                  <Legend formatter={() => 'الإيرادات'} />
                  <Line
                    type="monotone"
                    dataKey="revenue"
                    stroke="oklch(0.7 0.17 70)"
                    strokeWidth={2}
                    dot={{ fill: 'oklch(0.7 0.17 70)', r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </GlassCardContent>
        </GlassCard>

        {/* Orders Chart */}
        <GlassCard variant="admin">
          <GlassCardHeader>
            <GlassCardTitle>الطلبات - آخر ٧ أيام</GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={ordersChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                  <Tooltip
                    contentStyle={{
                      background: 'var(--popover)',
                      border: '1px solid var(--border)',
                      borderRadius: '8px',
                      direction: 'rtl',
                    }}
                    formatter={(value: number) => [value, 'الطلبات']}
                  />
                  <Legend formatter={() => 'الطلبات'} />
                  <Bar
                    dataKey="orders"
                    fill="oklch(0.7 0.17 70)"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </GlassCardContent>
        </GlassCard>
      </motion.div>

      {/* Bottom Row */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <GlassCard variant="admin" className="lg:col-span-2" noPadding>
          <div className="p-6 pb-0">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">آخر الطلبات</h3>
              <Link href="/admin/orders">
                <Button variant="ghost" size="sm" className="gap-1 text-admin">
                  عرض الكل
                  <ArrowLeft className="w-4 h-4" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">المستفيد</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">الخدمة</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">الحالة</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">المبلغ</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-6 py-3">التاريخ</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-8 text-muted-foreground">
                      لا توجد طلبات حديثة
                    </td>
                  </tr>
                ) : (
                  recentOrders.map((order) => (
                    <tr key={order.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors">
                      <td className="px-6 py-3 text-sm">{order.beneficiaryName}</td>
                      <td className="px-6 py-3 text-sm">{order.serviceName}</td>
                      <td className="px-6 py-3">
                        <BadgeStatus status={order.status} size="sm" />
                      </td>
                      <td className="px-6 py-3 text-sm">
                        <Currency amount={order.totalPrice} />
                      </td>
                      <td className="px-6 py-3 text-sm text-muted-foreground">
                        <DateFormatter date={order.createdAt} format="short" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* Recent Registrations */}
        <GlassCard variant="admin">
          <GlassCardHeader>
            <div className="flex items-center justify-between">
              <GlassCardTitle>التسجيلات الحديثة</GlassCardTitle>
              <TrendingUp className="w-5 h-5 text-admin" />
            </div>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="space-y-4 max-h-72 overflow-y-auto custom-scrollbar">
              {recentRegistrations.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-8">لا توجد تسجيلات حديثة</p>
              ) : (
                recentRegistrations.map((reg) => (
                  <div key={`${reg.type}-${reg.id}`} className="flex items-center gap-3">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${
                      reg.type === 'nurse' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' : 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400'
                    }`}>
                      {reg.type === 'nurse' ? <Stethoscope className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{reg.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {reg.type === 'nurse' ? 'ممرض/ـة' : 'مستفيد/ـة'}
                      </p>
                    </div>
                    <BadgeStatus status={reg.status} size="sm" />
                  </div>
                ))
              )}
            </div>
          </GlassCardContent>
        </GlassCard>
      </motion.div>

      {/* Emergency Alerts */}
      {dashboard.activeEmergencies > 0 && (
        <motion.div variants={item}>
          <GlassCard className="border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
            <GlassCardHeader>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center animate-pulse">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <GlassCardTitle className="text-red-700 dark:text-red-400">تنبيهات الطوارئ</GlassCardTitle>
                  <p className="text-sm text-red-600/80 dark:text-red-400/80">
                    يوجد {dashboard.activeEmergencies} حالة طوارئ نشطة تتطلب اهتمامًا فوريًا
                  </p>
                </div>
                <Link href="/admin/emergencies" className="mr-auto">
                  <Button variant="destructive" size="sm" className="gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    إدارة الطوارئ
                  </Button>
                </Link>
              </div>
            </GlassCardHeader>
          </GlassCard>
        </motion.div>
      )}

      {/* Summary Stats Row */}
      <motion.div variants={item} className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <GlassCard variant="admin">
          <div className="text-center">
            <p className="text-2xl font-bold text-admin">{dashboard.totalCompletedRequests}</p>
            <p className="text-xs text-muted-foreground mt-1">طلبات مكتملة</p>
          </div>
        </GlassCard>
        <GlassCard variant="admin">
          <div className="text-center">
            <p className="text-2xl font-bold text-admin">{dashboard.averageRating.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground mt-1">متوسط التقييم</p>
          </div>
        </GlassCard>
        <GlassCard variant="admin">
          <div className="text-center">
            <p className="text-2xl font-bold"><Currency amount={dashboard.totalCommission} /></p>
            <p className="text-xs text-muted-foreground mt-1">إجمالي العمولة</p>
          </div>
        </GlassCard>
        <GlassCard variant="admin">
          <div className="text-center">
            <p className="text-2xl font-bold text-admin">{dashboard.totalReferrals}</p>
            <p className="text-xs text-muted-foreground mt-1">إجمالي الإحالات</p>
          </div>
        </GlassCard>
      </motion.div>
    </motion.div>
  );
}
