'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Gift,
  Star,
  TrendingUp,
  ArrowDownToLine,
  Clock,
  CheckCircle2,
  Award,
  Info,
  Loader2,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { Currency, toArabicNumerals } from '@/components/common/currency';
import { EmptyState } from '@/components/common/empty-state';
import { ListSkeleton } from '@/components/common/loading-skeleton';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import type { ApiResponse, LoyaltyTransaction, LoyaltyTransactionType } from '@/types';

const transactionTypeLabels: Record<LoyaltyTransactionType, { label: string; color: string; icon: React.ElementType }> = {
  earn: { label: 'كسب', color: 'text-green-600', icon: TrendingUp },
  redeem: { label: 'استبدال', color: 'text-beneficiary', icon: ArrowDownToLine },
  expire: { label: 'انتهاء', color: 'text-red-500', icon: Clock },
  bonus: { label: 'مكافأة', color: 'text-amber-600', icon: Zap },
};

export default function LoyaltyPage() {
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [points, setPoints] = useState(0);
  const [threshold, setThreshold] = useState(100);
  const [transactions, setTransactions] = useState<LoyaltyTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRedeeming, setIsRedeeming] = useState(false);

  const fetchLoyalty = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/beneficiary/loyalty', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<{ points: number; threshold: number; transactions: LoyaltyTransaction[] }> = await res.json();
      if (data.success && data.data) {
        setPoints(data.data.points);
        setThreshold(data.data.threshold ?? 100);
        if (Array.isArray(data.data.transactions)) {
          setTransactions(data.data.transactions);
        }
      }
    } catch {
      // Error handled silently
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchLoyalty();
  }, [fetchLoyalty]);

  const redeemPoints = async () => {
    if (!token) return;
    setIsRedeeming(true);
    try {
      const res = await fetch('/api/beneficiary/loyalty', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ points: threshold }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'تم استبدال النقاط بنجاح' });
        fetchLoyalty();
      } else {
        toast({ title: data.message ?? 'فشل استبدال النقاط', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' });
    } finally {
      setIsRedeeming(false);
    }
  };

  const progressPercent = Math.min((points / threshold) * 100, 100);
  const canRedeem = points >= threshold;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold">نقاط الولاء</h1>
        <p className="text-sm text-muted-foreground">اكسب نقاطاً مع كل طلب واستبدلها بخصومات</p>
      </motion.div>

      {isLoading ? (
        <ListSkeleton items={3} />
      ) : (
        <>
          {/* Points Display */}
          <GlassCard variant="beneficiary" className="text-center space-y-4 py-8">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 200, damping: 15 }}
              className="w-24 h-24 rounded-full bg-beneficiary/10 flex items-center justify-center mx-auto"
            >
              <Gift className="w-12 h-12 text-beneficiary" />
            </motion.div>
            <div>
              <p className="text-5xl font-bold text-beneficiary">{toArabicNumerals(points)}</p>
              <p className="text-sm text-muted-foreground mt-1">نقطة</p>
            </div>

            {/* Progress to next reward */}
            <div className="max-w-xs mx-auto space-y-2">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{toArabicNumerals(points)} نقطة</span>
                <span>{toArabicNumerals(threshold)} نقطة</span>
              </div>
              <Progress value={progressPercent} className="h-3" />
              <p className="text-xs text-muted-foreground">
                {canRedeem
                  ? 'يمكنك استبدال نقاطك الآن!'
                  : `تحتاج ${toArabicNumerals(threshold - points)} نقطة إضافية`}
              </p>
            </div>

            <Button
              onClick={redeemPoints}
              disabled={!canRedeem || isRedeeming}
              className="bg-beneficiary hover:bg-beneficiary/90 text-beneficiary-foreground gap-2 min-w-[160px]"
            >
              {isRedeeming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Star className="w-4 h-4" />
                  استبدال النقاط
                </>
              )}
            </Button>
          </GlassCard>

          {/* How it works */}
          <GlassCard variant="beneficiary" className="space-y-4">
            <h3 className="font-semibold flex items-center gap-2">
              <Info className="w-4 h-4 text-beneficiary" />
              كيف تعمل نقاط الولاء؟
            </h3>
            <div className="space-y-3">
              {[
                { icon: TrendingUp, title: 'اكسب النقاط', desc: 'احصل على نقاط مع كل طلب مكتمل وتقييم' },
                { icon: Award, title: 'اجمع النقاط', desc: `اجمع ${toArabicNumerals(threshold)} نقطة للوصول إلى عتبة الاستبدال` },
                { icon: Gift, title: 'استبدل النقاط', desc: 'استبدل نقاطك بخصومات على الطلبات القادمة' },
              ].map((item, index) => {
                const Icon = item.icon;
                return (
                  <div key={index} className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-beneficiary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-beneficiary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{item.title}</p>
                      <p className="text-xs text-muted-foreground">{item.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </GlassCard>

          {/* Points History */}
          <div className="space-y-3">
            <h3 className="font-semibold">سجل النقاط</h3>
            {transactions.length === 0 ? (
              <EmptyState
                icon={<Star className="w-10 h-10 text-muted-foreground" />}
                title="لا يوجد سجل"
                description="ستظهر هنا حركات النقاط"
              />
            ) : (
              <div className="space-y-2 max-h-96 overflow-y-auto custom-scrollbar">
                {transactions.map((tx, index) => {
                  const typeInfo = transactionTypeLabels[tx.type] ?? transactionTypeLabels.earn;
                  const TypeIcon = typeInfo.icon;
                  return (
                    <motion.div
                      key={tx.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <GlassCard variant="beneficiary" className="py-3 flex items-center gap-3">
                        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                          tx.type === 'earn' || tx.type === 'bonus' ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'
                        }`}>
                          <TypeIcon className={`w-4 h-4 ${typeInfo.color}`} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">{tx.description || typeInfo.label}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(tx.createdAt).toLocaleDateString('ar-YE', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                        <span className={`font-bold text-sm ${
                          tx.type === 'earn' || tx.type === 'bonus' ? 'text-green-600' : 'text-red-500'
                        }`}>
                          {tx.type === 'earn' || tx.type === 'bonus' ? '+' : '-'}{toArabicNumerals(tx.points)}
                        </span>
                      </GlassCard>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
