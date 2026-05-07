'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  CreditCard,
  Calendar,
  ArrowUpDown,
  Loader2,
  Filter,
  Wallet,
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
import type { ApiResponse, Transaction, PaginationMeta } from '@/types';

const paymentMethodLabels: Record<string, string> = {
  cash: 'نقدي',
  bank_transfer: 'تحويل بنكي',
  wallet_deposit: 'إيداع محفظة',
  exchange_transfer: 'تحويل صراف',
  mobile_wallet: 'محفظة إلكترونية',
};

const transactionStatusLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  completed: 'مكتمل',
  failed: 'فشل',
  refunded: 'مسترد',
};

export default function PaymentsPage() {
  const token = useAuthStore((s) => s.token);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [totalSpent, setTotalSpent] = useState(0);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');

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
      const data: ApiResponse<Transaction[]> = await res.json();
      if (data.success && data.data) {
        setTransactions(data.data);
        const total = data.data
          .filter((t) => t.status === 'completed')
          .reduce((sum, t) => sum + t.amount, 0);
        setTotalSpent(total);
      }
    } catch {
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, dateFrom, dateTo]);

  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

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

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold">المدفوعات</h1>
        <p className="text-sm text-muted-foreground">سجل المدفوعات والمعاملات المالية</p>
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
            onClick={() => {
              setDateFrom('');
              setDateTo('');
            }}
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
  );
}
