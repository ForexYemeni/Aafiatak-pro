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
  MessageCircle,
  User,
  AlertTriangle,
  Heart,
  Activity,
  Wind,
  Siren,
  ArrowDown,
  Wallet,
  ShieldAlert,
  Ambulance,
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
import { useAuthFetch } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { ApiResponse, ServiceRequest, PaginationMeta, ServiceRequestStatus } from '@/types';

interface OrderWithDetails extends ServiceRequest {
  serviceName?: string;
  nurseName?: string;
  nurseAvatar?: string;
  nursePhone?: string;
  nurseRating?: number;
  nurseIsOnline?: boolean;
}

// --- Emergency types ---

interface EmergencyRequestItem {
  id: string;
  type: string;
  description?: string;
  status: string;
  lat?: number;
  lng?: number;
  address?: string;
  nurseName?: string;
  emergencyFee?: number;
  outcome?: string;
  resolvedNotes?: string;
  createdAt: string;
}

const emergencyTypeLabels: Record<string, string> = {
  medical: 'طبية عامة',
  injury: 'إصابة',
  breathing: 'صعوبة تنفس',
  cardiac: 'أزمة قلبية',
  fall: 'سقوط',
  other: 'أخرى',
};

const emergencyTypeIcons: Record<string, React.ElementType> = {
  medical: Heart,
  injury: Activity,
  breathing: Wind,
  cardiac: Siren,
  fall: ArrowDown,
  other: AlertTriangle,
};

const emergencyTypeColors: Record<string, string> = {
  medical: 'bg-red-500',
  injury: 'bg-orange-500',
  breathing: 'bg-blue-500',
  cardiac: 'bg-red-700',
  fall: 'bg-yellow-600',
  other: 'bg-gray-500',
};

const emergencyStatusLabels: Record<string, string> = {
  pending: 'قيد الانتظار',
  dispatched: 'تم الإرسال',
  accepted: 'مقبول',
  in_progress: 'قيد التنفيذ',
  resolved: 'تم الحل',
  cancelled: 'ملغي',
};

const emergencyStatusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  dispatched: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  accepted: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400',
  in_progress: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

const emergencyStatusDotColors: Record<string, string> = {
  pending: 'bg-yellow-500',
  dispatched: 'bg-blue-500',
  accepted: 'bg-indigo-500',
  in_progress: 'bg-orange-500',
  resolved: 'bg-green-500',
  cancelled: 'bg-gray-500',
};

const outcomeLabels: Record<string, string> = {
  treated_on_site: 'تم العلاج في الموقع',
  transferred_to_hospital: 'تم النقل للمستشفى',
  refused_treatment: 'رفض المريض العلاج',
  other: 'أخرى',
};

// --- Combined list item ---

type ListItemType = 'service' | 'emergency';

interface CombinedListItem {
  id: string;
  type: ListItemType;
  createdAt: string;
  order?: OrderWithDetails;
  emergency?: EmergencyRequestItem;
}

// --- Service request status map ---

const statusMap: Record<string, { label: string; variant: string }> = {
  pending: { label: 'قيد الانتظار', variant: 'pending' },
  assigned: { label: 'تم التعيين', variant: 'dispatched' },
  accepted: { label: 'مقبول', variant: 'active' },
  in_progress: { label: 'قيد التنفيذ', variant: 'in_progress' },
  completed: { label: 'مكتمل', variant: 'completed' },
  cancelled: { label: 'ملغي', variant: 'cancelled' },
  rejected: { label: 'مرفوض', variant: 'rejected' },
  awaiting_payment: { label: 'بانتظار تأكيد الدفع', variant: 'pending' },
};

type TabKey = 'active' | 'completed' | 'cancelled';

// Active emergency statuses
const activeEmergencyStatuses = ['pending', 'dispatched', 'accepted', 'in_progress'];
const completedEmergencyStatuses = ['resolved'];
const cancelledEmergencyStatuses = ['cancelled'];

