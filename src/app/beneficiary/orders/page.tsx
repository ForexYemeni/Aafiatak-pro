'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList,
  Star,
  MapPin,
  Phone,
  XCircle,
  Loader2,
  CheckCircle2,
  Clock,
  ChevronLeft,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { GlassCard } from '@/components/common/glass-card';
import { Currency } from '@/components/common/currency';
import { BadgeStatus } from '@/components/common/badge-status';
import { EmptyState } from '@/components/common/empty-state';
import { ListSkeleton } from '@/components/common/loading-skeleton';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useToast } from '@/hooks/use-toast';
import type { ApiResponse, ServiceRequest, PaginationMeta, ServiceRequestStatus } from '@/types';

interface OrderWithDetails extends ServiceRequest {
  serviceName?: string;
  nurseName?: string;
  nurseAvatar?: string;
  nursePhone?: string;
  nurseRating?: number;
}

const statusMap: Record<string, { label: string; variant: string }> = {
  pending: { label: 'قيد الانتظار', variant: 'pending' },
  assigned: { label: 'تم التعيين', variant: 'dispatched' },
  accepted: { label: 'مقبول', variant: 'active' },
  in_progress: { label: 'قيد التنفيذ', variant: 'in_progress' },
  completed: { label: 'مكتمل', variant: 'completed' },
  cancelled: { label: 'ملغي', variant: 'cancelled' },
  rejected: { label: 'مرفوض', variant: 'rejected' },
};

type TabKey = 'active' | 'completed' | 'cancelled';

export default function OrdersPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const statusMapByTab: Record<TabKey, string> = {
        active: 'pending,assigned,accepted,in_progress',
        completed: 'completed',
        cancelled: 'cancelled,rejected',
      };
      const res = await fetch(`/api/beneficiary/orders?status=${statusMapByTab[activeTab]}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data: ApiResponse<OrderWithDetails[]> = await res.json();
      if (data.success && data.data) {
        setOrders(data.data);
        if (data.pagination) setPagination(data.pagination);
      }
    } catch {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, activeTab]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  const cancelOrder = async (orderId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`/api/beneficiary/orders/${orderId}`, {
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
        fetchOrders();
      } else {
        toast({ title: 'فشل إلغاء الطلب', variant: 'destructive' });
      }
    } catch {
      toast({ title: 'حدث خطأ', variant: 'destructive' });
    }
  };

  const getStatusBadge = (status: string) => {
    const info = statusMap[status] ?? { label: status, variant: 'pending' };
    return <BadgeStatus status={info.variant} label={info.label} size="sm" />;
  };

  const formatDate = (dateStr: string | Date | null) => {
    if (!dateStr) return 'غير محدد';
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
        <h1 className="text-2xl font-bold">طلباتي</h1>
        <p className="text-sm text-muted-foreground">متابعة وإدارة طلبات الخدمة</p>
      </motion.div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="active" className="gap-1">
            النشطة
            {pagination && activeTab === 'active' && pagination.total > 0 && (
              <Badge variant="destructive" className="w-5 h-5 p-0 text-[10px] flex items-center justify-center">
                {pagination.total}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">المكتملة</TabsTrigger>
          <TabsTrigger value="cancelled">الملغاة</TabsTrigger>
        </TabsList>

        {(['active', 'completed', 'cancelled'] as TabKey[]).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {isLoading ? (
              <ListSkeleton items={4} />
            ) : orders.length === 0 ? (
              <EmptyState
                icon={<ClipboardList className="w-10 h-10 text-muted-foreground" />}
                title={
                  tab === 'active'
                    ? 'لا توجد طلبات نشطة'
                    : tab === 'completed'
                    ? 'لا توجد طلبات مكتملة'
                    : 'لا توجد طلبات ملغاة'
                }
                description={
                  tab === 'active'
                    ? 'يمكنك طلب خدمة جديدة من الصفحة الرئيسية'
                    : tab === 'completed'
                    ? 'ستظهر هنا الطلبات المنتهية'
                    : 'ستظهر هنا الطلبات الملغاة'
                }
                action={
                  tab === 'active'
                    ? { label: 'طلب خدمة', onClick: () => router.push('/beneficiary') }
                    : undefined
                }
              />
            ) : (
              <div className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar">
                <AnimatePresence>
                  {orders.map((order, index) => (
                    <motion.div
                      key={order.id}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -15 }}
                      transition={{ delay: index * 0.05 }}
                    >
                      <GlassCard
                        variant="beneficiary"
                        className="cursor-pointer hover:shadow-md transition-shadow"
                        onClick={() => router.push(`/beneficiary/orders/${order.id}`)}
                      >
                        <div className="flex items-start gap-4">
                          {/* Nurse Avatar */}
                          <Avatar className="w-12 h-12 shrink-0">
                            <AvatarFallback className="bg-beneficiary/10 text-beneficiary text-sm">
                              {order.nurseName ? order.nurseName.slice(0, 2) : 'ـ'}
                            </AvatarFallback>
                          </Avatar>

                          <div className="flex-1 min-w-0 space-y-2">
                            {/* Top row */}
                            <div className="flex items-center justify-between gap-2">
                              <h3 className="font-semibold text-sm truncate">
                                {order.nurseName ?? 'بانتظار تعيين ممرض/ـة'}
                              </h3>
                              {getStatusBadge(order.status)}
                            </div>

                            {/* Service name */}
                            {order.serviceName && (
                              <p className="text-xs text-muted-foreground">{order.serviceName}</p>
                            )}

                            {/* Time */}
                            <div className="flex items-center gap-1 text-xs text-muted-foreground">
                              <Clock className="w-3.5 h-3.5" />
                              {formatDate(order.scheduledAt ?? order.createdAt)}
                            </div>

                            {/* Price */}
                            <div className="flex items-center justify-between pt-1">
                              <Currency amount={order.pricing?.totalPrice ?? 0} className="text-sm text-beneficiary" />
                              <div className="flex items-center gap-2">
                                {/* Action buttons based on status */}
                                {(order.status === 'in_progress' || order.status === 'accepted') && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7 gap-1 border-beneficiary text-beneficiary"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (order.nurseId) router.push(`/beneficiary/tracking/${order.nurseId}`);
                                    }}
                                  >
                                    <MapPin className="w-3 h-3" />
                                    تتبع
                                  </Button>
                                )}
                                {order.status === 'completed' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7 gap-1"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      router.push(`/beneficiary/orders/${order.id}`);
                                    }}
                                  >
                                    <Star className="w-3 h-3" />
                                    تقييم
                                  </Button>
                                )}
                                {order.status === 'pending' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs h-7 gap-1 text-destructive border-destructive"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      cancelOrder(order.id);
                                    }}
                                  >
                                    <XCircle className="w-3 h-3" />
                                    إلغاء
                                  </Button>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
