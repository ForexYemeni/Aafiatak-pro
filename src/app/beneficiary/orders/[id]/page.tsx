'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight,
  Phone,
  MessageCircle,
  MapPin,
  Star,
  XCircle,
  Clock,
  CheckCircle2,
  Loader2,
  Stethoscope,
  CreditCard,
  Calendar,
  User,
  AlertTriangle,
  Send,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Lock,
  ShieldCheck,
  Banknote,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { GlassCard } from '@/components/common/glass-card';
import { Currency, formatYemeniRial, toArabicNumerals } from '@/components/common/currency';
import { BadgeStatus } from '@/components/common/badge-status';
import { CardSkeleton } from '@/components/common/loading-skeleton';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import type { ApiResponse, ServiceRequest } from '@/types';

interface OrderDetail extends ServiceRequest {
  serviceName?: string;
  nurseName?: string;
  nurseAvatar?: string;
  nursePhone?: string;
  nurseRating?: number;
  nurseSpecialization?: string;
  nurseIsOnline?: boolean;
  hasRated?: boolean;
}

const statusTimelineLabels: Record<string, { label: string; icon: React.ElementType }> = {
  pending: { label: 'تم إنشاء الطلب', icon: Clock },
  assigned: { label: 'تم تعيين ممرض/ـة', icon: User },
  accepted: { label: 'تم قبول الطلب', icon: CheckCircle2 },
  in_progress: { label: 'جاري التنفيذ', icon: Stethoscope },
  completed: { label: 'تم الإنجاز', icon: CheckCircle2 },
  cancelled: { label: 'تم الإلغاء', icon: XCircle },
  rejected: { label: 'تم الرفض', icon: XCircle },
};

const statusOrder = ['pending', 'assigned', 'accepted', 'in_progress', 'completed'];

// Rating tags options
const ratingTags = [
  { id: 'punctual', label: 'ملتزم بالوقت', icon: Clock },
  { id: 'professional', label: 'محترف', icon: Stethoscope },
  { id: 'friendly', label: 'ودود', icon: ThumbsUp },
  { id: 'clean', label: 'نظيف ومرتب', icon: CheckCircle2 },
  { id: 'skilled', label: 'ماهر', icon: Star },
  { id: 'patient', label: 'صبور', icon: ThumbsUp },
  { id: 'late', label: 'متأخر', icon: Clock },
  { id: 'unprofessional', label: 'غير محترف', icon: ThumbsDown },
];

// Animation variants
const fadeInUp = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: 'easeOut' as const } },
} as const;

const staggerContainer = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.08, delayChildren: 0.1 } },
} as const;

