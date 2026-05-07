'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  Navigation,
  DollarSign,
  RefreshCw,
  AlertTriangle,
  Syringe,
  HeartPulse,
  Baby,
  UserRound,
  Activity,
  Filter,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/common/glass-card';
import { Currency } from '@/components/common/currency';
import { BadgeStatus } from '@/components/common/badge-status';
import { EmptyState } from '@/components/common/empty-state';
import { PullToRefresh } from '@/components/common/pull-to-refresh';
import { CardSkeleton } from '@/components/common/loading-skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthFetch } from '@/hooks/use-auth';
import { useOrderUpdates } from '@/hooks/use-socket';
import { formatDateOnly, formatTimeOnly, toArabicNum } from '@/components/common/date-formatter';

// ---- Types ----

interface ServiceInfo {
  id: string;
  nameAr: string;
  category: string;
  basePrice: number;
  duration: number;
}

interface BeneficiaryInfo {
  id: string;
  name: string;
  phone: string;
  address?: string;
}

interface AssignmentRequest {
  id: string;
  status: string;
  scheduledAt: string | null;
  beneficiaryAddress: string | null;
  beneficiaryLat: number | null;
  beneficiaryLng: number | null;
  basePrice: number;
  nursePayout: number;
  totalPrice: number;
  isEmergency: boolean;
  service: ServiceInfo;
  beneficiary: BeneficiaryInfo;
}

interface Assignment {
  id: string;
  requestId: string;
  nurseId: string;
  status: string;
  assignedAt: string;
  respondedAt: string | null;
  estimatedArrivalMinutes: number | null;
  request: AssignmentRequest;
}

// ---- Service icon helper ----

function getServiceIcon(category: string) {
  switch (category) {
    case 'nursing': return <Syringe className="w-5 h-5" />;
    case 'elderly_care': return <UserRound className="w-5 h-5" />;
    case 'pediatric': return <Baby className="w-5 h-5" />;
    case 'physiotherapy': return <Activity className="w-5 h-5" />;
    case 'emergency': return <AlertTriangle className="w-5 h-5" />;
    case 'medical': return <HeartPulse className="w-5 h-5" />;
    default: return <ClipboardList className="w-5 h-5" />;
  }
}

// ---- Stagger animation variants ----

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
};

// ---- Component ----

