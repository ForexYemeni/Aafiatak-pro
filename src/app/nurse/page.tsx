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
  Shield,
  ChevronLeft,
  ShieldCheck,
  ShieldX,
  Hourglass,
} from 'lucide-react';
import Link from 'next/link';
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

// ---- Verification Status Config ----

const verificationConfig: Record<string, {
  icon: React.ElementType;
  title: string;
  description: string;
  iconBg: string;
  iconColor: string;
  borderColor: string;
  bgGradient: string;
}> = {
  unverified: {
    icon: Shield,
    title: 'حسابك غير موثق',
    description: 'لن تصلك أي طلبات حتى يتم توثيق حسابك. اضغط هنا لبدء التوثيق',
    iconBg: 'bg-amber-100 dark:bg-amber-900/30',
    iconColor: 'text-amber-600 dark:text-amber-400',
    borderColor: 'border-amber-200 dark:border-amber-800/50',
    bgGradient: 'from-amber-50/80 to-orange-50/50 dark:from-amber-900/10 dark:to-orange-900/5',
  },
  pending: {
    icon: Hourglass,
    title: 'حسابك قيد المراجعة',
    description: 'تم رفع المستندات وجاري المراجعة من قبل الإدارة. سنقوم بإشعارك فوراً',
    iconBg: 'bg-sky-100 dark:bg-sky-900/30',
    iconColor: 'text-sky-600 dark:text-sky-400',
    borderColor: 'border-sky-200 dark:border-sky-800/50',
    bgGradient: 'from-sky-50/80 to-blue-50/50 dark:from-sky-900/10 dark:to-blue-900/5',
  },
  rejected: {
    icon: ShieldX,
    title: 'تم رفض التوثيق',
    description: 'اضغط هنا لرفع المستندات مرة أخرى',
    iconBg: 'bg-red-100 dark:bg-red-900/30',
    iconColor: 'text-red-600 dark:text-red-400',
    borderColor: 'border-red-200 dark:border-red-800/50',
    bgGradient: 'from-red-50/80 to-rose-50/50 dark:from-red-900/10 dark:to-rose-900/5',
  },
};

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
  const [verificationStatus, setVerificationStatus] = useState<string | null>(null);
  const [profileCompleteness, setProfileCompleteness] = useState(0);
  const authFetch = useAuthFetch();
  const user = useAuthStore((s) => s.user);
  const orderUpdates = useOrderUpdates();

  // Fetch nurse verification status from profile API
  const fetchVerificationStatus = useCallback(async () => {
    try {
      const res = await authFetch('/api/nurse/profile');
      const data = await res.json();
      if (data.success && data.data) {
        const status = data.data.verificationStatus || 'unverified';
        setVerificationStatus(status);
        
        // Calculate profile completeness
        const fields = [
          !!data.data.name,
          !!data.data.phone,
          !!data.data.specialization?.length,
          !!data.data.governorate,
          !!data.data.address,
          !!data.data.identityDocumentUrl,
          !!data.data.licenseDocumentUrl,
          !!data.data.licenseNumber,
        ];
        const filled = fields.filter(Boolean).length;
        setProfileCompleteness(Math.round((filled / fields.length) * 100));
      }
    } catch {
      // If profile fetch fails, default to unverified from auth store
      const storedStatus = (user as Record<string, unknown>)?.verificationStatus as string | undefined;
      setVerificationStatus(storedStatus || 'unverified');
    }
  }, [authFetch, user]);

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
    fetchVerificationStatus();
  }, [fetchAssignments, fetchCounts, fetchVerificationStatus]);

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

  // Get verification config for current status
  const vConfig = verificationStatus ? verificationConfig[verificationStatus] : null;

  return (
    <div className="space-y-4">
      <PageHeader
        title={`مرحباً، ${user?.name?.split(' ')[0] ?? 'الممرض/ـة'}`}
        description="إدارة المهام والطلبات الموكلة إليك"
      />

      {/* Verification Warning Banner */}
      <AnimatePresence>
        {verificationStatus && verificationStatus !== 'verified' && vConfig && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <Link href="/nurse/profile" className="block">
              <GlassCard
                variant="nurse"
                className={`p-4 cursor-pointer hover:shadow-md transition-all duration-300 border ${vConfig.borderColor} bg-gradient-to-l ${vConfig.bgGradient}`}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-11 h-11 rounded-xl ${vConfig.iconBg} flex items-center justify-center shrink-0`}>
                    <vConfig.icon className={`w-5 h-5 ${vConfig.iconColor}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`font-bold text-sm ${vConfig.iconColor} mb-0.5`}>
                      {vConfig.title}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {vConfig.description}
                    </p>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-[10px] text-muted-foreground mb-1">
                        <span>اكتمال الملف</span>
                        <span className="font-bold">{toArabicNum(profileCompleteness)}%</span>
                      </div>
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${profileCompleteness}%` }}
                          transition={{ duration: 0.8, ease: 'easeOut' }}
                          className={`h-full rounded-full ${
                            profileCompleteness >= 70 ? 'bg-amber-500' : 'bg-red-500'
                          }`}
                        />
                      </div>
                    </div>
                  </div>
                  <ChevronLeft className="w-5 h-5 text-muted-foreground shrink-0" />
                </div>
              </GlassCard>
            </Link>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Verified Badge (shown when verified) */}
      <AnimatePresence>
        {verificationStatus === 'verified' && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.3, ease: 'easeOut' }}
          >
            <GlassCard variant="nurse" className="p-3 border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-l from-emerald-50/80 to-teal-50/50 dark:from-emerald-900/10 dark:to-teal-900/5">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                  <ShieldCheck className="w-4.5 h-4.5 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div className="flex-1">
                  <p className="font-bold text-sm text-emerald-700 dark:text-emerald-400">حسابك موثق</p>
                  <p className="text-xs text-muted-foreground">يمكنك استقبال الطلبات والعمل بشكل طبيعي</p>
                </div>
                <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 text-[10px]">
                  <ShieldCheck className="w-3 h-3 me-1" />
                  موثق
                </Badge>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </AnimatePresence>

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
                            <BadgeStatus status={assignment.status || 'pending'} />
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
