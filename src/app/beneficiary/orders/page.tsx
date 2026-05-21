'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
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
  Sparkles,
  PackageCheck,
  PackageX,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { GlassCard } from '@/components/common/glass-card';
import { Currency } from '@/components/common/currency';
import { toArabicNumerals } from '@/components/common/currency';
import { BadgeStatus } from '@/components/common/badge-status';
import { EmptyState } from '@/components/common/empty-state';
import { ListSkeleton } from '@/components/common/loading-skeleton';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useAuthFetch } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { useToast } from '@/hooks/use-toast';
import type { ApiResponse, ServiceRequest, PaginationMeta, ServiceRequestStatus } from '@/types';

interface OrderWithDetails extends ServiceRequest {
  serviceName?: string;
  nurseName?: string;
  nurseAvatar?: string;
  nursePhone?: string;
  nurseRating?: number;
  nurseIsOnline?: boolean;
  isUnifiedOrder?: boolean;
  services?: Array<{
    serviceId: string;
    nameAr: string;
    basePrice: number;
    quantity: number;
    duration: number;
  }>;
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
  medical: 'from-red-500 to-rose-600',
  injury: 'from-orange-500 to-amber-600',
  breathing: 'from-cyan-500 to-blue-600',
  cardiac: 'from-red-600 to-red-800',
  fall: 'from-yellow-500 to-orange-600',
  other: 'from-gray-500 to-gray-700',
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
  createdAt: string | Date;
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

// --- Animation variants ---
const containerVariants = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: { staggerChildren: 0.06, delayChildren: 0.1 },
  },
} as const;

const cardVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.97 },
  show: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.4, ease: 'easeOut' as const },
  },
  exit: {
    opacity: 0,
    y: -10,
    scale: 0.97,
    transition: { duration: 0.2, ease: 'easeOut' as const },
  },
} as const;