export default function NurseAvailableRequestsPage() {
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const authFetch = useAuthFetch();
  const orderUpdates = useOrderUpdates();

  const fetchAssignments = useCallback(async () => {
    try {
      const res = await authFetch('/api/nurse/assignments?status=pending&limit=50');
      const data = await res.json();
      if (data.success && data.data) {
        setAssignments(Array.isArray(data.data) ? data.data : []);
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchAssignments();
  }, [fetchAssignments]);

  // Refresh on real-time order updates
  useEffect(() => {
    if (orderUpdates.latestOrderUpdate) {
      fetchAssignments();
    }
  }, [orderUpdates.latestOrderUpdate, fetchAssignments]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAssignments();
  };

  const handleAccept = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    try {
      const res = await authFetch(`/api/nurse/assignments/${assignmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'accepted' }),
      });
      const data = await res.json();
      if (data.success) {
        setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      }
    } catch {
      // silently handle
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    try {
      const res = await authFetch(`/api/nurse/assignments/${assignmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'rejected', rejectedReason: 'تم الرفض من الممرض' }),
      });
      const data = await res.json();
      if (data.success) {
        setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      }
    } catch {
      // silently handle
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="الطلبات المتاحة"
        description="الطلبات الجديدة المتاحة لك للاستجابة"
        action={
          assignments.length > 0
            ? {
                label: toArabicNum(assignments.length),
                onClick: () => {},
                icon: <Filter className="w-4 h-4" />,
              }
            : undefined
        }
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-2 gap-3">
        <GlassCard variant="nurse" className="p-3 text-center">
          <p className="text-2xl font-bold text-nurse">{toArabicNum(assignments.length)}</p>
          <p className="text-xs text-muted-foreground">طلبات جديدة</p>
        </GlassCard>
        <GlassCard variant="nurse" className="p-3 text-center">
          <p className="text-2xl font-bold text-red-500">
            {toArabicNum(assignments.filter(a => a.request?.isEmergency).length)}
          </p>
          <p className="text-xs text-muted-foreground">طلبات طوارئ</p>
        </GlassCard>
      </div>

      <PullToRefresh onRefresh={handleRefresh}>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : assignments.length === 0 ? (
          <EmptyState
            icon={<ClipboardList className="w-10 h-10 text-muted-foreground" />}
            title="لا توجد طلبات متاحة"
            description="ستظهر الطلبات الجديدة هنا عند تعيينها لك من قبل النظام"
          />
        ) : (
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            className="space-y-3"
          >
            <AnimatePresence mode="popLayout">
              {assignments.map((assignment) => (
                <motion.div
                  key={assignment.id}
                  variants={itemVariants}
                  exit={{ opacity: 0, x: -100, transition: { duration: 0.2 } }}
                  layout
                >
                  <GlassCard variant="nurse" className="p-4">
                    {/* Service & Status Row */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-nurse/10 text-nurse flex items-center justify-center">
                          {assignment.request?.service
                            ? getServiceIcon(assignment.request.service.category)
                            : <ClipboardList className="w-5 h-5" />}
                        </div>
                        <div>
                          <h3 className="font-semibold text-sm">
                            {assignment.request?.service?.nameAr || 'طلب خدمة'}
                          </h3>
                          <p className="text-xs text-muted-foreground">
                            {assignment.request?.service?.duration
                              ? `${toArabicNum(assignment.request.service.duration)} دقيقة`
                              : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {assignment.request?.isEmergency && (
                          <Badge variant="destructive" className="text-[10px] gap-1">
                            <AlertTriangle className="w-3 h-3" />
                            طوارئ
                          </Badge>
                        )}
                        <BadgeStatus status={assignment.status} />
                      </div>
                    </div>

                    {/* Beneficiary Info */}
                    <div className="space-y-2 mb-3">
                      {assignment.request?.beneficiary && (
                        <div className="flex items-center gap-2 text-sm">
                          <UserRound className="w-4 h-4 text-muted-foreground" />
                          <span>{assignment.request.beneficiary.name}</span>
                        </div>
                      )}
                      {assignment.request?.beneficiaryAddress && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <MapPin className="w-4 h-4 shrink-0" />
                          <span className="line-clamp-1">{assignment.request.beneficiaryAddress}</span>
                        </div>
                      )}
                    </div>

                    {/* Time Row */}
                    <div className="flex items-center gap-4 mb-3 text-sm">
                      {assignment.request?.scheduledAt && (
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Clock className="w-4 h-4" />
                          <span>{formatDateOnly(new Date(assignment.request.scheduledAt))}</span>
                          <span>•</span>
                          <span>{formatTimeOnly(new Date(assignment.request.scheduledAt))}</span>
                        </div>
                      )}
                    </div>

                    {/* Price & Actions Row */}
                    <div className="flex items-center justify-between pt-3 border-t border-border">
                      <div className="flex items-center gap-1.5">
                        <DollarSign className="w-4 h-4 text-green-600" />
                        <span className="text-xs text-muted-foreground">أرباحك:</span>
                        <Currency amount={assignment.request?.nursePayout || 0} className="text-green-600" />
                      </div>

                      <div className="flex items-center gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-destructive border-destructive/30 hover:bg-destructive/10 h-8"
                          disabled={actionLoading === assignment.id}
                          onClick={() => handleReject(assignment.id)}
                        >
                          <XCircle className="w-4 h-4 me-1" />
                          رفض
                        </Button>
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700 h-8"
                          disabled={actionLoading === assignment.id}
                          onClick={() => handleAccept(assignment.id)}
                        >
                          {actionLoading === assignment.id ? (
                            <RefreshCw className="w-4 h-4 animate-spin" />
                          ) : (
                            <CheckCircle2 className="w-4 h-4 me-1" />
                          )}
                          قبول
                        </Button>
                      </div>
                    </div>
                  </GlassCard>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </PullToRefresh>
    </div>
  );
}