const timelineItemVariants = {
  hidden: { opacity: 0, x: 20 },
  show: { opacity: 1, x: 0, transition: { duration: 0.35, ease: 'easeOut' as const } },
} as const;

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Rating state
  const [ratingScore, setRatingScore] = useState(0);
  const [hoveredStar, setHoveredStar] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [existingRating, setExistingRating] = useState<{ score: number; comment?: string; tags?: string[]; isAnonymous?: boolean } | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!token || !orderId) return;
    setIsLoading(true);
    try {
      const res = await fetch(`/api/beneficiary/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<OrderDetail> = await res.json();
      if (data.success && data.data) {
        setOrder(data.data);

        // Check if already rated
        if (data.data.status === 'completed' && data.data.nurseId) {
          try {
            const ratingRes = await fetch(`/api/beneficiary/ratings?limit=100`, {
              headers: { Authorization: `Bearer ${token}` },
            });
            const ratingData = await ratingRes.json();
            if (ratingData.success && ratingData.data?.ratings) {
              const found = ratingData.data.ratings.find((r: any) => r.requestId === orderId || r.requestId?.toString() === orderId);
              if (found) {
                setExistingRating({
                  score: found.score,
                  comment: found.comment,
                  tags: found.tags,
                  isAnonymous: found.isAnonymous,
                });
              }
            }
          } catch {
            // Rating check failed, continue
          }
        }
      }
    } catch {
      // Error handled silently
    } finally {
      setIsLoading(false);
    }
  }, [token, orderId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const cancelOrder = async () => {
    if (!token || !order) return;
    try {
      const res = await fetch(`/api/beneficiary/orders/${order.id}`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ status: 'cancelled', cancelReason: 'إلغاء بواسطة المستفيد' }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'تم إلغاء الطلب' });
        fetchOrder();
      } else {
        toast({ title: 'فشل إلغاء الطلب', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' });
    }
  };

  const submitRating = async () => {
    if (!token || !order || ratingScore === 0) return;
    setIsSubmittingRating(true);
    try {
      const res = await fetch('/api/beneficiary/ratings', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          requestId: order.id,
          score: ratingScore,
          comment: ratingComment || undefined,
          tags: selectedTags.length > 0 ? selectedTags : undefined,
          isAnonymous,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast({ title: 'تم إرسال التقييم بنجاح' });
        setExistingRating({ score: ratingScore, comment: ratingComment, tags: selectedTags, isAnonymous });
        setRatingScore(0);
        setRatingComment('');
        setSelectedTags([]);
      } else if (data.code === 'ALREADY_RATED') {
        toast({ title: 'تم تقييم هذا الطلب بالفعل', variant: 'destructive' });
        setExistingRating({ score: ratingScore });
      } else {
        toast({ title: data.message || 'فشل إرسال التقييم', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'حدث خطأ أثناء إرسال التقييم', variant: 'destructive' });
    } finally {
      setIsSubmittingRating(false);
    }
  };

  const toggleTag = (tagId: string) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

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

  const getTimelineStatus = (status: string) => {
    return statusTimelineLabels[status] ?? { label: status, icon: Clock };
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <CardSkeleton />
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <AlertTriangle className="w-12 h-12 text-muted-foreground" />
        <p className="text-muted-foreground">لم يتم العثور على الطلب</p>
        <Button onClick={() => router.push('/beneficiary/orders')}>العودة للطلبات</Button>
      </div>
    );
  }

  const currentStatusIndex = statusOrder.indexOf(order.status);
  const isCancelledOrRejected = order.status === 'cancelled' || order.status === 'rejected';
  const canRate = order.status === 'completed' && order.nurseId;
  const isUnpaid = (order.status as string) === 'awaiting_payment';

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' as const }}
        className="flex items-center gap-3"
      >
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-xl">
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">تفاصيل الطلب</h1>
          <p className="text-sm text-muted-foreground">
            رقم الطلب: #{toArabicNumerals(order.id.slice(-6))}
          </p>
        </div>
        <BadgeStatus
          status={order.status === 'in_progress' ? 'in_progress' : order.status === 'completed' ? 'completed' : order.status === 'cancelled' ? 'cancelled' : order.status === 'pending' ? 'pending' : 'active'}
          label={getTimelineStatus(order.status).label}
          size="md"
        />
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* Animated Status Timeline                     */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div variants={fadeInUp} initial="hidden" animate="show">
        <GlassCard variant="beneficiary" className="overflow-hidden p-0">
          <div className="px-5 pt-5 pb-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-beneficiary/10 flex items-center justify-center">
                <Clock className="w-4 h-4 text-beneficiary" />
              </div>
              حالة الطلب
            </h3>
          </div>

          <motion.div
            className="px-5 pb-5 space-y-0"
            variants={staggerContainer}
            initial="hidden"
            animate="show"
          >
            {statusOrder.map((status, index) => {
              const info = getTimelineStatus(status);
              const Icon = info.icon;
              const isReached = index <= currentStatusIndex && !isCancelledOrRejected;
              const isCurrent = index === currentStatusIndex && !isCancelledOrRejected;
              const isLast = index === statusOrder.length - 1;

              return (
                <motion.div key={status} variants={timelineItemVariants}>
                  <div className="flex items-start gap-3 relative">
                    {/* Timeline connector + dot */}
                    <div className="flex flex-col items-center shrink-0">
                      <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: index * 0.1, duration: 0.3, ease: 'easeOut' as const }}
                        className={`w-9 h-9 rounded-xl flex items-center justify-center relative z-10 ${
                          isReached
                            ? 'bg-beneficiary text-beneficiary-foreground shadow-md shadow-beneficiary/20'
                            : 'bg-muted text-muted-foreground'
                        } ${isCurrent ? 'ring-2 ring-beneficiary/30 ring-offset-2 ring-offset-background' : ''}`}
                      >
                        <Icon className="w-4 h-4" />
                      </motion.div>
                      {/* Connecting line */}
                      {!isLast && (
                        <div className={`w-0.5 h-8 transition-colors duration-500 ${
                          isReached && index < currentStatusIndex ? 'bg-beneficiary' : 'bg-border'
                        }`} />
                      )}
                    </div>

                    {/* Label */}
                    <div className="pt-1.5 pb-3">
                      <p className={`text-sm font-medium ${isReached ? 'text-foreground' : 'text-muted-foreground'}`}>
                        {info.label}
                      </p>
                    </div>

                    {/* Check icon for reached steps */}
                    {isReached && index < currentStatusIndex && (
                      <div className="pt-2 mr-auto">
                        <CheckCircle2 className="w-4 h-4 text-beneficiary" />
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}

            {isCancelledOrRejected && (
              <motion.div variants={timelineItemVariants}>
                <div className="flex items-center gap-3 mt-1">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="w-9 h-9 rounded-xl bg-destructive text-destructive-foreground flex items-center justify-center shadow-md shadow-destructive/20"
                  >
                    <XCircle className="w-4 h-4" />
                  </motion.div>
                  <p className="text-sm font-bold text-destructive">
                    {order.status === 'cancelled' ? 'تم إلغاء الطلب' : 'تم رفض الطلب'}
                  </p>
                </div>
              </motion.div>
            )}
          </motion.div>
        </GlassCard>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* Nurse Info Card with Gradient Border         */}
      {/* ═══════════════════════════════════════════ */}
      {order.nurseId && (
        <motion.div variants={fadeInUp} initial="hidden" animate="show">
          <div className="rounded-2xl p-[1.5px] bg-gradient-to-l from-beneficiary via-purple-400 to-pink-400 shadow-md">
            <GlassCard variant="beneficiary" className="!rounded-[14px] space-y-4">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <Avatar className="w-16 h-16 ring-2 ring-beneficiary/20 shadow-lg">
                    <AvatarFallback className="bg-gradient-to-br from-beneficiary/20 to-purple-500/20 text-beneficiary text-xl font-bold">
                      {order.nurseName ? order.nurseName.slice(0, 2) : 'م'}
                    </AvatarFallback>
                  </Avatar>
                  {order.nurseIsOnline !== undefined && (
                    <span className={`absolute bottom-0 right-0 w-4 h-4 rounded-full border-2 border-white dark:border-gray-900 ${
                      order.nurseIsOnline ? 'bg-green-500' : 'bg-gray-400'
                    }`} />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-lg">{order.nurseName ?? 'الممرض/ـة'}</p>
                    {order.nurseIsOnline !== undefined && (
                      <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
                        order.nurseIsOnline
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400'
                      }`}>
                        {order.nurseIsOnline ? 'متصل الآن' : 'غير متصل'}
                      </span>
                    )}
                  </div>
                  {order.nurseSpecialization && (
                    <p className="text-sm text-muted-foreground mt-0.5">{order.nurseSpecialization}</p>
                  )}
                  {order.nurseRating !== undefined && order.nurseRating > 0 && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className="flex items-center">
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Star key={s} className={`w-3.5 h-3.5 ${s <= Math.round(order.nurseRating!) ? 'fill-yellow-500 text-yellow-500' : 'text-gray-300 dark:text-gray-600'}`} />
                        ))}
                      </div>
                      <span className="text-sm font-semibold">{toArabicNumerals(order.nurseRating.toFixed(1))}</span>
                    </div>
                  )}
                  {order.nursePhone && (
                    <div className="flex items-center gap-1.5 mt-1 text-sm">
                      <Phone className="w-3.5 h-3.5 text-green-600" />
                      <span className="font-medium" dir="ltr">{order.nursePhone}</span>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {order.nursePhone && (
                  <Button
                    className="gap-2 flex-1 bg-green-600 hover:bg-green-700 text-white rounded-xl"
                    size="sm"
                    onClick={() => window.open(`tel:${order.nursePhone}`)}
                  >
                    <Phone className="w-4 h-4" />
                    اتصال
                  </Button>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2 flex-1 rounded-xl"
                  onClick={() => router.push(`/beneficiary/chat/${order.nurseId}`)}
                >
                  <MessageCircle className="w-4 h-4" />
                  محادثة
                </Button>
                {['assigned', 'accepted', 'in_progress'].includes(order.status) && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2 flex-1 border-beneficiary text-beneficiary hover:bg-beneficiary/10 rounded-xl"
                    onClick={() => router.push(`/beneficiary/tracking/${order.nurseId}`)}
                  >
                    <MapPin className="w-4 h-4" />
                    تتبع
                  </Button>
                )}
              </div>
            </GlassCard>
          </div>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* Service Details                              */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div variants={fadeInUp} initial="hidden" animate="show">
        <GlassCard variant="beneficiary" className="space-y-4">
          <h3 className="font-bold text-sm flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-beneficiary/10 flex items-center justify-center">
              <Stethoscope className="w-4 h-4 text-beneficiary" />
            </div>
            تفاصيل الخدمة
          </h3>
          <div className="space-y-3 text-sm">
            <div className="flex justify-between items-center py-1.5 border-b border-border/30">
              <span className="text-muted-foreground">الخدمة</span>
              <span className="font-medium">{order.serviceName ?? 'خدمة طبية'}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-border/30">
              <span className="text-muted-foreground">الموعد</span>
              <span className="font-medium">{formatDate(order.scheduledAt) || 'فوري'}</span>
            </div>
            <div className="flex justify-between items-center py-1.5 border-b border-border/30">
              <span className="text-muted-foreground">العنوان</span>
              <span className="font-medium max-w-[60%] text-left text-xs">{order.beneficiaryAddress}</span>
            </div>
            {order.notes && (
              <div className="flex justify-between items-start py-1.5">
                <span className="text-muted-foreground shrink-0 ml-4">ملاحظات</span>
                <span className="font-medium max-w-[60%] text-left text-xs">{order.notes}</span>
              </div>
            )}
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* Awaiting Payment Confirmation                */}
      {/* ═══════════════════════════════════════════ */}
      {(order.status as string) === 'awaiting_payment' && (
        <motion.div variants={fadeInUp} initial="hidden" animate="show">
          <GlassCard variant="beneficiary" className="overflow-hidden p-0">
            <div className="bg-gradient-to-l from-amber-500 to-orange-400 px-5 py-3 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-white" />
              <h3 className="font-bold text-sm text-white">بانتظار تأكيد الدفع</h3>
            </div>
            <div className="p-5 space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
                  <Lock className="w-5 h-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-bold text-amber-700 dark:text-amber-400">
                    الطلب معلق بانتظار تأكيد الدفع من الإدارة
                  </p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    {order.paymentMethod === 'cash'
                      ? 'طريقة الدفع نقدي عند الخدمة — سيتم تأكيد الطلب قريباً.'
                      : 'يرجى إرسال إثبات الدفع عبر واتساب أو رفعه في التطبيق. سيتم تأكيد الدفع من الإدارة وإشعارك فور ذلك.'}
                  </p>
                </div>
              </div>
              {order.paymentMethod && order.paymentMethod !== 'cash' && (
                <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                  <Banknote className="w-4 h-4 text-amber-600 shrink-0" />
                  <div className="text-xs">
                    <span className="font-bold text-amber-700 dark:text-amber-400">
                      {order.paymentMethod === 'wallet_deposit' ? 'دفع عبر المحفظة الإلكترونية' : 'تحويل بنكي'}
                    </span>
                    <span className="text-muted-foreground mr-1.5">— أرسل إثبات الدفع للإدارة عبر واتساب</span>
                  </div>
                </div>
              )}
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* Waiting for nurse assignment                 */}
      {/* ═══════════════════════════════════════════ */}
      {!order.nurseId && order.status === 'pending' && (
        <motion.div variants={fadeInUp} initial="hidden" animate="show">
          <GlassCard variant="beneficiary" className="overflow-hidden p-0">
            <div className="bg-gradient-to-l from-beneficiary to-purple-600 px-5 py-3 flex items-center gap-2">
              <Clock className="w-4 h-4 text-white" />
              <h3 className="font-bold text-sm text-white">بانتظار تعيين ممرض/ـة</h3>
            </div>
            <div className="p-5 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-beneficiary/10 flex items-center justify-center shrink-0">
                <Stethoscope className="w-5 h-5 text-beneficiary" />
              </div>
              <div>
                <p className="text-sm font-medium">تم استلام طلبك بنجاح</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  سيتم إشعارك فور تعيين ممرض/ـة مناسب لطلبك
                </p>
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* Contact Guard Overlay for Unpaid Orders      */}
      {/* ═══════════════════════════════════════════ */}
      {isUnpaid && order.nurseId && order.nursePhone && (
        <motion.div
          variants={fadeInUp}
          initial="hidden"
          animate="show"
          className="relative"
        >
          <GlassCard variant="beneficiary" className="overflow-hidden p-0">
            {/* Blurred content underneath */}
            <div className="filter blur-[6px] pointer-events-none select-none opacity-60 p-5">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarFallback className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
                    {order.nurseName ? order.nurseName.slice(0, 2) : 'م'}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold">{order.nurseName}</p>
                  <p className="text-sm text-muted-foreground" dir="ltr">{order.nursePhone}</p>
                </div>
              </div>
            </div>
            {/* Overlay */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-background/80 dark:bg-background/90 backdrop-blur-sm rounded-2xl gap-3 p-5">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 flex items-center justify-center">
                <Lock className="w-6 h-6 text-amber-600 dark:text-amber-400" />
              </div>
              <p className="text-sm font-bold text-center">بيانات التواصل متاحة بعد تأكيد الدفع</p>
              <p className="text-xs text-muted-foreground text-center">سيتم إشعارك فور تأكيد الإدارة للدفع</p>
            </div>
          </GlassCard>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* Payment Details Card                         */}
      {/* ═══════════════════════════════════════════ */}
      <motion.div variants={fadeInUp} initial="hidden" animate="show">
        <GlassCard variant="beneficiary" className="overflow-hidden p-0">
          <div className="px-5 pt-5 pb-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-beneficiary/10 flex items-center justify-center">
                <CreditCard className="w-4 h-4 text-beneficiary" />
              </div>
              تفاصيل الدفع
            </h3>
          </div>
          <div className="px-5 pb-5 space-y-2.5 text-sm">
            <div className="flex justify-between items-center py-1">
              <span className="text-muted-foreground">السعر الأساسي</span>
              <Currency amount={order.pricing?.basePrice ?? 0} className="text-sm" />
            </div>
            {(order.pricing?.nightFee ?? 0) > 0 && (
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">رسوم ليلية</span>
                <Currency amount={order.pricing?.nightFee ?? 0} className="text-sm" />
              </div>
            )}
            {(order.pricing?.fridayFee ?? 0) > 0 && (
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground">رسوم الجمعة</span>
                <Currency amount={order.pricing?.fridayFee ?? 0} className="text-sm" />
              </div>
            )}
            {(order.pricing?.emergencyFee ?? 0) > 0 && (
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground text-red-600 dark:text-red-400">رسوم الطوارئ</span>
                <Currency amount={order.pricing?.emergencyFee ?? 0} className="text-sm text-red-600 dark:text-red-400" />
              </div>
            )}
            {(order.pricing?.couponDiscount ?? 0) > 0 && (
              <div className="flex justify-between items-center py-1">
                <span className="text-muted-foreground text-green-600 dark:text-green-400">خصم الكوبون</span>
                <Currency amount={-(order.pricing?.couponDiscount ?? 0)} className="text-sm text-green-600 dark:text-green-400" />
              </div>
            )}
            <Separator />
            <div className="flex justify-between items-center pt-2">
              <span className="font-bold text-base">الإجمالي</span>
              <Currency amount={order.pricing?.totalPrice ?? 0} className="text-beneficiary font-bold text-lg" />
            </div>
            <div className="flex justify-between items-center pt-1">
              <span className="text-muted-foreground text-xs">طريقة الدفع</span>
              <span className="font-medium text-xs px-2.5 py-1 rounded-lg bg-muted/50">
                {order.paymentMethod === 'cash' ? '💵 نقدي' : order.paymentMethod === 'mobile_wallet' ? '📱 محفظة إلكترونية' : order.paymentMethod ?? '💵 نقدي'}
              </span>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ═══════════════════════════════════════════ */}
      {/* RATING SECTION with Animated Stars           */}
      {/* ═══════════════════════════════════════════ */}
      {canRate && (
        <motion.div variants={fadeInUp} initial="hidden" animate="show">
          <GlassCard variant="beneficiary" className="space-y-5">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-yellow-500/10 flex items-center justify-center">
                <Star className="w-4 h-4 text-yellow-500" />
              </div>
              تقييم الخدمة
            </h3>

            {existingRating ? (
              /* ── Already rated ── */
              <div className="text-center py-4 space-y-3">
                <div className="flex items-center justify-center gap-1.5">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <motion.div
                      key={star}
                      initial={{ scale: 0, rotate: -180 }}
                      animate={{ scale: 1, rotate: 0 }}
                      transition={{ delay: star * 0.1, duration: 0.4, ease: 'easeOut' as const }}
                    >
                      <Star
                        className={`w-8 h-8 ${
                          star <= existingRating.score
                            ? 'fill-yellow-500 text-yellow-500'
                            : 'text-gray-300 dark:text-gray-600'
                        }`}
                      />
                    </motion.div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground">تم تقييم هذه الخدمة</p>
                {existingRating.comment && (
                  <div className="p-3 rounded-xl bg-muted/40 text-sm text-right">
                    {existingRating.comment}
                  </div>
                )}
                {existingRating.tags && existingRating.tags.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 justify-center">
                    {existingRating.tags.map((tag) => {
                      const tagInfo = ratingTags.find((t) => t.id === tag);
                      return tagInfo ? (
                        <span
                          key={tag}
                          className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-beneficiary/10 text-beneficiary"
                        >
                          {tagInfo.label}
                        </span>
                      ) : null;
                    })}
                  </div>
                )}
                {existingRating.isAnonymous && (
                  <p className="text-xs text-muted-foreground flex items-center justify-center gap-1">
                    <EyeOff className="w-3 h-3" />
                    تم التقييم بشكل مجهول
                  </p>
                )}
              </div>
            ) : (
              /* ── Rating form ── */
              <div className="space-y-5">
                {/* Animated Star selector */}
                <div className="text-center space-y-2">
                  <p className="text-sm text-muted-foreground">كيف تقيّم تجربتك مع {order.nurseName || 'الممرض/ـة'}؟</p>
                  <div className="flex items-center justify-center gap-3 py-3">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <motion.button
                        key={star}
                        type="button"
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.9 }}
                        onMouseEnter={() => setHoveredStar(star)}
                        onMouseLeave={() => setHoveredStar(0)}
                        onClick={() => setRatingScore(star)}
                        className="transition-transform"
                      >
                        <motion.div
                          animate={{
                            rotate: star <= (hoveredStar || ratingScore) ? [0, -15, 15, 0] : 0,
                            scale: star <= (hoveredStar || ratingScore) ? 1.1 : 1,
                          }}
                          transition={{ duration: 0.4, ease: 'easeOut' as const }}
                        >
                          <Star
                            className={`w-10 h-10 transition-colors duration-200 ${
                              star <= (hoveredStar || ratingScore)
                                ? 'fill-yellow-500 text-yellow-500 drop-shadow-[0_0_8px_rgba(234,179,8,0.4)]'
                                : 'text-gray-300 dark:text-gray-600'
                            }`}
                          />
                        </motion.div>
                      </motion.button>
                    ))}
                  </div>
                  <AnimatePresence>
                    {ratingScore > 0 && (
                      <motion.p
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        className="text-sm font-semibold text-beneficiary"
                      >
                        {ratingScore === 1 && 'سيء'}
                        {ratingScore === 2 && 'ضعيف'}
                        {ratingScore === 3 && 'مقبول'}
                        {ratingScore === 4 && 'جيد'}
                        {ratingScore === 5 && 'ممتاز'}
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>

                {/* Tags */}
                <AnimatePresence>
                  {ratingScore > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      <p className="text-xs text-muted-foreground font-medium">اختر الصفات المناسبة (اختياري)</p>
                      <div className="flex flex-wrap gap-2">
                        {ratingTags.map((tag) => {
                          const TagIcon = tag.icon;
                          const isSelected = selectedTags.includes(tag.id);
                          const isNegative = tag.id === 'late' || tag.id === 'unprofessional';
                          return (
                            <motion.button
                              key={tag.id}
                              type="button"
                              onClick={() => toggleTag(tag.id)}
                              whileTap={{ scale: 0.95 }}
                              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                                isSelected
                                  ? isNegative
                                    ? 'bg-red-500 text-white shadow-sm'
                                    : 'bg-beneficiary text-white shadow-sm'
                                  : isNegative
                                  ? 'bg-muted/60 text-red-400 hover:bg-red-500/10'
                                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
                              }`}
                            >
                              <TagIcon className="w-3 h-3" />
                              {tag.label}
                            </motion.button>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Comment */}
                <AnimatePresence>
                  {ratingScore > 0 && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-2 overflow-hidden"
                    >
                      <p className="text-xs text-muted-foreground font-medium">تعليقك (اختياري)</p>
                      <textarea
                        value={ratingComment}
                        onChange={(e) => setRatingComment(e.target.value)}
                        placeholder="شاركنا رأيك في التجربة..."
                        rows={3}
                        className="w-full rounded-xl border border-input bg-background px-4 py-3 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-beneficiary/30 focus:border-beneficiary"
                      />
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Anonymous toggle */}
                <AnimatePresence>
                  {ratingScore > 0 && (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                    >
                      <label className="flex items-center gap-2.5 cursor-pointer">
                        <div
                          className={`w-10 h-6 rounded-full transition-colors relative ${isAnonymous ? 'bg-beneficiary' : 'bg-muted'}`}
                          onClick={() => setIsAnonymous(!isAnonymous)}
                        >
                          <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${isAnonymous ? 'left-[18px]' : 'left-0.5'}`} />
                        </div>
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          {isAnonymous ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                          تقييم مجهول
                        </span>
                      </label>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Submit button */}
                <AnimatePresence>
                  {ratingScore > 0 && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                    >
                      <Button
                        className="w-full gap-2 bg-beneficiary hover:bg-beneficiary/90 rounded-xl"
                        onClick={submitRating}
                        disabled={isSubmittingRating}
                      >
                        {isSubmittingRating ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        إرسال التقييم
                      </Button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </GlassCard>
        </motion.div>
      )}

      {/* ═══════════════════════════════════════════ */}
      {/* Cancel Button                               */}
      {/* ═══════════════════════════════════════════ */}
      {(order.status === 'pending' || order.status === 'assigned') && (
        <motion.div variants={fadeInUp} initial="hidden" animate="show">
          <Button
            variant="destructive"
            className="w-full gap-2 rounded-xl"
            onClick={cancelOrder}
          >
            <XCircle className="w-4 h-4" />
            إلغاء الطلب
          </Button>
        </motion.div>
      )}
    </div>
  );
}
