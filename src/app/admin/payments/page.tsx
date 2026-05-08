'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Banknote, RefreshCw, CheckCircle, Wallet, Building2, Smartphone,
  Plus, Trash2, Copy, Check, Pencil, HandCoins, ArrowRightLeft, BanknoteIcon
} from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/common/stat-card';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { SearchInput } from '@/components/common/search-input';
import { BadgeStatus } from '@/components/common/badge-status';
import { DateFormatter } from '@/components/common/date-formatter';
import { Currency, formatYemeniRial } from '@/components/common/currency';
import { useAuthFetch } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';

// ── Yemeni E-Wallets ─────────────────────────────────────────────
const YEMENI_WALLETS: { id: string; nameAr: string; nameEn: string; color: string }[] = [
  { id: 'jeep', nameAr: 'جيب', nameEn: 'Jeeb', color: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400' },
  { id: 'jawali', nameAr: 'جوالي', nameEn: 'Jawali', color: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400' },
  { id: 'cash_wallet', nameAr: 'كاش', nameEn: 'Cash', color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400' },
  { id: 'one_cash', nameAr: 'ون كاش', nameEn: 'One Cash', color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400' },
  { id: 'flousk', nameAr: 'فلوسك', nameEn: 'Fulousk', color: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400' },
  { id: 'saba_cash', nameAr: 'سباء كاش', nameEn: 'Saba Cash', color: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-400' },
  { id: 'balh', nameAr: 'بلح', nameEn: 'Balh', color: 'bg-lime-100 text-lime-800 border-lime-300 dark:bg-lime-900/30 dark:text-lime-400' },
  { id: 'tadawul', nameAr: 'تداول', nameEn: 'Tadawul', color: 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-400' },
  { id: 'cashq', nameAr: 'كاشك', nameEn: 'CashQ', color: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/30 dark:text-rose-400' },
  { id: 'yomni', nameAr: 'يومني', nameEn: 'Yomni', color: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-400' },
  { id: 'payos', nameAr: 'بايوس', nameEn: 'PayOS', color: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-400' },
  { id: 'zain_cash', nameAr: 'زين كاش', nameEn: 'Zain Cash', color: 'bg-violet-100 text-violet-800 border-violet-300 dark:bg-violet-900/30 dark:text-violet-400' },
  { id: 'mubashir', nameAr: 'مباشر', nameEn: 'Mubashir', color: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-300 dark:bg-fuchsia-900/30 dark:text-fuchsia-400' },
  { id: 'rafid', nameAr: 'رافد', nameEn: 'Rafid', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400' },
  { id: 'amwal', nameAr: 'أموال', nameEn: 'Amwal', color: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400' },
  { id: 'salaf', nameAr: 'سلف', nameEn: 'Salaf', color: 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-400' },
  { id: 'halelflos', nameAr: 'حالف فلوس', nameEn: 'Halelflos', color: 'bg-pink-100 text-pink-800 border-pink-300 dark:bg-pink-900/30 dark:text-pink-400' },
  { id: 'yemen_wallet', nameAr: 'محفظة اليمن', nameEn: 'Yemen Wallet', color: 'bg-stone-100 text-stone-800 border-stone-300 dark:bg-stone-900/30 dark:text-stone-400' },
];

// ── Yemeni Exchange Offices ────────────────────────────────────────
const YEMENI_EXCHANGES: { id: string; nameAr: string; nameEn: string; color: string }[] = [
  { id: 'al_najm', nameAr: 'صرافة النجم', nameEn: 'Al-Najm Exchange', color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-900/30 dark:text-amber-400' },
  { id: 'yemen_express', nameAr: 'صرافة يمن اكسبرس', nameEn: 'Yemen Express', color: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400' },
  { id: 'al_imtiaz', nameAr: 'صرافة الامتياز', nameEn: 'Al-Imtiaz Exchange', color: 'bg-purple-100 text-purple-800 border-purple-300 dark:bg-purple-900/30 dark:text-purple-400' },
  { id: 'al_hazmi', nameAr: 'صرافة الحزمي', nameEn: 'Al-Hazmi Exchange', color: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400' },
  { id: 'al_kabsi', nameAr: 'صرافة الكبسي', nameEn: 'Al-Kabsi Exchange', color: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-900/30 dark:text-teal-400' },
  { id: 'shamsan', nameAr: 'صرافة شمسان', nameEn: 'Shamsan Exchange', color: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400' },
  { id: 'al_taiseer', nameAr: 'صرافة التيسير', nameEn: 'Al-Taiseer Exchange', color: 'bg-cyan-100 text-cyan-800 border-cyan-300 dark:bg-cyan-900/30 dark:text-cyan-400' },
  { id: 'al_amal', nameAr: 'صرافة الأمل', nameEn: 'Al-Amal Exchange', color: 'bg-rose-100 text-rose-800 border-rose-300 dark:bg-rose-900/30 dark:text-rose-400' },
  { id: 'al_thiqa', nameAr: 'صرافة الثقة', nameEn: 'Al-Thiqa Exchange', color: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-900/30 dark:text-indigo-400' },
  { id: 'al_safi', nameAr: 'صرافة الصافي', nameEn: 'Al-Safi Exchange', color: 'bg-lime-100 text-lime-800 border-lime-300 dark:bg-lime-900/30 dark:text-lime-400' },
  { id: 'al_rashid', nameAr: 'صرافة الرشيد', nameEn: 'Al-Rashid Exchange', color: 'bg-sky-100 text-sky-800 border-sky-300 dark:bg-sky-900/30 dark:text-sky-400' },
  { id: 'al_baraka', nameAr: 'صرافة البركة', nameEn: 'Al-Baraka Exchange', color: 'bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/30 dark:text-emerald-400' },
];

const walletMap = Object.fromEntries(YEMENI_WALLETS.map(w => [w.id, w]));
const exchangeMap = Object.fromEntries(YEMENI_EXCHANGES.map(e => [e.id, e]));

// ── Transaction Interface ─────────────────────────────────────────
interface TransactionItem {
  id: string;
  amount: number;
  commission: number;
  netAmount: number;
  paymentMethod: string;
  status: string;
  beneficiaryName: string;
  nurseName: string | null;
  walletType?: string;
  notes?: string;
  processedAt: string | null;
  createdAt: string;
}

interface PaymentMethodItem {
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

interface PaymentSummary {
  totalRevenue: number;
  totalCommission: number;
  totalNursePayouts: number;
  pendingPayments: number;
}

const methodLabels: Record<string, string> = {
  cash: 'نقدي',
  bank_transfer: 'تحويل بنكي',
  wallet_deposit: 'إيداع محفظة',
  exchange_transfer: 'تحويل صرافة',
  mobile_wallet: 'محفظة موبايل',
  card: 'بطاقة',
  wallet: 'محفظة إلكترونية',
};

const PIE_COLORS = [
  'oklch(0.7 0.17 70)',
  'oklch(0.65 0.17 220)',
  'oklch(0.6 0.22 300)',
  'oklch(0.6 0.17 150)',
  'oklch(0.55 0.2 25)',
];

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

const typeLabelsAr: Record<string, string> = {
  wallet_deposit: 'إيداع محفظة',
  bank_transfer: 'تحويل بنكي',
  cash: 'نقدي عند الوصول',
};

const typeIcons: Record<string, React.ReactNode> = {
  wallet_deposit: <Smartphone className="w-5 h-5" />,
  bank_transfer: <Building2 className="w-5 h-5" />,
  cash: <HandCoins className="w-5 h-5" />,
};

export default function AdminPaymentsPage() {
  const authFetch = useAuthFetch();
  const user = useAuthStore((s) => s.user);
  const isSubadmin = user?.role === 'subadmin';
  const canManagePayments = user?.permissions?.includes('manage_payments') ?? false;
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [summary, setSummary] = useState<PaymentSummary>({
    totalRevenue: 0,
    totalCommission: 0,
    totalNursePayouts: 0,
    pendingPayments: 0,
  });
  const [methodDistribution, setMethodDistribution] = useState<{ name: string; value: number }[]>([]);

  const [confirmTarget, setConfirmTarget] = useState<TransactionItem | null>(null);
  const [isConfirming, setIsConfirming] = useState(false);

  // Payment methods management
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethodItem[]>([]);
  const [pmDialog, setPmDialog] = useState(false);
  const [editingPm, setEditingPm] = useState<PaymentMethodItem | null>(null);
  const [pmForm, setPmForm] = useState({
    type: 'wallet_deposit' as 'wallet_deposit' | 'bank_transfer' | 'cash',
    walletType: 'jeep',
    exchangeType: 'al_najm',
    isActive: true,
    accountName: '',
    accountNumber: '',
    instructions: '',
  });
  const [isSavingPm, setIsSavingPm] = useState(false);
  const [deletePmTarget, setDeletePmTarget] = useState<PaymentMethodItem | null>(null);
  const [activeTab, setActiveTab] = useState('payment-methods');

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        search,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(methodFilter !== 'all' ? { paymentMethod: methodFilter } : {}),
      });
      const res = await authFetch(`/api/admin/transactions?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        const items = json.data.transactions ?? json.data;
        setTransactions(Array.isArray(items) ? items : []);
        if (json.data.pages) setTotalPages(json.data.pages);
      }
    } catch {
      toast.error('فشل تحميل المعاملات');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, page, search, statusFilter, methodFilter]);

  const fetchSummary = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/dashboard');
      const json = await res.json();
      if (json.success && json.data) {
        const d = json.data;
        setSummary({
          totalRevenue: d.totalRevenue ?? 0,
          totalCommission: d.totalCommission ?? 0,
          totalNursePayouts: d.totalNursePayouts ?? 0,
          pendingPayments: d.pendingOrders ?? 0,
        });
      }
    } catch {
      // silent
    }
  }, [authFetch]);

  const fetchPaymentMethods = useCallback(async () => {
    try {
      const res = await authFetch('/api/admin/payment-methods');
      const json = await res.json();
      if (json.success && json.data) {
        const items = json.data.paymentMethods ?? json.data;
        setPaymentMethods(Array.isArray(items) ? items : []);
      }
    } catch {
      // silent
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchTransactions();
    void fetchSummary();
    void fetchPaymentMethods();
  }, [fetchTransactions, fetchSummary, fetchPaymentMethods]);

  // Compute method distribution from transactions
  useEffect(() => {
    const dist: Record<string, number> = {};
    for (const t of transactions) {
      const key = methodLabels[t.paymentMethod] ?? t.paymentMethod;
      dist[key] = (dist[key] ?? 0) + 1;
    }
    setMethodDistribution(Object.entries(dist).map(([name, value]) => ({ name, value })));
  }, [transactions]);

  const handleConfirmPayment = async () => {
    if (!confirmTarget) return;
    setIsConfirming(true);
    try {
      const res = await authFetch(`/api/admin/transactions/${confirmTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'completed' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تأكيد الدفع');
        void fetchTransactions();
      } else {
        toast.error(json.message ?? 'فشل التأكيد');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setIsConfirming(false);
      setConfirmTarget(null);
    }
  };

  const handleSavePm = async () => {
    setIsSavingPm(true);
    try {
      const payload: any = {
        type: pmForm.type,
        isActive: pmForm.isActive,
        instructions: pmForm.instructions,
        accountName: pmForm.accountName,
        accountNumber: pmForm.accountNumber,
      };

      if (pmForm.type === 'wallet_deposit') {
        payload.walletType = pmForm.walletType;
        const w = walletMap[pmForm.walletType];
        if (w) {
          payload.nameAr = w.nameAr;
          payload.nameEn = w.nameEn;
        }
        if (!pmForm.accountNumber) {
          toast.error('يرجى إدخال رقم المحفظة');
          setIsSavingPm(false);
          return;
        }
        if (!pmForm.accountName) {
          toast.error('يرجى إدخال اسم صاحب المحفظة');
          setIsSavingPm(false);
          return;
        }
      } else if (pmForm.type === 'bank_transfer') {
        payload.exchangeType = pmForm.exchangeType;
        const ex = exchangeMap[pmForm.exchangeType];
        if (ex) {
          payload.nameAr = ex.nameAr;
          payload.nameEn = ex.nameEn;
        }
        if (!pmForm.accountNumber) {
          toast.error('يرجى إدخال رقم الهاتف');
          setIsSavingPm(false);
          return;
        }
        if (!pmForm.accountName) {
          toast.error('يرجى إدخال الاسم');
          setIsSavingPm(false);
          return;
        }
      } else if (pmForm.type === 'cash') {
        payload.nameAr = 'نقدي عند وصول الممرض';
        payload.nameEn = 'Cash on Nurse Arrival';
      }

      const url = editingPm ? `/api/admin/payment-methods/${editingPm.id}` : '/api/admin/payment-methods';
      const method = editingPm ? 'PATCH' : 'POST';
      const res = await authFetch(url, {
        method,
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editingPm ? 'تم تحديث طريقة الدفع' : 'تم إضافة طريقة الدفع');
        void fetchPaymentMethods();
      } else {
        toast.error(json.message ?? 'فشل الحفظ');
      }
    } catch {
      toast.error('حدث خطأ في الحفظ');
    } finally {
      setIsSavingPm(false);
      setPmDialog(false);
      setEditingPm(null);
    }
  };

  const handleDeletePm = async () => {
    if (!deletePmTarget) return;
    try {
      const res = await authFetch(`/api/admin/payment-methods/${deletePmTarget.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (json.success) {
        toast.success('تم حذف طريقة الدفع');
        void fetchPaymentMethods();
      }
    } catch {
      setPaymentMethods(prev => prev.filter(pm => pm.id !== deletePmTarget.id));
      toast.success('تم حذف طريقة الدفع');
    } finally {
      setDeletePmTarget(null);
    }
  };

  const openAddPm = (type: 'wallet_deposit' | 'bank_transfer' | 'cash') => {
    setEditingPm(null);
    setPmForm({
      type,
      walletType: 'jeep',
      exchangeType: 'al_najm',
      isActive: true,
      accountName: '',
      accountNumber: '',
      instructions: '',
    });
    setPmDialog(true);
  };

  const openEditPm = (pm: PaymentMethodItem) => {
    setEditingPm(pm);
    setPmForm({
      type: (pm.type as 'wallet_deposit' | 'bank_transfer' | 'cash') || 'wallet_deposit',
      walletType: pm.walletType ?? 'jeep',
      exchangeType: pm.exchangeType ?? 'al_najm',
      isActive: pm.isActive,
      accountName: pm.accountName || '',
      accountNumber: pm.accountNumber || '',
      instructions: pm.instructions || '',
    });
    setPmDialog(true);
  };

  const columns: ColumnDef<TransactionItem, unknown>[] = [
    {
      accessorKey: 'beneficiaryName',
      header: 'المستفيد',
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.beneficiaryName}</span>,
    },
    {
      accessorKey: 'amount',
      header: 'المبلغ',
      cell: ({ row }) => <Currency amount={row.original.amount} />,
    },
    {
      accessorKey: 'commission',
      header: 'العمولة',
      cell: ({ row }) => <Currency amount={row.original.commission} />,
    },
    {
      accessorKey: 'paymentMethod',
      header: 'طريقة الدفع',
      cell: ({ row }) => (
        <span className="text-sm">{methodLabels[row.original.paymentMethod] ?? row.original.paymentMethod}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'الحالة',
      cell: ({ row }) => <BadgeStatus status={row.original.status} />,
    },
    {
      accessorKey: 'createdAt',
      header: 'التاريخ',
      cell: ({ row }) => <DateFormatter date={row.original.createdAt} format="short" />,
    },
  ];

  const rowActions = [
    ...((!isSubadmin || canManagePayments) ? [{
      label: 'تأكيد الدفع',
      onClick: (row: Record<string, unknown>) => {
        const t = row as unknown as TransactionItem;
        if (t.status === 'pending') setConfirmTarget(t);
      },
    }] : []),
  ];

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'wallet_deposit': return <Smartphone className="w-5 h-5" />;
      case 'bank_transfer': return <Building2 className="w-5 h-5" />;
      case 'cash': return <HandCoins className="w-5 h-5" />;
      default: return <Banknote className="w-5 h-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'wallet_deposit': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400';
      case 'bank_transfer': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
      case 'cash': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
      default: return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-400';
    }
  };

  // Group payment methods by type
  const walletMethods = paymentMethods.filter(pm => pm.type === 'wallet_deposit');
  const bankMethods = paymentMethods.filter(pm => pm.type === 'bank_transfer');
  const cashMethods = paymentMethods.filter(pm => pm.type === 'cash');

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <PageHeader title="إدارة المدفوعات" description="عرض وإدارة المعاملات المالية وطرق الدفع" />
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={itemAnim} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Banknote className="w-6 h-6" />} value={<Currency amount={summary.totalRevenue} />} label="إجمالي الإيرادات" variant="admin" />
        <StatCard icon={<Banknote className="w-6 h-6" />} value={<Currency amount={summary.totalCommission} />} label="إجمالي العمولة" variant="admin" />
        <StatCard icon={<Banknote className="w-6 h-6" />} value={<Currency amount={summary.totalNursePayouts} />} label="مدفوعات الممرضين" variant="admin" />
        <StatCard icon={<Banknote className="w-6 h-6" />} value={summary.pendingPayments} label="دفعات معلقة" variant="admin" />
      </motion.div>

      {/* Tabs: Payment Methods / Transactions */}
      <motion.div variants={itemAnim}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="payment-methods">طرق الدفع</TabsTrigger>
            <TabsTrigger value="transactions">المعاملات</TabsTrigger>
          </TabsList>

          {/* ═══════════════ PAYMENT METHODS TAB ═══════════════ */}
          <TabsContent value="payment-methods" className="space-y-6 mt-4">
            {/* Quick Add Buttons */}
            {!isSubadmin && (
              <div className="flex flex-wrap gap-3">
                <Button onClick={() => openAddPm('wallet_deposit')} className="gap-2 bg-purple-600 hover:bg-purple-700 text-white">
                  <Smartphone className="w-4 h-4" />
                  إيداع محفظة
                </Button>
                <Button onClick={() => openAddPm('bank_transfer')} className="gap-2 bg-blue-600 hover:bg-blue-700 text-white">
                  <Building2 className="w-4 h-4" />
                  تحويل بنكي
                </Button>
                <Button onClick={() => openAddPm('cash')} className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                  <HandCoins className="w-4 h-4" />
                  نقدي عند الوصول
                </Button>
              </div>
            )}

            {/* ─── Wallet Deposit Section ─── */}
            {walletMethods.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                    <Smartphone className="w-4 h-4 text-purple-600 dark:text-purple-400" />
                  </div>
                  <h3 className="font-bold text-purple-700 dark:text-purple-400">إيداع محفظة</h3>
                  <Badge variant="secondary" className="text-[10px]">{walletMethods.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {walletMethods.map((pm) => {
                    const walletInfo = walletMap[pm.walletType || ''];
                    return (
                      <motion.div key={pm.id} variants={itemAnim}>
                        <GlassCard className={`relative ${!pm.isActive ? 'opacity-60' : ''}`}>
                          <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-purple-50 dark:bg-purple-900/20 flex items-center justify-center">
                                  <Smartphone className="w-5 h-5 text-purple-600 dark:text-purple-400" />
                                </div>
                                <div>
                                  <p className="font-bold text-sm">{pm.nameAr}</p>
                                  <p className="text-[10px] text-muted-foreground">{pm.nameEn}</p>
                                </div>
                              </div>
                              <Badge variant={pm.isActive ? 'default' : 'secondary'} className="text-[10px]">
                                {pm.isActive ? 'نشطة' : 'معطلة'}
                              </Badge>
                            </div>

                            {pm.accountName && (
                              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                                <span className="text-xs text-muted-foreground shrink-0">الاسم:</span>
                                <span className="text-sm font-medium truncate">{pm.accountName}</span>
                              </div>
                            )}

                            {pm.accountNumber && (
                              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                                <span className="text-xs text-muted-foreground shrink-0">الرقم:</span>
                                <span className="text-sm font-mono font-bold tracking-wider" dir="ltr">{pm.accountNumber}</span>
                                <CopyButton text={pm.accountNumber} />
                              </div>
                            )}

                            <div className="flex items-center gap-2 pt-2 border-t border-border">
                              {!isSubadmin && (
                                <>
                                  <Button variant="outline" size="sm" className="flex-1 text-xs gap-1" onClick={() => openEditPm(pm)}>
                                    <Pencil className="w-3 h-3" /> تعديل
                                  </Button>
                                  <Button variant="outline" size="sm" className="text-xs text-destructive hover:bg-destructive/10" onClick={() => setDeletePmTarget(pm)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </GlassCard>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── Bank Transfer Section ─── */}
            {bankMethods.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
                    <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                  </div>
                  <h3 className="font-bold text-blue-700 dark:text-blue-400">تحويل بنكي</h3>
                  <Badge variant="secondary" className="text-[10px]">{bankMethods.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {bankMethods.map((pm) => {
                    const exchangeInfo = exchangeMap[pm.exchangeType || ''];
                    return (
                      <motion.div key={pm.id} variants={itemAnim}>
                        <GlassCard className={`relative ${!pm.isActive ? 'opacity-60' : ''}`}>
                          <div className="p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-11 h-11 rounded-xl bg-blue-50 dark:bg-blue-900/20 flex items-center justify-center">
                                  <Building2 className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                                </div>
                                <div>
                                  <p className="font-bold text-sm">{pm.nameAr}</p>
                                  <p className="text-[10px] text-muted-foreground">{pm.nameEn}</p>
                                </div>
                              </div>
                              <Badge variant={pm.isActive ? 'default' : 'secondary'} className="text-[10px]">
                                {pm.isActive ? 'نشطة' : 'معطلة'}
                              </Badge>
                            </div>

                            {pm.accountName && (
                              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                                <span className="text-xs text-muted-foreground shrink-0">الاسم:</span>
                                <span className="text-sm font-medium truncate">{pm.accountName}</span>
                              </div>
                            )}

                            {pm.accountNumber && (
                              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50">
                                <span className="text-xs text-muted-foreground shrink-0">الهاتف:</span>
                                <span className="text-sm font-mono font-bold tracking-wider" dir="ltr">{pm.accountNumber}</span>
                                <CopyButton text={pm.accountNumber} />
                              </div>
                            )}

                            <div className="flex items-center gap-2 pt-2 border-t border-border">
                              {!isSubadmin && (
                                <>
                                  <Button variant="outline" size="sm" className="flex-1 text-xs gap-1" onClick={() => openEditPm(pm)}>
                                    <Pencil className="w-3 h-3" /> تعديل
                                  </Button>
                                  <Button variant="outline" size="sm" className="text-xs text-destructive hover:bg-destructive/10" onClick={() => setDeletePmTarget(pm)}>
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>
                        </GlassCard>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ─── Cash Section ─── */}
            {cashMethods.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
                    <HandCoins className="w-4 h-4 text-green-600 dark:text-green-400" />
                  </div>
                  <h3 className="font-bold text-green-700 dark:text-green-400">نقدي عند الوصول</h3>
                  <Badge variant="secondary" className="text-[10px]">{cashMethods.length}</Badge>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {cashMethods.map((pm) => (
                    <motion.div key={pm.id} variants={itemAnim}>
                      <GlassCard className={`relative ${!pm.isActive ? 'opacity-60' : ''}`}>
                        <div className="p-4 space-y-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-11 h-11 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center">
                                <HandCoins className="w-5 h-5 text-green-600 dark:text-green-400" />
                              </div>
                              <div>
                                <p className="font-bold text-sm">{pm.nameAr}</p>
                                <p className="text-[10px] text-muted-foreground">{pm.nameEn}</p>
                              </div>
                            </div>
                            <Badge variant={pm.isActive ? 'default' : 'secondary'} className="text-[10px]">
                              {pm.isActive ? 'نشطة' : 'معطلة'}
                            </Badge>
                          </div>

                          {pm.instructions && (
                            <p className="text-xs text-muted-foreground">{pm.instructions}</p>
                          )}

                          <div className="flex items-center gap-2 pt-2 border-t border-border">
                            {!isSubadmin && (
                              <>
                                <Button variant="outline" size="sm" className="flex-1 text-xs gap-1" onClick={() => openEditPm(pm)}>
                                  <Pencil className="w-3 h-3" /> تعديل
                                </Button>
                                <Button variant="outline" size="sm" className="text-xs text-destructive hover:bg-destructive/10" onClick={() => setDeletePmTarget(pm)}>
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Empty State for Payment Methods */}
            {paymentMethods.length === 0 && (
              <div className="text-center py-12">
                <Wallet className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-semibold mb-2">لا توجد طرق دفع</h3>
                <p className="text-sm text-muted-foreground mb-4">أضف طرق الدفع ليتمكن المستفيدون من الدفع</p>
                <div className="flex flex-wrap justify-center gap-3">
                  <Button onClick={() => openAddPm('wallet_deposit')} className="gap-2 bg-purple-600 hover:bg-purple-700">
                    <Smartphone className="w-4 h-4" /> إيداع محفظة
                  </Button>
                  <Button onClick={() => openAddPm('bank_transfer')} className="gap-2 bg-blue-600 hover:bg-blue-700">
                    <Building2 className="w-4 h-4" /> تحويل بنكي
                  </Button>
                  <Button onClick={() => openAddPm('cash')} className="gap-2 bg-green-600 hover:bg-green-700">
                    <HandCoins className="w-4 h-4" /> نقدي عند الوصول
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          {/* ═══════════════ TRANSACTIONS TAB ═══════════════ */}
          <TabsContent value="transactions" className="space-y-6 mt-4">
            {methodDistribution.length > 0 && (
              <GlassCard variant="admin">
                <GlassCardHeader>
                  <GlassCardTitle>توزيع طرق الدفع</GlassCardTitle>
                </GlassCardHeader>
                <GlassCardContent>
                  <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={methodDistribution} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={5} dataKey="value">
                          {methodDistribution.map((_, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Tooltip contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px', direction: 'rtl' }} formatter={(value: number) => [value, 'عدد المعاملات']} />
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </GlassCardContent>
              </GlassCard>
            )}

            <GlassCard variant="admin">
              <div className="flex flex-col sm:flex-row gap-4 mb-6">
                <SearchInput placeholder="بحث..." onChange={setSearch} className="flex-1" />
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="w-full sm:w-40">
                    <SelectValue placeholder="الحالة" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="pending">معلق</SelectItem>
                    <SelectItem value="completed">مكتمل</SelectItem>
                    <SelectItem value="failed">فاشل</SelectItem>
                    <SelectItem value="refunded">مسترد</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={methodFilter} onValueChange={setMethodFilter}>
                  <SelectTrigger className="w-full sm:w-44">
                    <SelectValue placeholder="طريقة الدفع" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {Object.entries(methodLabels).map(([key, label]) => (
                      <SelectItem key={key} value={key}>{label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button variant="outline" size="icon" onClick={() => void fetchTransactions()}>
                  <RefreshCw className="w-4 h-4" />
                </Button>
              </div>
            </GlassCard>

            <DataTable
              columns={columns}
              data={transactions}
              isLoading={isLoading}
              emptyMessage="لا توجد معاملات"
              emptyAction={{ label: 'تحديث', onClick: () => void fetchTransactions() }}
              rowActions={rowActions as never}
              currentPage={page}
              pageCount={totalPages}
              onPageChange={setPage}
            />
          </TabsContent>
        </Tabs>
      </motion.div>

      {/* Confirm Payment Dialog */}
      <ConfirmDialog
        open={!!confirmTarget}
        onOpenChange={(open) => { if (!open) setConfirmTarget(null); }}
        title="تأكيد الدفع"
        description={`هل أنت متأكد من تأكيد الدفع بقيمة ${confirmTarget ? formatYemeniRial(confirmTarget.amount) : ''}؟`}
        confirmLabel="تأكيد"
        variant="info"
        onConfirm={handleConfirmPayment}
        isLoading={isConfirming}
      />

      {/* ═══════════════ Add/Edit Payment Method Dialog ═══════════════ */}
      <Dialog open={pmDialog} onOpenChange={setPmDialog}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {getTypeIcon(pmForm.type)}
              {editingPm ? `تعديل: ${editingPm.nameAr}` : `إضافة ${typeLabelsAr[pmForm.type]}`}
            </DialogTitle>
            <DialogDescription>
              {pmForm.type === 'wallet_deposit'
                ? 'أدخل بيانات المحفظة الإلكترونية لاستقبال المدفوعات'
                : pmForm.type === 'bank_transfer'
                ? 'أدخل بيانات الصرافة لاستقبال التحويلات البنكية'
                : 'الدفع نقداً عند وصول الممرض للمستفيد'
              }
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-5 py-4">
            {/* Wallet Type Selection */}
            {pmForm.type === 'wallet_deposit' && (
              <div className="space-y-2">
                <Label className="font-semibold">نوع المحفظة *</Label>
                <Select value={pmForm.walletType} onValueChange={(v) => setPmForm({ ...pmForm, walletType: v })}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {YEMENI_WALLETS.map(w => (
                      <SelectItem key={w.id} value={w.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{w.nameAr}</span>
                          <span className="text-xs text-muted-foreground">({w.nameEn})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Exchange Type Selection */}
            {pmForm.type === 'bank_transfer' && (
              <div className="space-y-2">
                <Label className="font-semibold">اسم الصرافة *</Label>
                <Select value={pmForm.exchangeType} onValueChange={(v) => setPmForm({ ...pmForm, exchangeType: v })}>
                  <SelectTrigger className="h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    {YEMENI_EXCHANGES.map(ex => (
                      <SelectItem key={ex.id} value={ex.id}>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{ex.nameAr}</span>
                          <span className="text-xs text-muted-foreground">({ex.nameEn})</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Account Name */}
            {pmForm.type !== 'cash' && (
              <div className="space-y-2">
                <Label className="font-semibold">
                  {pmForm.type === 'wallet_deposit' ? 'اسم صاحب المحفظة *' : 'الاسم *'}
                </Label>
                <Input
                  value={pmForm.accountName}
                  onChange={(e) => setPmForm({ ...pmForm, accountName: e.target.value })}
                  placeholder={pmForm.type === 'wallet_deposit' ? 'محمد أحمد علي' : 'محمد أحمد علي'}
                />
              </div>
            )}

            {/* Account Number / Phone */}
            {pmForm.type !== 'cash' && (
              <div className="space-y-2">
                <Label className="font-semibold">
                  {pmForm.type === 'wallet_deposit' ? 'رقم المحفظة *' : 'رقم الهاتف *'}
                </Label>
                <Input
                  value={pmForm.accountNumber}
                  onChange={(e) => setPmForm({ ...pmForm, accountNumber: e.target.value })}
                  placeholder={pmForm.type === 'wallet_deposit' ? '777123456' : '777123456'}
                  dir="ltr"
                  className="text-left font-mono"
                />
                <p className="text-[10px] text-muted-foreground">
                  {pmForm.type === 'wallet_deposit'
                    ? 'أدخل رقم المحفظة الذي سيتلقى التحويل'
                    : 'أدخل رقم الهاتف المرتبط بالصرافة'
                  }
                </p>
              </div>
            )}

            {/* Instructions */}
            <div className="space-y-2">
              <Label>تعليمات إضافية</Label>
              <Input
                value={pmForm.instructions}
                onChange={(e) => setPmForm({ ...pmForm, instructions: e.target.value })}
                placeholder="تعليمات إضافية للمستفيد (اختياري)"
              />
            </div>

            {/* Active Toggle */}
            <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50">
              <Switch checked={pmForm.isActive} onCheckedChange={(v) => setPmForm({ ...pmForm, isActive: v })} />
              <div>
                <Label className="font-medium">تفعيل طريقة الدفع</Label>
                <p className="text-[10px] text-muted-foreground">عند التعطيل لن تظهر للمستفيدين</p>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPmDialog(false)} disabled={isSavingPm}>إلغاء</Button>
            <Button onClick={handleSavePm} disabled={isSavingPm} className="bg-admin hover:bg-admin/90 gap-2">
              {isSavingPm ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {isSavingPm ? 'جارٍ الحفظ...' : editingPm ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Payment Method */}
      <ConfirmDialog
        open={!!deletePmTarget}
        onOpenChange={(open) => { if (!open) setDeletePmTarget(null); }}
        title="حذف طريقة الدفع"
        description={`هل أنت متأكد من حذف "${deletePmTarget?.nameAr ?? ''}"؟`}
        confirmLabel="حذف"
        variant="destructive"
        onConfirm={handleDeletePm}
      />
    </motion.div>
  );
}

// ── Copy Button Component ────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback
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
      className="shrink-0 p-1.5 rounded-lg hover:bg-muted transition-colors"
      title="نسخ"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-green-600" />
      ) : (
        <Copy className="w-3.5 h-3.5 text-muted-foreground" />
      )}
    </button>
  );
}