const tabContentVariants = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: 'easeOut' as const } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15, ease: 'easeOut' as const } },
} as const;

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

  const tabRefs = useRef<Record<TabKey, HTMLButtonElement | null>>({
    active: null,
    completed: null,
    cancelled: null,
  });

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

  useRealtimeRefresh({
    entities: ['order'],
    onRefresh: () => {
      void fetchOrders();
      void fetchCounts();
      void fetchEmergencies();
    },
    fallbackInterval: 30000,
  });

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

  // --- Tab config ---
  const tabs: { key: TabKey; label: string; icon: React.ElementType; emptyIcon: React.ElementType; emptyTitle: string; emptyDesc: string }[] = [
    {
      key: 'active',
      label: 'النشطة',
      icon: Sparkles,
      emptyIcon: ClipboardList,
      emptyTitle: 'لا توجد طلبات نشطة',
      emptyDesc: 'يمكنك طلب خدمة جديدة من الصفحة الرئيسية',
    },
    {
      key: 'completed',
      label: 'المكتملة',
      icon: PackageCheck,
      emptyIcon: PackageCheck,
      emptyTitle: 'لا توجد طلبات مكتملة',
      emptyDesc: 'ستظهر هنا الطلبات المنتهية',
    },
    {
      key: 'cancelled',
      label: 'الملغاة',
      icon: PackageX,
      emptyIcon: PackageX,
      emptyTitle: 'لا توجد طلبات ملغاة',
      emptyDesc: 'ستظهر هنا الطلبات الملغاة',
    },
  ];

  // Render emergency card
  const renderEmergencyCard = (emergency: EmergencyRequestItem, index: number) => {
    const TypeIcon = emergencyTypeIcons[emergency.type] || AlertTriangle;
    const typeLabel = emergencyTypeLabels[emergency.type] || 'أخرى';
    const typeGradient = emergencyTypeColors[emergency.type] || 'from-red-500 to-rose-600';
    const statusLabel = emergencyStatusLabels[emergency.status] || emergency.status;
    const statusColor = emergencyStatusColors[emergency.status] || emergencyStatusColors.pending;
    const statusDotColor = emergencyStatusDotColors[emergency.status] || 'bg-gray-500';
    const isActive = activeEmergencyStatuses.includes(emergency.status);
    const isResolved = emergency.status === 'resolved';
    const outcomeLabel = emergency.outcome ? outcomeLabels[emergency.outcome] || emergency.outcome : null;

    return (
      <motion.div
        key={`emergency-${emergency.id}`}
        variants={cardVariants}
        layout
      >
        <GlassCard
          variant="beneficiary"
          className={`cursor-pointer hover:shadow-lg transition-all overflow-hidden group relative ${
            isActive ? 'ring-1 ring-red-500/30' : isResolved ? '' : ''
          }`}
          onClick={() => router.push('/beneficiary/emergency')}
        >
          {/* Animated gradient accent bar at top */}
          <div className={`h-1.5 -mx-5 -mt-5 mb-4 bg-gradient-to-l ${typeGradient} ${
            isActive ? 'animate-pulse' : ''
          }`} />

          {/* Pulse indicator for active emergencies - top-right */}
          {isActive && (
            <div className="absolute top-2 left-2">
              <span className="flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500" />
              </span>
            </div>
          )}

          <div className="flex items-start gap-3.5">
            {/* Emergency type icon */}
            <div className="relative shrink-0">
              <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${typeGradient} flex items-center justify-center text-white shadow-lg shadow-red-500/20`}>
                <TypeIcon className="w-6 h-6" />
              </div>
              {isResolved && (
                <span className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-green-500 border-2 border-white dark:border-gray-900 flex items-center justify-center">
                  <CheckCircle2 className="w-3 h-3 text-white" />
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-2.5">
              {/* Top row: type + emergency badge + status */}
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="font-bold text-sm truncate text-red-700 dark:text-red-400">
                    {typeLabel}
                  </h3>
                  <Badge className="bg-red-500/10 text-red-600 dark:bg-red-900/30 dark:text-red-400 border-red-500/20 dark:border-red-800/40 text-[10px] px-1.5 py-0 h-5 shrink-0">
                    <AlertTriangle className="w-3 h-3 ml-0.5" />
                    طوارئ
                  </Badge>
                </div>
                <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-bold shrink-0 ${statusColor}`}>
                  <span className={`w-1.5 h-1.5 rounded-full me-1 ${statusDotColor} ${isActive ? 'animate-pulse' : ''}`} />
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
                  <MapPin className="w-3 h-3 shrink-0 text-red-400" />
                  <span className="line-clamp-1">{emergency.address}</span>
                </div>
              )}

              {/* Nurse name if assigned */}
              {emergency.nurseName && (
                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/15 border border-green-100 dark:border-green-900/20">
                  <div className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/40 flex items-center justify-center shrink-0">
                    <User className="w-3 h-3 text-green-600" />
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
                <div className="flex items-center gap-2 p-2 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/30">
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                  <span className="text-xs font-semibold text-green-700 dark:text-green-400">{outcomeLabel}</span>
                </div>
              )}

              {/* Resolved notes */}
              {isResolved && emergency.resolvedNotes && (
                <p className="text-[11px] text-muted-foreground line-clamp-2">{emergency.resolvedNotes}</p>
              )}

              {/* Time + Fee + Actions row */}
              <div className="flex items-center justify-between pt-2 border-t border-border/40">
                <div className="flex items-center gap-3">
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{formatDate(emergency.createdAt)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex items-center gap-1 text-sm font-bold text-red-600 dark:text-red-400">
                    <Wallet className="w-3.5 h-3.5" />
                    {toArabicNumerals(emergency.emergencyFee || 0)} ر.ي
                  </div>
                  {isResolved && (
                    <Button
                      size="sm"
                      className="text-[11px] h-7 gap-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
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
                    className="text-[11px] h-7 gap-1 rounded-lg"
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
    const nurseActive = hasNurse(order);
    const isCompleted = order.status === 'completed';
    const isPending = order.status === 'pending';

    // Status dot timeline colors
    const statusDotMap: Record<string, string> = {
      pending: 'bg-amber-500',
      assigned: 'bg-violet-500',
      accepted: 'bg-emerald-500',
      in_progress: 'bg-sky-500',
      completed: 'bg-green-500',
      cancelled: 'bg-gray-400',
      rejected: 'bg-red-400',
      awaiting_payment: 'bg-orange-500',
    };

    return (
      <motion.div
        key={`order-${order.id}`}
        variants={cardVariants}
        layout
      >
        <GlassCard
          variant="beneficiary"
          className="cursor-pointer hover:shadow-md transition-all group"
          onClick={() => router.push(`/beneficiary/orders/${order.id}`)}
        >
          {/* Status dot timeline bar at top */}
          <div className="flex items-center gap-1 -mx-5 -mt-5 mb-3 px-5 py-2.5 bg-muted/30 dark:bg-muted/10 rounded-t-2xl">
            {['pending', 'assigned', 'accepted', 'in_progress', 'completed'].map((step, i) => {
              const stepIndex = ['pending', 'assigned', 'accepted', 'in_progress', 'completed'].indexOf(order.status);
              const isReached = i <= stepIndex && !['cancelled', 'rejected'].includes(order.status);
              return (
                <div key={step} className="flex-1 flex items-center gap-1">
                  <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${
                    isReached ? statusDotMap[order.status] || 'bg-beneficiary' : 'bg-muted-foreground/15'
                  }`} />
                </div>
              );
            })}
          </div>

          <div className="flex items-start gap-3.5">
            {/* Nurse Avatar */}
            <div className="relative shrink-0">
              <Avatar className="w-11 h-11 ring-2 ring-background shadow-md">
                <AvatarFallback className={`text-sm ${
                  isCompleted
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : nurseActive
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                    : 'bg-beneficiary/10 text-beneficiary'
                }`}>
                  {order.nurseName ? order.nurseName.slice(0, 2) : <User className="w-5 h-5" />}
                </AvatarFallback>
              </Avatar>
              {/* Online indicator */}
              {nurseActive && order.nurseIsOnline && (
                <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-green-500 border-2 border-white dark:border-gray-900" />
              )}
            </div>

            <div className="flex-1 min-w-0 space-y-2">
              {/* Top row: name + status */}
              <div className="flex items-center justify-between gap-2">
                <h3 className="font-semibold text-sm truncate">
                  {getDisplayName(order)}
                </h3>
                {getStatusBadge(order.status)}
              </div>

              {/* Service name */}
              {order.serviceName && (
                <p className="text-xs text-muted-foreground">
                  {order.isUnifiedOrder && order.services && order.services.length > 1 ? (
                    <span className="flex items-center gap-1">
                      <PackageCheck className="w-3 h-3 text-beneficiary shrink-0" />
                      <span>{order.serviceName}</span>
                      <span className="text-[10px] bg-beneficiary/10 text-beneficiary px-1 py-0.5 rounded-full shrink-0">
                        {toArabicNumerals(order.services.length)} خدمات
                      </span>
                    </span>
                  ) : (
                    order.serviceName
                  )}
                </p>
              )}

              {/* Nurse phone for assigned/accepted/in_progress */}
              {(nurseActive || (isCompleted && order.nursePhone)) && order.nursePhone && (
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

              {/* Time + Price row */}
              <div className="flex items-center justify-between pt-1.5 border-t border-border/30">
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />
                  {formatDate(order.scheduledAt ?? order.createdAt)}
                </div>
                <Currency amount={order.pricing?.totalPrice ?? 0} className="text-sm text-beneficiary font-bold" />
              </div>

              {/* Action buttons */}
              {nurseActive && (
                <div className="flex items-center gap-1.5 pt-1">
                  {order.nursePhone && (
                    <Button
                      size="sm"
                      className="text-[11px] h-7 gap-1 bg-green-600 hover:bg-green-700 text-white rounded-lg"
                      onClick={(e) => {
                        e.stopPropagation();
                        window.open(`tel:${order.nursePhone}`);
                      }}
                    >
                      <Phone className="w-3 h-3" />
                      اتصال
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[11px] h-7 gap-1 rounded-lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/beneficiary/chat/${order.nurseId}`);
                    }}
                  >
                    <MessageCircle className="w-3 h-3" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[11px] h-7 gap-1 border-beneficiary text-beneficiary hover:bg-beneficiary/10 rounded-lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (order.nurseId) router.push(`/beneficiary/tracking/${order.nurseId}`);
                    }}
                  >
                    <MapPin className="w-3 h-3" />
                    تتبع
                  </Button>
                </div>
              )}

              {/* Completed order actions */}
              {isCompleted && (
                <div className="flex items-center gap-1.5 pt-1">
                  {order.nursePhone && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-[11px] h-7 gap-1 border-green-600 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20 rounded-lg"
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
                    className="text-[11px] h-7 gap-1 bg-amber-500 hover:bg-amber-600 text-white rounded-lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      router.push(`/beneficiary/orders/${order.id}`);
                    }}
                  >
                    <Star className="w-3 h-3" />
                    تقييم
                  </Button>
                </div>
              )}

              {/* Cancel button for pending */}
              {isPending && (
                <div className="flex items-center gap-1.5 pt-1">
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-[11px] h-7 gap-1 text-destructive border-destructive/50 hover:bg-destructive/10 rounded-lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      cancelOrder(order.id);
                    }}
                  >
                    <XCircle className="w-3 h-3" />
                    إلغاء
                  </Button>
                </div>
              )}
            </div>
          </div>
        </GlassCard>
      </motion.div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' as const }}
      >
        <h1 className="text-2xl font-bold">طلباتي</h1>
        <p className="text-sm text-muted-foreground mt-1">متابعة وإدارة طلبات الخدمة والطوارئ</p>
      </motion.div>

      {/* Modern Tab Design with Animated Underline */}
      <div className="relative">
        <div className="flex bg-muted/40 dark:bg-muted/20 rounded-xl p-1 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.key;
            const count = combinedCounts[tab.key];
            return (
              <button
                key={tab.key}
                ref={(el) => { tabRefs.current[tab.key] = el; }}
                onClick={() => setActiveTab(tab.key)}
                className={`relative flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-lg text-sm font-medium transition-all duration-300 ${
                  isActive
                    ? 'text-beneficiary-foreground shadow-md'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {isActive && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-beneficiary rounded-lg"
                    transition={{ type: 'spring', bounce: 0.2, duration: 0.5 }}
                  />
                )}
                <span className="relative z-10 flex items-center gap-1.5">
                  <Icon className="w-4 h-4" />
                  <span>{tab.label}</span>
                  {count > 0 && (
                    <span className={`inline-flex items-center justify-center h-5 min-w-[20px] px-1 rounded-full text-[10px] font-bold ${
                      isActive
                        ? 'bg-white/25 text-white'
                        : tab.key === 'active'
                        ? 'bg-red-500 text-white'
                        : 'bg-muted-foreground/20 text-muted-foreground'
                    }`}>
                      {toArabicNumerals(count)}
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          variants={tabContentVariants}
          initial="hidden"
          animate="show"
          exit="exit"
        >
          {isLoading ? (
            <ListSkeleton items={4} />
          ) : combinedList.length === 0 ? (
            <EmptyState
              icon={(() => {
                const EmptyIcon = tabs.find(t => t.key === activeTab)?.emptyIcon || ClipboardList;
                return <EmptyIcon className="w-10 h-10 text-muted-foreground" />;
              })()}
              title={tabs.find(t => t.key === activeTab)?.emptyTitle || 'لا توجد طلبات'}
              description={tabs.find(t => t.key === activeTab)?.emptyDesc}
              variant="beneficiary"
              action={
                activeTab === 'active'
                  ? { label: 'طلب خدمة', onClick: () => router.push('/beneficiary') }
                  : undefined
              }
            />
          ) : (
            <motion.div
              className="space-y-3 max-h-[calc(100vh-280px)] overflow-y-auto custom-scrollbar"
              variants={containerVariants}
              initial="hidden"
              animate="show"
            >
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
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
