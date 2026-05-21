'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertTriangle, Eye, UserPlus, RefreshCw, Clock, Phone, MessageCircle,
  MapPin, Navigation, Siren, CheckCircle2, X, Loader2, Zap, Timer,
  User, Star, ShieldAlert, Ambulance, Search, Filter, ChevronDown,
  Radio, CircleDot, Activity, Stethoscope, Heart, Flame, TrendingUp,
  Users, Wifi, WifiOff, Sparkles, ArrowUpRight, XCircle, CircleCheck,
  Banknote
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard } from '@/components/common/glass-card';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { toArabicNum } from '@/components/common/date-formatter';
import { socketService } from '@/lib/socket';

/* ─────────────── Types ─────────────── */
interface EmergencyItem {
  id: string;
  beneficiaryName: string;
  beneficiaryPhone?: string;
  nurseName: string | null;
  type: string;
  description: string;
  status: string;
  priority: string;
  address: string;
  lat?: number;
  lng?: number;
  responseTime: number | null;
  emergencyFee?: number;
  createdAt: string;
}

interface NearbyNurse {
  id: string;
  name: string;
  phone: string;
  specialization: string;
  rating: number;
  distance: number | null;
  isAvailable: boolean;
  isOnline: boolean;
  governorate: string;
  completedJobs?: number;
  experience?: number;
}

/* ─────────────── Constants ─────────────── */
const typeLabels: Record<string, string> = {
  medical: 'طبي عام',
  injury: 'إصابة',
  breathing: 'تنفسي',
  cardiac: 'قلبي',
  fall: 'سقوط',
  other: 'أخرى',
  general_medical: 'طبي عام',
};

const typeColors: Record<string, { bg: string; text: string; icon: string }> = {
  medical:     { bg: 'bg-red-500',    text: 'text-red-600 dark:text-red-400',    icon: 'bg-red-100 dark:bg-red-900/30' },
  injury:      { bg: 'bg-orange-500', text: 'text-orange-600 dark:text-orange-400', icon: 'bg-orange-100 dark:bg-orange-900/30' },
  breathing:   { bg: 'bg-blue-500',   text: 'text-blue-600 dark:text-blue-400',   icon: 'bg-blue-100 dark:bg-blue-900/30' },
  cardiac:     { bg: 'bg-rose-500',   text: 'text-rose-600 dark:text-rose-400',   icon: 'bg-rose-100 dark:bg-rose-900/30' },
  fall:        { bg: 'bg-amber-500',  text: 'text-amber-600 dark:text-amber-400', icon: 'bg-amber-100 dark:bg-amber-900/30' },
  other:       { bg: 'bg-gray-500',   text: 'text-gray-600 dark:text-gray-400',   icon: 'bg-gray-100 dark:bg-gray-900/30' },
  general_medical: { bg: 'bg-red-500', text: 'text-red-600 dark:text-red-400', icon: 'bg-red-100 dark:bg-red-900/30' },
};

const typeIconMap: Record<string, React.ElementType> = {
  medical: Activity, injury: Heart, breathing: Stethoscope,
  cardiac: Heart, fall: AlertTriangle, other: ShieldAlert,
  general_medical: Activity,
};

