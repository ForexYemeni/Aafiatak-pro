'use client';

import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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
  Search,
  Loader2,
  Phone,
  MessageCircle,
  MapPin,
  Calendar,
  User,
  Navigation,
  Zap,
  ShieldAlert,
  Clock,
  CheckCircle2,
  Activity,
  UserPlus,
  Settings,
  Briefcase,
} from 'lucide-react';
import { StatCard } from '@/components/common/stat-card';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { CardSkeleton } from '@/components/common/loading-skeleton';
import { BadgeStatus } from '@/components/common/badge-status';
import { Currency } from '@/components/common/currency';
import { DateFormatter } from '@/components/common/date-formatter';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSearchParams } from 'next/navigation';

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
    transition: { staggerChildren: 0.06 },
  },
};

const item = {
  hidden: { opacity: 0, y: 20 },
  show: { opacity: 1, y: 0 },
};

export default function AdminDashboardPage() {
  const authFetch = useAuthFetch();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [dashboard, setDashboard] = useState<DashboardData | null>(null);
  const [recentOrders, setRecentOrders] = useState<RecentOrder[]>([]);
  const [recentRegistrations, setRecentRegistrations] = useState<RecentRegistration[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Quick search state
  const [quickSearch, setQuickSearch] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // Order detail dialog
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);

  const fetchDashboard = async () => {
    setIsLoading(true);
    setError(null);
    try {
      // Parallel API calls for faster loading
      const [dashboardRes, ordersRes, nursesRes, benRes] = await Promise.allSettled([
        authFetch('/api/admin/dashboard'),
        authFetch('/api/admin/orders?limit=5&page=1'),
        authFetch('/api/admin/nurses?limit=3&page=1'),
        authFetch('/api/admin/beneficiaries?limit=3&page=1'),
      ]);

      // Process dashboard data
      if (dashboardRes.status === 'fulfilled') {
        const json = await dashboardRes.value.json();
        if (json.success && json.data) {
          setDashboard(json.data);
        } else {
          setError(json.message ?? 'فشل تحميل البيانات');
        }
      } else {
        setError('فشل تحميل البيانات');
      }

      // Process orders
      if (ordersRes.status === 'fulfilled') {
        try {
          const res = ordersRes.value;
          if (res.ok) {
            const ordersJson = await res.json();
            if (ordersJson.success && ordersJson.data) {
              const ordersArray = ordersJson.data.orders ?? ordersJson.data;
              const orders = (Array.isArray(ordersArray) ? ordersArray : []).map((o: Record<string, unknown>) => ({
                id: String(o.id ?? o._id ?? ''),
                beneficiaryName: String((o.beneficiary as Record<string, unknown>)?.name ?? (o as any).beneficiaryName ?? 'غير معروف'),
                serviceName: String((o.service as Record<string, unknown>)?.nameAr ?? (o as any).serviceName ?? 'خدمة'),
                status: String(o.status ?? 'pending'),
                totalPrice: Number(o.totalPrice ?? o.basePrice ?? 0),
                createdAt: String(o.createdAt ?? new Date().toISOString()),
              }));
              setRecentOrders(orders);
            }
          }
        } catch { /* skip */ }
      }

      // Process nurses & beneficiaries
      const nurses: RecentRegistration[] = [];
      const beneficiaries: RecentRegistration[] = [];

      if (nursesRes.status === 'fulfilled') {
        try {
          const res = nursesRes.value;
          if (res.ok) {
            const nursesJson = await res.json();
            if (nursesJson.success && nursesJson.data) {
              const nursesArray = nursesJson.data.nurses ?? nursesJson.data;
              const nursesList = Array.isArray(nursesArray) ? nursesArray : [];
              for (const n of nursesList as Record<string, unknown>[]) {
                nurses.push({
                  id: String(n.id ?? n._id ?? ''),
                  name: String(n.name ?? ''),
                  type: 'nurse',
                  status: String(n.verificationStatus ?? n.status ?? 'pending'),
                  createdAt: String(n.createdAt ?? new Date().toISOString()),
                });
              }
            }
          }
        } catch { /* skip */ }
      }

      if (benRes.status === 'fulfilled') {
        try {
          const res = benRes.value;
          if (res.ok) {
            const benJson = await res.json();
            if (benJson.success && benJson.data) {
              const benArray = benJson.data.beneficiaries ?? benJson.data;
              const benList = Array.isArray(benArray) ? benArray : [];
              for (const b of benList as Record<string, unknown>[]) {
                beneficiaries.push({
                  id: String(b.id ?? b._id ?? ''),
                  name: String(b.name ?? ''),
                  type: 'beneficiary',
                  status: String(b.status ?? 'active'),
                  createdAt: String(b.createdAt ?? new Date().toISOString()),
                });
              }
            }
          }
        } catch { /* skip */ }
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

  // Quick search handler
  const handleQuickSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const q = quickSearch.trim();
    if (!q) return;

    setIsSearching(true);
    setShowSearchResults(true);
    try {
      const res = await authFetch(`/api/admin/orders?limit=5&search=${encodeURIComponent(q)}`);
      const json = await res.json();
      if (json.success && json.data) {
        const ordersArray = json.data.orders ?? json.data;
        setSearchResults(Array.isArray(ordersArray) ? ordersArray : []);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  };

  // Open order details in dialog
  const openOrderDetails = (order: any) => {
    setSelectedOrder(order);
  };

  // Get WhatsApp URL
  function getWhatsAppUrl(phone: string) {
    const cleanPhone = phone.replace(/\D/g, '');
    const withCode = cleanPhone.startsWith('0') ? '967' + cleanPhone.substring(1) : cleanPhone.startsWith('967') ? cleanPhone : '967' + cleanPhone;
    return `https://wa.me/${withCode}`;
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <CardSkeleton />
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

  return (
    <motion.div
      variants={container}
      initial="hidden"
      animate="show"
      className="space-y-6"
    >
      {/* Page Header - Professional with gradient accent */}
      <motion.div variants={item} className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-admin/20 to-admin/5 flex items-center justify-center border border-admin/20">
            <Activity className="w-6 h-6 text-admin" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">لوحة التحكم</h1>
            <p className="text-muted-foreground text-sm mt-0.5">نظرة عامة على منصة عافيتك</p>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={fetchDashboard} className="gap-2 border-admin/20 hover:bg-admin/5">
          <RefreshCw className="w-4 h-4" />
          تحديث
        </Button>
      </motion.div>

      {/* Quick Search - Redesigned */}
      <motion.div variants={item}>
        <GlassCard variant="admin" className="overflow-visible">
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-admin/10 flex items-center justify-center">
                <Search className="w-5 h-5 text-admin" />
              </div>
              <div>
                <h3 className="font-bold text-sm">بحث سريع</h3>
                <p className="text-xs text-muted-foreground">ابحث برقم الطلب أو اسم المستفيد أو رقم الهاتف</p>
              </div>
            </div>
            <form onSubmit={handleQuickSearch} className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  value={quickSearch}
                  onChange={(e) => {
                    setQuickSearch(e.target.value);
                    if (!e.target.value.trim()) {
                      setShowSearchResults(false);
                      setSearchResults([]);
                    }
                  }}
                  placeholder="أدخل رقم الطلب أو اسم المستفيد أو رقم الهاتف..."
                  className="pr-9 h-12 text-sm bg-background/50"
                  dir="rtl"
                />
              </div>
              <Button
                type="submit"
                className="bg-admin hover:bg-admin/90 h-12 px-6 gap-2"
                disabled={isSearching || !quickSearch.trim()}
              >
                {isSearching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                بحث
              </Button>
            </form>

            {/* Search Results */}
            {showSearchResults && (
              <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
                {isSearching ? (
                  <div className="flex items-center justify-center py-6 gap-2 text-sm text-muted-foreground">
                    <Loader2 className="w-5 h-5 animate-spin text-admin" />
                    جاري البحث...
                  </div>
                ) : searchResults.length === 0 ? (
                  <div className="text-center py-6">
                    <Search className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">لم يتم العثور على نتائج</p>
                    <Link href={`/admin/orders?search=${encodeURIComponent(quickSearch)}`}>
                      <Button variant="link" size="sm" className="text-admin mt-1">
                        البحث المتقدم في الطلبات
                      </Button>
                    </Link>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-muted-foreground">تم العثور على {searchResults.length} نتيجة</p>
                      <Link href={`/admin/orders?search=${encodeURIComponent(quickSearch)}`}>
                        <Button variant="link" size="sm" className="text-admin text-xs p-0 h-auto">
                          عرض الكل في الطلبات ←
                        </Button>
                      </Link>
                    </div>
                    <div className="space-y-2">
                      {searchResults.map((order: any) => (
                        <button
                          key={order.id || order._id}
                          onClick={() => openOrderDetails(order)}
                          className="w-full text-right p-3 rounded-xl border border-border hover:border-admin/30 hover:bg-admin/5 transition-all"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-3 min-w-0 flex-1">
                              <div className="w-9 h-9 rounded-lg bg-admin/10 flex items-center justify-center shrink-0">
                                <ClipboardList className="w-4 h-4 text-admin" />
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-mono text-xs font-bold text-admin">#{(order.id || order._id?.toString() || '').slice(-6).toUpperCase()}</span>
                                  <BadgeStatus status={order.status} size="sm" />
                                  {order.isEmergency && <Badge variant="destructive" className="text-[9px] px-1 py-0">طوارئ</Badge>}
                                </div>
                                <p className="text-xs text-muted-foreground mt-0.5 truncate">
                                  {order.beneficiaryName || 'غير معروف'} • {order.serviceName || 'خدمة'}
                                </p>
                              </div>
                            </div>
                            <div className="text-left shrink-0">
                              <Currency amount={order.totalPrice || 0} className="text-sm font-bold" />
                              <p className="text-[10px] text-muted-foreground">
                                {order.beneficiaryPhone && <span dir="ltr">{order.beneficiaryPhone}</span>}
                              </p>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* Stat Cards - Professional with hover effects */}
      <motion.div variants={item} className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Link href="/admin/nurses" className="group">
          <div className="glass rounded-2xl p-4 sm:p-5 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border border-transparent hover:border-admin/20">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Stethoscope className="w-5 h-5 text-admin" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl sm:text-3xl font-bold tracking-tight">{dashboard.totalNurses}</p>
                <p className="text-xs text-muted-foreground">إجمالي الممرضين</p>
                {dashboard.nurseGrowthRate !== 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <span className="text-[10px] text-green-600 font-medium">{dashboard.nurseGrowthRate}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Link>
        <Link href="/admin/beneficiaries" className="group">
          <div className="glass rounded-2xl p-4 sm:p-5 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border border-transparent hover:border-admin/20">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-violet-500/20 to-purple-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Users className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl sm:text-3xl font-bold tracking-tight">{dashboard.totalBeneficiaries}</p>
                <p className="text-xs text-muted-foreground">إجمالي المستفيدين</p>
                {dashboard.beneficiaryGrowthRate !== 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <span className="text-[10px] text-green-600 font-medium">{dashboard.beneficiaryGrowthRate}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Link>
        <Link href="/admin/orders" className="group">
          <div className="glass rounded-2xl p-4 sm:p-5 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border border-transparent hover:border-admin/20">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-sky-500/20 to-blue-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <ClipboardList className="w-5 h-5 text-sky-600 dark:text-sky-400" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl sm:text-3xl font-bold tracking-tight">{dashboard.todayOrders}</p>
                <p className="text-xs text-muted-foreground">طلبات اليوم</p>
                {dashboard.orderGrowthRate !== 0 && (
                  <div className="flex items-center gap-1 mt-0.5">
                    <TrendingUp className="w-3 h-3 text-green-500" />
                    <span className="text-[10px] text-green-600 font-medium">{dashboard.orderGrowthRate}%</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </Link>
        <Link href="/admin/payments" className="group">
          <div className="glass rounded-2xl p-4 sm:p-5 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border border-transparent hover:border-admin/20">
            <div className="flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-emerald-500/20 to-green-500/10 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                <Banknote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div className="min-w-0">
                <p className="text-2xl sm:text-3xl font-bold tracking-tight"><Currency amount={dashboard.todayRevenue} /></p>
                <p className="text-xs text-muted-foreground">إيرادات اليوم</p>
              </div>
            </div>
          </div>
        </Link>
      </motion.div>

      {/* Quick Actions - Professional Card Grid */}
      <motion.div variants={item}>
        <div className="flex items-center gap-2 mb-3">
          <Zap className="w-5 h-5 text-admin" />
          <h3 className="text-lg font-semibold">إجراءات سريعة</h3>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Link href="/admin/nurses" className="group">
            <div className="glass rounded-2xl p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border border-transparent hover:border-sky-200 dark:hover:border-sky-900/50 text-center">
              <div className="w-12 h-12 rounded-2xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Stethoscope className="w-6 h-6 text-sky-600 dark:text-sky-400" />
              </div>
              <p className="text-sm font-semibold mb-1">الممرضون المعلقون</p>
              {dashboard.pendingVerifications > 0 ? (
                <Badge variant="destructive" className="text-[10px]">{dashboard.pendingVerifications} بانتظار المراجعة</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">لا يوجد معلقين</Badge>
              )}
            </div>
          </Link>
          <Link href="/admin/emergencies" className="group">
            <div className="glass rounded-2xl p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border border-transparent hover:border-red-200 dark:hover:border-red-900/50 text-center">
              <div className="w-12 h-12 rounded-2xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <ShieldAlert className="w-6 h-6 text-red-600 dark:text-red-400" />
              </div>
              <p className="text-sm font-semibold mb-1">حالات الطوارئ</p>
              {dashboard.activeEmergencies > 0 ? (
                <Badge variant="destructive" className="text-[10px] animate-pulse">{dashboard.activeEmergencies} حالة نشطة</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">لا توجد طوارئ</Badge>
              )}
            </div>
          </Link>
          <Link href="/admin/orders" className="group">
            <div className="glass rounded-2xl p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border border-transparent hover:border-amber-200 dark:hover:border-amber-900/50 text-center">
              <div className="w-12 h-12 rounded-2xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Clock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm font-semibold mb-1">الطلبات المعلقة</p>
              {dashboard.pendingOrders > 0 ? (
                <Badge className="text-[10px] bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-400">{dashboard.pendingOrders} طلب معلق</Badge>
              ) : (
                <Badge variant="secondary" className="text-[10px]">لا توجد معلقات</Badge>
              )}
            </div>
          </Link>
          <Link href="/admin/services" className="group">
            <div className="glass rounded-2xl p-4 transition-all duration-300 hover:shadow-lg hover:scale-[1.02] border border-transparent hover:border-emerald-200 dark:hover:border-emerald-900/50 text-center">
              <div className="w-12 h-12 rounded-2xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-3 group-hover:scale-110 transition-transform">
                <Plus className="w-6 h-6 text-emerald-600 dark:text-emerald-400" />
              </div>
              <p className="text-sm font-semibold mb-1">إضافة خدمة</p>
              <Badge variant="secondary" className="text-[10px]">خدمة جديدة</Badge>
            </div>
          </Link>
        </div>
      </motion.div>

      {/* Emergency Alerts - Enhanced */}
      {dashboard.activeEmergencies > 0 && (
        <motion.div variants={item}>
          <div className="rounded-2xl border-2 border-red-300 dark:border-red-800/50 bg-gradient-to-l from-red-50 to-red-100/50 dark:from-red-950/30 dark:to-red-900/20 p-5">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-red-100 dark:bg-red-900/40 flex items-center justify-center animate-pulse shrink-0">
                <AlertTriangle className="w-7 h-7 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-red-700 dark:text-red-400">تنبيهات الطوارئ</h3>
                <p className="text-sm text-red-600/80 dark:text-red-400/80 mt-0.5">
                  يوجد <span className="font-bold text-lg">{dashboard.activeEmergencies}</span> حالة طوارئ نشطة تتطلب اهتمامًا فوريًا
                </p>
              </div>
              <Link href="/admin/emergencies" className="shrink-0">
                <Button variant="destructive" size="sm" className="gap-2 shadow-lg shadow-red-500/20">
                  <AlertTriangle className="w-4 h-4" />
                  إدارة الطوارئ
                </Button>
              </Link>
            </div>
          </div>
        </motion.div>
      )}

      {/* Main Content Grid */}
      <motion.div variants={item} className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders - Enhanced */}
        <GlassCard variant="admin" className="lg:col-span-2" noPadding>
          <div className="p-5 pb-0">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center">
                  <ClipboardList className="w-5 h-5 text-sky-600 dark:text-sky-400" />
                </div>
                <div>
                  <h3 className="text-lg font-semibold">آخر الطلبات</h3>
                  <p className="text-xs text-muted-foreground">أحدث 5 طلبات على المنصة</p>
                </div>
              </div>
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
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">المستفيد</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">الخدمة</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">الحالة</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">المبلغ</th>
                  <th className="text-right text-xs font-medium text-muted-foreground px-5 py-3">التاريخ</th>
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
                    <tr key={order.id} className="border-b border-border/50 hover:bg-accent/20 transition-colors cursor-pointer" onClick={() => setSelectedOrder(order)}>
                      <td className="px-5 py-3 text-sm font-medium">{order.beneficiaryName}</td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">{order.serviceName}</td>
                      <td className="px-5 py-3">
                        <BadgeStatus status={order.status} size="sm" />
                      </td>
                      <td className="px-5 py-3 text-sm font-semibold">
                        <Currency amount={order.totalPrice} />
                      </td>
                      <td className="px-5 py-3 text-sm text-muted-foreground">
                        <DateFormatter date={order.createdAt} format="short" />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </GlassCard>

        {/* Recent Registrations - Enhanced */}
        <GlassCard variant="admin">
          <GlassCardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-violet-100 dark:bg-violet-900/30 flex items-center justify-center">
                  <UserPlus className="w-5 h-5 text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <GlassCardTitle>التسجيلات الحديثة</GlassCardTitle>
                  <p className="text-xs text-muted-foreground mt-0.5">أحدث المستخدمين المسجلين</p>
                </div>
              </div>
            </div>
          </GlassCardHeader>
          <GlassCardContent>
            <div className="space-y-3 max-h-72 overflow-y-auto custom-scrollbar">
              {recentRegistrations.length === 0 ? (
                <div className="text-center py-8">
                  <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">لا توجد تسجيلات حديثة</p>
                </div>
              ) : (
                recentRegistrations.map((reg) => (
                  <div key={`${reg.type}-${reg.id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-accent/20 transition-colors">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      reg.type === 'nurse' ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400' : 'bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400'
                    }`}>
                      {reg.type === 'nurse' ? <Stethoscope className="w-5 h-5" /> : <Users className="w-5 h-5" />}
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

      {/* Summary Stats - Professional Bento Grid */}
      <motion.div variants={item}>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="glass rounded-2xl p-4 text-center hover:shadow-md transition-all duration-200 border border-transparent hover:border-green-200 dark:hover:border-green-900/50">
            <div className="w-10 h-10 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-2">
              <CheckCircle2 className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{dashboard.totalCompletedRequests}</p>
            <p className="text-xs text-muted-foreground mt-1">طلبات مكتملة</p>
          </div>
          <div className="glass rounded-2xl p-4 text-center hover:shadow-md transition-all duration-200 border border-transparent hover:border-amber-200 dark:hover:border-amber-900/50">
            <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mx-auto mb-2">
              <TrendingUp className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            </div>
            <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{dashboard.averageRating.toFixed(1)}</p>
            <p className="text-xs text-muted-foreground mt-1">متوسط التقييم</p>
          </div>
          <div className="glass rounded-2xl p-4 text-center hover:shadow-md transition-all duration-200 border border-transparent hover:border-emerald-200 dark:hover:border-emerald-900/50">
            <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center mx-auto mb-2">
              <Banknote className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <p className="text-2xl font-bold"><Currency amount={dashboard.totalCommission} /></p>
            <p className="text-xs text-muted-foreground mt-1">إجمالي العمولة</p>
          </div>
          <div className="glass rounded-2xl p-4 text-center hover:shadow-md transition-all duration-200 border border-transparent hover:border-sky-200 dark:hover:border-sky-900/50">
            <div className="w-10 h-10 rounded-xl bg-sky-100 dark:bg-sky-900/30 flex items-center justify-center mx-auto mb-2">
              <Users className="w-5 h-5 text-sky-600 dark:text-sky-400" />
            </div>
            <p className="text-2xl font-bold text-sky-600 dark:text-sky-400">{dashboard.totalReferrals}</p>
            <p className="text-xs text-muted-foreground mt-1">إجمالي الإحالات</p>
          </div>
          <Link href="/admin/deployments" className="glass rounded-2xl p-4 text-center hover:shadow-md transition-all duration-200 border border-transparent hover:border-indigo-200 dark:hover:border-indigo-900/50">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-900/30 flex items-center justify-center mx-auto mb-2">
              <Briefcase className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">التكليفات</p>
            <p className="text-xs text-muted-foreground mt-1">إدارة التكليفات</p>
          </Link>
        </div>
      </motion.div>

      {/* Order Detail Dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={(open) => { if (!open) setSelectedOrder(null); }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-admin" />
              تفاصيل الطلب #{selectedOrder?.id?.slice?.(-6)?.toUpperCase?.()}
            </DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4">
              {/* Beneficiary Info */}
              <div className="flex items-center gap-3 p-3 glass rounded-xl">
                <Avatar className="w-12 h-12 shrink-0">
                  <AvatarFallback className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                    <User className="w-5 h-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold truncate">{selectedOrder.beneficiaryName || 'غير معروف'}</p>
                  {selectedOrder.beneficiaryPhone && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-muted-foreground">{selectedOrder.beneficiaryPhone}</span>
                      <a href={`tel:${selectedOrder.beneficiaryPhone}`}><Phone className="w-3.5 h-3.5 text-blue-500" /></a>
                      <a href={getWhatsAppUrl(selectedOrder.beneficiaryPhone)} target="_blank" rel="noopener noreferrer"><MessageCircle className="w-3.5 h-3.5 text-green-500" /></a>
                    </div>
                  )}
                </div>
                <BadgeStatus status={selectedOrder.status} size="md" />
              </div>

              {/* Order Details Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Stethoscope className="w-3.5 h-3.5" />
                    <p className="text-xs">الخدمة</p>
                  </div>
                  <p className="text-sm font-medium break-words">{selectedOrder.serviceName || 'خدمة'}</p>
                </div>
                <div className="glass rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Banknote className="w-3.5 h-3.5" />
                    <p className="text-xs">المبلغ الإجمالي</p>
                  </div>
                  <p className="text-sm font-bold"><Currency amount={selectedOrder.totalPrice || 0} /></p>
                </div>
                <div className="glass rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <User className="w-3.5 h-3.5" />
                    <p className="text-xs">الممرض/ـة</p>
                  </div>
                  <p className="text-sm font-medium break-words">{selectedOrder.nurseName || 'غير معيَّن'}</p>
                </div>
                <div className="glass rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Calendar className="w-3.5 h-3.5" />
                    <p className="text-xs">التاريخ</p>
                  </div>
                  <p className="text-sm font-medium"><DateFormatter date={selectedOrder.createdAt} format="short" /></p>
                </div>
              </div>

              {/* Location */}
              {selectedOrder.beneficiaryAddress && (
                <div className="glass rounded-xl p-3">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <MapPin className="w-3.5 h-3.5 text-red-500" />
                    <p className="text-xs">الموقع</p>
                  </div>
                  <p className="text-sm font-medium">{selectedOrder.beneficiaryAddress}</p>
                  {selectedOrder.beneficiaryLat && selectedOrder.beneficiaryLng && (
                    <a href={`https://www.google.com/maps?q=${selectedOrder.beneficiaryLat},${selectedOrder.beneficiaryLng}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                      <Navigation className="w-3 h-3" /> عرض على الخريطة
                    </a>
                  )}
                </div>
              )}

              {/* Emergency / Night / Friday badges */}
              <div className="flex flex-wrap gap-2">
                {selectedOrder.isEmergency && <Badge variant="destructive">طلب طوارئ</Badge>}
                {selectedOrder.isNightService && <Badge className="bg-indigo-100 text-indigo-700">خدمة ليلية</Badge>}
                {selectedOrder.isFridayService && <Badge className="bg-amber-100 text-amber-700">خدمة جمعة</Badge>}
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">ملاحظات</p>
                  <p className="text-sm">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Action Button */}
              <Button
                onClick={() => router.push(`/admin/orders?search=${encodeURIComponent(selectedOrder.id.slice(-6))}`)}
                className="w-full bg-admin hover:bg-admin/90 gap-2"
              >
                <ClipboardList className="w-4 h-4" />
                إدارة الطلب بالكامل
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