export default function OrdersPage() {
  const router = useRouter();
  const token = useAuthStore((s) => s.token);
  const authFetch = useAuthFetch();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<TabKey>('active');
  const [orders, setOrders] = useState<OrderWithDetails[]>([]);
  const [emergencies, setEmergencies] = useState<EmergencyRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pagination, setPagination] = useState<PaginationMeta | null>(null);
  const [counts, setCounts] = useState({ active: 0, completed: 0, cancelled: 0 });

  const fetchCounts = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch('/api/beneficiary/orders?counts=true', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        setCounts(data.data as { active: number; completed: number; cancelled: number });
      }
    } catch {
      // silently handle
    }
  }, [token]);

  const fetchEmergencies = useCallback(async () => {
    if (!token) return;
    try {
      const res = await authFetch('/api/beneficiary/emergency');
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.data) {
          const emergenciesList = Array.isArray(data.data) ? data.data : data.data.emergencies || [];
          setEmergencies(emergenciesList);
        }
      }
    } catch {
      // silently handle
    }
  }, [token, authFetch]);

  const fetchOrders = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const statusMapByTab: Record<TabKey, string> = {
        active: 'pending,assigned,accepted,in_progress,awaiting_payment',
        completed: 'completed',
        cancelled: 'cancelled,rejected',
      };
      const res = await fetch(`/api/beneficiary/orders?status=${statusMapByTab[activeTab]}&limit=20`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) {
        const ordersArray = data.data?.orders || data.data || [];
        setOrders(Array.isArray(ordersArray) ? ordersArray : []);
        if (data.data?.total !== undefined) {
          setPagination({
            total: data.data.total || 0,
            page: data.data.page || 1,
            limit: 20,
            totalPages: data.data.pages || 1,
          });
        } else if (data.pagination) {
          setPagination(data.pagination);
        }
      }
    } catch {
      setOrders([]);
    } finally {
      setIsLoading(false);
    }
  }, [token, activeTab]);

  useEffect(() => {
    fetchOrders();
    fetchCounts();
    fetchEmergencies();
  }, [fetchOrders, fetchCounts, fetchEmergencies]);

  // Compute emergency counts by tab
  const emergencyCounts = {
    active: emergencies.filter((e) => activeEmergencyStatuses.includes(e.status)).length,
    completed: emergencies.filter((e) => completedEmergencyStatuses.includes(e.status)).length,
    cancelled: emergencies.filter((e) => cancelledEmergencyStatuses.includes(e.status)).length,
  };

  // Combined counts
  const combinedCounts = {
    active: counts.active + emergencyCounts.active,
    completed: counts.completed + emergencyCounts.completed,
    cancelled: counts.cancelled + emergencyCounts.cancelled,
  };

  // Build combined list based on active tab
  const combinedList: CombinedListItem[] = [];

  // Filter emergencies by active tab
  const filteredEmergencies = emergencies.filter((e) => {
    if (activeTab === 'active') return activeEmergencyStatuses.includes(e.status);
    if (activeTab === 'completed') return completedEmergencyStatuses.includes(e.status);
    if (activeTab === 'cancelled') return cancelledEmergencyStatuses.includes(e.status);
    return false;
  });

  for (const e of filteredEmergencies) {
    combinedList.push({
      id: `emergency-${e.id}`,
      type: 'emergency',
      createdAt: e.createdAt,
      emergency: e,
    });
  }

  for (const o of orders) {
    combinedList.push({
      id: `order-${o.id}`,
      type: 'service',
      createdAt: o.createdAt,
      order: o,
    });
  }

  // Sort by createdAt newest first
  combinedList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

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

  // Check if order has an assigned/accepted nurse
  const hasNurse = (order: OrderWithDetails) => {
    return order.nurseId && ['assigned', 'accepted', 'in_progress'].includes(order.status);
  };

  // Get display name for order header
  const getDisplayName = (order: OrderWithDetails) => {
    if (order.status === 'completed') {
      return order.nurseName || 'مكتمل';
    }
    if (order.status === 'cancelled' || order.status === 'rejected') {
      return order.nurseName || 'ملغي';
    }
    if (hasNurse(order)) {
      return order.nurseName || 'الممرض/ـة';
    }
    return 'بانتظار تعيين ممرض/ـة';
  };

  // Render emergency card
  const renderEmergencyCard = (emergency: EmergencyRequestItem, index: number) => {
    const TypeIcon = emergencyTypeIcons[emergency.type] || AlertTriangle;
    const typeLabel = emergencyTypeLabels[emergency.type] || 'أخرى';
    const typeColor = emergencyTypeColors[emergency.type] || 'bg-red-500';
    const statusLabel = emergencyStatusLabels[emergency.status] || emergency.status;
    const statusColor = emergencyStatusColors[emergency.status] || emergencyStatusColors.pending;
    const statusDotColor = emergencyStatusDotColors[emergency.status] || 'bg-gray-500';
    const isActive = activeEmergencyStatuses.includes(emergency.status);
    const isResolved = emergency.status === 'resolved';
    const outcomeLabel = emergency.outcome ? outcomeLabels[emergency.outcome] || emergency.outcome : null;

    return (
      <motion.div
        key={`emergency-${emergency.id}`}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -15 }}
        transition={{ delay: index * 0.05 }}
      >
        <GlassCard
          variant="beneficiary"
          className={`cursor-pointer hover:shadow-lg transition-all border-2 border-red-500/40 dark:border-red-500/30 overflow-hidden ${
            isActive ? 'ring-2 ring-red-500/20' : isResolved ? 'border-green-400/50 dark:border-green-700/30' : ''
          }`}
          onClick={() => router.push('/beneficiary/emergency')}
        >
          {/* Gradient accent bar at top */}
          <div className={`h-2 -mx-4 -mt-4 mb-4 ${
            isActive
              ? 'bg-gradient-to-l from-red-600 via-red-500 to-orange-500'
              : isResolved
              ? 'bg-gradient-to-l from-green-600 via-green-500 to-emerald-500'
              : 'bg-gradient-to-l from-gray-400 to-gray-300'
          }`} />

          <div className="flex items-start gap-4">
            {/* Emergency type icon with pulse */}
            <div className="relative">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-white shrink-0 shadow-lg ${typeColor}`}>
                <TypeIcon className="w-7 h-7" />
              </div>
              {/* Pulse indicator for active emergencies */}
              {isActive && (
                <span className="absolute -top-1 -right-1 flex h-5 w-5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-5 w-5 bg-red-500 border-2 border-white dark:border-gray-900" />
                </span>
              )}
              {/* Check icon for resolved */}
              {isResolved && (
                <span className="absolute -bottom-1 -left-1 w-6 h-6 rounded-full bg-green-500 border-2 border-white dark:border-gray-900 flex items-center justify-center">
                  <CheckCircle2 className="w-3.5 h-3.5 text-white" />
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-2.5">
              {/* Top row: Emergency type + badge + status */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-bold text-sm truncate text-red-700 dark:text-red-400">
                    {typeLabel}
                  </h3>
                  <Badge className="bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400 border-red-200 dark:border-red-800 text-[10px] px-1.5 py-0 h-5 shrink-0">
                    <AlertTriangle className="w-3 h-3 ml-0.5" />
                    طوارئ
                  </Badge>
                </div>
                {/* Status badge */}
                <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-bold shrink-0 ${statusColor}`}>
                  <span className={`w-2 h-2 rounded-full me-1.5 ${statusDotColor} ${isActive ? 'animate-pulse' : ''}`} />
                  {statusLabel}
                </span>
              </div>

              {/* Description */}
              {emergency.description && (
                <div className="p-2 rounded-lg bg-red-50/50 dark:bg-red-900/10 border border-red-100/50 dark:border-red-900/20">
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">{emergency.description}</p>
                </div>
              )}

              {/* Address */}
              {emergency.address && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3 shrink-0" />
                  <span className="line-clamp-1">{emergency.address}</span>
                </div>
              )}

              {/* Nurse name if assigned */}
              {emergency.nurseName && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/15 border border-green-100 dark:border-green-900/20">
                  <div className="w-7 h-7 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
                    <User className="w-3.5 h-3.5 text-green-600" />
                  </div>
                  <div>
                    <span className="text-xs font-semibold text-green-700 dark:text-green-400">{emergency.nurseName}</span>
                    <p className="text-[10px] text-green-600/70 dark:text-green-400/70">
                      {emergency.status === 'dispatched' ? 'سيتم قبول الحالة قريباً' :
                       emergency.status === 'accepted' ? 'في الطريق إليك' :
                       emergency.status === 'in_progress' ? 'في موقعك وبدأ العلاج' :
                       'تم التعيين'}
                    </p>
                  </div>
                </div>
              )}

              {/* Outcome for resolved */}
              {isResolved && outcomeLabel && (
                <div className="flex items-center gap-2 p-2.5 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/30">
                  <CheckCircle2 className="w-4 h-4 text-green-600 shrink-0" />
                  <span className="text-xs font-semibold text-green-700 dark:text-green-400">{outcomeLabel}</span>
                </div>
              )}

              {/* Resolved notes */}
              {isResolved && emergency.resolvedNotes && (
                <p className="text-[11px] text-muted-foreground line-clamp-2">{emergency.resolvedNotes}</p>
              )}

              {/* Time */}
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {formatDate(emergency.createdAt)}
              </div>

              {/* Fee and actions */}
              <div className="flex items-center justify-between pt-2 border-t border-border/50">
                <div className="flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-red-500" />
                  <span className="text-sm font-bold text-red-600 dark:text-red-400">
                    {(emergency.emergencyFee || 0).toLocaleString('ar-YE')} ر.ي
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Rate button for resolved emergencies */}
                  {isResolved && (
                    <Button
                      size="sm"
                      className="text-xs h-7 gap-1 bg-amber-500 hover:bg-amber-600 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        router.push('/beneficiary/emergency');
                      }}
                    >
                      <Star className="w-3 h-3" />
                      تقييم
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className={`text-xs h-7 gap-1 ${isActive ? 'border-red-300 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20' : 'border-green-300 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push('/beneficiary/emergency');
                    }}
                  >
                    <ShieldAlert className="w-3 h-3" />
                    التفاصيل
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </motion.div>
    );
  };

  // Render service order card
  const renderOrderCard = (order: OrderWithDetails, index: number) => {
    return (
      <motion.div
        key={`order-${order.id}`}
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
              <AvatarFallback className={`text-sm ${
                order.status === 'completed'
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : hasNurse(order)
                  ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                  : 'bg-beneficiary/10 text-beneficiary'
              }`}>
                {order.nurseName ? order.nurseName.slice(0, 2) : <User className="w-5 h-5" />}
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0 space-y-2">
              {/* Top row */}
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-sm truncate">
                  {getDisplayName(order)}
                </h3>
                {getStatusBadge(order.status)}
              </div>

              {/* Service name */}
              {order.serviceName && (
                <p className="text-xs text-muted-foreground">{order.serviceName}</p>
              )}

              {/* Nurse phone for assigned/accepted/in_progress */}
              {(hasNurse(order) || (order.status === 'completed' && order.nursePhone)) && order.nursePhone && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Phone className="w-3 h-3 text-green-600" />
                  <span className="text-green-700 dark:text-green-400 font-medium" dir="ltr">
                    {order.nursePhone}
                  </span>
                  {order.nurseIsOnline && (
                    <span className="text-[10px] bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 px-1.5 py-0.5 rounded-full">
                      متصل
                    </span>
                  )}
                </div>
              )}

              {/* Time */}
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                {formatDate(order.scheduledAt ?? order.createdAt)}
              </div>

              {/* Price and actions */}
              <div className="flex items-center justify-between pt-1">
                <Currency amount={order.pricing?.totalPrice ?? 0} className="text-sm text-beneficiary" />
                <div className="flex items-center gap-1.5">
                  {/* Action buttons for active orders with nurse */}
                  {hasNurse(order) && (
                    <>
                      {/* Call button */}
                      {order.nursePhone && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 gap-1 border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`tel:${order.nursePhone}`);
                          }}
                        >
                          <Phone className="w-3 h-3" />
                          اتصال
                        </Button>
                      )}
                      {/* Chat button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 gap-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push(`/beneficiary/chat/${order.nurseId}`);
                        }}
                      >
                        <MessageCircle className="w-3 h-3" />
                      </Button>
                      {/* Track button */}
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-xs h-7 gap-1 border-beneficiary text-beneficiary hover:bg-beneficiary/10"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (order.nurseId) router.push(`/beneficiary/tracking/${order.nurseId}`);
                        }}
                      >
                        <MapPin className="w-3 h-3" />
                        تتبع
                      </Button>
                    </>
                  )}
                  {/* Completed order actions */}
                  {order.status === 'completed' && (
                    <>
                      {order.nursePhone && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-xs h-7 gap-1 border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.open(`tel:${order.nursePhone}`);
                          }}
                        >
                          <Phone className="w-3 h-3" />
                        </Button>
                      )}
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
                    </>
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
    );
  };

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
      >
        <h1 className="text-2xl font-bold">طلباتي</h1>
        <p className="text-sm text-muted-foreground">متابعة وإدارة طلبات الخدمة والطوارئ</p>
      </motion.div>

      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabKey)}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="active" className="gap-1">
            النشطة
            {combinedCounts.active > 0 && (
              <Badge variant="destructive" className="h-5 min-w-[20px] p-0 text-[10px] flex items-center justify-center">
                {combinedCounts.active}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1">
            المكتملة
            {combinedCounts.completed > 0 && (
              <Badge variant="secondary" className="h-5 min-w-[20px] p-0 text-[10px] flex items-center justify-center">
                {combinedCounts.completed}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="cancelled" className="gap-1">
            الملغاة
            {combinedCounts.cancelled > 0 && (
              <Badge variant="outline" className="h-5 min-w-[20px] p-0 text-[10px] flex items-center justify-center">
                {combinedCounts.cancelled}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        {(['active', 'completed', 'cancelled'] as TabKey[]).map((tab) => (
          <TabsContent key={tab} value={tab} className="mt-4">
            {isLoading ? (
              <ListSkeleton items={4} />
            ) : combinedList.length === 0 ? (
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
                  {combinedList.map((item, index) => {
                    if (item.type === 'emergency' && item.emergency) {
                      return renderEmergencyCard(item.emergency, index);
                    }
                    if (item.type === 'service' && item.order) {
                      return renderOrderCard(item.order, index);
                    }
                    return null;
                  })}
                </AnimatePresence>
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
