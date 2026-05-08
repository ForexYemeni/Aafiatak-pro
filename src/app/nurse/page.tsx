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
  PlayCircle,
  Phone,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { useAuthStore } from '@/lib/stores/auth-store';
import { useOrderUpdates } from '@/hooks/use-socket';
import { formatDateOnly, formatTimeOnly, toArabicNum } from '@/components/common/date-formatter';
import { toast } from 'sonner';

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

type TabType = 'new' | 'active' | 'completed';

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

export default function NurseTasksPage() {
  const [activeTab, setActiveTab] = useState<TabType>('new');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [counts, setCounts] = useState({ new: 0, active: 0, completed: 0 });
  const authFetch = useAuthFetch();
  const user = useAuthStore((s) => s.user);
  const orderUpdates = useOrderUpdates();

  const fetchCounts = useCallback(async () => {
    try {
      const res = await authFetch('/api/nurse/assignments?counts=true');
      const data = await res.json();
      if (data.success && data.data) {
        setCounts(data.data as { new: number; active: number; completed: number });
      }
    } catch {
      // silently handle
    }
  }, [authFetch]);

  const fetchAssignments = useCallback(async () => {
    try {
      const statusMap: Record<TabType, string> = {
        new: 'pending',
        active: 'active',
        completed: 'completed',
      };
      const res = await authFetch(`/api/nurse/assignments?status=${statusMap[activeTab]}&limit=50`);
      const data = await res.json();
      if (data.success && data.data) {
        setAssignments(data.data as Assignment[]);
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [authFetch, activeTab]);

  useEffect(() => {
    setIsLoading(true);
    fetchAssignments();
    fetchCounts();
  }, [fetchAssignments, fetchCounts]);

  // Refresh on real-time order updates
  useEffect(() => {
    if (orderUpdates.latestOrderUpdate) {
      fetchAssignments();
      fetchCounts();
    }
  }, [orderUpdates.latestOrderUpdate, fetchAssignments, fetchCounts]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await fetchAssignments();
  };

  const handleAccept = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    try {
      const res = await authFetch(`/api/nurse/assignments/${assignmentId}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'accept' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('تم قبول الطلب بنجاح');
        setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      } else {
        toast.error(data.message || 'فشل قبول الطلب');
      }
    } catch {
      toast.error('حدث خطأ أثناء قبول الطلب');
    } finally {
      setActionLoading(null);
    }
  };

  const handleReject = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    try {
      const res = await authFetch(`/api/nurse/assignments/${assignmentId}`, {
        method: 'POST',
        body: JSON.stringify({ action: 'reject' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('تم رفض الطلب');
        setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      } else {
        toast.error(data.message || 'فشل رفض الطلب');
      }
    } catch {
      toast.error('حدث خطأ أثناء رفض الطلب');
    } finally {
      setActionLoading(null);
    }
  };

  const handleStartService = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    try {
      const res = await authFetch(`/api/nurse/orders/${assignmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'start' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('تم بدء تنفيذ الخدمة');
        // Update the assignment status locally
        setAssignments((prev) =>
          prev.map((a) => (a.id === assignmentId ? { ...a, status: 'in_progress' } : a))
        );
      } else {
        toast.error(data.message || 'فشل بدء الخدمة');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCompleteService = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    try {
      const res = await authFetch(`/api/nurse/orders/${assignmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'complete' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('تم إكمال الخدمة بنجاح');
        setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      } else {
        toast.error(data.message || 'فشل إكمال الخدمة');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setActionLoading(null);
    }
  };

  const getWhatsAppUrl = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const withCode = cleanPhone.startsWith('0') ? '967' + cleanPhone.substring(1) : cleanPhone.startsWith('967') ? cleanPhone : '967' + cleanPhone;
    return `https://wa.me/${withCode}`;
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title={`مرحباً، ${user?.name?.split(' ')[0] ?? 'الممرض/ـة'}`}
        description="إدارة المهام والطلبات الموكلة إليك"
      />

      {/* Quick Stats */}
      <div className="grid grid-cols-3 gap-3">
        <GlassCard variant="nurse" className="p-3 text-center">
          <p className="text-2xl font-bold text-nurse">{toArabicNum(counts.new)}</p>
          <p className="text-xs text-muted-foreground">جديدة</p>
        </GlassCard>
        <GlassCard variant="nurse" className="p-3 text-center">
          <p className="text-2xl font-bold text-sky-600">{toArabicNum(counts.active)}</p>
          <p className="text-xs text-muted-foreground">نشطة</p>
        </GlassCard>
        <GlassCard variant="nurse" className="p-3 text-center">
          <p className="text-2xl font-bold text-green-600">{toArabicNum(counts.completed)}</p>
          <p className="text-xs text-muted-foreground">مكتملة</p>
        </GlassCard>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as TabType)}>
        <TabsList className="w-full grid grid-cols-3">
          <TabsTrigger value="new" className="gap-1">
            الجديدة
            {counts.new > 0 && (
              <Badge variant="destructive" className="h-5 min-w-[20px] p-0 text-[10px] flex items-center justify-center">
                {toArabicNum(counts.new)}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="active" className="gap-1">
            النشطة
            {counts.active > 0 && (
              <Badge className="h-5 min-w-[20px] p-0 text-[10px] flex items-center justify-center bg-sky-600">
                {toArabicNum(counts.active)}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1">
            المكتملة
            {counts.completed > 0 && (
              <Badge variant="secondary" className="h-5 min-w-[20px] p-0 text-[10px] flex items-center justify-center">
                {toArabicNum(counts.completed)}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
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
                title={
                  activeTab === 'new' ? 'لا توجد مهام جديدة' :
                  activeTab === 'active' ? 'لا توجد مهام نشطة' :
                  'لا توجد مهام مكتملة'
                }
                description={
                  activeTab === 'new' ? 'ستظهر المهام الجديدة هنا عند تعيينها لك' :
                  activeTab === 'active' ? 'قم بقبول المهام الجديدة لبدء العمل' :
                  'ستظهر المهام المكتملة هنا بعد إنهائها'
                }
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
                              {assignment.request.beneficiary.phone && (
                                <a href={`tel:${assignment.request.beneficiary.phone}`} className="text-blue-500">
                                  <Phone className="w-3 h-3" />
                                </a>
                              )}
                            </div>
                          )}
                          {assignment.request?.beneficiaryAddress && (
                            <div className="flex items-center gap-2 text-sm text-muted-foreground">
                              <MapPin className="w-4 h-4 shrink-0" />
                              <span className="line-clamp-1">{assignment.request.beneficiaryAddress}</span>
                            </div>
                          )}
                          {assignment.request?.beneficiaryLat && assignment.request?.beneficiaryLng && (
                            <a
                              href={`https://www.google.com/maps?q=${assignment.request.beneficiaryLat},${assignment.request.beneficiaryLng}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="flex items-center gap-1.5 text-xs text-blue-600"
                            >
                              <Navigation className="w-3 h-3" />
                              عرض الموقع على الخريطة
                            </a>
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

                        {/* Price Row */}
                        <div className="flex items-center justify-between pt-3 border-t border-border">
                          <div className="flex items-center gap-1.5">
                            <DollarSign className="w-4 h-4 text-green-600" />
                            <span className="text-xs text-muted-foreground">أرباحك:</span>
                            <Currency amount={assignment.request?.nursePayout || 0} className="text-green-600" />
                          </div>

                          {/* Action Buttons */}
                          {activeTab === 'new' && (
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
                          )}

                          {activeTab === 'active' && (
                            <div className="flex items-center gap-2">
                              {/* Navigate to beneficiary */}
                              {assignment.request?.beneficiaryLat && assignment.request?.beneficiaryLng && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8"
                                  onClick={() => {
                                    window.open(
                                      `https://www.google.com/maps/dir/?api=1&destination=${assignment.request!.beneficiaryLat},${assignment.request!.beneficiaryLng}`,
                                      '_blank'
                                    );
                                  }}
                                >
                                  <Navigation className="w-4 h-4 me-1" />
                                  اتجاه
                                </Button>
                              )}

                              {/* Start service button (status: accepted) */}
                              {assignment.status === 'accepted' && (
                                <Button
                                  size="sm"
                                  className="bg-sky-600 hover:bg-sky-700 h-8"
                                  disabled={actionLoading === assignment.id}
                                  onClick={() => handleStartService(assignment.id)}
                                >
                                  {actionLoading === assignment.id ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <PlayCircle className="w-4 h-4 me-1" />
                                  )}
                                  بدء التنفيذ
                                </Button>
                              )}

                              {/* Complete service button (status: in_progress) */}
                              {assignment.status === 'in_progress' && (
                                <Button
                                  size="sm"
                                  className="bg-green-600 hover:bg-green-700 h-8"
                                  disabled={actionLoading === assignment.id}
                                  onClick={() => handleCompleteService(assignment.id)}
                                >
                                  {actionLoading === assignment.id ? (
                                    <RefreshCw className="w-4 h-4 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-4 h-4 me-1" />
                                  )}
                                  إكمال
                                </Button>
                              )}
                            </div>
                          )}

                          {activeTab === 'completed' && (
                            <Badge variant="secondary" className="text-xs">
                              <CheckCircle2 className="w-3 h-3 me-1" />
                              مكتمل
                            </Badge>
                          )}
                        </div>
                      </GlassCard>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </PullToRefresh>
        </TabsContent>
      </Tabs>
    </div>
  );
}
