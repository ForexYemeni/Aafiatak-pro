'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Wallet,
  TrendingUp,
  Calendar,
  ArrowDownToLine,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/common/glass-card';
import { Currency, formatYemeniRial, toArabicNumerals } from '@/components/common/currency';
import { StatCard } from '@/components/common/stat-card';
import { EmptyState } from '@/components/common/empty-state';
import { PullToRefresh } from '@/components/common/pull-to-refresh';
import { ChartSkeleton, CardSkeleton } from '@/components/common/loading-skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthFetch } from '@/hooks/use-auth';
import { formatDateOnly } from '@/components/common/date-formatter';

// ---- Types ----

interface EarningsData {
  totalEarnings: number;
  availableBalance: number;
  completedJobs: number;
  thisMonthEarnings: number;
  recentPayouts: Array<{
    id: string;
    amount: number;
    method: string;
    status: string;
    requestedAt: string;
    processedAt: string | null;
    reference: string | null;
  }>;
  dailyEarnings: Array<{
    date: string;
    earnings: number;
  }>;
}

// ---- Component ----

export default function NurseEarningsPage() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);
  const authFetch = useAuthFetch();

  const fetchEarnings = useCallback(async () => {
    try {
      const res = await authFetch('/api/nurse/earnings');
      const data = await res.json();
      if (data.success && data.data) {
        setEarnings(data.data as EarningsData);
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchEarnings();
  }, [fetchEarnings]);

  const handlePayoutRequest = async () => {
    if (!earnings || earnings.availableBalance <= 0) return;
    setPayoutLoading(true);
    try {
      const res = await authFetch('/api/nurse/earnings', {
        method: 'POST',
        body: JSON.stringify({ amount: earnings.availableBalance }),
      });
      const data = await res.json();
      if (data.success) {
        setShowPayoutDialog(false);
        fetchEarnings();
      }
    } catch {
      // silently handle
    } finally {
      setPayoutLoading(false);
    }
  };

  // Chart data with Arabic day names
  const arabicDayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

  const chartData = (earnings?.dailyEarnings ?? []).map((d) => {
    const date = new Date(d.date);
    return {
      name: arabicDayNames[date.getDay()],
      earnings: Math.round(d.earnings),
    };
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="الأرباح" description="تتبع أرباحك والمدفوعات" />
        <div className="grid grid-cols-2 gap-3">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <ChartSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader title="الأرباح" description="تتبع أرباحك والمدفوعات" />

      {/* Total Earnings Card */}
      <GlassCard variant="nurse" className="p-6">
        <div className="text-center">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Wallet className="w-6 h-6 text-nurse" />
            <span className="text-sm text-muted-foreground">إجمالي الأرباح</span>
          </div>
          <p className="text-4xl font-bold text-nurse mb-1">
            <Currency amount={earnings?.totalEarnings ?? 0} />
          </p>
          <div className="flex items-center justify-center gap-4 mt-3">
            <div className="text-center">
              <p className="text-xs text-muted-foreground">هذا الشهر</p>
              <p className="font-semibold text-sm">
                <Currency amount={earnings?.thisMonthEarnings ?? 0} />
              </p>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="text-center">
              <p className="text-xs text-muted-foreground">خدمات مكتملة</p>
              <p className="font-semibold text-sm">{toArabicNumerals(earnings?.completedJobs ?? 0)}</p>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Available Balance Card */}
      <GlassCard variant="nurse" className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-muted-foreground">الرصيد المتاح للسحب</p>
            <p className="text-2xl font-bold text-green-600">
              <Currency amount={earnings?.availableBalance ?? 0} />
            </p>
          </div>
          <Button
            className="bg-green-600 hover:bg-green-700 gap-2"
            disabled={!earnings || earnings.availableBalance <= 0}
            onClick={() => setShowPayoutDialog(true)}
          >
            <ArrowDownToLine className="w-4 h-4" />
            طلب سحب
          </Button>
        </div>
      </GlassCard>

      {/* Payout Dialog */}
      {showPayoutDialog && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
          onClick={() => setShowPayoutDialog(false)}
        >
          <motion.div
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            className="bg-card rounded-2xl p-6 w-full max-w-sm shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-2">طلب سحب الأرباح</h3>
            <p className="text-sm text-muted-foreground mb-4">
              سيتم تحويل المبلغ المتاح إلى حسابك البنكي أو محفظتك
            </p>
            <div className="p-4 rounded-xl bg-muted/50 text-center mb-4">
              <p className="text-sm text-muted-foreground">المبلغ</p>
              <p className="text-2xl font-bold text-green-600">
                <Currency amount={earnings?.availableBalance ?? 0} />
              </p>
            </div>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setShowPayoutDialog(false)}>
                إلغاء
              </Button>
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={handlePayoutRequest}
                disabled={payoutLoading}
              >
                {payoutLoading ? (
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin me-2" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 me-2" />
                )}
                تأكيد السحب
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Earnings Chart */}
      <GlassCard variant="nurse" className="p-4">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-semibold text-sm">أرباح آخر ٧ أيام</h3>
          <Calendar className="w-4 h-4 text-muted-foreground" />
        </div>

        {chartData.length > 0 ? (
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 5, right: 5, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis
                  dataKey="name"
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: 'var(--muted-foreground)' }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v: number) => `${Math.round(v / 1000)}k`}
                />
                <Tooltip
                  formatter={(value: number) => [formatYemeniRial(value), 'الأرباح']}
                  contentStyle={{
                    backgroundColor: 'var(--card)',
                    border: '1px solid var(--border)',
                    borderRadius: '12px',
                    direction: 'rtl',
                  }}
                />
                <Bar
                  dataKey="earnings"
                  fill="oklch(0.65 0.17 220)"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={40}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="h-52 flex items-center justify-center">
            <p className="text-sm text-muted-foreground">لا توجد بيانات</p>
          </div>
        )}
      </GlassCard>

      {/* Commission Breakdown */}
      <GlassCard variant="nurse" className="p-4">
        <h3 className="font-semibold text-sm mb-3">تفاصيل العمولة</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">إجمالي الأرباح</span>
            <Currency amount={earnings?.totalEarnings ?? 0} />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">الرصيد المتاح</span>
            <Currency amount={earnings?.availableBalance ?? 0} className="text-green-600" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">تم سحبه</span>
            <Currency amount={(earnings?.totalEarnings ?? 0) - (earnings?.availableBalance ?? 0)} className="text-muted-foreground" />
          </div>
        </div>
      </GlassCard>

      {/* Recent Payouts / Transactions */}
      <GlassCard variant="nurse" className="p-4">
        <h3 className="font-semibold text-sm mb-3">آخر المدفوعات</h3>

        {!earnings?.recentPayouts || earnings.recentPayouts.length === 0 ? (
          <EmptyState
            icon={<DollarSign className="w-8 h-8 text-muted-foreground" />}
            title="لا توجد مدفوعات"
            description="ستظهر المدفوعات هنا بعد طلب سحب أرباحك"
          />
        ) : (
          <div className="space-y-3 max-h-96 overflow-y-auto custom-scrollbar">
            {earnings.recentPayouts.map((payout) => (
              <div key={payout.id} className="flex items-center justify-between p-3 rounded-xl bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                    payout.status === 'completed' ? 'bg-green-100 dark:bg-green-900/30' :
                    payout.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                    'bg-red-100 dark:bg-red-900/30'
                  }`}>
                    {payout.status === 'completed' ? (
                      <CheckCircle2 className="w-4 h-4 text-green-600" />
                    ) : payout.status === 'pending' ? (
                      <Clock className="w-4 h-4 text-yellow-600" />
                    ) : (
                      <XCircle className="w-4 h-4 text-red-600" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium">
                      <Currency amount={payout.amount} />
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateOnly(new Date(payout.requestedAt))}
                    </p>
                  </div>
                </div>
                <Badge
                  variant={
                    payout.status === 'completed' ? 'default' :
                    payout.status === 'pending' ? 'secondary' :
                    'destructive'
                  }
                  className="text-[10px]"
                >
                  {payout.status === 'completed' ? 'مكتمل' :
                   payout.status === 'pending' ? 'قيد المعالجة' :
                   'فشل'}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