const statusConfig: Record<string, { label: string; color: string; dotColor: string }> = {
  pending:     { label: 'معلق',         color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300', dotColor: 'bg-yellow-500' },
  dispatched:  { label: 'تم الإرسال',    color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300',        dotColor: 'bg-blue-500' },
  accepted:    { label: 'مقبول - في الطريق', color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-300', dotColor: 'bg-indigo-500' },
  in_progress: { label: 'قيد التنفيذ',   color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300', dotColor: 'bg-orange-500' },
  resolved:    { label: 'تم الحل',       color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',     dotColor: 'bg-green-500' },
  cancelled:   { label: 'ملغي',         color: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300',         dotColor: 'bg-gray-500' },
};

const priorityConfig: Record<string, { label: string; color: string; glow: string; border: string }> = {
  low:    { label: 'منخفض', color: 'border-green-400 bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300', glow: '', border: 'border-l-green-500' },
  medium: { label: 'متوسط', color: 'border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20 text-yellow-700 dark:text-yellow-300', glow: '', border: 'border-l-yellow-500' },
  high:   { label: 'مرتفع', color: 'border-orange-400 bg-orange-50 dark:bg-orange-900/20 text-orange-700 dark:text-orange-300', glow: 'shadow-orange-500/20 shadow-md', border: 'border-l-orange-500' },
  urgent: { label: 'عاجل',  color: 'border-red-400 bg-red-50 dark:bg-red-900/20 text-red-700 dark:text-red-300', glow: 'shadow-red-500/30 shadow-lg animate-pulse', border: 'border-l-red-500' },
};

const emergencySteps = [
  { key: 'pending', label: 'معلق' },
  { key: 'dispatched', label: 'مرسل' },
  { key: 'accepted', label: 'في الطريق' },
  { key: 'in_progress', label: 'قيد التنفيذ' },
  { key: 'resolved', label: 'تم الحل' },
];

/* ─────────────── Helpers ─────────────── */
function getWhatsAppUrl(phone: string) {
  const cleanPhone = phone.replace(/\D/g, '');
  const withCode = cleanPhone.startsWith('0') ? '967' + cleanPhone.substring(1) : cleanPhone.startsWith('967') ? cleanPhone : '967' + cleanPhone;
  return `https://wa.me/${withCode}`;
}

function getTimeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffSec = Math.floor((now - then) / 1000);
  if (diffSec < 60) return `منذ ${diffSec} ثانية`;
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `منذ ${diffMin} دقيقة`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `منذ ${diffHr} ساعة`;
  const diffDay = Math.floor(diffHr / 24);
  return `منذ ${diffDay} يوم`;
}

/* ─────────────── Animation ─────────────── */
const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const cardHover = { whileHover: { scale: 1.01 }, whileTap: { scale: 0.99 } };

/* ════════════════════════════════════════════════════════════════ */
/* ═══════════════ MAIN COMPONENT ════════════════════════════════ */
/* ════════════════════════════════════════════════════════════════ */
export default function AdminEmergenciesPage() {
  const authFetch = useAuthFetch();
  const [emergencies, setEmergencies] = useState<EmergencyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Detail dialog
  const [viewTarget, setViewTarget] = useState<EmergencyItem | null>(null);

  // Assign nurse dialog
  const [assignTarget, setAssignTarget] = useState<EmergencyItem | null>(null);
  const [nearbyNurses, setNearbyNurses] = useState<NearbyNurse[]>([]);
  const [selectedNurse, setSelectedNurse] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isLoadingNurses, setIsLoadingNurses] = useState(false);
  const [nurseSearch, setNurseSearch] = useState('');
  const [nurseSearchDebounce, setNurseSearchDebounce] = useState('');

  // Assign confirmation
  const [assignConfirmNurse, setAssignConfirmNurse] = useState<NearbyNurse | null>(null);

  // Execute & Resolve dialogs
  const [executeTarget, setExecuteTarget] = useState<EmergencyItem | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [resolveTarget, setResolveTarget] = useState<EmergencyItem | null>(null);
  const [isResolving, setIsResolving] = useState(false);

  /* ── Fetch emergencies ── */
  const fetchEmergencies = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        limit: '100',
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      });
      const res = await authFetch(`/api/admin/emergencies?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        const emergenciesArray = json.data.emergencies ?? json.data;
        setEmergencies(Array.isArray(emergenciesArray) ? emergenciesArray : []);
      }
    } catch {
      // silent for auto-refresh
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, statusFilter]);

  useEffect(() => {
    setIsLoading(true);
    void fetchEmergencies();
  }, [fetchEmergencies]);

  const { refresh: realtimeRefreshEmergencies } = useRealtimeRefresh({
    entities: ['emergency'],
    onRefresh: () => void fetchEmergencies(),
    fallbackInterval: 30000,
  });

  /* ── Fetch nearby nurses ── */
  const fetchNearbyNurses = useCallback(async (em: EmergencyItem, searchTerm?: string) => {
    setIsLoadingNurses(true);
    setNearbyNurses([]);
    try {
      const params = new URLSearchParams({
        ...(em.id ? { emergencyId: em.id } : {}),
        ...(em.lat ? { lat: String(em.lat) } : {}),
        ...(em.lng ? { lng: String(em.lng) } : {}),
        maxDistance: '100',
        limit: '50',
        ...(searchTerm ? { search: searchTerm } : {}),
      });
      const res = await authFetch(`/api/admin/emergencies/nearby-nurses?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        setNearbyNurses(json.data.nurses || []);
      } else {
        toast.error('فشل البحث عن الممرضين');
      }
    } catch {
      toast.error('فشل تحميل قائمة الممرضين');
    } finally {
      setIsLoadingNurses(false);
    }
  }, [authFetch]);

  // Debounced nurse search - triggers API call
  useEffect(() => {
    if (!assignTarget) return;
    const timer = setTimeout(() => {
      void fetchNearbyNurses(assignTarget, nurseSearchDebounce);
    }, 400);
    return () => clearTimeout(timer);
  }, [nurseSearchDebounce, assignTarget, fetchNearbyNurses]);

  /* ── Actions ── */
  const handleAssign = async () => {
    if (!assignTarget || !selectedNurse) return;
    setIsAssigning(true);
    try {
      const res = await authFetch(`/api/admin/emergencies/${assignTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'dispatched', nurseId: selectedNurse }),
      });
      const json = await res.json();
      if (json.success) {
        // Emit socket event so nurse receives real-time notification with sound + voice
        try {
          socketService.emitEmergencyDispatched({
            emergencyRequestId: assignTarget.id,
            nurseId: selectedNurse,
            nurseName: assignTarget.nurseName || '',
            estimatedArrivalMinutes: null,
            dispatchedAt: new Date().toISOString(),
          });
        } catch {
          // Socket not connected - push notification already sent by API
        }
        toast.success('تم إرسال الممرض/ـة للطوارئ بنجاح');
        void fetchEmergencies();
      } else {
        toast.error(json.message ?? 'فشل التعيين');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setIsAssigning(false);
      setAssignTarget(null);
      setSelectedNurse('');
      setNearbyNurses([]);
      setNurseSearch('');
      setNurseSearchDebounce('');
      setAssignConfirmNurse(null);
    }
  };

  const handleDirectExecute = async () => {
    if (!executeTarget) return;
    setIsExecuting(true);
    try {
      const res = await authFetch(`/api/admin/emergencies/${executeTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'in_progress' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم بدء التنفيذ المباشر');
        void fetchEmergencies();
      } else {
        toast.error(json.message ?? 'فشل التنفيذ');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setIsExecuting(false);
      setExecuteTarget(null);
    }
  };

  const handleResolve = async () => {
    if (!resolveTarget) return;
    setIsResolving(true);
    try {
      const res = await authFetch(`/api/admin/emergencies/${resolveTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'resolved' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم حل حالة الطوارئ');
        void fetchEmergencies();
      } else {
        toast.error(json.message ?? 'فشل التحديث');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setIsResolving(false);
      setResolveTarget(null);
    }
  };

  /* ── Derived state ── */
  const isActive = (status: string) => ['pending', 'dispatched', 'accepted', 'in_progress'].includes(status);

  const activeCount = emergencies.filter((e) => isActive(e.status)).length;
  const pendingCount = emergencies.filter((e) => e.status === 'pending').length;
  const dispatchedCount = emergencies.filter((e) => e.status === 'dispatched').length;
  const inProgressCount = emergencies.filter((e) => e.status === 'in_progress').length;
  const resolvedCount = emergencies.filter((e) => e.status === 'resolved').length;

  // Filter emergencies by search
  const filteredEmergencies = searchQuery
    ? emergencies.filter(e =>
        e.beneficiaryName?.includes(searchQuery) ||
        e.beneficiaryPhone?.includes(searchQuery) ||
        e.description?.includes(searchQuery) ||
        e.address?.includes(searchQuery) ||
        (typeLabels[e.type] || e.type)?.includes(searchQuery)
      )
    : emergencies;

  // Group by status priority
  const activeEmergencies = filteredEmergencies.filter(e => isActive(e.status));
  const resolvedEmergencies = filteredEmergencies.filter(e => !isActive(e.status));

  /* ════════════════════════════════════════════════════════════════ */
  /* ═══════════════ RENDER ═══════════════════════════════════════ */
  /* ════════════════════════════════════════════════════════════════ */
  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* ── Header ── */}
      <motion.div variants={itemAnim}>
        <PageHeader
          title="إدارة الطوارئ"
          description="متابعة وإدارة طلبات الطوارئ - تحديث تلقائي كل ١٥ ثانية"
        />
      </motion.div>

      {/* ── Stats Row ── */}
      <motion.div variants={itemAnim} className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <GlassCard variant="admin" className="p-4 border-r-4 border-red-500">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
              <Flame className="w-5 h-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-red-600 dark:text-red-400">{toArabicNum(activeCount)}</p>
              <p className="text-[11px] text-muted-foreground font-medium">حالات نشطة</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard variant="admin" className="p-4 border-r-4 border-yellow-500">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
              <Timer className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-yellow-600 dark:text-yellow-400">{toArabicNum(pendingCount)}</p>
              <p className="text-[11px] text-muted-foreground font-medium">بانتظار التعيين</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard variant="admin" className="p-4 border-r-4 border-blue-500">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Ambulance className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-blue-600 dark:text-blue-400">{toArabicNum(dispatchedCount)}</p>
              <p className="text-[11px] text-muted-foreground font-medium">تم الإرسال</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard variant="admin" className="p-4 border-r-4 border-orange-500">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-orange-100 dark:bg-orange-900/30 flex items-center justify-center">
              <Radio className="w-5 h-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-orange-600 dark:text-orange-400">{toArabicNum(inProgressCount)}</p>
              <p className="text-[11px] text-muted-foreground font-medium">قيد التنفيذ</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard variant="admin" className="p-4 border-r-4 border-green-500">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <CircleCheck className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-black text-green-600 dark:text-green-400">{toArabicNum(resolvedCount)}</p>
              <p className="text-[11px] text-muted-foreground font-medium">تم الحل</p>
            </div>
          </div>
        </GlassCard>
      </motion.div>

      {/* ── Filter Bar ── */}
      <motion.div variants={itemAnim}>
        <GlassCard variant="admin" className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="بحث بالاسم، الهاتف، العنوان..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pr-10"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {[
                { key: 'all', label: 'الكل', count: emergencies.length },
                { key: 'pending', label: 'معلق', count: pendingCount },
                { key: 'dispatched', label: 'مرسل', count: dispatchedCount },
                { key: 'in_progress', label: 'قيد التنفيذ', count: inProgressCount },
                { key: 'resolved', label: 'تم الحل', count: resolvedCount },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setStatusFilter(tab.key)}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    statusFilter === tab.key
                      ? 'bg-admin text-white shadow-sm'
                      : 'bg-muted/60 hover:bg-muted text-muted-foreground'
                  }`}
                >
                  {tab.label}
                  <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${
                    statusFilter === tab.key ? 'bg-white/20' : 'bg-muted'
                  }`}>
                    {toArabicNum(tab.count)}
                  </span>
                </button>
              ))}
            </div>
            <Button variant="outline" size="icon" className="shrink-0" onClick={() => { setIsLoading(true); void fetchEmergencies(); }}>
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </GlassCard>
      </motion.div>

      {/* ── Active Emergencies ── */}
      {activeEmergencies.length > 0 && (
        <motion.div variants={itemAnim}>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <h2 className="text-lg font-bold">حالات الطوارئ النشطة</h2>
            </div>
            <Badge variant="destructive" className="text-xs">{toArabicNum(activeEmergencies.length)} حالة</Badge>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {activeEmergencies.map((em) => {
              const tc = typeColors[em.type] || typeColors.other;
              const pc = priorityConfig[em.priority] || priorityConfig.medium;
              const sc = statusConfig[em.status] || statusConfig.pending;
              const TypeIcon = typeIconMap[em.type] || ShieldAlert;

              return (
                <motion.div key={em.id} {...cardHover} className={`rounded-2xl border bg-card shadow-sm transition-all hover:shadow-lg ${pc.glow} border-l-4 ${pc.border} ${em.priority === 'urgent' ? 'ring-2 ring-red-500/30' : em.priority === 'high' ? 'ring-1 ring-orange-500/20' : ''}`}>
                  <div className="p-4 space-y-3">
                    {/* Header Row */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <div className={`w-10 h-10 rounded-xl ${tc.icon} flex items-center justify-center ${em.priority === 'urgent' && em.status === 'pending' ? 'animate-pulse' : ''}`}>
                          <TypeIcon className={`w-5 h-5 ${tc.text}`} />
                        </div>
                        <div>
                          <p className="font-bold text-sm">{typeLabels[em.type] || em.type}</p>
                          <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${pc.color}`}>
                            {priorityConfig[em.priority]?.label || em.priority}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-2 h-2 rounded-full ${sc.dotColor} ${isActive(em.status) ? 'animate-pulse' : ''}`} />
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${sc.color}`}>
                          {sc.label}
                        </span>
                        {em.status === 'pending' && (
                          <span className="w-5 h-5 rounded-full bg-yellow-500 text-white flex items-center justify-center text-[10px] font-bold animate-pulse">!</span>
                        )}
                      </div>
                    </div>

                    {/* Response Timer */}
                    {isActive(em.status) && (
                      <div className={`flex items-center gap-1.5 text-xs font-medium ${
                        em.priority === 'urgent' ? 'text-red-600 dark:text-red-400' : em.priority === 'high' ? 'text-orange-600 dark:text-orange-400' : 'text-muted-foreground'
                      }`}>
                        <Timer className={`w-3.5 h-3.5 ${em.priority === 'urgent' ? 'animate-pulse' : ''}`} />
                        <span>{getTimeAgo(em.createdAt)}</span>
                        {em.priority === 'urgent' && <span className="text-[9px] text-red-500">⏱ ينتظر!</span>}
                      </div>
                    )}

                    {/* Status Progress Indicator */}
                    <div className="flex items-center gap-1">
                      {emergencySteps.map((step, stepIdx) => {
                        const currentStepIdx = emergencySteps.findIndex(s => s.key === em.status);
                        const isCompleted = stepIdx < currentStepIdx;
                        const isCurrent = step.key === em.status;
                        return (
                          <div key={step.key} className="flex items-center gap-1 flex-1">
                            <div className={`flex-1 h-1 rounded-full transition-all ${
                              isCompleted ? 'bg-green-500' : isCurrent ? 'bg-admin' : 'bg-muted/50'
                            }`} />
                            {stepIdx < emergencySteps.length - 1 && null}
                          </div>
                        );
                      })}
                    </div>

                    {/* Beneficiary Info */}
                    <div className="flex items-center gap-2.5 p-2.5 rounded-xl bg-muted/40">
                      <Avatar className="w-8 h-8">
                        <AvatarFallback className="text-[10px] bg-admin/10 text-admin">
                          {em.beneficiaryName?.slice(0, 2) || '؟'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{em.beneficiaryName}</p>
                        {em.beneficiaryPhone && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-[10px] text-muted-foreground">{em.beneficiaryPhone}</span>
                            <a href={`tel:${em.beneficiaryPhone}`} className="w-5 h-5 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                              <Phone className="w-2.5 h-2.5" />
                            </a>
                            <a href={getWhatsAppUrl(em.beneficiaryPhone)} target="_blank" rel="noopener noreferrer" className="w-5 h-5 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
                              <MessageCircle className="w-2.5 h-2.5" />
                            </a>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Description */}
                    {em.description && (
                      <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">{em.description}</p>
                    )}

                    {/* Location & Map */}
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground">
                      {em.address && (
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                          <MapPin className="w-3.5 h-3.5 text-red-500 shrink-0" />
                          <span className="truncate">{em.address}</span>
                        </div>
                      )}
                      {em.lat && em.lng && (
                        <a
                          href={`https://www.google.com/maps?q=${em.lat},${em.lng}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-center gap-1 text-blue-600 hover:text-blue-700 shrink-0"
                        >
                          <Navigation className="w-3 h-3" />
                          <span className="text-[10px]">عرض الخريطة</span>
                        </a>
                      )}
                    </div>

                    {/* Nurse Info */}
                    {em.nurseName && (
                      <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50 dark:bg-blue-900/10 border border-blue-100 dark:border-blue-900/30">
                        <Stethoscope className="w-3.5 h-3.5 text-blue-600" />
                        <span className="text-xs font-medium text-blue-700 dark:text-blue-300">{em.nurseName}</span>
                      </div>
                    )}

                    {/* Action Buttons */}
                    <div className="flex gap-2 pt-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1 flex-1"
                        onClick={() => setViewTarget(em)}
                      >
                        <Eye className="w-3.5 h-3.5" /> التفاصيل
                      </Button>
                      {em.status === 'pending' && (
                        <Button
                          size="sm"
                          className="h-8 text-xs gap-1 flex-1 bg-admin hover:bg-admin/90 text-white shadow-sm"
                          onClick={() => {
                            setAssignTarget(em);
                            void fetchNearbyNurses(em);
                          }}
                        >
                          <UserPlus className="w-3.5 h-3.5" /> تعيين
                        </Button>
                      )}
                      {(em.status === 'pending' || em.status === 'dispatched') && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1 border-orange-300 text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20"
                          onClick={() => setExecuteTarget(em)}
                        >
                          <Zap className="w-3.5 h-3.5" /> تنفيذ
                        </Button>
                      )}
                      {isActive(em.status) && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-8 text-xs gap-1 border-green-300 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/20"
                          onClick={() => setResolveTarget(em)}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> حل
                        </Button>
                      )}
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Resolved/Closed Emergencies - Accordion Style ── */}
      {resolvedEmergencies.length > 0 && (
        <motion.div variants={itemAnim}>
          <button
            onClick={() => {
              const el = document.getElementById('resolved-section');
              if (el) el.classList.toggle('hidden');
            }}
            className="w-full flex items-center justify-between mb-3 group"
          >
            <div className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              <h2 className="text-lg font-bold">الحالات المنتهية</h2>
              <Badge variant="secondary" className="text-xs">{toArabicNum(resolvedEmergencies.length)}</Badge>
            </div>
            <ChevronDown className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
          </button>
          <div id="resolved-section" className="space-y-2">
            {resolvedEmergencies.map((em) => {
              const sc = statusConfig[em.status] || statusConfig.resolved;
              const tc = typeColors[em.type] || typeColors.other;

              return (
                <motion.div key={em.id} {...cardHover}>
                  <GlassCard variant="admin" className="p-3 opacity-70 hover:opacity-100 transition-opacity border-l-4 border-l-green-400">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-lg ${tc.icon} flex items-center justify-center`}>
                        <ShieldAlert className={`w-4 h-4 ${tc.text}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium">{typeLabels[em.type] || em.type}</p>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${sc.color}`}>{sc.label}</span>
                        </div>
                        <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-0.5">
                          <span>{em.beneficiaryName}</span>
                          {em.nurseName && <span>• {em.nurseName}</span>}
                          <span>• {getTimeAgo(em.createdAt)}</span>
                        </div>
                      </div>
                      <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => setViewTarget(em)}>
                        <Eye className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </GlassCard>
                </motion.div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* ── Empty State ── */}
      {!isLoading && filteredEmergencies.length === 0 && (
        <motion.div variants={itemAnim}>
          <GlassCard variant="admin" className="p-16 text-center">
            <div className="w-16 h-16 rounded-2xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-500" />
            </div>
            <h3 className="font-bold text-lg mb-1">لا توجد حالات طوارئ</h3>
            <p className="text-sm text-muted-foreground">جميع حالات الطوارئ تم التعامل معها بنجاح</p>
          </GlassCard>
        </motion.div>
      )}

      {/* ── Loading State ── */}
      {isLoading && emergencies.length === 0 && (
        <GlassCard variant="admin" className="p-16 text-center">
          <Loader2 className="w-10 h-10 text-admin animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">جارٍ تحميل حالات الطوارئ...</p>
        </GlassCard>
      )}

      {/* ═══════════════ VIEW DETAILS DIALOG ═══════════════ */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Siren className="w-5 h-5 text-red-500" />
              تفاصيل حالة الطوارئ
            </DialogTitle>
          </DialogHeader>
          {viewTarget && (() => {
            const tc = typeColors[viewTarget.type] || typeColors.other;
            const pc = priorityConfig[viewTarget.priority] || priorityConfig.medium;
            const sc = statusConfig[viewTarget.status] || statusConfig.pending;
            const TypeIcon = typeIconMap[viewTarget.type] || ShieldAlert;

            return (
              <div className="space-y-4">
                {/* Horizontal Status Stepper */}
                <div className="flex items-center gap-1 p-2 rounded-xl bg-muted/30">
                  {emergencySteps.map((step, stepIdx) => {
                    const currentStepIdx = emergencySteps.findIndex(s => s.key === viewTarget.status);
                    const isCompleted = stepIdx < currentStepIdx;
                    const isCurrent = step.key === viewTarget.status;
                    return (
                      <div key={step.key} className="flex items-center gap-1 flex-1">
                        <div className="flex flex-col items-center gap-1 flex-1">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[9px] font-bold transition-all ${
                            isCompleted ? 'bg-green-500 text-white' : isCurrent ? 'bg-admin text-white' : 'bg-muted text-muted-foreground'
                          }`}>
                            {isCompleted ? '✓' : stepIdx + 1}
                          </div>
                          <span className={`text-[8px] font-medium leading-tight text-center ${
                            isCompleted ? 'text-green-600 dark:text-green-400' : isCurrent ? 'text-admin font-bold' : 'text-muted-foreground'
                          }`}>
                            {step.label}
                          </span>
                        </div>
                        {stepIdx < emergencySteps.length - 1 && (
                          <div className={`h-0.5 flex-1 rounded-full mt-[-12px] ${isCompleted ? 'bg-green-500' : 'bg-muted/50'}`} />
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Emergency Header */}
                <div className={`rounded-2xl border-2 p-4 ${
                  isActive(viewTarget.status)
                    ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
                    : 'border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
                }`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`w-14 h-14 rounded-xl ${tc.icon} flex items-center justify-center ${isActive(viewTarget.status) && viewTarget.priority === 'urgent' ? 'animate-pulse' : ''}`}>
                        <TypeIcon className={`w-7 h-7 ${tc.text}`} />
                      </div>
                      <div>
                        <p className="font-bold">{typeLabels[viewTarget.type] || viewTarget.type}</p>
                        <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full border font-semibold ${pc.color}`}>
                          أولوية: {pc.label}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${sc.dotColor} ${isActive(viewTarget.status) ? 'animate-pulse' : ''}`} />
                      <span className={`text-xs px-3 py-1.5 rounded-full font-semibold ${sc.color}`}>{sc.label}</span>
                    </div>
                  </div>
                </div>

                {/* Time with icon header */}
                <div className="flex items-center gap-2 p-3 rounded-xl bg-muted/30">
                  <Clock className="w-4 h-4 text-muted-foreground" />
                  <div className="flex-1">
                    <span className="text-sm font-medium">تم الإرسال {getTimeAgo(viewTarget.createdAt)}</span>
                  </div>
                  {viewTarget.priority === 'urgent' && isActive(viewTarget.status) && (
                    <span className="text-xs text-red-500 font-bold animate-pulse flex items-center gap-1">
                      <Timer className="w-3.5 h-3.5" /> ينتظر!
                    </span>
                  )}
                </div>

                {/* Description with section header */}
                {viewTarget.description && (
                  <div className="rounded-xl bg-muted/40 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Activity className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground font-bold">الوصف</p>
                    </div>
                    <p className="text-sm leading-relaxed">{viewTarget.description}</p>
                  </div>
                )}

                {/* Beneficiary & Nurse with section headers */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-xl bg-muted/40 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground font-bold">المستفيد</p>
                    </div>
                    <p className="text-sm font-medium">{viewTarget.beneficiaryName}</p>
                    {viewTarget.beneficiaryPhone && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-xs text-muted-foreground">{viewTarget.beneficiaryPhone}</span>
                        <a href={`tel:${viewTarget.beneficiaryPhone}`} className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center text-blue-600 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors">
                          <Phone className="w-3 h-3" />
                        </a>
                        <a href={getWhatsAppUrl(viewTarget.beneficiaryPhone)} target="_blank" rel="noopener noreferrer" className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center text-green-600 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors">
                          <MessageCircle className="w-3 h-3" />
                        </a>
                      </div>
                    )}
                  </div>
                  <div className="rounded-xl bg-muted/40 p-3">
                    <div className="flex items-center gap-1.5 mb-2">
                      <Stethoscope className="w-3.5 h-3.5 text-muted-foreground" />
                      <p className="text-[10px] text-muted-foreground font-bold">الممرض/ـة</p>
                    </div>
                    <p className="text-sm font-medium">{viewTarget.nurseName ?? 'غير معيَّن'}</p>
                  </div>
                </div>

                {/* Fee with section header */}
                {viewTarget.emergencyFee && (
                  <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30">
                    <div className="flex items-center gap-1.5">
                      <Banknote className="w-3.5 h-3.5 text-red-500" />
                      <span className="text-xs text-muted-foreground font-bold">رسوم الطوارئ</span>
                    </div>
                    <span className="font-bold text-red-600 text-sm">{viewTarget.emergencyFee.toLocaleString('ar-YE')} ر.ي</span>
                  </div>
                )}

                {/* Location with section header */}
                {viewTarget.address && (
                  <div className="rounded-xl bg-muted/40 p-3">
                    <div className="flex items-center gap-1.5 mb-1">
                      <MapPin className="w-3.5 h-3.5 text-red-500" />
                      <p className="text-[10px] text-muted-foreground font-bold">العنوان</p>
                    </div>
                    <p className="text-sm font-medium">{viewTarget.address}</p>
                    {viewTarget.lat && viewTarget.lng && (
                      <a href={`https://www.google.com/maps?q=${viewTarget.lat},${viewTarget.lng}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-xs text-blue-600 mt-1.5 hover:underline font-medium">
                        <Navigation className="w-3.5 h-3.5" /> عرض على الخريطة
                      </a>
                    )}
                  </div>
                )}

                {/* Quick Actions - More Prominent */}
                {isActive(viewTarget.status) && (
                  <div className="flex gap-2 pt-2 border-t border-border">
                    {viewTarget.status === 'pending' && (
                      <Button
                        className="flex-1 gap-2 bg-admin hover:bg-admin/90 h-11 shadow-md shadow-admin/20"
                        onClick={() => {
                          setAssignTarget(viewTarget);
                          setViewTarget(null);
                          void fetchNearbyNurses(viewTarget);
                        }}
                      >
                        <UserPlus className="w-5 h-5" />
                        تعيين ممرض/ـة
                      </Button>
                    )}
                    <Button
                      className="flex-1 gap-2 bg-orange-600 hover:bg-orange-700 text-white h-11 shadow-md shadow-orange-500/20"
                      onClick={() => {
                        setExecuteTarget(viewTarget);
                        setViewTarget(null);
                      }}
                    >
                      <Zap className="w-5 h-5" />
                      تنفيذ مباشر
                    </Button>
                    <Button
                      variant="outline"
                      className="gap-2 text-green-600 border-green-300 hover:bg-green-50 dark:hover:bg-green-900/20 h-11 shadow-sm"
                      onClick={() => {
                        setResolveTarget(viewTarget);
                        setViewTarget(null);
                      }}
                    >
                      <CheckCircle2 className="w-5 h-5" />
                      تم الحل
                    </Button>
                  </div>
                )}
              </div>
            );
          })()}
        </DialogContent>
      </Dialog>

      {/* ═══════════════ ASSIGN NURSE DIALOG ═══════════════ */}
      <Dialog open={!!assignTarget} onOpenChange={(open) => {
        if (!open) {
          setAssignTarget(null);
          setSelectedNurse('');
          setNearbyNurses([]);
          setNurseSearch('');
          setNurseSearchDebounce('');
        }
      }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-admin" />
              تعيين ممرض/ـة للطوارئ
            </DialogTitle>
            <DialogDescription>
              ابحث بالاسم أو الهاتف - الممرضون المتاحون يظهرون أولاً
            </DialogDescription>
          </DialogHeader>

          {/* Emergency Info Summary */}
          {assignTarget && (() => {
            const tc = typeColors[assignTarget.type] || typeColors.other;
            const TypeIcon = typeIconMap[assignTarget.type] || ShieldAlert;
            return (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30">
                <div className={`w-10 h-10 rounded-lg ${tc.icon} flex items-center justify-center`}>
                  <TypeIcon className={`w-5 h-5 ${tc.text}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">{typeLabels[assignTarget.type] || assignTarget.type} - {assignTarget.beneficiaryName}</p>
                  <p className="text-xs text-muted-foreground truncate">{assignTarget.address || assignTarget.description || 'حالة طوارئ'}</p>
                </div>
              </div>
            );
          })()}

          {/* Search nurses */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="ابحث بالاسم أو الهاتف أو التخصص..."
              value={nurseSearch}
              onChange={(e) => {
                setNurseSearch(e.target.value);
                setNurseSearchDebounce(e.target.value);
              }}
              className="pr-10"
            />
            {nurseSearch && (
              <button
                onClick={() => { setNurseSearch(''); setNurseSearchDebounce(''); }}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {isLoadingNurses ? (
            <div className="flex flex-col items-center justify-center py-10 gap-3">
              <Loader2 className="w-8 h-8 animate-spin text-admin" />
              <span className="text-sm text-muted-foreground">جارٍ البحث عن الممرضين...</span>
            </div>
          ) : nearbyNurses.length === 0 ? (
            <div className="text-center py-10">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
                <Users className="w-8 h-8 text-muted-foreground" />
              </div>
              <p className="text-sm font-medium text-muted-foreground">لا يوجد ممرضون متاحون</p>
              <p className="text-xs text-muted-foreground mt-1">جرّب تغيير كلمات البحث أو تحقق من حالة الممرضين</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[350px]">
              <div className="space-y-2 pr-1">
                <div className="flex items-center justify-between px-1">
                  <span className="text-[11px] text-muted-foreground font-medium">{toArabicNum(nearbyNurses.length)} ممرض/ـة</span>
                  <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                    <span className="w-2 h-2 rounded-full bg-green-500" /> متاح
                    <span className="w-2 h-2 rounded-full bg-gray-400 mr-1" /> غير متاح
                  </div>
                </div>
                {nearbyNurses.map((nurse) => {
                  const isSelected = selectedNurse === nurse.id;
                  const isAvailable = nurse.isOnline && nurse.isAvailable;

                  return (
                    <motion.button
                      key={nurse.id}
                      onClick={() => setSelectedNurse(nurse.id)}
                      whileHover={{ scale: 1.01 }}
                      whileTap={{ scale: 0.99 }}
                      className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-right border-2 ${
                        isSelected
                          ? 'border-admin bg-admin/5 shadow-sm'
                          : 'border-transparent hover:border-muted hover:bg-muted/30'
                      }`}
                    >
                      <div className="relative">
                        <Avatar className="w-11 h-11">
                          <AvatarFallback className={`text-xs font-bold ${
                            isAvailable
                              ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                              : nurse.isAvailable
                              ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                              : 'bg-muted text-muted-foreground'
                          }`}>
                            {nurse.name.slice(0, 2)}
                          </AvatarFallback>
                        </Avatar>
                        {/* Online indicator */}
                        <span className={`absolute -bottom-0.5 -left-0.5 w-3.5 h-3.5 rounded-full border-2 border-card ${
                          isAvailable ? 'bg-green-500' : nurse.isAvailable ? 'bg-yellow-500' : 'bg-gray-400'
                        }`} />
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-bold truncate">{nurse.name}</p>
                          {isAvailable && (
                            <Badge className="text-[9px] px-1.5 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-0">
                              متاح الآن
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">{nurse.specialization}</p>
                        <div className="flex items-center gap-3 mt-1">
                          {nurse.governorate && (
                            <span className="text-[10px] text-muted-foreground">{nurse.governorate}</span>
                          )}
                          {nurse.completedJobs > 0 && (
                            <span className="text-[10px] text-muted-foreground">{toArabicNum(nurse.completedJobs)} مهمة</span>
                          )}
                        </div>
                      </div>

                      <div className="text-left shrink-0 space-y-1.5">
                        {nurse.distance !== null ? (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-red-500" />
                            <span className="text-sm font-bold text-red-600 dark:text-red-400">{nurse.distance} كم</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">الموقع غير متاح</span>
                          </div>
                        )}
                        {nurse.rating > 0 && (
                          <div className="flex items-center gap-0.5">
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            <span className="text-xs font-medium">{nurse.rating.toFixed(1)}</span>
                          </div>
                        )}
                      </div>

                      {/* Selected checkmark */}
                      {isSelected && (
                        <div className="w-6 h-6 rounded-full bg-admin flex items-center justify-center shrink-0">
                          <CheckCircle2 className="w-4 h-4 text-white" />
                        </div>
                      )}
                    </motion.button>
                  );
                })}
              </div>
            </ScrollArea>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => {
              setAssignTarget(null);
              setSelectedNurse('');
              setNearbyNurses([]);
              setNurseSearch('');
              setNurseSearchDebounce('');
            }} disabled={isAssigning}>إلغاء</Button>
            <Button onClick={() => {
              const nurse = nearbyNurses.find(n => n.id === selectedNurse);
              if (nurse) setAssignConfirmNurse(nurse);
            }} disabled={!selectedNurse} className="bg-admin hover:bg-admin/90 gap-2">
              <UserPlus className="w-4 h-4" />
              تعيين وإرسال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ ASSIGN NURSE CONFIRMATION DIALOG ═══════════════ */}
      <Dialog open={!!assignConfirmNurse} onOpenChange={(open) => { if (!open) setAssignConfirmNurse(null); }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-admin" />
              تأكيد تعيين الممرض/ـة
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من تعيين هذا الممرض/ـة لحالة الطوارئ؟
            </DialogDescription>
          </DialogHeader>
          {assignConfirmNurse && assignTarget && (() => {
            const tc = typeColors[assignTarget.type] || typeColors.other;
            const TypeIcon = typeIconMap[assignTarget.type] || ShieldAlert;
            return (
              <div className="space-y-4">
                {/* Emergency Info */}
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30">
                  <div className="flex items-center gap-2 mb-1">
                    <div className={`w-7 h-7 rounded-lg ${tc.icon} flex items-center justify-center`}>
                      <TypeIcon className={`w-3.5 h-3.5 ${tc.text}`} />
                    </div>
                    <span className="font-bold text-sm">{typeLabels[assignTarget.type] || assignTarget.type}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">المستفيد: {assignTarget.beneficiaryName}</p>
                </div>

                {/* Nurse Info */}
                <div className="p-3 rounded-xl bg-admin/5 border border-admin/20">
                  <div className="flex items-center gap-3">
                    <Avatar className="w-12 h-12">
                      <AvatarFallback className="text-sm font-bold bg-admin/10 text-admin">
                        {assignConfirmNurse.name.slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-sm">{assignConfirmNurse.name}</p>
                      <p className="text-xs text-muted-foreground">{assignConfirmNurse.specialization}</p>
                      <div className="flex items-center gap-2 mt-1">
                        {assignConfirmNurse.distance !== null && (
                          <span className="text-[10px] flex items-center gap-0.5 text-muted-foreground">
                            <MapPin className="w-3 h-3 text-red-500" />
                            {assignConfirmNurse.distance} كم
                          </span>
                        )}
                        {assignConfirmNurse.rating > 0 && (
                          <span className="text-[10px] flex items-center gap-0.5">
                            <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                            {assignConfirmNurse.rating.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setAssignConfirmNurse(null)} disabled={isAssigning}>إلغاء</Button>
            <Button onClick={handleAssign} disabled={isAssigning} className="bg-admin hover:bg-admin/90 gap-2">
              {isAssigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {isAssigning ? 'جارٍ التعيين...' : 'تأكيد التعيين'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ DIRECT EXECUTE DIALOG ═══════════════ */}
      <Dialog open={!!executeTarget} onOpenChange={(open) => { if (!open) setExecuteTarget(null); }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              تنفيذ مباشر
            </DialogTitle>
            <DialogDescription>
              سيتم تغيير حالة الطوارئ إلى &quot;قيد التنفيذ&quot; فوراً بدون تعيين ممرض
            </DialogDescription>
          </DialogHeader>
          {executeTarget && (() => {
            const tc = typeColors[executeTarget.type] || typeColors.other;
            const TypeIcon = typeIconMap[executeTarget.type] || ShieldAlert;
            return (
              <div className="p-4 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900/30 space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg ${tc.icon} flex items-center justify-center`}>
                    <TypeIcon className={`w-4 h-4 ${tc.text}`} />
                  </div>
                  <span className="font-bold">{typeLabels[executeTarget.type] || executeTarget.type}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-3.5 h-3.5" />
                  <span>{executeTarget.beneficiaryName}</span>
                </div>
                {executeTarget.address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="w-3.5 h-3.5" />
                    <span className="truncate">{executeTarget.address}</span>
                  </div>
                )}
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExecuteTarget(null)} disabled={isExecuting}>إلغاء</Button>
            <Button onClick={handleDirectExecute} disabled={isExecuting} className="bg-orange-600 hover:bg-orange-700 text-white gap-2">
              {isExecuting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {isExecuting ? 'جارٍ التنفيذ...' : 'تنفيذ الآن'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════════ RESOLVE DIALOG ═══════════════ */}
      <Dialog open={!!resolveTarget} onOpenChange={(open) => { if (!open) setResolveTarget(null); }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
              تأكيد حل حالة الطوارئ
            </DialogTitle>
            <DialogDescription>
              سيتم تحديث حالة الطوارئ إلى &quot;تم الحل&quot;
            </DialogDescription>
          </DialogHeader>
          {resolveTarget && (() => {
            const tc = typeColors[resolveTarget.type] || typeColors.other;
            const TypeIcon = typeIconMap[resolveTarget.type] || ShieldAlert;
            return (
              <div className="p-4 rounded-xl bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-900/30 space-y-2">
                <div className="flex items-center gap-2">
                  <div className={`w-8 h-8 rounded-lg ${tc.icon} flex items-center justify-center`}>
                    <TypeIcon className={`w-4 h-4 ${tc.text}`} />
                  </div>
                  <span className="font-bold">{typeLabels[resolveTarget.type] || resolveTarget.type}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <User className="w-3.5 h-3.5" />
                  <span>{resolveTarget.beneficiaryName}</span>
                </div>
              </div>
            );
          })()}
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)} disabled={isResolving}>إلغاء</Button>
            <Button onClick={handleResolve} disabled={isResolving} className="bg-green-600 hover:bg-green-700 text-white gap-2">
              {isResolving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {isResolving ? 'جارٍ التحديث...' : 'تأكيد الحل'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
