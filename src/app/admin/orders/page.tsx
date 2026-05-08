'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ClipboardList, Eye, UserPlus, RefreshCw, Phone, MessageCircle, MapPin, Clock, Calendar, Banknote, User, Stethoscope, Navigation, X, CheckCircle2, Search, Loader2, Star, Map, Zap, XCircle, AlertCircle } from 'lucide-react';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard } from '@/components/common/glass-card';
import { SearchInput } from '@/components/common/search-input';
import { BadgeStatus } from '@/components/common/badge-status';
import { DateFormatter } from '@/components/common/date-formatter';
import { Currency } from '@/components/common/currency';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
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

interface OrderItem {
  id: string;
  beneficiaryName: string;
  beneficiaryPhone?: string;
  beneficiaryId: string;
  nurseName: string | null;
  nursePhone?: string;
  nurseId: string | null;
  serviceName: string;
  status: string;
  totalPrice: number;
  basePrice?: number;
  commission?: number;
  nursePayout?: number;
  isEmergency: boolean;
  isNightService?: boolean;
  isFridayService?: boolean;
  paymentStatus?: string;
  paymentMethod?: string;
  beneficiaryAddress?: string;
  beneficiaryLat?: number;
  beneficiaryLng?: number;
  scheduledAt: string | null;
  createdAt: string;
  notes?: string;
}

interface NurseOption {
  id: string;
  name: string;
  phone?: string;
  specialization: string[];
  rating: number;
  completedJobs: number;
  isOnline: boolean;
  isAvailable: boolean;
  lat?: number;
  lng?: number;
  distance?: number;
}

const statusLabels: Record<string, string> = {
  pending: 'معلق',
  assigned: 'تم التعيين',
  accepted: 'مقبول',
  in_progress: 'قيد التنفيذ',
  completed: 'مكتمل',
  cancelled: 'ملغي',
  rejected: 'مرفوض',
};

const paymentStatusLabels: Record<string, string> = {
  pending: 'معلق',
  completed: 'مكتمل',
  failed: 'فاشل',
  refunded: 'مسترد',
};

