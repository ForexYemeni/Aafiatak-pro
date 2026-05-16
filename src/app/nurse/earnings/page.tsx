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
  Sparkles,
  Banknote,
  Receipt,
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
import { formatDateOnly, toArabicNum } from '@/components/common/date-formatter';
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

// ---- Animation Variants ----

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08, ease: 'easeOut' as const },
  },
} as const;

const itemVariants = {
  hidden: { opacity: 0, y: 15, scale: 0.98 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.35, ease: 'easeOut' as const } },
} as const;

// ---- Component ----

export default function NurseEarningsPage() {
  const [earnings, setEarnings] = useState<EarningsData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPayoutDialog, setShowPayoutDialog] = useState(false);
  const [payoutLoading, setPayoutLoading] = useState(false);

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
    <div className="space-y-5">
      <PageHeader title="الأرباح" description="تتبع أرباحك والمدفوعات" />

      {/* ══════════════ Total Earnings Card with Gradient ══════════════ */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' as const }}
      >
        <GlassCard variant="nurse" className="p-0 overflow-hidden">
          <div className="relative bg-gradient-to-bl from-nurse via-sky-500 to-teal-500 p-6 text-white">
            {/* Decorative shapes */}
            <div className="absolute -top-8 -left-8 w-28 h-28 rounded-full bg-white/8 blur-sm" />
            <div className="absolute -bottom-6 -right-6 w-24 h-24 rounded-full bg-white/6" />
            
            <div className="relative z-10 text-center">
              <div className="flex items-center justify-center gap-2 mb-3">
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity, ease: 'easeOut' as const }}
                >
                  <Wallet className="w-6 h-6 opacity-90" />
                </motion.div>
                <span className="text-sm font-semibold opacity-90">إجمالي الأرباح</span>
              </div>
              <p className="text-4xl font-black tracking-tight">
                <Currency amount={earnings?.totalEarnings ?? 0} />
              </p>
              <div className="flex items-center justify-center gap-6 mt-4">
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">هذا الشهر</p>
                  <p className="font-black text-lg mt-0.5">
                    <Currency amount={earnings?.thisMonthEarnings ?? 0} />
                  </p>
                </div>
                <div className="w-px h-10 bg-white/20" />
                <div className="text-center">
                  <p className="text-[10px] uppercase tracking-wider opacity-70 font-semibold">خدمات مكتملة</p>
                  <p className="font-black text-lg mt-0.5">{toArabicNumerals(earnings?.completedJobs ?? 0)}</p>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ══════════════ Available Balance Card ══════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1, ease: 'easeOut' as const }}
      >
        <GlassCard variant="nurse" className="p-5 border border-emerald-200/50 dark:border-emerald-800/30 bg-gradient-to-l from-emerald-50/60 to-green-50/40 dark:from-emerald-900/10 dark:to-green-900/5">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Banknote className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                <p className="text-xs text-muted-foreground font-semibold">الرصيد المتاح للسحب</p>
              </div>
              <p className="text-3xl font-black text-emerald-600 dark:text-emerald-400">
                <Currency amount={earnings?.availableBalance ?? 0} />
              </p>
              {earnings && earnings.availableBalance > 0 && (
                <p className="text-[11px] text-muted-foreground mt-1">
                  بعد خصم الرسوم: <span className="text-emerald-600 dark:text-emerald-400 font-bold"><Currency amount={earnings.availableBalance - withdrawalFee} /></span>
                </p>
              )}
            </div>
            <motion.div whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
              <Button
                className="bg-gradient-to-l from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 gap-2 shadow-lg shadow-emerald-600/20 rounded-xl h-12 px-5 font-bold"
                disabled={!earnings || earnings.availableBalance <= 0}
                onClick={openPayoutDialog}
              >
                <ArrowDownToLine className="w-4 h-4" />
                طلب سحب
              </Button>
            </motion.div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ══════════════ Payout Dialog ══════════════ */}
      <AnimatePresence>
        {showPayoutDialog && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4"
            onClick={() => setShowPayoutDialog(false)}
          >
            <motion.div
              initial={{ y: 100, opacity: 0, scale: 0.95 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: 100, opacity: 0, scale: 0.95 }}
              transition={{ ease: 'easeOut' as const }}
              className="bg-card rounded-3xl p-6 w-full max-w-md shadow-2xl max-h-[90vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-3 mb-5">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-bl from-emerald-400 to-green-500 flex items-center justify-center shadow-lg shadow-emerald-500/25">
                  <ArrowDownToLine className="w-6 h-6 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-black">طلب سحب الأرباح</h3>
                  <p className="text-xs text-muted-foreground">سيتم تحويل المبلغ إلى محفظتك</p>
                </div>
              </div>

              {/* Amount Section */}
              <div className="p-4 rounded-2xl bg-gradient-to-l from-emerald-50 to-green-50/50 dark:from-emerald-950/20 dark:to-green-950/10 text-center mb-5 border border-emerald-200 dark:border-emerald-800">
                <p className="text-xs text-emerald-700 dark:text-emerald-400 font-semibold mb-1">مبلغ السحب</p>
                <p className="text-3xl font-black text-emerald-700 dark:text-emerald-400">
                  <Currency amount={withdrawAmount} />
                </p>
                <Separator className="my-3 bg-emerald-200 dark:bg-emerald-800" />
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-[10px] text-muted-foreground">المبلغ</p>
                    <p className="text-sm font-bold"><Currency amount={withdrawAmount} /></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">رسوم السحب</p>
                    <p className="text-sm font-bold text-red-600">-<Currency amount={withdrawalFee} /></p>
                  </div>
                  <div>
                    <p className="text-[10px] text-muted-foreground">صافي التحويل</p>
                    <p className="text-sm font-black text-emerald-600"><Currency amount={Math.max(0, netAmount)} /></p>
                  </div>
                </div>
              </div>

              {/* Withdrawal Form */}
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">اسم صاحب المحفظة</Label>
                  <Input
                    value={walletHolderName}
                    onChange={(e) => setWalletHolderName(e.target.value)}
                    placeholder="الاسم الثلاثي"
                    className="bg-muted/30 rounded-xl h-11"
                  />
                  <p className="text-[10px] text-muted-foreground">تم تعبئة الاسم تلقائياً من حسابك</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">رقم الهاتف</Label>
                  <Input
                    value={earnings?.nursePhone || ''}
                    disabled
                    className="bg-muted/30 rounded-xl h-11"
                    dir="ltr"
                  />
                  <p className="text-[10px] text-muted-foreground">رقم هاتفك المسجل في المنصة</p>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">نوع المحفظة</Label>
                  <Select value={selectedWalletType} onValueChange={setSelectedWalletType}>
                    <SelectTrigger className="bg-muted/30 rounded-xl h-11">
                      <SelectValue placeholder="اختر نوع المحفظة" />
                    </SelectTrigger>
                    <SelectContent>
                      {(earnings?.enabledWalletTypes || ['جيب', 'جوالي', 'فلوسك', 'حوالة بنكية']).map((type) => (
                        <SelectItem key={type} value={type}>{type}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-sm font-semibold">رقم المحفظة</Label>
                  <Input
                    value={walletNumber}
                    onChange={(e) => setWalletNumber(e.target.value)}
                    placeholder="أدخل رقم المحفظة"
                    className="bg-muted/30 rounded-xl h-11"
                    dir="ltr"
                  />
                </div>

                <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                  <Info className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-700 dark:text-amber-400">
                    <p className="font-bold mb-0.5">رسوم السحب: <Currency amount={withdrawalFee} /></p>
                    <p>سيتم خصم رسوم السحب تلقائياً من المبلغ. صافي التحويل: <Currency amount={Math.max(0, netAmount)} /></p>
                  </div>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1 rounded-xl h-11" onClick={() => setShowPayoutDialog(false)}>
                    إلغاء
                  </Button>
                  <Button
                    className="flex-1 bg-gradient-to-l from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 rounded-xl h-11 font-bold"
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

      {/* ══════════════ Earnings Chart ══════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.15, ease: 'easeOut' as const }}
      >
        <GlassCard variant="nurse" className="p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-nurse" />
              <h3 className="font-bold text-sm">أرباح آخر {toArabicNum(7)} أيام</h3>
            </div>
            <Calendar className="w-4 h-4 text-muted-foreground" />
          </div>

          {chartData.length > 0 ? (
            <div className="h-56">
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
                      borderRadius: '16px',
                      direction: 'rtl',
                      boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                    }}
                  />
                  <Bar
                    dataKey="earnings"
                    fill="oklch(0.65 0.17 220)"
                    radius={[8, 8, 0, 0]}
                    maxBarSize={40}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-56 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">لا توجد بيانات</p>
            </div>
          )}
        </GlassCard>
      </motion.div>

      {/* ══════════════ Commission Breakdown ══════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.2, ease: 'easeOut' as const }}
      >
        <GlassCard variant="nurse" className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <Receipt className="w-4 h-4 text-nurse" />
            <h3 className="font-bold text-sm">تفاصيل الأرباح</h3>
          </div>
          <div className="space-y-3">
            {[
              { label: 'إجمالي الأرباح', value: earnings?.totalEarnings ?? 0, color: '' },
              { label: 'الرصيد المتاح', value: earnings?.availableBalance ?? 0, color: 'text-emerald-600 dark:text-emerald-400' },
              { label: 'رسوم السحب', value: withdrawalFee, color: 'text-amber-600 dark:text-amber-400' },
              { label: 'تم سحبه', value: (earnings?.totalEarnings ?? 0) - (earnings?.availableBalance ?? 0), color: 'text-muted-foreground' },
            ].map((item, i) => (
              <div key={i} className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">{item.label}</span>
                <Currency amount={item.value} className={`font-bold ${item.color}`} />
              </div>
            ))}
          </div>
        </GlassCard>
      </motion.div>

      {/* ══════════════ Recent Withdrawal Requests ══════════════ */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.25, ease: 'easeOut' as const }}
      >
        <GlassCard variant="nurse" className="p-5">
          <div className="flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-nurse" />
            <h3 className="font-bold text-sm">طلبات السحب</h3>
          </div>

          {!earnings?.recentPayouts || earnings.recentPayouts.length === 0 ? (
            <EmptyState
              icon={<DollarSign className="w-10 h-10 text-muted-foreground" />}
              title="لا توجد طلبات سحب"
              description="ستظهر طلبات السحب هنا بعد طلب سحب أرباحك"
            />
          ) : (
            <div className="space-y-3 max-h-[500px] overflow-y-auto custom-scrollbar">
              {earnings.recentPayouts.map((payout) => (
                <div key={payout.id} className="p-4 rounded-2xl bg-muted/20 border border-border/40 hover:bg-muted/30 transition-colors">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                        payout.status === 'processed' ? 'bg-green-100 dark:bg-green-900/30' :
                        payout.status === 'approved' ? 'bg-blue-100 dark:bg-blue-900/30' :
                        payout.status === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30' :
                        'bg-red-100 dark:bg-red-900/30'
                      }`}>
                        {statusIcons[payout.status] || <Clock className="w-4 h-4 text-yellow-600" />}
                      </div>
                      <div>
                        <p className="text-sm font-bold">
                          <Currency amount={payout.amount} />
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          {formatDateOnly(new Date(payout.requestedAt))}
                        </p>
                      </div>
                    </div>
                    <Badge
                      className={`text-[10px] font-bold ${statusColors[payout.status] || ''}`}
                      variant="outline"
                    >
                      {statusLabels[payout.status] || payout.status}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-muted-foreground mt-2 pt-2 border-t border-border/50">
                    <span>{payout.walletType}</span>
                    <span>•</span>
                    <span dir="ltr">{payout.walletNumber}</span>
                    <span>•</span>
                    <span>{payout.walletHolderName}</span>
                  </div>

                  <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-1.5">
                    <span>صافي التحويل: <span className="text-emerald-600 font-bold"><Currency amount={payout.netAmount} /></span></span>
                    <span>الرسوم: <Currency amount={payout.withdrawalFee} /></span>
                  </div>

                  {payout.status === 'rejected' && payout.rejectedReason && (
                    <div className="mt-2 p-2.5 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                      <p className="text-[10px] text-red-600 dark:text-red-400 font-medium">
                        سبب الرفض: {payout.rejectedReason}
                      </p>
                    </div>
                  )}

                  {payout.status === 'processed' && (
                    <div className="mt-2 p-2.5 rounded-xl bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800">
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
      </motion.div>
    </div>
  );
}
