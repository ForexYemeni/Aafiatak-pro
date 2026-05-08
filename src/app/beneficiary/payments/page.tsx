'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  CreditCard, Calendar, Loader2, Filter, Wallet,
  Smartphone, Building2, HandCoins, Copy, Check,
  ChevronDown, ChevronUp, Phone, User, Info
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { GlassCard } from '@/components/common/glass-card';
import { Currency, formatYemeniRial } from '@/components/common/currency';
import { BadgeStatus } from '@/components/common/badge-status';
import { EmptyState } from '@/components/common/empty-state';
import { ListSkeleton } from '@/components/common/loading-skeleton';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useAuthFetch } from '@/hooks/use-auth';
import type { Transaction } from '@/types';

const paymentMethodLabels: Record<string, string> = {
  cash: 'نقدي',
  bank_transfer: 'تحويل بنكي',
  wallet_deposit: 'إيداع محفظة',
  exchange_transfer: 'تحويل صرافة',
  mobile_wallet: 'محفظة إلكترونية',
};

const transactionStatusLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  completed: 'مكتمل',
  failed: 'فشل',
  refunded: 'مسترد',
};

interface PaymentMethodInfo {
  id: string;
  nameAr: string;
  nameEn: string;
  type: string;
  walletType: string | null;
  exchangeType: string | null;
  icon: string;
  isActive: boolean;
  instructions: string;
  accountName: string;
  accountNumber: string;
}

const YEMENI_WALLETS: Record<string, { nameAr: string; color: string }> = {
  jeep: { nameAr: 'جيب', color: 'from-green-500 to-green-600' },
  jawali: { nameAr: 'جوالي', color: 'from-purple-500 to-purple-600' },
  cash_wallet: { nameAr: 'كاش', color: 'from-amber-500 to-amber-600' },
  one_cash: { nameAr: 'ون كاش', color: 'from-blue-500 to-blue-600' },
  flousk: { nameAr: 'فلوسك', color: 'from-orange-500 to-orange-600' },
  saba_cash: { nameAr: 'سباء كاش', color: 'from-teal-500 to-teal-600' },
  balh: { nameAr: 'بلح', color: 'from-lime-500 to-lime-600' },
  tadawul: { nameAr: 'تداول', color: 'from-cyan-500 to-cyan-600' },
  cashq: { nameAr: 'كاشك', color: 'from-rose-500 to-rose-600' },
  yomni: { nameAr: 'يومني', color: 'from-indigo-500 to-indigo-600' },
  payos: { nameAr: 'بايوس', color: 'from-sky-500 to-sky-600' },
  zain_cash: { nameAr: 'زين كاش', color: 'from-violet-500 to-violet-600' },
  mubashir: { nameAr: 'مباشر', color: 'from-fuchsia-500 to-fuchsia-600' },
  rafid: { nameAr: 'رافد', color: 'from-emerald-500 to-emerald-600' },
  amwal: { nameAr: 'أموال', color: 'from-yellow-500 to-yellow-600' },
  salaf: { nameAr: 'سلف', color: 'from-red-500 to-red-600' },
  halelflos: { nameAr: 'حالف فلوس', color: 'from-pink-500 to-pink-600' },
  yemen_wallet: { nameAr: 'محفظة اليمن', color: 'from-stone-500 to-stone-600' },
};

const YEMENI_EXCHANGES: Record<string, { nameAr: string; color: string }> = {
  al_najm: { nameAr: 'صرافة النجم', color: 'from-amber-500 to-amber-600' },
  yemen_express: { nameAr: 'صرافة يمن اكسبرس', color: 'from-blue-500 to-blue-600' },
  al_imtiaz: { nameAr: 'صرافة الامتياز', color: 'from-purple-500 to-purple-600' },
  al_hazmi: { nameAr: 'صرافة الحزمي', color: 'from-green-500 to-green-600' },
  al_kabsi: { nameAr: 'صرافة الكبسي', color: 'from-teal-500 to-teal-600' },
  shamsan: { nameAr: 'صرافة شمسان', color: 'from-orange-500 to-orange-600' },
  al_taiseer: { nameAr: 'صرافة التيسير', color: 'from-cyan-500 to-cyan-600' },
  al_amal: { nameAr: 'صرافة الأمل', color: 'from-rose-500 to-rose-600' },
  al_thiqa: { nameAr: 'صرافة الثقة', color: 'from-indigo-500 to-indigo-600' },
  al_safi: { nameAr: 'صرافة الصافي', color: 'from-lime-500 to-lime-600' },
  al_rashid: { nameAr: 'صرافة الرشيد', color: 'from-sky-500 to-sky-600' },
  al_baraka: { nameAr: 'صرافة البركة', color: 'from-emerald-500 to-emerald-600' },
};