const specializationLabels: Record<string, string> = {
  general_nursing: 'تمريض عام',
  critical_care: 'رعاية حرجة',
  pediatric: 'أطفال',
  elderly_care: 'مسنين',
  physiotherapy: 'علاج طبيعي',
  wound_care: 'جروح',
  iv_therapy: 'علاج وريدي',
  mental_health: 'صحة نفسية',
  post_surgery: 'بعد الجراحة',
  emergency: 'طوارئ',
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

function getWhatsAppUrl(phone: string) {
  const cleanPhone = phone.replace(/\D/g, '');
  const withCode = cleanPhone.startsWith('0') ? '967' + cleanPhone.substring(1) : cleanPhone.startsWith('967') ? cleanPhone : '967' + cleanPhone;
  return `https://wa.me/${withCode}`;
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

export default function AdminOrdersPage() {
  const authFetch = useAuthFetch();
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusTab, setStatusTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Assign dialog
  const [assignTarget, setAssignTarget] = useState<OrderItem | null>(null);
  const [nurses, setNurses] = useState<NurseOption[]>([]);
  const [isLoadingNurses, setIsLoadingNurses] = useState(false);
  const [selectedNurse, setSelectedNurse] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [nurseSearch, setNurseSearch] = useState('');

  // View dialog
  const [viewTarget, setViewTarget] = useState<OrderItem | null>(null);

  // Execute dialog
  const [executeTarget, setExecuteTarget] = useState<OrderItem | null>(null);
  const [executeNotes, setExecuteNotes] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<OrderItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Auto-refresh
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        search,
        ...(statusTab !== 'all' ? { status: statusTab } : {}),
      });
      const res = await authFetch(`/api/admin/orders?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        const ordersArray = json.data.orders ?? json.data;
        setOrders(Array.isArray(ordersArray) ? ordersArray : []);
        const pages = json.data.pages ?? json.data.totalPages;
        if (pages) setTotalPages(pages);
      }
    } catch {
      // silent for auto-refresh
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, page, search, statusTab]);

  useEffect(() => {
    setIsLoading(true);
    void fetchOrders();
  }, [fetchOrders]);

  // Auto-refresh every 15s
  useEffect(() => {
    intervalRef.current = setInterval(() => void fetchOrders(), 15000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [fetchOrders]);

  const fetchAvailableNurses = async (orderLat?: number, orderLng?: number) => {
    setIsLoadingNurses(true);
    setNurseSearch('');
    try {
      const res = await authFetch('/api/admin/nurses?limit=200&status=verified');
      const json = await res.json();
      if (json.success && json.data) {
        const nursesArray = json.data.nurses ?? json.data;
        let nurseList = (Array.isArray(nursesArray) ? nursesArray : []).map((n: Record<string, unknown>) => ({
          id: String(n.id ?? n._id ?? ''),
          name: String(n.name ?? ''),
          phone: String(n.phone ?? ''),
          specialization: Array.isArray(n.specialization) ? n.specialization : [],
          rating: Number(n.rating ?? 0),
          completedJobs: Number(n.completedJobs ?? 0),
          isOnline: Boolean(n.isOnline),
          isAvailable: Boolean(n.isAvailable),
          lat: (n.lat != null && n.lat !== 0) ? Number(n.lat) : undefined,
          lng: (n.lng != null && n.lng !== 0) ? Number(n.lng) : undefined,
          distance: undefined as number | undefined,
        }));

        // Calculate distance if order has location
        if (orderLat && orderLng) {
          nurseList = nurseList.map(n => ({
            ...n,
            distance: (n.lat && n.lng) ? calculateDistance(orderLat, orderLng, n.lat, n.lng) : undefined,
          }));
          // Sort by distance (nearest first)
          nurseList.sort((a, b) => {
            if (a.distance === undefined && b.distance === undefined) return 0;
            if (a.distance === undefined) return 1;
            if (b.distance === undefined) return -1;
            return a.distance - b.distance;
          });
        }

        setNurses(nurseList);
      }
    } catch {
      toast.error('فشل تحميل قائمة الممرضين');
    } finally {
      setIsLoadingNurses(false);
    }
  };

  const handleDirectAssign = async (nurseId: string) => {
    if (!assignTarget) return;
    setIsAssigning(true);
    setSelectedNurse(nurseId);
    try {
      const res = await authFetch(`/api/admin/orders/${assignTarget.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ nurseId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تعيين الممرض/ـة بنجاح');
        void fetchOrders();
        setAssignTarget(null);
      } else {
        toast.error(json.message ?? 'فشل التعيين');
      }
    } catch {
      toast.error('حدث خطأ أثناء التعيين');
    } finally {
      setIsAssigning(false);
      setSelectedNurse('');
    }
  };

  const handleDirectExecute = async () => {
    if (!executeTarget) return;
    setIsExecuting(true);
    try {
      const res = await authFetch(`/api/admin/orders/${executeTarget.id}/execute`, {
        method: 'POST',
        body: JSON.stringify({ notes: executeNotes || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تنفيذ الطلب مباشرة بنجاح');
        void fetchOrders();
        setExecuteTarget(null);
        setExecuteNotes('');
      } else {
        toast.error(json.message ?? 'فشل التنفيذ');
      }
    } catch {
      toast.error('حدث خطأ أثناء التنفيذ');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleCancelOrder = async () => {
    if (!cancelTarget) return;
    setIsCancelling(true);
    try {
      const res = await authFetch(`/api/admin/orders/${cancelTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'cancelled',
          cancelReason: cancelReason || 'إلغاء بواسطة الإدارة',
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم إلغاء الطلب');
        void fetchOrders();
        setCancelTarget(null);
        setCancelReason('');
      } else {
        toast.error(json.message ?? 'فشل الإلغاء');
      }
    } catch {
      toast.error('حدث خطأ أثناء الإلغاء');
    } finally {
      setIsCancelling(false);
    }
  };

  const openAssignDialog = (order: OrderItem) => {
    setAssignTarget(order);
    setSelectedNurse('');
    void fetchAvailableNurses(order.beneficiaryLat, order.beneficiaryLng);
  };

  // Filter nurses by search
  const filteredNurses = nurses.filter(n => {
    if (!nurseSearch) return true;
    const q = nurseSearch.toLowerCase();
    return (
      n.name.toLowerCase().includes(q) ||
      n.phone?.includes(q) ||
      n.specialization.some(s => (specializationLabels[s] ?? s).toLowerCase().includes(q))
    );
  });

  // Separate nearby nurses (< 10km) and other nurses
  const nearbyNurses = filteredNurses.filter(n => n.distance !== undefined && n.distance <= 10);
  const otherNurses = filteredNurses.filter(n => n.distance === undefined || n.distance > 10);

  const columns: ColumnDef<OrderItem, unknown>[] = [
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
          {row.original.isEmergency && (
            <Badge variant="destructive" className="text-[10px] mt-1">طوارئ</Badge>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'serviceName',
      header: 'الخدمة',
      cell: ({ row }) => (
        <div>
          <p className="text-sm">{row.original.serviceName}</p>
          {row.original.isNightService && <Badge className="text-[10px] mr-1 bg-indigo-100 text-indigo-700">ليلي</Badge>}
          {row.original.isFridayService && <Badge className="text-[10px] mr-1 bg-amber-100 text-amber-700">جمعة</Badge>}
        </div>
      ),
    },
    {
      accessorKey: 'nurseName',
      header: 'الممرض/ـة',
      cell: ({ row }) => (
        <span className="text-sm">{row.original.nurseName ?? <span className="text-muted-foreground">غير معيَّن</span>}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'الحالة',
      cell: ({ row }) => <BadgeStatus status={row.original.status} />,
    },
    {
      accessorKey: 'totalPrice',
      header: 'المبلغ',
      cell: ({ row }) => <Currency amount={row.original.totalPrice} />,
    },
    {
      accessorKey: 'createdAt',
      header: 'التاريخ',
      cell: ({ row }) => <DateFormatter date={row.original.createdAt} format="short" />,
    },
  ];

  const rowActions = [
    {
      label: 'عرض التفاصيل',
      icon: Eye,
      onClick: (row: Record<string, unknown>) => setViewTarget(row as unknown as OrderItem),
    },
    {
      label: 'تعيين ممرض/ـة',
      icon: UserPlus,
      onClick: (row: Record<string, unknown>) => openAssignDialog(row as unknown as OrderItem),
      visible: (row: Record<string, unknown>) => {
        const order = row as unknown as OrderItem;
        return !order.nurseId && order.status === 'pending';
      },
    },
    {
      label: 'تنفيذ مباشر',
      icon: Zap,
      onClick: (row: Record<string, unknown>) => {
        setExecuteTarget(row as unknown as OrderItem);
        setExecuteNotes('');
      },
      visible: (row: Record<string, unknown>) => {
        const order = row as unknown as OrderItem;
        return ['pending', 'assigned', 'accepted'].includes(order.status);
      },
    },
    {
      label: 'إلغاء الطلب',
      icon: XCircle,
      onClick: (row: Record<string, unknown>) => {
        setCancelTarget(row as unknown as OrderItem);
        setCancelReason('');
      },
      visible: (row: Record<string, unknown>) => {
        const order = row as unknown as OrderItem;
        return ['pending', 'assigned', 'accepted', 'in_progress'].includes(order.status);
      },
    },
  ];

  const tabs = [
    { value: 'all', label: 'الكل' },
    { value: 'pending', label: 'معلق' },
    { value: 'assigned', label: 'تم التعيين' },
    { value: 'accepted', label: 'مقبول' },
    { value: 'in_progress', label: 'قيد التنفيذ' },
    { value: 'completed', label: 'مكتمل' },
    { value: 'cancelled', label: 'ملغي' },
  ];

  const NurseCard = ({ nurse, onSelect, isSelected, isAssigning }: { nurse: NurseOption; onSelect: (id: string) => void; isSelected: boolean; isAssigning: boolean }) => (
    <button
      onClick={() => onSelect(nurse.id)}
      disabled={isAssigning}
      className={`w-full text-right p-3 rounded-xl border-2 transition-all ${
        isSelected
          ? 'border-admin bg-admin/5 dark:bg-admin/10 shadow-md'
          : 'border-border hover:border-admin/30 hover:shadow-sm'
      } ${isAssigning && isSelected ? 'opacity-70' : ''}`}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <Avatar className="w-10 h-10">
            <AvatarFallback className="text-xs bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
              {nurse.name.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          {nurse.isOnline && (
            <span className="absolute -bottom-0.5 -left-0.5 w-3 h-3 bg-green-500 border-2 border-background rounded-full" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium truncate">{nurse.name}</p>
            {nurse.isOnline && <Badge className="text-[9px] px-1 py-0 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">متصل</Badge>}
          </div>
          <p className="text-[10px] text-muted-foreground truncate">
            {nurse.specialization.slice(0, 2).map(s => specializationLabels[s] ?? s).join(' • ')}
          </p>
        </div>
        <div className="text-left shrink-0">
          {nurse.distance !== undefined && (
            <p className="text-xs font-bold text-admin">{nurse.distance} كم</p>
          )}
          <div className="flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="text-xs font-medium">{nurse.rating.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </button>
  );

  const OrderDetailView = ({ order }: { order: OrderItem }) => (
    <div className="space-y-4">
      {/* Beneficiary Info */}
      <div className="flex items-center gap-3 p-3 glass rounded-xl">
        <Avatar className="w-12 h-12">
          <AvatarFallback className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
            <User className="w-5 h-5" />
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <p className="font-semibold">{order.beneficiaryName}</p>
          {order.beneficiaryPhone && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-sm text-muted-foreground">{order.beneficiaryPhone}</span>
              <a href={`tel:${order.beneficiaryPhone}`}><Phone className="w-3.5 h-3.5 text-blue-500" /></a>
              <a href={getWhatsAppUrl(order.beneficiaryPhone)} target="_blank" rel="noopener noreferrer"><MessageCircle className="w-3.5 h-3.5 text-green-500" /></a>
            </div>
          )}
        </div>
        <BadgeStatus status={order.status} size="md" />
      </div>

      {/* Order Details Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Stethoscope className="w-3.5 h-3.5" />
            <p className="text-xs">الخدمة</p>
          </div>
          <p className="text-sm font-medium">{order.serviceName}</p>
        </div>
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Banknote className="w-3.5 h-3.5" />
            <p className="text-xs">المبلغ الإجمالي</p>
          </div>
          <p className="text-sm font-bold"><Currency amount={order.totalPrice} /></p>
        </div>
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <User className="w-3.5 h-3.5" />
            <p className="text-xs">الممرض/ـة</p>
          </div>
          <p className="text-sm font-medium">{order.nurseName ?? 'غير معيَّن'}</p>
          {order.nursePhone && (
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-xs text-muted-foreground">{order.nursePhone}</span>
              <a href={getWhatsAppUrl(order.nursePhone)} target="_blank" rel="noopener noreferrer"><MessageCircle className="w-3 h-3 text-green-500" /></a>
            </div>
          )}
        </div>
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <Calendar className="w-3.5 h-3.5" />
            <p className="text-xs">التاريخ</p>
          </div>
          <p className="text-sm font-medium"><DateFormatter date={order.createdAt} format="short" /></p>
        </div>
      </div>

      {/* Location */}
      {order.beneficiaryAddress && (
        <div className="glass rounded-xl p-3">
          <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
            <MapPin className="w-3.5 h-3.5 text-red-500" />
            <p className="text-xs">الموقع</p>
          </div>
          <p className="text-sm font-medium">{order.beneficiaryAddress}</p>
          {order.beneficiaryLat && order.beneficiaryLng && (
            <a href={`https://www.google.com/maps?q=${order.beneficiaryLat},${order.beneficiaryLng}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 mt-1">
              <Navigation className="w-3 h-3" /> عرض على الخريطة
            </a>
          )}
        </div>
      )}

      {/* Payment Info */}
      {order.paymentStatus && (
        <div className="glass rounded-xl p-3">
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">حالة الدفع</span>
            <Badge variant={order.paymentStatus === 'completed' ? 'default' : 'secondary'}>
              {paymentStatusLabels[order.paymentStatus] ?? order.paymentStatus}
            </Badge>
          </div>
          {order.commission !== undefined && order.commission > 0 && (
            <div className="flex items-center justify-between mt-2">
              <span className="text-xs text-muted-foreground">عمولة المنصة</span>
              <Currency amount={order.commission} />
            </div>
          )}
          {order.nursePayout !== undefined && order.nursePayout > 0 && (
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-muted-foreground">أتعاب الممرض/ـة</span>
              <Currency amount={order.nursePayout} />
            </div>
          )}
        </div>
      )}

      {/* Notes */}
      {order.notes && (
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-muted-foreground">ملاحظات</p>
          <p className="text-sm">{order.notes}</p>
        </div>
      )}

      {/* Emergency / Night / Friday badges */}
      <div className="flex flex-wrap gap-2">
        {order.isEmergency && <Badge variant="destructive">طلب طوارئ</Badge>}
        {order.isNightService && <Badge className="bg-indigo-100 text-indigo-700">خدمة ليلية</Badge>}
        {order.isFridayService && <Badge className="bg-amber-100 text-amber-700">خدمة جمعة</Badge>}
      </div>

      {order.scheduledAt && (
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Clock className="w-3.5 h-3.5" />
          موعد التنفيذ: <DateFormatter date={order.scheduledAt} format="full" />
        </div>
      )}

      {/* Action Buttons */}
      <div className="space-y-2">
        {/* Assign nurse if no nurse assigned */}
        {!order.nurseId && order.status === 'pending' && (
          <Button
            onClick={() => { setViewTarget(null); openAssignDialog(order); }}
            className="w-full bg-admin hover:bg-admin/90 gap-2"
          >
            <UserPlus className="w-4 h-4" />
            تعيين ممرض/ـة لهذا الطلب
          </Button>
        )}

        {/* Direct execution button */}
        {['pending', 'assigned', 'accepted'].includes(order.status) && (
          <Button
            onClick={() => { setViewTarget(null); setExecuteTarget(order); setExecuteNotes(''); }}
            variant="outline"
            className="w-full gap-2 border-green-500 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
          >
            <Zap className="w-4 h-4" />
            تنفيذ مباشر من الإدارة
          </Button>
        )}

        {/* Cancel order button */}
        {['pending', 'assigned', 'accepted', 'in_progress'].includes(order.status) && (
          <Button
            onClick={() => { setViewTarget(null); setCancelTarget(order); setCancelReason(''); }}
            variant="outline"
            className="w-full gap-2 border-destructive text-destructive hover:bg-destructive/10"
          >
            <XCircle className="w-4 h-4" />
            إلغاء الطلب
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <PageHeader title="إدارة الطلبات" description="عرض وإدارة طلبات الخدمة - تحديث تلقائي كل ١٥ ثانية" />
      </motion.div>

      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <div className="flex flex-col gap-4 mb-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <SearchInput placeholder="بحث بالاسم أو الهاتف..." onChange={setSearch} className="flex-1" />
              <Button variant="outline" size="icon" onClick={() => { setIsLoading(true); void fetchOrders(); }}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
            <Tabs value={statusTab} onValueChange={setStatusTab}>
              <TabsList className="flex-wrap h-auto gap-1">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={itemAnim}>
        <DataTable
          columns={columns}
          data={orders}
          isLoading={isLoading}
          emptyMessage="لا توجد طلبات"
          emptyAction={{ label: 'تحديث', onClick: () => void fetchOrders() }}
          rowActions={rowActions as never}
          currentPage={page}
          pageCount={totalPages}
          onPageChange={setPage}
        />
      </motion.div>

      {/* View Order Dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تفاصيل الطلب</DialogTitle>
          </DialogHeader>
          {viewTarget && <OrderDetailView order={viewTarget} />}
        </DialogContent>
      </Dialog>

      {/* Assign Nurse Dialog */}
      <Dialog open={!!assignTarget} onOpenChange={(open) => { if (!open) { setAssignTarget(null); setSelectedNurse(''); } }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-admin" />
              تعيين ممرض/ـة
            </DialogTitle>
            <DialogDescription>
              اضغط على الممرض/ـة لتعيينه/ا مباشرة للطلب
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Order info */}
            {assignTarget && (
              <div className="glass rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{assignTarget.beneficiaryName}</p>
                    <p className="text-xs text-muted-foreground">{assignTarget.serviceName}</p>
                  </div>
                  <Currency amount={assignTarget.totalPrice} className="text-sm" />
                </div>
                {assignTarget.beneficiaryLat && assignTarget.beneficiaryLng && (
                  <a href={`https://www.google.com/maps?q=${assignTarget.beneficiaryLat},${assignTarget.beneficiaryLng}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 mt-1">
                    <MapPin className="w-3 h-3" /> موقع المستفيد
                  </a>
                )}
              </div>
            )}

            {/* Search nurses */}
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={nurseSearch}
                onChange={(e) => setNurseSearch(e.target.value)}
                placeholder="بحث بالاسم أو التخصص..."
                className="pr-9"
              />
            </div>

            {isLoadingNurses ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 text-admin animate-spin" />
                <span className="mr-2 text-sm text-muted-foreground">جارٍ تحميل الممرضين...</span>
              </div>
            ) : nurses.length === 0 ? (
              <div className="text-center py-8">
                <Stethoscope className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">لا يوجد ممرضون موثقون حالياً</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-[50vh] overflow-y-auto">
                {/* Nearby Nurses */}
                {nearbyNurses.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-admin" />
                      <Label className="text-sm font-semibold">الممرضون الأقرب ({nearbyNurses.length})</Label>
                    </div>
                    <div className="space-y-2">
                      {nearbyNurses.map((n) => (
                        <NurseCard
                          key={n.id}
                          nurse={n}
                          onSelect={handleDirectAssign}
                          isSelected={selectedNurse === n.id}
                          isAssigning={isAssigning}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {/* Other Nurses */}
                {otherNurses.length > 0 && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Stethoscope className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm font-semibold text-muted-foreground">
                        {nearbyNurses.length > 0 ? 'ممرضون آخرون' : 'الممرضون المتاحون'} ({otherNurses.length})
                      </Label>
                    </div>
                    <div className="space-y-2">
                      {otherNurses.slice(0, 20).map((n) => (
                        <NurseCard
                          key={n.id}
                          nurse={n}
                          onSelect={handleDirectAssign}
                          isSelected={selectedNurse === n.id}
                          isAssigning={isAssigning}
                        />
                      ))}
                    </div>
                  </div>
                )}

                {filteredNurses.length === 0 && nurseSearch && (
                  <p className="text-center text-sm text-muted-foreground py-4">لا توجد نتائج مطابقة</p>
                )}
              </div>
            )}
          </div>

          {isAssigning && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-admin">
              <Loader2 className="w-4 h-4 animate-spin" />
              جارٍ التعيين...
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Direct Execute Dialog */}
      <Dialog open={!!executeTarget} onOpenChange={(open) => { if (!open) { setExecuteTarget(null); setExecuteNotes(''); } }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5 text-green-600" />
              تنفيذ مباشر من الإدارة
            </DialogTitle>
            <DialogDescription>
              سيتم تحويل حالة الطلب إلى مكتمل مباشرة
            </DialogDescription>
          </DialogHeader>

          {executeTarget && (
            <div className="space-y-4 py-2">
              {/* Order info */}
              <div className="glass rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{executeTarget.beneficiaryName}</p>
                    <p className="text-xs text-muted-foreground">{executeTarget.serviceName}</p>
                  </div>
                  <Currency amount={executeTarget.totalPrice} className="text-sm" />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-xs text-muted-foreground">الحالة الحالية:</span>
                  <BadgeStatus status={executeTarget.status} />
                </div>
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  سيتم تنفيذ الطلب مباشرة وتحديث حالته إلى مكتمل. {executeTarget.nurseId && 'سيتم إشعار الممرض المعين بإلغاء تعيينه.'}
                </p>
              </div>

              {/* Optional notes */}
              <div>
                <Label className="text-sm mb-1.5 block">ملاحظات (اختياري)</Label>
                <Textarea
                  value={executeNotes}
                  onChange={(e) => setExecuteNotes(e.target.value)}
                  placeholder="أضف ملاحظات حول سبب التنفيذ المباشر..."
                  className="min-h-[80px]"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setExecuteTarget(null); setExecuteNotes(''); }}
              disabled={isExecuting}
            >
              إلغاء
            </Button>
            <Button
              className="bg-green-600 hover:bg-green-700 gap-2"
              onClick={handleDirectExecute}
              disabled={isExecuting}
            >
              {isExecuting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4" />
              )}
              تنفيذ مباشر
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Order Dialog */}
      <Dialog open={!!cancelTarget} onOpenChange={(open) => { if (!open) { setCancelTarget(null); setCancelReason(''); } }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <XCircle className="w-5 h-5 text-destructive" />
              إلغاء الطلب
            </DialogTitle>
            <DialogDescription>
              هل أنت متأكد من إلغاء هذا الطلب؟
            </DialogDescription>
          </DialogHeader>

          {cancelTarget && (
            <div className="space-y-4 py-2">
              <div className="glass rounded-xl p-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">{cancelTarget.beneficiaryName}</p>
                    <p className="text-xs text-muted-foreground">{cancelTarget.serviceName}</p>
                  </div>
                  <BadgeStatus status={cancelTarget.status} />
                </div>
              </div>

              <div>
                <Label className="text-sm mb-1.5 block">سبب الإلغاء</Label>
                <Textarea
                  value={cancelReason}
                  onChange={(e) => setCancelReason(e.target.value)}
                  placeholder="أدخل سبب إلغاء الطلب..."
                  className="min-h-[80px]"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setCancelTarget(null); setCancelReason(''); }}
              disabled={isCancelling}
            >
              تراجع
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              onClick={handleCancelOrder}
              disabled={isCancelling}
            >
              {isCancelling ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <XCircle className="w-4 h-4" />
              )}
              إلغاء الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
