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
  Building2,
  Home,
  Ban,
  HelpCircle,
  FileText,
  Star,
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
import { useAuthFetch, _GET_CACHE_readSync } from '@/hooks/use-auth';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useOrderUpdates } from '@/hooks/use-socket';
import { formatDateOnly, formatTimeOnly, toArabicNum } from '@/components/common/date-formatter';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

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
  emergencyType?: string;
  emergencyDescription?: string;
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
  assignmentType?: 'service' | 'emergency';
  outcome?: string | null;
  resolvedNotes?: string | null;
  request: AssignmentRequest;
}

type TabType = 'new' | 'active' | 'completed';

// ---- Outcome Labels & Icons ----

const outcomeConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  treated_on_site: { label: 'تم العلاج في الموقع', icon: Home, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800' },
  transferred_to_hospital: { label: 'تم النقل للمستشفى', icon: Building2, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800' },
  refused_treatment: { label: 'رفض المريض العلاج', icon: Ban, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800' },
  other: { label: 'أخرى', icon: HelpCircle, color: 'text-gray-600 dark:text-gray-400', bg: 'bg-gray-50 dark:bg-gray-900/20 border-gray-200 dark:border-gray-800' },
};

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
  // Read from in-memory cache synchronously — no skeleton if cache is warm
  const [assignments, setAssignments] = useState<Assignment[]>(() => {
    const c = _GET_CACHE_readSync<{ success: boolean; data?: Assignment[] }>('/api/nurse/assignments?status=pending&limit=50');
    return c?.success && Array.isArray(c.data) ? c.data : [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const c = _GET_CACHE_readSync('/api/nurse/assignments?status=pending&limit=50');
    return !(c as any)?.success;
  });
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [counts, setCounts] = useState<{ new: number; active: number; completed: number }>(() => {
    const c = _GET_CACHE_readSync<{ success: boolean; data?: { new: number; active: number; completed: number } }>('/api/nurse/assignments?counts=true');
    return c?.success && c.data ? c.data : { new: 0, active: 0, completed: 0 };
  });
  const [verificationStatus, setVerificationStatus] = useState<string | null>(() => {
    const c = _GET_CACHE_readSync<{ success: boolean; data?: { verificationStatus?: string } }>('/api/nurse/profile');
    return c?.success && c.data?.verificationStatus ? c.data.verificationStatus : null;
  });
  const [profileCompleteness, setProfileCompleteness] = useState(0);
  const [ratingSummary, setRatingSummary] = useState<{ averageRating: number; reviewCount: number; completedJobs: number } | null>(null);
  const authFetch = useAuthFetch();
  const user = useAuthStore((s) => s.user);
  const orderUpdates = useOrderUpdates();

  // ── Resolve Emergency Dialog State ──
  const [resolveDialogOpen, setResolveDialogOpen] = useState(false);
  const [resolvingEmergency, setResolvingEmergency] = useState<Assignment | null>(null);
  const [selectedOutcome, setSelectedOutcome] = useState<string>('');
  const [resolveNotes, setResolveNotes] = useState('');

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

  // OPTIMIZED: Run all initial API calls in parallel instead of sequentially
  useEffect(() => {
    setIsLoading(true);
    Promise.allSettled([
      fetchAssignments(),
      fetchCounts(),
      fetchVerificationStatus(),
      fetchRatingSummary(),
    ]).finally(() => {
      // fetchAssignments sets isLoading=false internally
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab]); // Only re-fetch when tab changes

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

  // ── Service Assignment Actions ──

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
      fetchCounts();
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
      fetchCounts();
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
      fetchCounts();
    }
  };

  // ── Emergency Assignment Actions ──

  const handleEmergencyAccept = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    try {
      const res = await authFetch(`/api/nurse/emergencies/${assignmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'accept' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('تم قبول حالة الطوارئ - انطلق فوراً');
        setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      } else {
        toast.error(data.message || 'فشل قبول حالة الطوارئ');
      }
    } catch {
      toast.error('حدث خطأ أثناء قبول حالة الطوارئ');
    } finally {
      setActionLoading(null);
      fetchCounts();
    }
  };

  const handleEmergencyReject = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    try {
      const res = await authFetch(`/api/nurse/emergencies/${assignmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reject' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('تم رفض حالة الطوارئ');
        setAssignments((prev) => prev.filter((a) => a.id !== assignmentId));
      } else {
        toast.error(data.message || 'فشل رفض حالة الطوارئ');
      }
    } catch {
      toast.error('حدث خطأ أثناء رفض حالة الطوارئ');
    } finally {
      setActionLoading(null);
      fetchCounts();
    }
  };

  const handleEmergencyArrive = async (assignmentId: string) => {
    setActionLoading(assignmentId);
    try {
      const res = await authFetch(`/api/nurse/emergencies/${assignmentId}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'arrive' }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('تم تسجيل الوصول - بدء التعامل مع الحالة');
        setAssignments((prev) =>
          prev.map((a) => (a.id === assignmentId ? { ...a, status: 'in_progress' } : a))
        );
      } else {
        toast.error(data.message || 'فشل تسجيل الوصول');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setActionLoading(null);
    }
  };

  const handleOpenResolveDialog = (assignment: Assignment) => {
    setResolvingEmergency(assignment);
    setSelectedOutcome('');
    setResolveNotes('');
    setResolveDialogOpen(true);
  };

  const handleEmergencyResolve = async () => {
    if (!resolvingEmergency || !selectedOutcome) {
      toast.error('يجب تحديد نتيجة الحالة');
      return;
    }

    setActionLoading(resolvingEmergency.id);
    try {
      const res = await authFetch(`/api/nurse/emergencies/${resolvingEmergency.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ action: 'resolve', outcome: selectedOutcome, resolvedNotes: resolveNotes }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('تم إنهاء حالة الطوارئ بنجاح');
        setAssignments((prev) => prev.filter((a) => a.id !== resolvingEmergency.id));
        setResolveDialogOpen(false);
        setResolvingEmergency(null);
      } else {
        toast.error(data.message || 'فشل إنهاء حالة الطوارئ');
      }
    } catch {
      toast.error('حدث خطأ أثناء إنهاء حالة الطوارئ');
    } finally {
      setActionLoading(null);
      fetchCounts();
    }
  };

  const isEmergency = (a: Assignment) => a.assignmentType === 'emergency' || a.request?.isEmergency;

  // Fetch rating summary
  const fetchRatingSummary = useCallback(async () => {
    try {
      const res = await authFetch('/api/nurse/ratings?limit=1');
      const data = await res.json();
      if (data.success && data.data?.summary) {
        setRatingSummary(data.data.summary);
      }
    } catch {
      // silently handle
    }
  }, [authFetch]);

  // Get verification config for current status
  const vConfig = verificationStatus ? verificationConfig[verificationStatus] : null;

  return (
    <div className="space-y-4">
      {/* Nurse Hero Header */}
      <motion.div
        initial={{ opacity: 0, y: -15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-bl from-sky-600 via-nurse to-teal-600 p-5 text-white shadow-lg shadow-nurse/20"
      >
        <div className="relative z-10 flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-widest opacity-70 mb-1">بوابة الممرض</p>
            <h2 className="text-xl font-black leading-snug">مرحباً، {user?.name?.split(' ')[0] ?? 'الممرض/ـة'}</h2>
            <p className="text-xs opacity-80 mt-1">إدارة المهام والطلبات الموكلة إليك</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-white/15 border border-white/25 flex items-center justify-center shrink-0">
            <ClipboardList className="w-6 h-6 text-white" />
          </div>
        </div>
        <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-white/8 blur-sm" />
        <div className="absolute -bottom-4 -right-4 w-20 h-20 rounded-full bg-white/8" />
      </motion.div>

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

      {/* Rating Summary Card */}
      <Link href="/nurse/ratings" className="block">
        <GlassCard variant="nurse" className="p-4 cursor-pointer hover:shadow-md transition-all duration-300 border-amber-200/50 dark:border-amber-800/30 bg-gradient-to-l from-amber-50/60 to-yellow-50/40 dark:from-amber-900/10 dark:to-yellow-900/5">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center shrink-0">
              <Star className="w-6 h-6 text-amber-500 fill-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-bold text-sm">تقييماتي</h3>
                <ChevronLeft className="w-4 h-4 text-muted-foreground" />
              </div>
              <div className="flex items-center gap-3">
                <span className="text-2xl font-bold text-amber-600">{toArabicNum(ratingSummary?.averageRating?.toFixed(1) ?? '0.0')}</span>
                <div className="flex items-center gap-0.5">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <Star
                      key={s}
                      className={`w-4 h-4 ${s <= Math.round(ratingSummary?.averageRating ?? 0) ? 'text-amber-400 fill-amber-400' : 'text-gray-300'}`}
                    />
                  ))}
                </div>
                <span className="text-xs text-muted-foreground">
                  {toArabicNum(ratingSummary?.reviewCount ?? 0)} تقييم
                </span>
              </div>
            </div>
            <div className="text-left">
              <p className="text-[10px] text-muted-foreground">خدمة مكتملة</p>
              <p className="text-lg font-bold text-nurse">{toArabicNum(ratingSummary?.completedJobs ?? 0)}</p>
            </div>
          </div>
        </GlassCard>
      </Link>

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
                      <GlassCard
                        variant="nurse"
                        className={`p-4 ${isEmergency(assignment) ? 'border-red-200 dark:border-red-900/40 ring-1 ring-red-100 dark:ring-red-900/20' : ''}`}
                      >
                        {/* Service & Status Row */}
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                              isEmergency(assignment)
                                ? assignment.status === 'assigned'
                                  ? 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 animate-pulse'
                                  : 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400'
                                : 'bg-nurse/10 text-nurse'
                            }`}>
                              {isEmergency(assignment)
                                ? <AlertTriangle className="w-5 h-5" />
                                : assignment.request?.service
                                  ? getServiceIcon(assignment.request.service.category)
                                  : <ClipboardList className="w-5 h-5" />}
                            </div>
                            <div>
                              <h3 className="font-semibold text-sm">
                                {assignment.request?.service?.nameAr || 'طلب خدمة'}
                              </h3>
                              <p className="text-xs text-muted-foreground">
                                {isEmergency(assignment)
                                  ? assignment.status === 'assigned'
                                    ? 'بانتظار قبولك - حالة عاجلة'
                                    : assignment.status === 'accepted'
                                      ? 'تم القبول - انطلق الآن'
                                      : assignment.status === 'in_progress'
                                        ? 'جاري التنفيذ - في الموقع'
                                        : 'حالة طوارئ'
                                  : assignment.request?.service?.duration
                                    ? `${toArabicNum(assignment.request.service.duration)} دقيقة`
                                    : ''}
                              </p>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isEmergency(assignment) && (
                              <Badge variant="destructive" className={`text-[10px] gap-1 ${assignment.status === 'assigned' ? 'animate-pulse' : ''}`}>
                                <AlertTriangle className="w-3 h-3" />
                                طوارئ
                              </Badge>
                            )}
                            <BadgeStatus status={assignment.status || 'pending'} />
                          </div>
                        </div>

                        {/* Emergency Description */}
                        {isEmergency(assignment) && assignment.request?.emergencyDescription && (
                          <div className="mb-3 p-2.5 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30">
                            <p className="text-[10px] text-red-500 font-medium mb-0.5">وصف الطوارئ</p>
                            <p className="text-xs text-foreground leading-relaxed">{assignment.request.emergencyDescription}</p>
                          </div>
                        )}

                        {/* Outcome Display for completed emergencies */}
                        {isEmergency(assignment) && assignment.outcome && (
                          <div className={`mb-3 p-2.5 rounded-xl border ${outcomeConfig[assignment.outcome]?.bg || 'bg-muted'}`}>
                            <div className="flex items-center gap-2">
                              {(() => {
                                const oc = outcomeConfig[assignment.outcome!];
                                if (!oc) return null;
                                const IconComp = oc.icon;
                                return <IconComp className={`w-4 h-4 ${oc.color}`} />;
                              })()}
                              <span className="text-xs font-medium">
                                {outcomeConfig[assignment.outcome]?.label || assignment.outcome}
                              </span>
                            </div>
                            {assignment.resolvedNotes && (
                              <div className="flex items-start gap-1.5 mt-1.5">
                                <FileText className="w-3 h-3 text-muted-foreground shrink-0 mt-0.5" />
                                <p className="text-[11px] text-muted-foreground leading-relaxed">{assignment.resolvedNotes}</p>
                              </div>
                            )}
                          </div>
                        )}

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
                          {isEmergency(assignment) && assignment.assignedAt && (
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Clock className="w-4 h-4" />
                              <span>تم التعيين {formatDateOnly(new Date(assignment.assignedAt))}</span>
                            </div>
                          )}
                        </div>

                        {/* ── Earnings Row ── */}
                        <div className="flex items-center gap-2 pt-3 border-t border-border mb-3">
                          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800/40">
                            <DollarSign className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            <span className="text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                              {isEmergency(assignment) ? 'رسوم الطوارئ:' : 'أرباحك:'}
                            </span>
                            <Currency amount={assignment.request?.nursePayout || assignment.request?.basePrice || 0} className="font-bold text-emerald-700 dark:text-emerald-300" />
                          </div>
                        </div>

                        {/* ══════════════ إجراءات الحالة ══════════════ */}
                        {activeTab !== 'completed' && (
                          <div className="space-y-3">
                            {/* Step Progress Tracker */}
                            {!isEmergency(assignment) ? (
                              <div className="p-3 rounded-xl bg-muted/30 border border-border/60">
                                <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-2.5">مسار إجراءات الحالة</p>
                                <div className="flex items-center">
                                  {/* Step 1 */}
                                  <div className="flex flex-col items-center gap-1">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                                      assignment.status === 'assigned'
                                        ? 'bg-amber-500 border-amber-400 text-white shadow-md shadow-amber-500/40 scale-110'
                                        : 'bg-emerald-500 border-emerald-400 text-white'
                                    }`}>
                                      {assignment.status === 'assigned' ? '١' : <CheckCircle2 className="w-4 h-4" />}
                                    </div>
                                    <span className={`text-[9px] font-bold ${
                                      assignment.status === 'assigned' ? 'text-amber-600 dark:text-amber-400' : 'text-emerald-600 dark:text-emerald-400'
                                    }`}>قبول</span>
                                  </div>
                                  {/* Line */}
                                  <div className={`flex-1 h-1 mx-1 rounded-full ${
                                    assignment.status !== 'assigned' ? 'bg-nurse' : 'bg-muted'
                                  }`} />
                                  {/* Step 2 */}
                                  <div className="flex flex-col items-center gap-1">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                                      assignment.status === 'accepted'
                                        ? 'bg-sky-500 border-sky-400 text-white shadow-md shadow-sky-500/40 scale-110'
                                        : assignment.status === 'in_progress'
                                          ? 'bg-emerald-500 border-emerald-400 text-white'
                                          : 'bg-muted border-border text-muted-foreground'
                                    }`}>
                                      {assignment.status === 'in_progress' ? <CheckCircle2 className="w-4 h-4" /> : '٢'}
                                    </div>
                                    <span className={`text-[9px] font-bold ${
                                      assignment.status === 'accepted' ? 'text-sky-600 dark:text-sky-400' :
                                      assignment.status === 'in_progress' ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'
                                    }`}>تنفيذ</span>
                                  </div>
                                  {/* Line */}
                                  <div className={`flex-1 h-1 mx-1 rounded-full ${
                                    assignment.status === 'in_progress' ? 'bg-nurse' : 'bg-muted'
                                  }`} />
                                  {/* Step 3 */}
                                  <div className="flex flex-col items-center gap-1">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                                      assignment.status === 'in_progress'
                                        ? 'bg-green-500 border-green-400 text-white shadow-md shadow-green-500/40 scale-110'
                                        : 'bg-muted border-border text-muted-foreground'
                                    }`}>
                                      ٣
                                    </div>
                                    <span className={`text-[9px] font-bold ${
                                      assignment.status === 'in_progress' ? 'text-green-600 dark:text-green-400' : 'text-muted-foreground'
                                    }`}>إكمال</span>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200/60 dark:border-red-900/30">
                                <p className="text-[10px] font-bold text-red-500/70 uppercase tracking-widest mb-2.5">مسار إجراءات الطوارئ</p>
                                <div className="flex items-center">
                                  <div className="flex flex-col items-center gap-1">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                                      assignment.status === 'assigned'
                                        ? 'bg-red-500 border-red-400 text-white shadow-md shadow-red-500/40 scale-110 animate-pulse'
                                        : 'bg-emerald-500 border-emerald-400 text-white'
                                    }`}>
                                      {assignment.status === 'assigned' ? '١' : <CheckCircle2 className="w-4 h-4" />}
                                    </div>
                                    <span className="text-[9px] font-bold text-red-600 dark:text-red-400">قبول</span>
                                  </div>
                                  <div className={`flex-1 h-1 mx-1 rounded-full ${assignment.status !== 'assigned' ? 'bg-orange-400' : 'bg-muted'}`} />
                                  <div className="flex flex-col items-center gap-1">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                                      assignment.status === 'accepted'
                                        ? 'bg-orange-500 border-orange-400 text-white shadow-md shadow-orange-500/40 scale-110 animate-pulse'
                                        : assignment.status === 'in_progress'
                                          ? 'bg-emerald-500 border-emerald-400 text-white'
                                          : 'bg-muted border-border text-muted-foreground'
                                    }`}>
                                      {assignment.status === 'in_progress' ? <CheckCircle2 className="w-4 h-4" /> : '٢'}
                                    </div>
                                    <span className="text-[9px] font-bold text-orange-600 dark:text-orange-400">انطلاق</span>
                                  </div>
                                  <div className={`flex-1 h-1 mx-1 rounded-full ${assignment.status === 'in_progress' ? 'bg-green-500' : 'bg-muted'}`} />
                                  <div className="flex flex-col items-center gap-1">
                                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black border-2 transition-all ${
                                      assignment.status === 'in_progress'
                                        ? 'bg-green-500 border-green-400 text-white shadow-md shadow-green-500/40 scale-110 animate-pulse'
                                        : 'bg-muted border-border text-muted-foreground'
                                    }`}>٣</div>
                                    <span className="text-[9px] font-bold text-green-600 dark:text-green-400">إنهاء</span>
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* ── Primary Action Buttons ── */}
                            {isEmergency(assignment) ? (
                              <>
                                {activeTab === 'new' && assignment.status === 'assigned' && (
                                  <div className="space-y-2">
                                    <p className="text-[11px] text-center text-red-600 dark:text-red-400 font-semibold">⚡ حالة طوارئ عاجلة — حدد قرارك فوراً</p>
                                    <div className="grid grid-cols-2 gap-2">
                                      <Button
                                        variant="outline"
                                        className="h-11 w-full text-destructive border-destructive/40 hover:bg-destructive/10 font-semibold gap-1.5"
                                        disabled={actionLoading === assignment.id}
                                        onClick={() => handleEmergencyReject(assignment.id)}
                                      >
                                        {actionLoading === assignment.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
                                        رفض التكليف
                                      </Button>
                                      <Button
                                        className="h-11 w-full bg-red-600 hover:bg-red-700 text-white font-bold gap-1.5 shadow-lg shadow-red-600/30"
                                        disabled={actionLoading === assignment.id}
                                        onClick={() => handleEmergencyAccept(assignment.id)}
                                      >
                                        {actionLoading === assignment.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                        قبول الطوارئ
                                      </Button>
                                    </div>
                                  </div>
                                )}
                                {activeTab === 'active' && assignment.status === 'accepted' && (
                                  <div className="space-y-2">
                                    <div className="p-2.5 rounded-lg bg-orange-50 dark:bg-orange-900/15 border border-orange-200/70 dark:border-orange-800/30 text-center">
                                      <p className="text-xs font-bold text-orange-700 dark:text-orange-400">الخطوة الثانية — الانطلاق للموقع</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">انطلق الآن ثم اضغط "وصلت للموقع" عند الوصول</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      {assignment.request?.beneficiary?.phone && (
                                        <Button variant="outline" className="h-10 gap-1.5 font-medium text-sm" onClick={() => window.open(`tel:${assignment.request!.beneficiary!.phone}`, '_self')}>
                                          <Phone className="w-4 h-4" />اتصال بالمريض
                                        </Button>
                                      )}
                                      {assignment.request?.beneficiaryLat && assignment.request?.beneficiaryLng && (
                                        <Button className="h-10 bg-red-600 hover:bg-red-700 text-white gap-1.5 font-medium text-sm" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${assignment.request!.beneficiaryLat},${assignment.request!.beneficiaryLng}`, '_blank')}>
                                          <Navigation className="w-4 h-4" />اذهب الآن
                                        </Button>
                                      )}
                                    </div>
                                    <Button
                                      className="w-full h-12 bg-sky-600 hover:bg-sky-700 text-white font-bold gap-2 shadow-lg shadow-sky-600/25 text-[15px]"
                                      disabled={actionLoading === assignment.id}
                                      onClick={() => handleEmergencyArrive(assignment.id)}
                                    >
                                      {actionLoading === assignment.id ? <RefreshCw className="w-5 h-5 animate-spin" /> : <MapPin className="w-5 h-5" />}
                                      وصلت للموقع — ابدأ التعامل مع الحالة
                                    </Button>
                                  </div>
                                )}
                                {activeTab === 'active' && assignment.status === 'in_progress' && (
                                  <div className="space-y-2">
                                    <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-900/15 border border-green-200/70 dark:border-green-800/30 text-center">
                                      <p className="text-xs font-bold text-green-700 dark:text-green-400">الخطوة الثالثة — إنهاء الحالة</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">سجّل نتيجة الحالة عند الانتهاء من التعامل معها</p>
                                    </div>
                                    {assignment.request?.beneficiary?.phone && (
                                      <Button variant="outline" className="w-full h-10 gap-1.5 font-medium" onClick={() => window.open(`tel:${assignment.request!.beneficiary!.phone}`, '_self')}>
                                        <Phone className="w-4 h-4" />اتصال بالمريض
                                      </Button>
                                    )}
                                    <Button
                                      className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold gap-2 shadow-lg shadow-green-600/25 text-[15px]"
                                      disabled={actionLoading === assignment.id}
                                      onClick={() => handleOpenResolveDialog(assignment)}
                                    >
                                      {actionLoading === assignment.id ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                      إنهاء الحالة وتسجيل النتيجة
                                    </Button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <>
                                {activeTab === 'new' && (
                                  <div className="space-y-2">
                                    <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/15 border border-amber-200/70 dark:border-amber-800/30 text-center">
                                      <p className="text-xs font-bold text-amber-700 dark:text-amber-400">الخطوة الأولى — قبول التكليف</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">راجع التفاصيل أعلاه ثم حدد قرارك</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2">
                                      <Button
                                        variant="outline"
                                        className="h-11 w-full text-destructive border-destructive/40 hover:bg-destructive/10 font-semibold gap-1.5"
                                        disabled={actionLoading === assignment.id}
                                        onClick={() => handleReject(assignment.id)}
                                      >
                                        <XCircle className="w-4 h-4" />رفض التكليف
                                      </Button>
                                      <Button
                                        className="h-11 w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5 shadow-lg shadow-emerald-600/25"
                                        disabled={actionLoading === assignment.id}
                                        onClick={() => handleAccept(assignment.id)}
                                      >
                                        {actionLoading === assignment.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                        قبول التكليف
                                      </Button>
                                    </div>
                                  </div>
                                )}
                                {activeTab === 'active' && assignment.status === 'accepted' && (
                                  <div className="space-y-2">
                                    <div className="p-2.5 rounded-lg bg-sky-50 dark:bg-sky-900/15 border border-sky-200/70 dark:border-sky-800/30 text-center">
                                      <p className="text-xs font-bold text-sky-700 dark:text-sky-400">الخطوة الثانية — تنفيذ التكليف</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">انطلق للموقع ثم اضغط "بدء تنفيذ التكليف" عند البدء الفعلي</p>
                                    </div>
                                    {assignment.request?.beneficiaryLat && assignment.request?.beneficiaryLng && (
                                      <Button variant="outline" className="w-full h-10 gap-1.5 font-medium" onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${assignment.request!.beneficiaryLat},${assignment.request!.beneficiaryLng}`, '_blank')}>
                                        <Navigation className="w-4 h-4" />الاتجاه للموقع
                                      </Button>
                                    )}
                                    <Button
                                      className="w-full h-12 bg-sky-600 hover:bg-sky-700 text-white font-bold gap-2 shadow-lg shadow-sky-600/25 text-[15px]"
                                      disabled={actionLoading === assignment.id}
                                      onClick={() => handleStartService(assignment.id)}
                                    >
                                      {actionLoading === assignment.id ? <RefreshCw className="w-5 h-5 animate-spin" /> : <PlayCircle className="w-5 h-5" />}
                                      بدء تنفيذ التكليف
                                    </Button>
                                  </div>
                                )}
                                {activeTab === 'active' && assignment.status === 'in_progress' && (
                                  <div className="space-y-2">
                                    <div className="p-2.5 rounded-lg bg-green-50 dark:bg-green-900/15 border border-green-200/70 dark:border-green-800/30 text-center">
                                      <p className="text-xs font-bold text-green-700 dark:text-green-400">الخطوة الثالثة — إكمال التكليف</p>
                                      <p className="text-[10px] text-muted-foreground mt-0.5">بعد الانتهاء من الخدمة اضغط لتأكيد الإنهاء</p>
                                    </div>
                                    <Button
                                      className="w-full h-12 bg-green-600 hover:bg-green-700 text-white font-bold gap-2 shadow-lg shadow-green-600/25 text-[15px]"
                                      disabled={actionLoading === assignment.id}
                                      onClick={() => handleCompleteService(assignment.id)}
                                    >
                                      {actionLoading === assignment.id ? <RefreshCw className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                                      إكمال التكليف
                                    </Button>
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        )}
                        {/* Completed state */}
                        {activeTab === 'completed' && (
                          <div className="flex items-center gap-3 pt-2">
                            <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
                              <div className="h-full w-full bg-gradient-to-l from-emerald-500 to-teal-500 rounded-full" />
                            </div>
                            <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400 border-0 gap-1 px-3 py-1">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              مكتمل بنجاح
                            </Badge>
                          </div>
                        )}
                      </GlassCard>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </motion.div>
            )}
          </PullToRefresh>
        </TabsContent>
      </Tabs>

      {/* ── Resolve Emergency Dialog ── */}
      <Dialog open={resolveDialogOpen} onOpenChange={setResolveDialogOpen}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>إنهاء حالة الطوارئ</DialogTitle>
            <DialogDescription>
              ماذا حدث مع حالة الطوارئ؟ حدد النتيجة وأضف ملاحظاتك
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-2">
            {/* Outcome Selection */}
            <div className="space-y-2">
              <p className="text-sm font-medium">نتيجة الحالة *</p>
              <div className="space-y-2">
                {Object.entries(outcomeConfig).map(([key, config]) => {
                  const IconComp = config.icon;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSelectedOutcome(key)}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-right ${
                        selectedOutcome === key
                          ? `${config.bg} border-current ${config.color}`
                          : 'border-border hover:border-muted-foreground/30'
                      }`}
                    >
                      <IconComp className={`w-5 h-5 shrink-0 ${selectedOutcome === key ? config.color : 'text-muted-foreground'}`} />
                      <span className={`text-sm font-medium ${selectedOutcome === key ? config.color : ''}`}>
                        {config.label}
                      </span>
                      {selectedOutcome === key && (
                        <CheckCircle2 className={`w-4 h-4 mr-auto ${config.color}`} />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <p className="text-sm font-medium">ملاحظات إضافية</p>
              <textarea
                value={resolveNotes}
                onChange={(e) => setResolveNotes(e.target.value)}
                placeholder="أضف ملاحظاتك حول الحالة..."
                className="w-full min-h-[80px] p-3 rounded-xl border border-border bg-background text-sm resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                dir="rtl"
              />
            </div>

            {/* Submit */}
            <Button
              className="w-full bg-green-600 hover:bg-green-700 h-11"
              disabled={!selectedOutcome || actionLoading === resolvingEmergency?.id}
              onClick={handleEmergencyResolve}
            >
              {actionLoading === resolvingEmergency?.id ? (
                <RefreshCw className="w-4 h-4 animate-spin me-2" />
              ) : (
                <CheckCircle2 className="w-4 h-4 me-2" />
              )}
              تأكيد إنهاء الحالة
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
