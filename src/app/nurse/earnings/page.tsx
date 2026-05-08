'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wallet,
  TrendingUp,
  Calendar,
  ArrowDownToLine,
  DollarSign,
  Clock,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronDown,
  Info,
} from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { GlassCard } from '@/components/common/glass-card';
import { Currency, formatYemeniRial, toArabicNumerals } from '@/components/common/currency';
import { EmptyState } from '@/components/common/empty-state';
import { ChartSkeleton, CardSkeleton } from '@/components/common/loading-skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthFetch } from '@/hooks/use-auth';
import { formatDateOnly } from '@/components/common/date-formatter';
import { toast } from 'sonner';

// ---- Types ----

interface EarningsData {
  totalEarnings: number;
  availableBalance: number;
  completedJobs: number;
  thisMonthEarnings: number;
  nurseName: string;
  nursePhone: string;
  nurseWalletType: string;
  nurseWalletNumber: string;
  withdrawalFee: number;
  enabledWalletTypes: string[];
  recentPayouts: Array<{
    id: string;
    amount: number;
    netAmount: number;
    withdrawalFee: number;
    walletType: string;
    walletNumber: string;
    walletHolderName: string;
    method: string;
    status: string;
    requestedAt: string;
    processedAt: string | null;
    rejectedReason: string | null;
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

  // Withdrawal form state
  const [withdrawAmount, setWithdrawAmount] = useState<number>(0);
  const [selectedWalletType, setSelectedWalletType] = useState<string>('');
  const [walletNumber, setWalletNumber] = useState<string>('');
  const [walletHolderName, setWalletHolderName] = useState<string>('');

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

  const openPayoutDialog = () => {
    if (!earnings || earnings.availableBalance <= 0) return;
    setWithdrawAmount(earnings.availableBalance);
    setWalletHolderName(earnings.nurseName || '');
    setSelectedWalletType(earnings.nurseWalletType || '');
    setWalletNumber(earnings.nurseWalletNumber || '');
    setShowPayoutDialog(true);
  };

  const handlePayoutRequest = async () => {
    if (!earnings || withdrawAmount <= 0) return;
    if (!selectedWalletType) {
      toast.error('يرجى اختيار نوع المحفظة');
      return;
    }
    if (!walletNumber) {
      toast.error('يرجى إدخال رقم المحفظة');
      return;
    }
    if (!walletHolderName) {
      toast.error('يرجى إدخال اسم صاحب المحفظة');
      return;
    }

    setPayoutLoading(true);
    try {
      const res = await authFetch('/api/nurse/earnings', {
        method: 'POST',
        body: JSON.stringify({
          amount: withdrawAmount,
          walletType: selectedWalletType,
          walletNumber,
          walletHolderName,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(data.message || 'تم إرسال طلب السحب بنجاح');
        setShowPayoutDialog(false);
        fetchEarnings();
      } else {
        toast.error(data.message || 'فشل طلب السحب');
      }
    } catch {
      toast.error('حدث خطأ أثناء طلب السحب');
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

  const withdrawalFee = earnings?.withdrawalFee ?? 200;
  const netAmount = withdrawAmount - withdrawalFee;

  const statusLabels: Record<string, string> = {
    pending: 'قيد المراجعة',
    approved: 'تمت الموافقة',
    rejected: 'مرفوض',
    processed: 'تم التحويل',
  };

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    approved: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    processed: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
    rejected: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  };

  const statusIcons: Record<string, React.ReactNode> = {
    pending: <Clock className="w-4 h-4 text-yellow-600" />,
    approved: <CheckCircle2 className="w-4 h-4 text-blue-600" />,
    processed: <CheckCircle2 className="w-4 h-4 text-green-600" />,
    rejected: <XCircle className="w-4 h-4 text-red-600" />,
  };

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
            {earnings && earnings.availableBalance > 0 && (
              <p className="text-xs text-muted-foreground mt-1">
                بعد خصم الرسوم: <span className="text-green-600 font-medium"><Currency amount={earnings.availableBalance - withdrawalFee} /></span>
              </p>
            )}
          </div>
          <Button
            className="bg-green-600 hover:bg-green-700 gap-2"
            disabled={!earnings || earnings.availableBalance <= 0}
            onClick={openPayoutDialog}
          >
            <ArrowDownToLine className="w-4 h-4" />
            طلب سحب
          </Button>
        </div>
      </GlassCard>

      {/* Payout Dialog */}
      <AnimatePresence>
        {showPayoutDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowPayoutDialog(false)}
          >
            <motion.div
              initial={{ y: 100 }}
              animate={{ y: 0 }}
              exit={{ y: 100 }}
              className="bg-card rounded-2xl p-6 w-full max-w-md shadow-xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                  <ArrowDownToLine className="w-5 h-5 text-green-600" />
                </div>
                <div>
                  <h3 className="text-lg font-bold">طلب سحب الأرباح</h3>
                  <p className="text-xs text-muted-foreground">سيتم تحويل المبلغ إلى محفظتك</p>
                </div>
              </div>

              {/* Amount Section */}
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-950/20 text-center mb-4 border border-green-200 dark:border-green-800">
                <p className="text-xs text-green-700 dark:text-green-400 mb-1">مبلغ السحب</p>
                <p className="text-3xl font-bold text-green-700 dark:text-green-400">
                  <Currency amount={withdrawAmount} />
                </p>
                <Separator className="my-3 bg-green-200 dark:bg-green-800" />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground">المبلغ</p>
                    <p className="text-sm font-semibold"><Currency amount={withdrawAmount} /></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">رسوم السحب</p>
                    <p className="text-sm font-semibold text-red-600">-<Currency amount={withdrawalFee} /></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">صافي التحويل</p>
                    <p className="text-sm font-bold text-green-600"><Currency amount={Math.max(0, netAmount)} /></p>
                  </div>
                </div>
              </div>

              {/* Withdrawal Form */}
              <div className="space-y-4">
                {/* Name - Auto-filled */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">اسم صاحب المحفظة</Label>
                  <Input
                    value={walletHolderName}
                    onChange={(e) => setWalletHolderName(e.target.value)}
                    placeholder="الاسم الثلاثي"
                    className="bg-muted/30"
                  />
                  <p className="text-[10px] text-muted-foreground">تم تعبئة الاسم تلقائياً من حسابك</p>
                </div>

                {/* Phone - Auto-filled from nurse account */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">رقم الهاتف</Label>
                  <Input
                    value={earnings?.nursePhone || ''}
                    disabled
                    className="bg-muted/30"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-muted-foreground">رقم هاتفك المسجل في المنصة</p>
                </div>

                {/* Wallet Type - Dropdown */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">نوع المحفظة</Label>
                  <Select value={selectedWalletType} onValueChange={setSelectedWalletType}>
                    <SelectTrigger className="bg-muted/30">
                      <SelectValue placeholder="اختر نوع المحفظة" />
                    </SelectTrigger>
                    <SelectContent>
                      {(earnings?.enabledWalletTypes || ['جيب', 'جوالي', 'فلوسك', 'حوالة بنكية']).map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Wallet Number */}
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">رقم المحفظة</Label>
                  <Input
                    value={walletNumber}
                    onChange={(e) => setWalletNumber(e.target.value)}
                    placeholder="أدخل رقم المحفظة"
                    className="bg-muted/30"
                    dir="ltr"
                  />
                </div>

                {/* Fee Notice */}
                <div className="flex items-start gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-700 dark:text-amber-400">
                    <p className="font-semibold mb-0.5">رسوم السحب: <Currency amount={withdrawalFee} /></p>
                    <p>سيتم خصم رسوم السحب تلقائياً من المبلغ. صافي التحويل: <Currency amount={Math.max(0, netAmount)} /></p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => setShowPayoutDialog(false)}>
                    إلغاء
                  </Button>
                  <Button
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    onClick={handlePayoutRequest}
                    disabled={payoutLoading || !selectedWalletType || !walletNumber || !walletHolderName}
                  >
                    {payoutLoading ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin me-2" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4 me-2" />
                    )}
                    تأكيد السحب
                  </Button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

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
        <h3 className="font-semibold text-sm mb-3">تفاصيل الأرباح</h3>
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
            <span className="text-muted-foreground">رسوم السحب</span>
            <Currency amount={withdrawalFee} className="text-amber-600" />
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">تم سحبه</span>
            <Currency amount={(earnings?.totalEarnings ?? 0) - (earnings?.availableBalance ?? 0)} className="text-muted-foreground" />
          </div>
        </div>
      </GlassCard>

      {/* Recent Withdrawal Requests */}
      <GlassCard variant="nurse" className="p-4">
        <h3 className="font-semibold text-sm mb-3">طلبات السحب</h3>

        {!earnings?.recentPayouts || earnings.recentPayouts.length === 0 ? (
          <EmptyState
            icon={<DollarSign className="w-8 h-8 text-muted-foreground" />}
            title="لا توجد طلبات سحب"
            description="ستظهر طلبات السحب هنا بعد طلب سحب أرباحك"
          />
        ) : (
          <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
            {earnings.recentPayouts.map((payout) => (
              <div key={payout.id} className="p-3 rounded-xl bg-muted/30 border border-border/50">
                {/* Header */}
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                      payout.status === 'processed' ? 'bg-green-100 dark:bg-green-900/30' :
                      payout.status === 'approved' ? 'bg-blue-100 dark:bg-blue-900/30' :
                      payout.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                      'bg-red-100 dark:bg-red-900/30'
                    }`}>
                      {statusIcons[payout.status] || <Clock className="w-4 h-4 text-yellow-600" />}
                    </div>
                    <div>
                      <p className="text-sm font-medium">
                        <Currency amount={payout.amount} />
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {formatDateOnly(new Date(payout.requestedAt))}
                      </p>
                    </div>
                  </div>
                  <Badge
                    className={`text-[10px] ${statusColors[payout.status] || ''}`}
                    variant="outline"
                  >
                    {statusLabels[payout.status] || payout.status}
                  </Badge>
                </div>

                {/* Wallet Details */}
                <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                  <span>{payout.walletType}</span>
                  <span>•</span>
                  <span dir="ltr">{payout.walletNumber}</span>
                  <span>•</span>
                  <span>{payout.walletHolderName}</span>
                </div>

                {/* Fee Details */}
                <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1">
                  <span>صافي التحويل: <span className="text-green-600 font-medium"><Currency amount={payout.netAmount} /></span></span>
                  <span>الرسوم: <Currency amount={payout.withdrawalFee} /></span>
                </div>

                {/* Rejected Reason */}
                {payout.status === 'rejected' && payout.rejectedReason && (
                  <div className="mt-2 p-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                    <p className="text-[10px] text-red-600 dark:text-red-400">
                      سبب الرفض: {payout.rejectedReason}
                    </p>
                  </div>
                )}

                {/* Processed Notice */}
                {payout.status === 'processed' && (
                  <div className="mt-2 p-2 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
                    <p className="text-[10px] text-green-700 dark:text-green-400">
                      تم تحويل المبلغ إلى محفظة {payout.walletType} باسم {payout.walletHolderName} - رقم {payout.walletNumber}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}
