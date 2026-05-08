'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
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
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { GlassCard } from '@/components/common/glass-card';
import { Currency, formatYemeniRial } from '@/components/common/currency';
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

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orderId = params.id as string;
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center gap-3"
      >
        <Button variant="ghost" size="icon" onClick={() => router.back()}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-xl font-bold">تفاصيل الطلب</h1>
          <p className="text-sm text-muted-foreground">
            رقم الطلب: #{order.id.slice(-6)}
          </p>
        </div>
        <BadgeStatus
          status={order.status === 'in_progress' ? 'in_progress' : order.status === 'completed' ? 'completed' : order.status === 'cancelled' ? 'cancelled' : order.status === 'pending' ? 'pending' : 'active'}
          label={getTimelineStatus(order.status).label}
          size="md"
        />
      </motion.div>

      {/* Status Timeline */}
      <GlassCard variant="beneficiary" className="space-y-4">
        <h3 className="font-semibold text-sm">حالة الطلب</h3>
        <div className="space-y-3">
          {statusOrder.map((status, index) => {
            const info = getTimelineStatus(status);
            const Icon = info.icon;
            const isReached = index <= currentStatusIndex && !isCancelledOrRejected;
            const isCurrent = index === currentStatusIndex && !isCancelledOrRejected;

            return (
              <div key={status} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                  isReached
                    ? 'bg-beneficiary text-beneficiary-foreground'
                    : 'bg-muted text-muted-foreground'
                } ${isCurrent ? 'ring-2 ring-beneficiary/30 ring-offset-2' : ''}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1">
                  <p className={`text-sm font-medium ${isReached ? 'text-foreground' : 'text-muted-foreground'}`}>
                    {info.label}
                  </p>
                </div>
                {isReached && (
                  <CheckCircle2 className="w-4 h-4 text-beneficiary" />
                )}
              </div>
            );
          })}

          {isCancelledOrRejected && (
            <div className="flex items-center gap-3 mt-2">
              <div className="w-8 h-8 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center shrink-0">
                <XCircle className="w-4 h-4" />
              </div>
              <p className="text-sm font-medium text-destructive">
                {order.status === 'cancelled' ? 'تم إلغاء الطلب' : 'تم رفض الطلب'}
              </p>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Service Details */}
      <GlassCard variant="beneficiary" className="space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <Stethoscope className="w-4 h-4 text-beneficiary" />
          تفاصيل الخدمة
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">الخدمة</span>
            <span className="font-medium">{order.serviceName ?? 'خدمة طبية'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">الموعد</span>
            <span className="font-medium">{formatDate(order.scheduledAt) || 'فوري'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">العنوان</span>
            <span className="font-medium max-w-[60%] text-left">{order.beneficiaryAddress}</span>
          </div>
          {order.notes && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">ملاحظات</span>
              <span className="font-medium max-w-[60%] text-left">{order.notes}</span>
            </div>
          )}
        </div>
      </GlassCard>

      {/* Nurse Info */}
      {order.nurseId && (
        <GlassCard variant="beneficiary" className="space-y-4">
          <h3 className="font-semibold text-sm flex items-center gap-2">
            <User className="w-4 h-4 text-beneficiary" />
            معلومات الممرض/ـة
          </h3>
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16">
              <AvatarFallback className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xl">
                {order.nurseName ? order.nurseName.slice(0, 2) : 'م'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-bold text-lg">{order.nurseName ?? 'الممرض/ـة'}</p>
                {order.nurseIsOnline !== undefined && (
                  <div className="flex items-center gap-1">
                    <div className={`w-2 h-2 rounded-full ${order.nurseIsOnline ? 'bg-green-500' : 'bg-gray-400'}`} />
                    <span className={`text-xs ${order.nurseIsOnline ? 'text-green-600' : 'text-muted-foreground'}`}>
                      {order.nurseIsOnline ? 'متصل' : 'غير متصل'}
                    </span>
                  </div>
                )}
              </div>
              {order.nurseSpecialization && (
                <p className="text-sm text-muted-foreground">{order.nurseSpecialization}</p>
              )}
              {order.nurseRating !== undefined && order.nurseRating > 0 && (
                <div className="flex items-center gap-1 mt-1">
                  <Star className="w-4 h-4 fill-yellow-500 text-yellow-500" />
                  <span className="text-sm font-medium">{order.nurseRating.toFixed(1)}</span>
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
                className="gap-2 flex-1 bg-green-600 hover:bg-green-700 text-white"
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
              className="gap-2 flex-1"
              onClick={() => router.push(`/beneficiary/chat/${order.nurseId}`)}
            >
              <MessageCircle className="w-4 h-4" />
              محادثة
            </Button>
            {['assigned', 'accepted', 'in_progress'].includes(order.status) && (
              <Button
                variant="outline"
                size="sm"
                className="gap-2 flex-1 border-beneficiary text-beneficiary"
                onClick={() => router.push(`/beneficiary/tracking/${order.nurseId}`)}
              >
                <MapPin className="w-4 h-4" />
                تتبع
              </Button>
            )}
          </div>
        </GlassCard>
      )}

      {/* Waiting for nurse assignment */}
      {!order.nurseId && order.status === 'pending' && (
        <GlassCard variant="beneficiary" className="text-center py-6">
          <Clock className="w-10 h-10 text-beneficiary mx-auto mb-3" />
          <p className="font-semibold">بانتظار تعيين ممرض/ـة</p>
          <p className="text-sm text-muted-foreground mt-1">
            سيتم إشعارك فور تعيين ممرض/ـة لطلبك
          </p>
        </GlassCard>
      )}

      {/* Payment Details */}
      <GlassCard variant="beneficiary" className="space-y-4">
        <h3 className="font-semibold text-sm flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-beneficiary" />
          تفاصيل الدفع
        </h3>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">السعر الأساسي</span>
            <Currency amount={order.pricing?.basePrice ?? 0} className="text-sm" />
          </div>
          {(order.pricing?.nightFee ?? 0) > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">رسوم ليلية</span>
              <Currency amount={order.pricing?.nightFee ?? 0} className="text-sm" />
            </div>
          )}
          {(order.pricing?.fridayFee ?? 0) > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">رسوم الجمعة</span>
              <Currency amount={order.pricing?.fridayFee ?? 0} className="text-sm" />
            </div>
          )}
          {(order.pricing?.emergencyFee ?? 0) > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground text-red-600">رسوم الطوارئ</span>
              <Currency amount={order.pricing?.emergencyFee ?? 0} className="text-sm text-red-600" />
            </div>
          )}
          {(order.pricing?.couponDiscount ?? 0) > 0 && (
            <div className="flex justify-between">
              <span className="text-muted-foreground text-green-600">خصم الكوبون</span>
              <Currency amount={-(order.pricing?.couponDiscount ?? 0)} className="text-sm text-green-600" />
            </div>
          )}
          <Separator />
          <div className="flex justify-between pt-1">
            <span className="font-bold">الإجمالي</span>
            <Currency amount={order.pricing?.totalPrice ?? 0} className="text-beneficiary font-bold" />
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">طريقة الدفع</span>
            <span className="font-medium">
              {order.paymentMethod === 'cash' ? 'نقدي' : order.paymentMethod === 'mobile_wallet' ? 'محفظة إلكترونية' : order.paymentMethod ?? 'نقدي'}
            </span>
          </div>
        </div>
      </GlassCard>

      {/* Cancel Button */}
      {(order.status === 'pending' || order.status === 'assigned') && (
        <Button
          variant="destructive"
          className="w-full gap-2"
          onClick={cancelOrder}
        >
          <XCircle className="w-4 h-4" />
          إلغاء الطلب
        </Button>
      )}
    </div>
  );
}
