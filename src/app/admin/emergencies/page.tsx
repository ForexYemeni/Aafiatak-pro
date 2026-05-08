'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { AlertTriangle, Eye, UserPlus, RefreshCw, Clock, Phone, MessageCircle, MapPin, Navigation, Siren, Activity } from 'lucide-react';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { BadgeStatus } from '@/components/common/badge-status';
import { DateFormatter } from '@/components/common/date-formatter';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
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
  createdAt: string;
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
  const [selectedNurse, setSelectedNurse] = useState('');
  const [nurseOptions, setNurseOptions] = useState<{ id: string; name: string }[]>([]);
  const [isAssigning, setIsAssigning] = useState(false);

  const [statusTarget, setStatusTarget] = useState<EmergencyItem | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

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

  const fetchNurses = async () => {
    try {
      const res = await authFetch('/api/admin/nurses?limit=50&status=active');
      const json = await res.json();
      if (json.success && json.data) {
        const nursesArray = json.data.nurses ?? json.data;
        setNurseOptions((Array.isArray(nursesArray) ? nursesArray : []).map((n: Record<string, unknown>) => ({
          id: String(n.id ?? n._id ?? ''),
          name: String(n.name ?? ''),
        })));
      }
    } catch {
      toast.error('فشل تحميل قائمة الممرضين');
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

  const handleStatusUpdate = async () => {
    if (!statusTarget || !newStatus) return;
    setIsUpdating(true);
    try {
      const res = await authFetch(`/api/admin/emergencies/${statusTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تحديث حالة الطوارئ');
        void fetchEmergencies();
      } else {
        toast.error(json.message ?? 'فشل التحديث');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setIsUpdating(false);
      setStatusTarget(null);
      setNewStatus('');
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
        <span className={`text-xs px-2 py-1 rounded-full ${
          row.original.status === 'resolved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
          row.original.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
          row.original.status === 'dispatched' ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400' :
          row.original.status === 'in_progress' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
          'bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-400'
        }`}>
          {statusLabelsAr[row.original.status] ?? row.original.status}
        </span>
      ),
    },
    {
      accessorKey: 'nurseName',
      header: 'الممرض/ـة',
      cell: ({ row }) => <span className="text-sm">{row.original.nurseName ?? 'غير معيَّن'}</span>,
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
      onClick: (row: Record<string, unknown>) => setViewTarget(row as unknown as EmergencyItem),
    },
    {
      label: 'تعيين ممرض/ـة',
      onClick: (row: Record<string, unknown>) => {
        setAssignTarget(row as unknown as EmergencyItem);
        void fetchNurses();
      },
    },
    {
      label: 'تحديث الحالة',
      onClick: (row: Record<string, unknown>) => {
        setStatusTarget(row as unknown as EmergencyItem);
        setNewStatus((row as unknown as EmergencyItem).status);
      },
    },
  ];

  const activeCount = emergencies.filter((e) => isActive(e.status)).length;

  const EmergencyDetailView = ({ em }: { em: EmergencyItem }) => (
    <div className="space-y-4">
      {/* Emergency Header with pulsing animation */}
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
          <span className={`text-xs px-3 py-1.5 rounded-full font-medium ${
            em.status === 'resolved' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
            em.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
            em.status === 'in_progress' ? 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400' :
            'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
          }`}>
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

      {activeCount > 0 && (
        <motion.div variants={itemAnim}>
          <GlassCard className="border-red-200 dark:border-red-900/50 bg-red-50/50 dark:bg-red-950/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center animate-pulse">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div className="flex-1">
                <p className="font-semibold text-red-700 dark:text-red-400">
                  {activeCount} حالة طوارئ نشطة
                </p>
                <p className="text-sm text-red-600/80 dark:text-red-400/80">
                  تتطلب اهتمامًا فوريًا
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Clock className="w-3.5 h-3.5" />
                تحديث تلقائي كل ١٥ ثانية
              </div>
            </div>
          </GlassCard>
        </motion.div>
      )}

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

      {/* View Details */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل حالة الطوارئ</DialogTitle>
          </DialogHeader>
          {viewTarget && <EmergencyDetailView em={viewTarget} />}
        </DialogContent>
      </Dialog>

      {/* Assign Nurse */}
      <Dialog open={!!assignTarget} onOpenChange={(open) => { if (!open) setAssignTarget(null); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعيين ممرض/ـة للطوارئ</DialogTitle>
            <DialogDescription>اختر ممرض/ـة للإرسال فورًا</DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>اختر ممرض/ـة</Label>
            <Select value={selectedNurse} onValueChange={setSelectedNurse}>
              <SelectTrigger>
                <SelectValue placeholder="اختر ممرض/ـة" />
              </SelectTrigger>
              <SelectContent>
                {nurseOptions.map((n) => (
                  <SelectItem key={n.id} value={n.id}>{n.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)} disabled={isAssigning}>إلغاء</Button>
            <Button onClick={handleAssign} disabled={isAssigning || !selectedNurse} className="bg-admin hover:bg-admin/90">
              {isAssigning ? 'جارٍ التعيين...' : 'إرسال'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update - Arabic labels */}
      <Dialog open={!!statusTarget} onOpenChange={(open) => { if (!open) setStatusTarget(null); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تحديث حالة الطوارئ</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Label>الحالة الجديدة</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabelsAr).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStatusTarget(null)} disabled={isUpdating}>إلغاء</Button>
            <Button onClick={handleStatusUpdate} disabled={isUpdating} className="bg-admin hover:bg-admin/90">
              {isUpdating ? 'جارٍ التحديث...' : 'تحديث'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
