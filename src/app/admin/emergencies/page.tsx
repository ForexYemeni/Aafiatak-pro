'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle, Eye, UserPlus, RefreshCw, Clock, Phone, MessageCircle,
  MapPin, Navigation, Siren, Activity, Play, CheckCircle2, X,
  Loader2, Zap, Timer, User, Star
} from 'lucide-react';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { DateFormatter } from '@/components/common/date-formatter';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Separator } from '@/components/ui/separator';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import { toast } from 'sonner';
import type { ColumnDef } from '@tanstack/react-table';

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
  specialty: string;
  rating: number;
  distance: number;
  isAvailable: boolean;
}

const typeLabels: Record<string, string> = {
  medical: 'طبي',
  injury: 'إصابة',
  breathing: 'تنفسي',
  cardiac: 'قلبي',
  fall: 'سقوط',
  other: 'أخرى',
};

const typeIcons: Record<string, string> = {
  medical: '🏥',
  injury: '🩹',
  breathing: '🫁',
  cardiac: '❤️',
  fall: '🚨',
  other: '⚕️',
};

const statusLabelsAr: Record<string, string> = {
  pending: 'معلق',
  dispatched: 'تم الإرسال',
  in_progress: 'قيد التنفيذ',
  resolved: 'تم الحل',
  cancelled: 'ملغي',
};

const statusColors: Record<string, string> = {
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  dispatched: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  in_progress: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  resolved: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400',
};

const priorityColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400 border-green-300',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400 border-orange-300',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400 border-red-300',
};