export default function PaymentsPage() {
  const authFetch = useAuthFetch();
  const token = useAuthStore((s) => s.token);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [activeTab, setActiveTab] = useState<'methods' | 'history'>('methods');

  // Payment methods from admin
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodInfo[]>([]);
  const [isLoadingMethods, setIsLoadingMethods] = useState(true);
  const [expandedMethod, setExpandedMethod] = useState<string | null>(null);

  const fetchPayments = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      params.set('limit', '50');
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`/api/beneficiary/payments?${params.toString()}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setTransactions(Array.isArray(data.data) ? data.data : []);
        const total = (Array.isArray(data.data) ? data.data : [])
          .filter((t: any) => t.status === 'completed')
          .reduce((sum: number, t: any) => sum + t.amount, 0);
        setTotalSpent(total);
      }
    } catch {
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, dateFrom, dateTo]);

  const fetchPaymentMethods = useCallback(async () => {
    setIsLoadingMethods(true);
    try {
      const res = await fetch('/api/payments/methods');
      const data = await res.json();
      if (data.success && data.data) {
        setPaymentMethods(Array.isArray(data.data) ? data.data : []);
      }
    } catch {
      setPaymentMethods([]);
    } finally {
      setIsLoadingMethods(false);
    }
  }, []);

  useEffect(() => {
    fetchPayments();
    fetchPaymentMethods();
  }, [fetchPayments, fetchPaymentMethods]);

  const formatDate = (dateStr: string | Date | null) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('ar-YE', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // Group payment methods by type
  const walletMethods = paymentMethods.filter(pm => pm.type === 'wallet_deposit');
  const bankMethods = paymentMethods.filter(pm => pm.type === 'bank_transfer');
  const cashMethods = paymentMethods.filter(pm => pm.type === 'cash');

  return (
    <div className="space-y-6">
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold">المدفوعات</h1>
        <p className="text-sm text-muted-foreground">طرق الدفع المتاحة وسجل المعاملات</p>
      </motion.div>

      {/* Total Spent Summary */}
      <GlassCard variant="beneficiary" className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-beneficiary/10 flex items-center justify-center shrink-0">
          <Wallet className="w-7 h-7 text-beneficiary" />
        </div>
        <div className="flex-1">
          <p className="text-sm text-muted-foreground">إجمالي المدفوعات</p>
          <Currency amount={totalSpent} className="text-2xl text-beneficiary" />
        </div>
        <div className="text-left">
          <p className="text-sm text-muted-foreground">عدد المعاملات</p>
          <p className="text-2xl font-bold">{transactions.length}</p>
        </div>
      </GlassCard>

      {/* Tab Switcher */}
      <div className="flex gap-2 p-1 rounded-xl bg-muted/50">
        <button
          onClick={() => setActiveTab('methods')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            activeTab === 'methods'
              ? 'bg-beneficiary text-white shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <Wallet className="w-4 h-4" />
          طرق الدفع
        </button>
        <button
          onClick={() => setActiveTab('history')}
          className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 ${
            activeTab === 'history'
              ? 'bg-beneficiary text-white shadow-md'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          <CreditCard className="w-4 h-4" />
          السجل
        </button>
      </div>

      {/* ═══════════════ PAYMENT METHODS TAB ═══════════════ */}
      {activeTab === 'methods' && (
        <div className="space-y-4">
          {isLoadingMethods ? (
            <ListSkeleton items={4} />
          ) : paymentMethods.length === 0 ? (
            <EmptyState
              icon={<Wallet className="w-10 h-10 text-muted-foreground" />}
              title="لا توجد طرق دفع"
              description="لم يتم إضافة طرق دفع بعد"
            />
          ) : (
            <>
              {/* Wallet Deposit Methods */}
              {walletMethods.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                      <Smartphone className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                    </div>
                    <h3 className="font-bold text-sm">إيداع محفظة</h3>
                  </div>
                  <div className="space-y-3">
                    {walletMethods.map((pm, index) => {
                      const walletInfo = YEMENI_WALLETS[pm.walletType || ''];
                      const isExpanded = expandedMethod === pm.id;
                      return (
                        <motion.div
                          key={pm.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <GlassCard
                            variant="beneficiary"
                            className={`overflow-hidden transition-all cursor-pointer ${isExpanded ? 'ring-2 ring-beneficiary/30' : ''}`}
                          >
                            {/* Header - always visible */}
                            <div
                              className="p-4"
                              onClick={() => setExpandedMethod(isExpanded ? null : pm.id)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${walletInfo?.color || 'from-purple-500 to-purple-600'} flex items-center justify-center shadow-md`}>
                                    <Smartphone className="w-5 h-5 text-white" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-sm">{pm.nameAr}</p>
                                    <p className="text-[10px] text-muted-foreground">{pm.nameEn}</p>
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                )}
                              </div>
                            </div>

                            {/* Expanded Content */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 pb-4 space-y-3">
                                    <Separator />

                                    {/* Account Name */}
                                    {pm.accountName && (
                                      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                                        <User className="w-4 h-4 text-beneficiary shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[10px] text-muted-foreground">اسم صاحب المحفظة</p>
                                          <p className="text-sm font-semibold truncate">{pm.accountName}</p>
                                        </div>
                                        <CopyButton text={pm.accountName} />
                                      </div>
                                    )}

                                    {/* Wallet Number */}
                                    {pm.accountNumber && (
                                      <div className="flex items-center gap-3 p-3 rounded-xl bg-beneficiary/5 border border-beneficiary/20">
                                        <Phone className="w-4 h-4 text-beneficiary shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[10px] text-muted-foreground">رقم المحفظة</p>
                                          <p className="text-base font-bold font-mono tracking-wider" dir="ltr">{pm.accountNumber}</p>
                                        </div>
                                        <CopyButton text={pm.accountNumber} />
                                      </div>
                                    )}

                                    {/* Instructions */}
                                    {pm.instructions && (
                                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400">
                                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        <p className="text-xs">{pm.instructions}</p>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </GlassCard>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Bank Transfer Methods */}
              {bankMethods.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                      <Building2 className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    </div>
                    <h3 className="font-bold text-sm">تحويل بنكي</h3>
                  </div>
                  <div className="space-y-3">
                    {bankMethods.map((pm, index) => {
                      const exchangeInfo = YEMENI_EXCHANGES[pm.exchangeType || ''];
                      const isExpanded = expandedMethod === `bank-${pm.id}`;
                      return (
                        <motion.div
                          key={pm.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                        >
                          <GlassCard
                            variant="beneficiary"
                            className={`overflow-hidden transition-all cursor-pointer ${isExpanded ? 'ring-2 ring-beneficiary/30' : ''}`}
                          >
                            <div
                              className="p-4"
                              onClick={() => setExpandedMethod(isExpanded ? null : `bank-${pm.id}`)}
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                  <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${exchangeInfo?.color || 'from-blue-500 to-blue-600'} flex items-center justify-center shadow-md`}>
                                    <Building2 className="w-5 h-5 text-white" />
                                  </div>
                                  <div>
                                    <p className="font-bold text-sm">{pm.nameAr}</p>
                                    <p className="text-[10px] text-muted-foreground">{pm.nameEn}</p>
                                  </div>
                                </div>
                                {isExpanded ? (
                                  <ChevronUp className="w-5 h-5 text-muted-foreground" />
                                ) : (
                                  <ChevronDown className="w-5 h-5 text-muted-foreground" />
                                )}
                              </div>
                            </div>

                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  transition={{ duration: 0.2 }}
                                  className="overflow-hidden"
                                >
                                  <div className="px-4 pb-4 space-y-3">
                                    <Separator />

                                    {pm.accountName && (
                                      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
                                        <User className="w-4 h-4 text-beneficiary shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[10px] text-muted-foreground">الاسم</p>
                                          <p className="text-sm font-semibold truncate">{pm.accountName}</p>
                                        </div>
                                        <CopyButton text={pm.accountName} />
                                      </div>
                                    )}

                                    {pm.accountNumber && (
                                      <div className="flex items-center gap-3 p-3 rounded-xl bg-beneficiary/5 border border-beneficiary/20">
                                        <Phone className="w-4 h-4 text-beneficiary shrink-0" />
                                        <div className="flex-1 min-w-0">
                                          <p className="text-[10px] text-muted-foreground">رقم الهاتف</p>
                                          <p className="text-base font-bold font-mono tracking-wider" dir="ltr">{pm.accountNumber}</p>
                                        </div>
                                        <CopyButton text={pm.accountNumber} />
                                      </div>
                                    )}

                                    {pm.instructions && (
                                      <div className="flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400">
                                        <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                                        <p className="text-xs">{pm.instructions}</p>
                                      </div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </GlassCard>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Cash Methods */}
              {cashMethods.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                      <HandCoins className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    </div>
                    <h3 className="font-bold text-sm">نقدي عند الوصول</h3>
                  </div>
                  {cashMethods.map((pm, index) => (
                    <motion.div
                      key={pm.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <GlassCard variant="beneficiary" className="p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center shadow-md">
                            <HandCoins className="w-5 h-5 text-white" />
                          </div>
                          <div>
                            <p className="font-bold text-sm">{pm.nameAr}</p>
                            <p className="text-[10px] text-muted-foreground">ادفع للممرض نقداً عند الوصول</p>
                          </div>
                        </div>
                        {pm.instructions && (
                          <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-400">
                            <Info className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                            <p className="text-xs">{pm.instructions}</p>
                          </div>
                        )}
                      </GlassCard>
                    </motion.div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ═══════════════ HISTORY TAB ═══════════════ */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* Date Filter */}
          <GlassCard variant="beneficiary" className="space-y-3">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-beneficiary" />
              <Label className="font-semibold">تصفية بالتاريخ</Label>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="date-from" className="text-xs">من</Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  dir="ltr"
                  className="text-left text-sm"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="date-to" className="text-xs">إلى</Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  dir="ltr"
                  className="text-left text-sm"
                />
              </div>
            </div>
            {(dateFrom || dateTo) && (
              <Button
                variant="ghost"
                size="sm"
                className="text-xs"
                onClick={() => { setDateFrom(''); setDateTo(''); }}
              >
                مسح التصفية
              </Button>
            )}
          </GlassCard>

          {/* Transactions List */}
          {isLoading ? (
            <ListSkeleton items={5} />
          ) : transactions.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="w-10 h-10 text-muted-foreground" />}
              title="لا توجد معاملات"
              description="ستظهر هنا معاملاتك المالية"
            />
          ) : (
            <div className="space-y-3 max-h-[calc(100vh-400px)] overflow-y-auto custom-scrollbar">
              {transactions.map((tx, index) => (
                <motion.div
                  key={tx.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                >
                  <GlassCard variant="beneficiary" className="py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-medium text-sm truncate">
                            طلب #{tx.requestId?.slice(-6) ?? 'ـ'}
                          </p>
                          <BadgeStatus
                            status={tx.status}
                            label={transactionStatusLabels[tx.status] ?? tx.status}
                            size="sm"
                          />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {formatDate(tx.createdAt)}
                          </span>
                          <span>{paymentMethodLabels[tx.paymentMethod] ?? tx.paymentMethod}</span>
                        </div>
                      </div>
                      <Currency
                        amount={tx.amount}
                        className={`text-sm font-bold ${tx.status === 'refunded' ? 'text-green-600' : 'text-beneficiary'}`}
                      />
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Copy Button Component ────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <button
      onClick={handleCopy}
      className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
        copied
          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
          : 'bg-beneficiary/10 text-beneficiary hover:bg-beneficiary/20'
      }`}
    >
      {copied ? (
        <>
          <Check className="w-3.5 h-3.5" />
          تم النسخ
        </>
      ) : (
        <>
          <Copy className="w-3.5 h-3.5" />
          نسخ
        </>
      )}
    </button>
  );
}
