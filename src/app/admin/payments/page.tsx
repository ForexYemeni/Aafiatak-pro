'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Banknote, RefreshCw, CheckCircle } from 'lucide-react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, Legend } from 'recharts';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { StatCard } from '@/components/common/stat-card';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { SearchInput } from '@/components/common/search-input';
import { BadgeStatus } from '@/components/common/badge-status';
import { DateFormatter } from '@/components/common/date-formatter';
import { Currency, formatYemeniRial } from '@/components/common/currency';
import { ChartSkeleton } from '@/components/common/loading-skeleton';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
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
  processedAt: string | null;
  createdAt: string;
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
        setTransactions(json.data as TransactionItem[]);
        if (json.pagination) setTotalPages(json.pagination.totalPages);
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

  useEffect(() => {
    void fetchTransactions();
    void fetchSummary();

    // Compute method distribution from transactions
    const dist: Record<string, number> = {};
    for (const t of transactions) {
      const key = methodLabels[t.paymentMethod] ?? t.paymentMethod;
      dist[key] = (dist[key] ?? 0) + 1;
    }
    setMethodDistribution(Object.entries(dist).map(([name, value]) => ({ name, value })));
  }, [fetchTransactions, fetchSummary, transactions]);

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
      cell: ({ row }) => methodLabels[row.original.paymentMethod] ?? row.original.paymentMethod,
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
    {
      label: 'تأكيد الدفع',
      onClick: (row: Record<string, unknown>) => {
        const t = row as unknown as TransactionItem;
        if (t.status === 'pending') setConfirmTarget(t);
      },
    },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <PageHeader title="إدارة المدفوعات" description="عرض وإدارة المعاملات المالية" />
      </motion.div>

      {/* Summary Cards */}
      <motion.div variants={itemAnim} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={<Banknote className="w-6 h-6" />} value={<Currency amount={summary.totalRevenue} />} label="إجمالي الإيرادات" variant="admin" />
        <StatCard icon={<Banknote className="w-6 h-6" />} value={<Currency amount={summary.totalCommission} />} label="إجمالي العمولة" variant="admin" />
        <StatCard icon={<Banknote className="w-6 h-6" />} value={<Currency amount={summary.totalNursePayouts} />} label="مدفوعات الممرضين" variant="admin" />
        <StatCard icon={<Banknote className="w-6 h-6" />} value={summary.pendingPayments} label="دفعات معلقة" variant="admin" />
      </motion.div>

      {/* Method Distribution */}
      {methodDistribution.length > 0 && (
        <motion.div variants={itemAnim}>
          <GlassCard variant="admin">
            <GlassCardHeader>
              <GlassCardTitle>توزيع طرق الدفع</GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={methodDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={90}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {methodDistribution.map((_, index) => (
                        <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: '8px', direction: 'rtl' }}
                      formatter={(value: number) => [value, 'عدد المعاملات']}
                    />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      )}

      {/* Filters */}
      <motion.div variants={itemAnim}>
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
      </motion.div>

      <motion.div variants={itemAnim}>
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
      </motion.div>

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
    </motion.div>
  );
}