const priorityLabels: Record<string, string> = {
  low: 'منخفض',
  medium: 'متوسط',
  high: 'مرتفع',
  urgent: 'عاجل',
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

function getWhatsAppUrl(phone: string) {
  const cleanPhone = phone.replace(/\D/g, '');
  const withCode = cleanPhone.startsWith('0') ? '967' + cleanPhone.substring(1) : cleanPhone.startsWith('967') ? cleanPhone : '967' + cleanPhone;
  return `https://wa.me/${withCode}`;
}

export default function AdminEmergenciesPage() {
  const authFetch = useAuthFetch();
  const [emergencies, setEmergencies] = useState<EmergencyItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [viewTarget, setViewTarget] = useState<EmergencyItem | null>(null);
  const [assignTarget, setAssignTarget] = useState<EmergencyItem | null>(null);
  const [nearbyNurses, setNearbyNurses] = useState<NearbyNurse[]>([]);
  const [selectedNurse, setSelectedNurse] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [isLoadingNurses, setIsLoadingNurses] = useState(false);

  const [executeTarget, setExecuteTarget] = useState<EmergencyItem | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchEmergencies = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
      });
      const res = await authFetch(`/api/admin/emergencies?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        const emergenciesArray = json.data.emergencies ?? json.data;
        setEmergencies(Array.isArray(emergenciesArray) ? emergenciesArray : []);
        if (json.data.pages || json.data.totalPages) {
          setTotalPages(json.data.pages ?? json.data.totalPages ?? 1);
        }
      }
    } catch {
      // silent for auto-refresh
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, page, statusFilter]);

  useEffect(() => {
    setIsLoading(true);
    void fetchEmergencies();
  }, [fetchEmergencies]);

  // Auto-refresh every 15s
  useEffect(() => {
    intervalRef.current = setInterval(() => void fetchEmergencies(), 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchEmergencies]);

  // Fetch nearby nurses based on emergency location
  const fetchNearbyNurses = async (em: EmergencyItem) => {
    setIsLoadingNurses(true);
    try {
      // Fetch all verified nurses
      const res = await authFetch('/api/admin/nurses?limit=100&status=active');
      const json = await res.json();
      if (json.success && json.data) {
        const nursesArray = json.data.nurses ?? json.data;
        const allNurses = Array.isArray(nursesArray) ? nursesArray : [];

        // Calculate distance for each nurse
        const nursesWithDistance: NearbyNurse[] = allNurses
          .filter((n: any) => n.lat && n.lng && em.lat && em.lng)
          .map((n: any) => {
            const R = 6371;
            const dLat = (n.lat - em.lat!) * Math.PI / 180;
            const dLon = (n.lng - em.lng!) * Math.PI / 180;
            const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                      Math.cos(em.lat! * Math.PI / 180) * Math.cos(n.lat * Math.PI / 180) *
                      Math.sin(dLon/2) * Math.sin(dLon/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = Math.round(R * c * 10) / 10;
            return {
              id: String(n.id ?? n._id ?? ''),
              name: String(n.name ?? ''),
              phone: String(n.phone ?? ''),
              specialty: String(n.specialty ?? 'تمريض عام'),
              rating: n.rating || 0,
              distance,
              isAvailable: n.isAvailable !== false,
            };
          })
          .sort((a: NearbyNurse, b: NearbyNurse) => a.distance - b.distance);

        setNearbyNurses(nursesWithDistance);
      }
    } catch {
      toast.error('فشل تحميل قائمة الممرضين');
    } finally {
      setIsLoadingNurses(false);
    }
  };

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
        toast.success('تم إرسال الممرض/ـة للطوارئ');
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
    }
  };

  // Direct execution - start the emergency immediately
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

  // Resolve emergency
  const handleResolve = async (em: EmergencyItem) => {
    try {
      const res = await authFetch(`/api/admin/emergencies/${em.id}`, {
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
    }
  };

  const isActive = (status: string) => ['pending', 'dispatched', 'in_progress'].includes(status);

  const columns: ColumnDef<EmergencyItem, unknown>[] = [
    {
      accessorKey: 'type',
      header: 'النوع',
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          {isActive(row.original.status) && (
            <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          )}
          <span className="text-lg">{typeIcons[row.original.type] ?? '⚕️'}</span>
          <span className="font-medium">{typeLabels[row.original.type] ?? row.original.type}</span>
        </div>
      ),
    },
    {
      accessorKey: 'beneficiaryName',
      header: 'المستفيد',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm">{row.original.beneficiaryName}</p>
          {row.original.beneficiaryPhone && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-muted-foreground">{row.original.beneficiaryPhone}</span>
              <a href={`tel:${row.original.beneficiaryPhone}`} className="text-blue-500"><Phone className="w-3 h-3" /></a>
              <a href={getWhatsAppUrl(row.original.beneficiaryPhone)} target="_blank" rel="noopener noreferrer" className="text-green-500"><MessageCircle className="w-3 h-3" /></a>
            </div>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'priority',
      header: 'الأولوية',
      cell: ({ row }) => (
        <span className={`text-xs px-2.5 py-1 rounded-full border font-medium ${priorityColors[row.original.priority] ?? ''}`}>
          {priorityLabels[row.original.priority] ?? row.original.priority}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'الحالة',
      cell: ({ row }) => (
        <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${statusColors[row.original.status] ?? ''}`}>
          {statusLabelsAr[row.original.status] ?? row.original.status}
        </span>
      ),
    },
    {
      accessorKey: 'nurseName',
      header: 'الممرض/ـة',
      cell: ({ row }) => <span className="text-sm">{row.original.nurseName ?? '—'}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: 'الوقت',
      cell: ({ row }) => <DateFormatter date={row.original.createdAt} format="relative" />,
    },
  ];

  const rowActions = [
    {
      label: 'عرض التفاصيل',
      icon: Eye,
      onClick: (row: Record<string, unknown>) => setViewTarget(row as unknown as EmergencyItem),
    },
    {
      label: 'تعيين ممرض/ـة',
      icon: UserPlus,
      onClick: (row: Record<string, unknown>) => {
        const em = row as unknown as EmergencyItem;
        setAssignTarget(em);
        void fetchNearbyNurses(em);
      },
      hidden: (row: Record<string, unknown>) => (row as unknown as EmergencyItem).status !== 'pending',
    },
    {
      label: 'تنفيذ مباشر',
      icon: Zap,
      onClick: (row: Record<string, unknown>) => setExecuteTarget(row as unknown as EmergencyItem),
      hidden: (row: Record<string, unknown>) => {
        const em = row as unknown as EmergencyItem;
        return em.status !== 'pending' && em.status !== 'dispatched';
      },
    },
    {
      label: 'تم الحل',
      icon: CheckCircle2,
      onClick: (row: Record<string, unknown>) => handleResolve(row as unknown as EmergencyItem),
      hidden: (row: Record<string, unknown>) => !isActive((row as unknown as EmergencyItem).status),
    },
  ];

  const activeCount = emergencies.filter((e) => isActive(e.status)).length;
  const pendingCount = emergencies.filter((e) => e.status === 'pending').length;

  const EmergencyDetailView = ({ em }: { em: EmergencyItem }) => (
    <div className="space-y-4">
      {/* Emergency Header */}
      <div className={`rounded-xl border-2 p-4 ${
        isActive(em.status)
          ? 'border-red-300 dark:border-red-800 bg-red-50/50 dark:bg-red-950/20'
          : 'border-green-300 dark:border-green-800 bg-green-50/50 dark:bg-green-950/20'
      }`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-full flex items-center justify-center text-2xl ${
              isActive(em.status) ? 'bg-red-100 dark:bg-red-900/30 animate-pulse' : 'bg-green-100 dark:bg-green-900/30'
            }`}>
              {typeIcons[em.type] ?? '🚨'}
            </div>
            <div>
              <p className="font-bold text-sm">{typeLabels[em.type] ?? em.type}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full border ${priorityColors[em.priority] ?? ''}`}>
                أولوية: {priorityLabels[em.priority] ?? em.priority}
              </span>
            </div>
          </div>
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${statusColors[em.status] ?? ''}`}>
            {statusLabelsAr[em.status] ?? em.status}
          </span>
        </div>
      </div>

      {/* Description */}
      <div className="glass rounded-xl p-3">
        <p className="text-xs text-muted-foreground mb-1">الوصف</p>
        <p className="text-sm">{em.description}</p>
      </div>

      {/* Beneficiary & Nurse */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">المستفيد</p>
          <p className="text-sm font-medium">{em.beneficiaryName}</p>
          {em.beneficiaryPhone && (
            <div className="flex items-center gap-1.5 mt-1">
              <span className="text-xs text-muted-foreground">{em.beneficiaryPhone}</span>
              <a href={`tel:${em.beneficiaryPhone}`}><Phone className="w-3 h-3 text-blue-500" /></a>
              <a href={getWhatsAppUrl(em.beneficiaryPhone)} target="_blank" rel="noopener noreferrer"><MessageCircle className="w-3 h-3 text-green-500" /></a>
            </div>
          )}
        </div>
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">الممرض/ـة</p>
          <p className="text-sm font-medium">{em.nurseName ?? 'غير معيَّن'}</p>
        </div>
      </div>

      {/* Fee */}
      {em.emergencyFee && (
        <div className="flex items-center justify-between p-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-900/30">
          <span className="text-xs text-muted-foreground">رسوم الطوارئ</span>
          <span className="font-bold text-red-600 text-sm">{em.emergencyFee.toLocaleString('ar-YE')} ر.ي</span>
        </div>
      )}

      {/* Location */}
      {em.address && (
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 mb-1">
            <MapPin className="w-3.5 h-3.5 text-red-500" />
            <p className="text-xs text-muted-foreground">العنوان</p>
          </div>
          <p className="text-sm font-medium">{em.address}</p>
          {em.lat && em.lng && (
            <a href={`https://www.google.com/maps?q=${em.lat},${em.lng}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 mt-1">
              <Navigation className="w-3 h-3" /> عرض على الخريطة
            </a>
          )}
        </div>
      )}

      {/* Response Time */}
      {em.responseTime && (
        <div className="glass rounded-xl p-3 border-green-200 dark:border-green-900/30">
          <div className="flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-green-500" />
            <span className="text-xs text-muted-foreground">وقت الاستجابة</span>
          </div>
          <p className="text-sm font-bold text-green-700 dark:text-green-400">
            {em.responseTime < 60 ? `${em.responseTime} ثانية` : `${Math.round(em.responseTime / 60)} دقيقة`}
          </p>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        <DateFormatter date={em.createdAt} format="full" />
      </div>
    </div>
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <PageHeader title="إدارة الطوارئ" description="إدارة ومتابعة طلبات الطوارئ - تحديث تلقائي كل ١٥ ثانية" />
      </motion.div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3">
        {activeCount > 0 && (
          <motion.div variants={itemAnim}>
            <GlassCard className="border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center animate-pulse">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="font-bold text-red-700 dark:text-red-400 text-lg">{activeCount}</p>
                  <p className="text-xs text-red-600/80">حالات نشطة</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
        {pendingCount > 0 && (
          <motion.div variants={itemAnim}>
            <GlassCard className="border-yellow-200 dark:border-yellow-900/50 bg-yellow-50/50 dark:bg-yellow-950/20 p-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center animate-pulse">
                  <Timer className="w-5 h-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="font-bold text-yellow-700 dark:text-yellow-400 text-lg">{pendingCount}</p>
                  <p className="text-xs text-yellow-600/80">بانتظار التعيين</p>
                </div>
              </div>
            </GlassCard>
          </motion.div>
        )}
      </div>

      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="pending">معلق</SelectItem>
                <SelectItem value="dispatched">تم الإرسال</SelectItem>
                <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                <SelectItem value="resolved">تم الحل</SelectItem>
                <SelectItem value="cancelled">ملغي</SelectItem>
              </SelectContent>
            </Select>
            <Button variant="outline" size="icon" onClick={() => { setIsLoading(true); void fetchEmergencies(); }}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={itemAnim}>
        <DataTable
          columns={columns}
          data={emergencies}
          isLoading={isLoading}
          emptyMessage="لا توجد حالات طوارئ"
          emptyAction={{ label: 'تحديث', onClick: () => { setIsLoading(true); void fetchEmergencies(); } }}
          rowActions={rowActions as never}
          currentPage={page}
          pageCount={totalPages}
          onPageChange={setPage}
        />
      </motion.div>

      {/* View Details Dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Siren className="w-5 h-5 text-red-500" />
              تفاصيل حالة الطوارئ
            </DialogTitle>
          </DialogHeader>
          {viewTarget && <EmergencyDetailView em={viewTarget} />}
        </DialogContent>
      </Dialog>

      {/* Assign Nurse Dialog - with nearby nurses sorted by distance */}
      <Dialog open={!!assignTarget} onOpenChange={(open) => { if (!open) { setAssignTarget(null); setSelectedNurse(''); } }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-admin" />
              تعيين ممرض/ـة للطوارئ
            </DialogTitle>
            <DialogDescription>الممرضون مرتبون حسب القرب من موقع الطوارئ</DialogDescription>
          </DialogHeader>

          {isLoadingNurses ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-admin" />
              <span className="mr-2 text-sm text-muted-foreground">جارٍ البحث عن الممرضين القريبين...</span>
            </div>
          ) : nearbyNurses.length === 0 ? (
            <div className="text-center py-8">
              <User className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">لا يوجد ممرضون متاحون بالقرب من الموقع</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto custom-scrollbar">
              {nearbyNurses.map((nurse) => (
                <button
                  key={nurse.id}
                  onClick={() => setSelectedNurse(nurse.id)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl transition-all text-right ${
                    selectedNurse === nurse.id
                      ? 'ring-2 ring-admin bg-admin/5'
                      : 'hover:bg-muted/50'
                  }`}
                >
                  <Avatar className="w-10 h-10">
                    <AvatarFallback className="bg-admin/10 text-admin text-xs">
                      {nurse.name.slice(0, 2)}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-medium truncate">{nurse.name}</p>
                      {nurse.rating > 0 && (
                        <div className="flex items-center gap-0.5">
                          <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
                          <span className="text-[10px]">{nurse.rating.toFixed(1)}</span>
                        </div>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{nurse.specialty}</p>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3 text-red-500" />
                      <span className="text-sm font-bold text-red-600">{nurse.distance} كم</span>
                    </div>
                    <span className={`text-[10px] ${nurse.isAvailable ? 'text-green-600' : 'text-gray-400'}`}>
                      {nurse.isAvailable ? 'متاح' : 'غير متاح'}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => { setAssignTarget(null); setSelectedNurse(''); }} disabled={isAssigning}>إلغاء</Button>
            <Button onClick={handleAssign} disabled={isAssigning || !selectedNurse} className="bg-admin hover:bg-admin/90">
              {isAssigning ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <UserPlus className="w-4 h-4 ml-1" />}
              {isAssigning ? 'جارٍ التعيين...' : 'تعيين وإرسال'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Direct Execute Confirmation */}
      <Dialog open={!!executeTarget} onOpenChange={(open) => { if (!open) setExecuteTarget(null); }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-orange-500" />
              تنفيذ مباشر
            </DialogTitle>
            <DialogDescription>
              سيتم تغيير حالة الطوارئ إلى "قيد التنفيذ" فوراً
            </DialogDescription>
          </DialogHeader>
          {executeTarget && (
            <div className="p-3 rounded-xl bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-900/30">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{typeIcons[executeTarget.type] ?? '🚨'}</span>
                <span className="font-medium text-sm">{typeLabels[executeTarget.type] ?? executeTarget.type}</span>
              </div>
              <p className="text-xs text-muted-foreground">{executeTarget.beneficiaryName}</p>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setExecuteTarget(null)} disabled={isExecuting}>إلغاء</Button>
            <Button onClick={handleDirectExecute} disabled={isExecuting} className="bg-orange-600 hover:bg-orange-700 text-white">
              {isExecuting ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Play className="w-4 h-4 ml-1" />}
              {isExecuting ? 'جارٍ التنفيذ...' : 'تنفيذ الآن'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
