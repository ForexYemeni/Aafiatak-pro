'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Users,
  Copy,
  Share2,
  Gift,
  CheckCircle2,
  Clock,
  Loader2,
  Link as LinkIcon,
  MessageSquare,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import { GlassCard } from '@/components/common/glass-card';
import { Currency, toArabicNumerals } from '@/components/common/currency';
import { EmptyState } from '@/components/common/empty-state';
import { ListSkeleton } from '@/components/common/loading-skeleton';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import type { ApiResponse, Referral, ReferralStatus } from '@/types';

const referralStatusLabels: Record<ReferralStatus, { label: string; color: string }> = {
  pending: { label: 'قيد الانتظار', color: 'text-yellow-600' },
  completed: { label: 'مكتمل', color: 'text-green-600' },
  rewarded: { label: 'مكافأ', color: 'text-beneficiary' },
  expired: { label: 'منتهي', color: 'text-red-500' },
};

export default function ReferralPage() {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);
  const { toast } = useToast();
  const [referralCode, setReferralCode] = useState('');
  const [rewardPoints, setRewardPoints] = useState(0);
  const [referrals, setReferrals] = useState<Referral[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const referralCodeFromUser = (user as { referralCode?: string } | null)?.referralCode ?? referralCode;

  const fetchReferral = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/beneficiary/referral', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<{ code: string; reward: number; referrals: Referral[] }> = await res.json();
      if (data.success && data.data) {
        setReferralCode(data.data.code);
        setRewardPoints(data.data.reward);
        if (Array.isArray(data.data.referrals)) {
          setReferrals(data.data.referrals);
        }
      }
    } catch {
      // Error handled silently
    } finally {
      setIsLoading(false);
    }
  }, [token]);

  useEffect(() => {
    fetchReferral();
  }, [fetchReferral]);

  const copyCode = async () => {
    const code = referralCodeFromUser || 'AF000000';
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({ title: 'تم نسخ الكود' });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: 'فشل النسخ', variant: 'destructive' });
    }
  };

  const copyLink = async () => {
    const link = `https://aafiatak.com/register?ref=${referralCodeFromUser || 'AF000000'}`;
    try {
      await navigator.clipboard.writeText(link);
      toast({ title: 'تم نسخ الرابط' });
    } catch {
      toast({ title: 'فشل نسخ الرابط', variant: 'destructive' });
    }
  };

  const shareWhatsApp = () => {
    const code = referralCodeFromUser || 'AF000000';
    const text = encodeURIComponent(
      `سجّل في عافيتك - منصة الرعاية الصحية المنزلية واستخدم كود الإحالة ${code} للحصول على خصم!`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  };

  const shareTelegram = () => {
    const code = referralCodeFromUser || 'AF000000';
    const text = encodeURIComponent(
      `سجّل في عافيتك - منصة الرعاية الصحية المنزلية واستخدم كود الإحالة ${code} للحصول على خصم!`
    );
    window.open(`https://t.me/share/url?url=https://aafiatak.com&text=${text}`, '_blank');
  };

  const completedCount = referrals.filter((r) => r.status === 'completed' || r.status === 'rewarded').length;
  const pendingCount = referrals.filter((r) => r.status === 'pending').length;
  const totalRewardPoints = referrals
    .filter((r) => r.status === 'rewarded')
    .reduce((sum, r) => sum + r.reward, 0);

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold">الإحالة</h1>
        <p className="text-sm text-muted-foreground">ادعُ أصدقاءك واحصل على نقاط مكافأة</p>
      </motion.div>

      {isLoading ? (
        <ListSkeleton items={3} />
      ) : (
        <>
          {/* Referral Code */}
          <GlassCard variant="beneficiary" className="text-center space-y-5 py-8">
            <div className="w-16 h-16 rounded-full bg-beneficiary/10 flex items-center justify-center mx-auto">
              <Gift className="w-8 h-8 text-beneficiary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground mb-2">كود الإحالة الخاص بك</p>
              <div className="flex items-center justify-center gap-2">
                <span className="text-3xl font-bold tracking-widest text-beneficiary">
                  {referralCodeFromUser || 'AF------'}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9 shrink-0"
                  onClick={copyCode}
                >
                  {copied ? (
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </Button>
              </div>
            </div>

            {/* Share buttons */}
            <div className="flex gap-2 justify-center">
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={shareWhatsApp}
              >
                <MessageSquare className="w-4 h-4" />
                واتساب
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={shareTelegram}
              >
                <Share2 className="w-4 h-4" />
                تيليجرام
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-2"
                onClick={copyLink}
              >
                <LinkIcon className="w-4 h-4" />
                نسخ الرابط
              </Button>
            </div>
          </GlassCard>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3">
            <GlassCard variant="beneficiary" className="text-center py-4">
              <p className="text-2xl font-bold text-beneficiary">{toArabicNumerals(referrals.length)}</p>
              <p className="text-xs text-muted-foreground">إجمالي الإحالات</p>
            </GlassCard>
            <GlassCard variant="beneficiary" className="text-center py-4">
              <p className="text-2xl font-bold text-green-600">{toArabicNumerals(completedCount)}</p>
              <p className="text-xs text-muted-foreground">مكتملة</p>
            </GlassCard>
            <GlassCard variant="beneficiary" className="text-center py-4">
              <p className="text-2xl font-bold text-yellow-600">{toArabicNumerals(pendingCount)}</p>
              <p className="text-xs text-muted-foreground">قيد الانتظار</p>
            </GlassCard>
          </div>

          {/* Reward Points Earned */}
          {totalRewardPoints > 0 && (
            <GlassCard variant="beneficiary" className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-beneficiary/10 flex items-center justify-center shrink-0">
                <Gift className="w-6 h-6 text-beneficiary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">نقاط المكافأة المكتسبة</p>
                <p className="text-xl font-bold text-beneficiary">{toArabicNumerals(totalRewardPoints)} نقطة</p>
              </div>
            </GlassCard>
          )}

          {/* Referral History */}
          <div className="space-y-3">
            <h3 className="font-semibold">سجل الإحالات</h3>
            {referrals.length === 0 ? (
              <EmptyState
                icon={<Users className="w-10 h-10 text-muted-foreground" />}
                title="لا توجد إحالات"
                description="شارك كود الإحالة مع أصدقاءك للبدء"
              />
            ) : (
              <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
                {referrals.map((ref, index) => {
                  const statusInfo = referralStatusLabels[ref.status] ?? referralStatusLabels.pending;
                  return (
                    <motion.div
                      key={ref.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <GlassCard variant="beneficiary" className="py-3 flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-beneficiary/10 flex items-center justify-center shrink-0">
                          <Users className="w-4 h-4 text-beneficiary" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium">كود: {ref.code}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(ref.createdAt).toLocaleDateString('ar-YE', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <div className="text-left">
                          <p className={`text-xs font-medium ${statusInfo.color}`}>
                            {statusInfo.label}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {toArabicNumerals(ref.reward)} نقطة
                          </p>
                        </div>
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
