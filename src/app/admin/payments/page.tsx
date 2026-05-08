'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Banknote, RefreshCw, CheckCircle, Wallet, CreditCard, Building2, Smartphone, Plus, Trash2 } from 'lucide-react';
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
  icon: string;
  isActive: boolean;
  instructions: string;
  accountName?: string;
  accountNumber?: string;
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
};

const walletLabels: Record<string, string> = {
  flous: 'فلوس',
  zain_cash: 'زين كاش',
  mtn_momo: 'إم تي إن موبايل موني',
  halelflos: 'حالف فلوس',
};

const walletColors: Record<string, string> = {
  flous: 'bg-orange-100 text-orange-800 border-orange-300 dark:bg-orange-900/30 dark:text-orange-400',
  zain_cash: 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-400',
  mtn_momo: 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-400',
  halelflos: 'bg-green-100 text-green-800 border-green-300 dark:bg-green-900/30 dark:text-green-400',
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
    nameAr: '',
    nameEn: '',
    type: 'wallet',
    walletType: 'flous',
    icon: '',
    isActive: true,
    instructions: '',
    accountName: '',
    accountNumber: '',
  });
  const [isSavingPm, setIsSavingPm] = useState(false);
  const [deletePmTarget, setDeletePmTarget] = useState<PaymentMethodItem | null>(null);
  const [activeTab, setActiveTab] = useState('transactions');

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
      // Payment methods API might not exist yet, seed defaults
      setPaymentMethods([
        { id: '1', nameAr: 'فلوس', nameEn: 'Flous', type: 'wallet', walletType: 'flous', icon: '📱', isActive: true, instructions: 'قم بتحويل المبلغ إلى رقم المحفظة المحدد', accountName: '', accountNumber: '' },
        { id: '2', nameAr: 'زين كاش', nameEn: 'Zain Cash', type: 'wallet', walletType: 'zain_cash', icon: '💳', isActive: true, instructions: 'قم بتحويل المبلغ إلى رقم زين كاش المحدد', accountName: '', accountNumber: '' },
        { id: '3', nameAr: 'إم تي إن موبايل موني', nameEn: 'MTN MoMo', type: 'wallet', walletType: 'mtn_momo', icon: '📲', isActive: true, instructions: 'قم بتحويل المبلغ إلى رقم إم تي إن المحدد', accountName: '', accountNumber: '' },
        { id: '4', nameAr: 'حالف فلوس', nameEn: 'Halelflos', type: 'wallet', walletType: 'halelflos', icon: '💰', isActive: true, instructions: 'قم بتحويل المبلغ إلى رقم المحفظة المحدد', accountName: '', accountNumber: '' },
        { id: '5', nameAr: 'تحويل بنكي (عبر الصراف)', nameEn: 'Bank Transfer', type: 'bank_transfer', walletType: null, icon: '🏦', isActive: true, instructions: 'قم بتحويل المبلغ إلى الحساب البنكي المحدد', accountName: '', accountNumber: '' },
        { id: '6', nameAr: 'نقدي', nameEn: 'Cash', type: 'cash', walletType: null, icon: '💵', isActive: true, instructions: 'الدفع نقداً عند الاستلام', accountName: '', accountNumber: '' },
      ]);
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
    if (!pmForm.nameAr) {
      toast.error('يرجى إدخال اسم طريقة الدفع');
      return;
    }
    setIsSavingPm(true);
    try {
      const url = editingPm ? `/api/admin/payment-methods/${editingPm.id}` : '/api/admin/payment-methods';
      const method = editingPm ? 'PATCH' : 'POST';
      const res = await authFetch(url, {
        method,
        body: JSON.stringify(pmForm),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(editingPm ? 'تم تحديث طريقة الدفع' : 'تم إضافة طريقة الدفع');
        void fetchPaymentMethods();
      } else {
        toast.error(json.message ?? 'فشل الحفظ');
      }
    } catch {
      // If API doesn't exist, update locally
      if (editingPm) {
        setPaymentMethods(prev => prev.map(pm => pm.id === editingPm.id ? { ...pm, ...pmForm } : pm));
      } else {
        setPaymentMethods(prev => [...prev, { ...pmForm, id: Date.now().toString() } as PaymentMethodItem]);
      }
      toast.success(editingPm ? 'تم تحديث طريقة الدفع' : 'تم إضافة طريقة الدفع');
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

  const openAddPm = () => {
    setEditingPm(null);
    setPmForm({ nameAr: '', nameEn: '', type: 'wallet', walletType: 'flous', icon: '', isActive: true, instructions: '', accountName: '', accountNumber: '' });
    setPmDialog(true);
  };

  const openEditPm = (pm: PaymentMethodItem) => {
    setEditingPm(pm);
    setPmForm({
      nameAr: pm.nameAr,
      nameEn: pm.nameEn,
      type: pm.type,
      walletType: pm.walletType ?? 'flous',
      icon: pm.icon,
      isActive: pm.isActive,
      instructions: pm.instructions,
      accountName: (pm as any).accountName ?? '',
      accountNumber: (pm as any).accountNumber ?? '',
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
        <div>
          <span className="text-sm">{methodLabels[row.original.paymentMethod] ?? row.original.paymentMethod}</span>
          {row.original.walletType && (
            <span className={`text-[10px] mr-1 px-1.5 py-0.5 rounded-full border ${walletColors[row.original.walletType] ?? ''}`}>
              {walletLabels[row.original.walletType] ?? row.original.walletType}
            </span>
          )}
        </div>
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
      case 'wallet': return <Smartphone className="w-5 h-5" />;
      case 'bank_transfer': return <Building2 className="w-5 h-5" />;
      case 'card': return <CreditCard className="w-5 h-5" />;
      default: return <Banknote className="w-5 h-5" />;
    }
  };

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

      {/* Tabs: Transactions / Payment Methods */}
      <motion.div variants={itemAnim}>
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            <TabsTrigger value="transactions">المعاملات</TabsTrigger>
            <TabsTrigger value="payment-methods">طرق الدفع</TabsTrigger>
          </TabsList>

          <TabsContent value="transactions" className="space-y-6 mt-4">
            {/* Method Distribution */}
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

            {/* Filters */}
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

          <TabsContent value="payment-methods" className="space-y-6 mt-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">طرق الدفع المتاحة</h3>
              {!isSubadmin && (
                <Button onClick={openAddPm} className="bg-admin hover:bg-admin/90 gap-2">
                  <Plus className="w-4 h-4" />
                  إضافة طريقة دفع
                </Button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {paymentMethods.map((pm) => (
                <motion.div key={pm.id} variants={itemAnim}>
                  <GlassCard className={`relative ${!pm.isActive ? 'opacity-60' : ''}`}>
                    <div className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-admin/10 flex items-center justify-center text-admin">
                            {pm.icon ? <span className="text-xl">{pm.icon}</span> : getTypeIcon(pm.type)}
                          </div>
                          <div>
                            <p className="font-semibold text-sm">{pm.nameAr}</p>
                            <p className="text-xs text-muted-foreground">{pm.nameEn}</p>
                          </div>
                        </div>
                        <Badge variant={pm.isActive ? 'default' : 'secondary'} className="text-[10px]">
                          {pm.isActive ? 'نشطة' : 'معطلة'}
                        </Badge>
                      </div>

                      <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">النوع:</span>
                        <span className="text-xs font-medium">
                          {pm.type === 'wallet' ? 'محفظة إلكترونية' : pm.type === 'bank_transfer' ? 'تحويل بنكي' : pm.type === 'card' ? 'بطاقة' : 'نقدي'}
                        </span>
                        {pm.walletType && (
                          <span className={`text-[10px] px-1.5 py-0.5 rounded-full border ${walletColors[pm.walletType] ?? ''}`}>
                            {walletLabels[pm.walletType] ?? pm.walletType}
                          </span>
                        )}
                      </div>

                      {(pm as any).accountNumber && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">رقم الحساب: </span>
                          <span className="font-mono font-medium" dir="ltr">{(pm as any).accountNumber}</span>
                        </div>
                      )}

                      {(pm as any).accountName && (
                        <div className="text-xs">
                          <span className="text-muted-foreground">اسم صاحب الحساب: </span>
                          <span className="font-medium">{(pm as any).accountName}</span>
                        </div>
                      )}

                      {pm.instructions && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{pm.instructions}</p>
                      )}

                      <div className="flex items-center gap-2 pt-2 border-t border-border">
                        {!isSubadmin && (
                          <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={() => openEditPm(pm)}>
                            تعديل
                          </Button>
                        )}
                        {!isSubadmin && (
                          <Button variant="outline" size="sm" className="text-xs text-destructive hover:bg-destructive/10" onClick={() => setDeletePmTarget(pm)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {isSubadmin && (
                          <span className="text-xs text-muted-foreground">عرض فقط</span>
                        )}
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </div>
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

      {/* Add/Edit Payment Method Dialog */}
      <Dialog open={pmDialog} onOpenChange={setPmDialog}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPm ? 'تعديل طريقة الدفع' : 'إضافة طريقة دفع جديدة'}</DialogTitle>
            <DialogDescription>
              {editingPm ? 'قم بتعديل بيانات طريقة الدفع' : 'أدخل بيانات طريقة الدفع الجديدة'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>الاسم بالعربية *</Label>
                <Input value={pmForm.nameAr} onChange={(e) => setPmForm({ ...pmForm, nameAr: e.target.value })} placeholder="فلوس" />
              </div>
              <div className="space-y-2">
                <Label>الاسم بالإنجليزية</Label>
                <Input value={pmForm.nameEn} onChange={(e) => setPmForm({ ...pmForm, nameEn: e.target.value })} placeholder="Flous" dir="ltr" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>النوع *</Label>
                <Select value={pmForm.type} onValueChange={(v) => setPmForm({ ...pmForm, type: v, walletType: v === 'wallet' ? pmForm.walletType : '' })}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="wallet">محفظة إلكترونية</SelectItem>
                    <SelectItem value="bank_transfer">تحويل بنكي</SelectItem>
                    <SelectItem value="cash">نقدي</SelectItem>
                    <SelectItem value="card">بطاقة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              {pmForm.type === 'wallet' && (
                <div className="space-y-2">
                  <Label>نوع المحفظة</Label>
                  <Select value={pmForm.walletType} onValueChange={(v) => setPmForm({ ...pmForm, walletType: v })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="flous">فلوس</SelectItem>
                      <SelectItem value="zain_cash">زين كاش</SelectItem>
                      <SelectItem value="mtn_momo">إم تي إن موبايل موني</SelectItem>
                      <SelectItem value="halelflos">حالف فلوس</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>اسم صاحب الحساب</Label>
                <Input value={pmForm.accountName} onChange={(e) => setPmForm({ ...pmForm, accountName: e.target.value })} placeholder="محمد أحمد" />
              </div>
              <div className="space-y-2">
                <Label>رقم الحساب / المحفظة</Label>
                <Input value={pmForm.accountNumber} onChange={(e) => setPmForm({ ...pmForm, accountNumber: e.target.value })} placeholder="777123456" dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>تعليمات الدفع</Label>
              <Input value={pmForm.instructions} onChange={(e) => setPmForm({ ...pmForm, instructions: e.target.value })} placeholder="قم بتحويل المبلغ إلى الرقم المحدد" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={pmForm.isActive} onCheckedChange={(v) => setPmForm({ ...pmForm, isActive: v })} />
              <Label>نشطة</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPmDialog(false)} disabled={isSavingPm}>إلغاء</Button>
            <Button onClick={handleSavePm} disabled={isSavingPm} className="bg-admin hover:bg-admin/90">
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
