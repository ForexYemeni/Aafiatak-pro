'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ClipboardList, Eye, UserPlus, RefreshCw, Phone, MessageCircle, MapPin,
  Clock, Calendar, Banknote, User, Stethoscope, Navigation, X, CheckCircle2,
  Search, Loader2, Star, Zap, XCircle, AlertCircle, CreditCard, Shield,
  Image as ImageIcon, ChevronDown, ArrowUpRight, CircleDollarSign,
  Users, UserCheck, ShieldCheck, Ban, FileText, ExternalLink, ZoomIn,
  Smartphone, Building2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { SPECIALIZATION_LABELS } from '@/lib/constants';
import { SearchInput } from '@/components/common/search-input';
import { Currency, formatYemeniRial } from '@/components/common/currency';
import { useAuthFetch, _GET_CACHE_readSync } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
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
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';

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
  paymentMethodId?: string;
  paymentMethodName?: string | null;
  paymentMethodAccountName?: string | null;
  paymentMethodAccountNumber?: string | null;
  paymentMethodInstructions?: string | null;
  hasPaymentProof?: boolean;
  paymentProofData?: string;
  beneficiaryAddress?: string;
  beneficiaryLat?: number;
  beneficiaryLng?: number;
  scheduledAt: string | null;
  createdAt: string;
  notes?: string;
  cancelReason?: string;
  isUnifiedOrder?: boolean;
  services?: Array<{
    serviceId: string;
    nameAr: string;
    basePrice: number;
    quantity: number;
    duration: number;
  }>;
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

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string; icon: React.ElementType }> = {
  pending: { label: 'معلق', color: 'text-amber-700', bg: 'bg-amber-50', border: 'border-amber-200', icon: Clock },
  awaiting_payment: { label: 'بانتظار الدفع', color: 'text-orange-700', bg: 'bg-orange-50', border: 'border-orange-200', icon: CreditCard },
  assigned: { label: 'تم التعيين', color: 'text-blue-700', bg: 'bg-blue-50', border: 'border-blue-200', icon: UserCheck },
  accepted: { label: 'مقبول', color: 'text-sky-700', bg: 'bg-sky-50', border: 'border-sky-200', icon: CheckCircle2 },
  in_progress: { label: 'قيد التنفيذ', color: 'text-indigo-700', bg: 'bg-indigo-50', border: 'border-indigo-200', icon: Zap },
  completed: { label: 'مكتمل', color: 'text-green-700', bg: 'bg-green-50', border: 'border-green-200', icon: CheckCircle2 },
  cancelled: { label: 'ملغي', color: 'text-red-700', bg: 'bg-red-50', border: 'border-red-200', icon: Ban },
  rejected: { label: 'مرفوض', color: 'text-rose-700', bg: 'bg-rose-50', border: 'border-rose-200', icon: XCircle },
};

const paymentStatusConfig: Record<string, { label: string; color: string; bg: string }> = {
  pending: { label: 'معلق', color: 'text-amber-700', bg: 'bg-amber-100' },
  completed: { label: 'مكتمل', color: 'text-green-700', bg: 'bg-green-100' },
  failed: { label: 'فاشل', color: 'text-red-700', bg: 'bg-red-100' },
  refunded: { label: 'مسترد', color: 'text-blue-700', bg: 'bg-blue-100' },
  awaiting_confirmation: { label: 'بانتظار التأكيد', color: 'text-orange-700', bg: 'bg-orange-100' },
};

// SPECIALIZATION_LABELS → imported from @/lib/constants as SPECIALIZATION_LABELS

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.06 } } };
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

function timeAgo(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${hours} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `منذ ${days} يوم`;
  return past.toLocaleDateString('ar-SA');
}

export default function AdminOrdersPage() {
  const authFetch = useAuthFetch();
  // Read from in-memory cache synchronously — no skeleton if cache is warm
  const [orders, setOrders] = useState<OrderItem[]>(() => {
    const c = _GET_CACHE_readSync<{ success: boolean; data: { orders?: OrderItem[] } }>('/api/admin/orders?page=1&limit=20&search=');
    return c?.success && Array.isArray(c.data?.orders) ? c.data.orders : [];
  });
  const [isLoading, setIsLoading] = useState<boolean>(() => {
    const c = _GET_CACHE_readSync('/api/admin/orders?page=1&limit=20&search=');
    return !(c as any)?.success;
  });
  const [statusTab, setStatusTab] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [counts, setCounts] = useState<Record<string, number>>({});

  // Assign dialog
  const [assignTarget, setAssignTarget] = useState<OrderItem | null>(null);
  const [nurses, setNurses] = useState<NurseOption[]>([]);
  const [isLoadingNurses, setIsLoadingNurses] = useState(false);
  const [selectedNurse, setSelectedNurse] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);
  const [nurseSearch, setNurseSearch] = useState('');

  // View dialog
  const [viewTarget, setViewTarget] = useState<OrderItem | null>(null);

  // Payment confirm dialog
  const [paymentTarget, setPaymentTarget] = useState<OrderItem | null>(null);
  const [isConfirmingPayment, setIsConfirmingPayment] = useState(false);

  // Reject dialog
  const [rejectTarget, setRejectTarget] = useState<OrderItem | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [isRejecting, setIsRejecting] = useState(false);

  // Execute dialog
  const [executeTarget, setExecuteTarget] = useState<OrderItem | null>(null);
  const [executeNotes, setExecuteNotes] = useState('');
  const [isExecuting, setIsExecuting] = useState(false);

  // Cancel dialog
  const [cancelTarget, setCancelTarget] = useState<OrderItem | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Image viewer
  const [imageViewerSrc, setImageViewerSrc] = useState<string | null>(null);

  const fetchOrders = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '20',
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

        // Calculate counts
        const c: Record<string, number> = { all: ordersArray.length || 0 };
        ordersArray.forEach((o: OrderItem) => { c[o.status] = (c[o.status] || 0) + 1; });
        setCounts(c);
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

  const { refresh: realtimeRefreshOrders } = useRealtimeRefresh({
    entities: ['order'],
    onRefresh: () => void fetchOrders(),
    fallbackInterval: 5000,
  });

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

        if (orderLat && orderLng) {
          nurseList = nurseList.map(n => ({
            ...n,
            distance: (n.lat && n.lng) ? calculateDistance(orderLat, orderLng, n.lat, n.lng) : undefined,
          }));
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

  const handleConfirmPayment = async () => {
    if (!paymentTarget) return;
    setIsConfirmingPayment(true);
    try {
      const res = await authFetch(`/api/admin/orders/${paymentTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          paymentStatus: 'completed',
          status: 'pending',
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تأكيد الدفع بنجاح');
        void fetchOrders();
        setPaymentTarget(null);
      } else {
        toast.error(json.message ?? 'فشل تأكيد الدفع');
      }
    } catch {
      toast.error('حدث خطأ أثناء تأكيد الدفع');
    } finally {
      setIsConfirmingPayment(false);
    }
  };

  const handleRejectOrder = async () => {
    if (!rejectTarget) return;
    setIsRejecting(true);
    try {
      const res = await authFetch(`/api/admin/orders/${rejectTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'rejected',
          cancelReason: rejectReason || 'مرفوض بواسطة الإدارة',
          paymentStatus: rejectTarget.paymentStatus === 'awaiting_confirmation' ? 'failed' : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم رفض الطلب');
        void fetchOrders();
        setRejectTarget(null);
        setRejectReason('');
      } else {
        toast.error(json.message ?? 'فشل رفض الطلب');
      }
    } catch {
      toast.error('حدث خطأ أثناء رفض الطلب');
    } finally {
      setIsRejecting(false);
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

  const filteredNurses = nurses.filter(n => {
    if (!nurseSearch) return true;
    const q = nurseSearch.toLowerCase();
    return (
      n.name.toLowerCase().includes(q) ||
      n.phone?.includes(q) ||
      n.specialization.some(s => (SPECIALIZATION_LABELS[s] ?? s).toLowerCase().includes(q))
    );
  });

  const nearbyNurses = filteredNurses.filter(n => n.distance !== undefined && n.distance <= 10);
  const otherNurses = filteredNurses.filter(n => n.distance === undefined || n.distance > 10);

  const tabs = [
    { value: 'all', label: 'الكل', icon: ClipboardList },
    { value: 'awaiting_payment', label: 'بانتظار الدفع', icon: CreditCard },
    { value: 'pending', label: 'معلق', icon: Clock },
    { value: 'assigned', label: 'تم التعيين', icon: UserCheck },
    { value: 'in_progress', label: 'قيد التنفيذ', icon: Zap },
    { value: 'completed', label: 'مكتمل', icon: CheckCircle2 },
    { value: 'cancelled', label: 'ملغي', icon: Ban },
  ];

  // Nurse card component
  const NurseCard = ({ nurse, onSelect, isSelected, isAssigning }: { nurse: NurseOption; onSelect: (id: string) => void; isSelected: boolean; isAssigning: boolean }) => (
    <button
      onClick={() => onSelect(nurse.id)}
      disabled={isAssigning}
      className={`w-full text-right p-3 rounded-xl border-2 transition-all duration-200 ${
        isSelected
          ? 'border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/20 shadow-md shadow-emerald-500/10'
          : 'border-border hover:border-emerald-300 hover:shadow-sm'
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
            {nurse.specialization.slice(0, 2).map(s => SPECIALIZATION_LABELS[s] ?? s).join(' • ')}
          </p>
        </div>
        <div className="text-left shrink-0 space-y-1">
          {nurse.distance !== undefined && (
            <Badge variant="outline" className="text-[10px] px-1.5 py-0.5 font-bold">
              <MapPin className="w-2.5 h-2.5 ml-0.5" />
              {nurse.distance} كم
            </Badge>
          )}
          <div className="flex items-center gap-0.5">
            <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
            <span className="text-xs font-medium">{nurse.rating.toFixed(1)}</span>
          </div>
        </div>
      </div>
    </button>
  );

  // Order Card Component - Professional Design
  const OrderCard = ({ order }: { order: OrderItem }) => {
    const statusInfo = statusConfig[order.status] || statusConfig.pending;
    const payInfo = order.paymentStatus ? (paymentStatusConfig[order.paymentStatus] || paymentStatusConfig.pending) : null;
    const StatusIcon = statusInfo.icon;
    const shortId = '#' + order.id.slice(-6).toUpperCase();

    const needsPaymentConfirmation = order.status === 'awaiting_payment' && order.paymentStatus === 'awaiting_confirmation';
    const canAssign = !order.nurseId && (order.status === 'pending' || order.status === 'awaiting_payment');
    const canExecute = ['pending', 'assigned', 'accepted'].includes(order.status);
    const canCancel = ['pending', 'assigned', 'accepted', 'in_progress', 'awaiting_payment'].includes(order.status);

    return (
      <motion.div
        variants={itemAnim}
        className={`relative rounded-2xl border-2 overflow-hidden transition-all duration-300 hover:shadow-lg ${
          order.isEmergency ? 'border-red-300 dark:border-red-800' : 'border-border'
        }`}
      >
        {/* Emergency stripe */}
        {order.isEmergency && (
          <div className="absolute top-0 right-0 left-0 h-1.5 bg-gradient-to-l from-red-600 via-red-500 to-orange-500" />
        )}

        {/* Card Header */}
        <div className={`p-4 ${order.isEmergency ? 'pt-5' : ''}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 flex-1 min-w-0">
              {/* Beneficiary Avatar */}
              <div className="relative shrink-0">
                <Avatar className="w-11 h-11 border-2 border-background shadow-sm">
                  <AvatarFallback className="text-sm bg-gradient-to-br from-purple-500 to-purple-700 text-white font-bold">
                    {order.beneficiaryName?.charAt(0) || 'م'}
                  </AvatarFallback>
                </Avatar>
                {order.isEmergency && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                    <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500" />
                  </span>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-sm truncate">{order.beneficiaryName}</p>
                  <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md shrink-0">{shortId}</span>
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  <p className="text-xs text-muted-foreground truncate">{order.serviceName}</p>
                  {order.isUnifiedOrder && order.services && order.services.length > 1 && (
                    <Badge className="text-[9px] px-1.5 py-0 bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400 shrink-0">
                      {order.services.length} خدمات
                    </Badge>
                  )}
                  {order.isEmergency && <Badge variant="destructive" className="text-[9px] px-1.5 py-0 shrink-0">طوارئ</Badge>}
                  {order.isNightService && <Badge className="text-[9px] px-1.5 py-0 bg-indigo-100 text-indigo-700 shrink-0">ليلي</Badge>}
                  {order.isFridayService && <Badge className="text-[9px] px-1.5 py-0 bg-amber-100 text-amber-700 shrink-0">جمعة</Badge>}
                </div>
              </div>
            </div>

            {/* Status Badge */}
            <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shrink-0 ${statusInfo.bg} ${statusInfo.color} ${statusInfo.border} border`}>
              <StatusIcon className="w-3 h-3" />
              {statusInfo.label}
            </div>
          </div>

          {/* Order Info Row */}
          <div className="flex items-center gap-3 mt-3 flex-wrap">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Banknote className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-bold text-emerald-700 dark:text-emerald-400">{formatYemeniRial(order.totalPrice)}</span>
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span>{timeAgo(order.createdAt)}</span>
            </div>
            {order.nurseName && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Stethoscope className="w-3 h-3" />
                <span className="truncate">{order.nurseName}</span>
              </div>
            )}
            {order.beneficiaryPhone && (
              <div className="flex items-center gap-1 shrink-0">
                <a href={`tel:${order.beneficiaryPhone}`} className="p-1 rounded-full hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600"><Phone className="w-3.5 h-3.5" /></a>
                <a href={getWhatsAppUrl(order.beneficiaryPhone)} target="_blank" rel="noopener noreferrer" className="p-1 rounded-full hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600"><MessageCircle className="w-3.5 h-3.5" /></a>
              </div>
            )}
          </div>

          {/* Payment Status Row */}
          {payInfo && (
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold ${payInfo.bg} ${payInfo.color}`}>
                <CircleDollarSign className="w-3 h-3" />
                {payInfo.label}
              </div>
              {order.paymentMethod && (
                <span className="text-[10px] text-muted-foreground font-medium">
                  {order.paymentMethodName
                    ? order.paymentMethodName
                    : order.paymentMethod === 'cash' ? '💵 نقدي' : order.paymentMethod === 'wallet_deposit' ? '📱 محفظة' : order.paymentMethod === 'bank_transfer' ? '🏦 تحويل' : order.paymentMethod}
                </span>
              )}
              {order.hasPaymentProof && order.paymentProofData && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
                  <ImageIcon className="w-3 h-3" />
                  صورة إثبات مرفقة
                </div>
              )}
              {order.hasPaymentProof && !order.paymentProofData && (
                <div className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  <MessageCircle className="w-3 h-3" />
                  إثبات عبر واتساب
                </div>
              )}
            </div>
          )}

          {/* Payment Method Details Card */}
          {order.paymentMethod && order.paymentMethod !== 'cash' && order.paymentMethodAccountName && (
            <div className="mt-2 p-2.5 rounded-xl bg-purple-50/50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800">
              <div className="flex items-center gap-2 text-[10px]">
                {order.paymentMethod === 'wallet_deposit' ? <span className="text-purple-600">📱</span> : <span className="text-blue-600">🏦</span>}
                <span className="font-bold text-purple-700 dark:text-purple-400">{order.paymentMethodName || (order.paymentMethod === 'wallet_deposit' ? 'محفظة إلكترونية' : 'تحويل بنكي')}</span>
              </div>
              <div className="flex items-center gap-3 mt-1.5 text-[10px]">
                {order.paymentMethodAccountName && (
                  <span className="text-muted-foreground">الاسم: <b className="text-foreground">{order.paymentMethodAccountName}</b></span>
                )}
                {order.paymentMethodAccountNumber && (
                  <span className="text-muted-foreground">الرقم: <b className="text-foreground font-mono" dir="ltr">{order.paymentMethodAccountNumber}</b></span>
                )}
              </div>
            </div>
          )}

          {/* Payment Proof Thumbnail */}
          {order.hasPaymentProof && order.paymentProofData && (
            <div className="mt-3">
              <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                صورة إثبات الدفع
              </div>
              <button
                onClick={() => setImageViewerSrc(order.paymentProofData!)}
                className="relative group w-full max-w-[280px] rounded-xl overflow-hidden border-2 border-emerald-200 dark:border-emerald-800 shadow-sm hover:shadow-md transition-all"
              >
                <img
                  src={order.paymentProofData}
                  alt="إثبات الدفع"
                  className="w-full h-36 object-cover"
                />
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center">
                  <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
                <div className="absolute bottom-1.5 right-1.5 px-2 py-1 rounded-lg bg-black/60 text-white text-[10px] flex items-center gap-1">
                  <ImageIcon className="w-3 h-3" />
                  اضغط لعرض إثبات الدفع بالكامل
                </div>
              </button>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border/50">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setViewTarget(order)}
              className="text-xs h-8 px-3 gap-1.5 hover:bg-slate-100 dark:hover:bg-slate-800"
            >
              <Eye className="w-3.5 h-3.5" />
              التفاصيل
            </Button>

            {/* Payment Confirmation - Primary Action */}
            {needsPaymentConfirmation && (
              <Button
                size="sm"
                onClick={() => setPaymentTarget(order)}
                className="text-xs h-8 px-3 gap-1.5 bg-gradient-to-l from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white shadow-sm"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                تأكيد الدفع
              </Button>
            )}

            {/* Assign Nurse */}
            {canAssign && !needsPaymentConfirmation && (
              <Button
                size="sm"
                onClick={() => openAssignDialog(order)}
                className="text-xs h-8 px-3 gap-1.5 bg-gradient-to-l from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white shadow-sm"
              >
                <UserPlus className="w-3.5 h-3.5" />
                تعيين ممرض
              </Button>
            )}

            {/* Direct Execute */}
            {canExecute && !needsPaymentConfirmation && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setExecuteTarget(order); setExecuteNotes(''); }}
                className="text-xs h-8 px-3 gap-1.5 text-green-700 hover:bg-green-50 dark:text-green-400 dark:hover:bg-green-900/20"
              >
                <Zap className="w-3.5 h-3.5" />
                تنفيذ مباشر
              </Button>
            )}

            {/* Reject */}
            {needsPaymentConfirmation && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setRejectTarget(order); setRejectReason(''); }}
                className="text-xs h-8 px-3 gap-1.5 text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
              >
                <Ban className="w-3.5 h-3.5" />
                رفض
              </Button>
            )}

            {/* Cancel */}
            {canCancel && !needsPaymentConfirmation && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => { setCancelTarget(order); setCancelReason(''); }}
                className="text-xs h-8 px-3 gap-1.5 text-destructive hover:bg-destructive/10"
              >
                <XCircle className="w-3.5 h-3.5" />
                إلغاء
              </Button>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <PageHeader title="إدارة الطلبات" description="عرض وإدارة طلبات الخدمة - تحديث تلقائي كل ١٥ ثانية" />
      </motion.div>

      {/* Stats Cards */}
      <motion.div variants={itemAnim} className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'بانتظار الدفع', count: counts.awaiting_payment || 0, icon: CreditCard, color: 'from-orange-500 to-amber-500' },
          { label: 'معلق', count: counts.pending || 0, icon: Clock, color: 'from-amber-500 to-yellow-500' },
          { label: 'قيد التنفيذ', count: (counts.in_progress || 0) + (counts.assigned || 0), icon: Zap, color: 'from-indigo-500 to-blue-500' },
          { label: 'مكتمل', count: counts.completed || 0, icon: CheckCircle2, color: 'from-green-500 to-emerald-500' },
        ].map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="relative overflow-hidden rounded-xl border border-border bg-white dark:bg-slate-900 p-3 shadow-sm">
              <div className={`absolute top-0 right-0 w-16 h-16 rounded-bl-3xl bg-gradient-to-bl ${stat.color} opacity-10`} />
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-lg bg-gradient-to-bl ${stat.color} text-white shadow-sm`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-xl font-bold">{stat.count}</p>
                  <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            </div>
          );
        })}
      </motion.div>

      {/* Search & Tabs */}
      <motion.div variants={itemAnim} className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <SearchInput placeholder="بحث بالاسم أو الهاتف أو رقم الطلب..." onChange={setSearch} className="flex-1" />
          <Button variant="outline" size="icon" onClick={() => { setIsLoading(true); void fetchOrders(); }} className="shrink-0">
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        {/* Status Tabs - Horizontal Scrollable */}
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = statusTab === tab.value;
            const count = tab.value === 'all' ? counts.all : (counts[tab.value] || 0);
            return (
              <button
                key={tab.value}
                onClick={() => { setStatusTab(tab.value); setPage(1); }}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? 'bg-admin text-white shadow-md shadow-admin/25'
                    : 'bg-white dark:bg-slate-900 border border-border hover:border-admin/30 text-muted-foreground'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                {tab.label}
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                    isActive ? 'bg-white/20' : 'bg-muted'
                  }`}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Order Cards Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-8 h-8 text-admin animate-spin" />
            <p className="text-sm text-muted-foreground">جارٍ تحميل الطلبات...</p>
          </div>
        </div>
      ) : orders.length === 0 ? (
        <motion.div variants={itemAnim} className="flex flex-col items-center justify-center py-20">
          <ClipboardList className="w-16 h-16 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">لا توجد طلبات</p>
          <Button variant="outline" size="sm" onClick={() => { setIsLoading(true); void fetchOrders(); }} className="mt-3 gap-2">
            <RefreshCw className="w-3.5 h-3.5" />
            تحديث
          </Button>
        </motion.div>
      ) : (
        <motion.div variants={container} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} />
          ))}
        </motion.div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>السابق</Button>
          <span className="text-sm text-muted-foreground">{page} / {totalPages}</span>
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>التالي</Button>
        </div>
      )}

      {/* ========== DIALOGS ========== */}

      {/* View Order Details Dialog */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
        <DialogContent dir="rtl" className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText className="w-5 h-5 text-admin" />
              تفاصيل الطلب #{viewTarget?.id?.slice(-6).toUpperCase()}
            </DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-5">
              {/* Beneficiary Section */}
              <div className="flex items-center gap-4 p-4 rounded-xl bg-gradient-to-l from-purple-50 to-white dark:from-purple-900/20 dark:to-slate-900 border border-purple-200 dark:border-purple-800">
                <Avatar className="w-14 h-14 border-2 border-purple-200 dark:border-purple-700">
                  <AvatarFallback className="text-lg bg-gradient-to-br from-purple-500 to-purple-700 text-white font-bold">
                    {viewTarget.beneficiaryName?.charAt(0) || 'م'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <p className="font-bold text-lg">{viewTarget.beneficiaryName}</p>
                  {viewTarget.beneficiaryPhone && (
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-sm text-muted-foreground font-mono" dir="ltr">{viewTarget.beneficiaryPhone}</span>
                      <a href={`tel:${viewTarget.beneficiaryPhone}`} className="p-1.5 rounded-lg hover:bg-blue-100 dark:hover:bg-blue-900/30 text-blue-600"><Phone className="w-4 h-4" /></a>
                      <a href={getWhatsAppUrl(viewTarget.beneficiaryPhone)} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-green-100 dark:hover:bg-green-900/30 text-green-600"><MessageCircle className="w-4 h-4" /></a>
                    </div>
                  )}
                </div>
                <div className="text-left">
                  {(() => {
                    const si = statusConfig[viewTarget.status] || statusConfig.pending;
                    const SI = si.icon;
                    return (
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold ${si.bg} ${si.color} ${si.border} border`}>
                        <SI className="w-3.5 h-3.5" />
                        {si.label}
                      </div>
                    );
                  })()}
                </div>
              </div>

              {/* Order Details Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/30 border border-border">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                    <Stethoscope className="w-3.5 h-3.5" />
                    <p className="text-[11px]">الخدمة</p>
                  </div>
                  <p className="text-sm font-bold">{viewTarget.serviceName}</p>
                  {viewTarget.isUnifiedOrder && viewTarget.services && viewTarget.services.length > 1 && (
                    <div className="mt-2 space-y-1">
                      {viewTarget.services.map((s, idx) => (
                        <div key={idx} className="flex items-center justify-between text-[10px] text-muted-foreground bg-muted/50 rounded-md px-2 py-1">
                          <span>{s.nameAr}</span>
                          <span className="font-medium">{formatYemeniRial(s.basePrice)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-900/10 border border-emerald-200 dark:border-emerald-800">
                  <div className="flex items-center gap-1.5 text-emerald-600 mb-1.5">
                    <Banknote className="w-3.5 h-3.5" />
                    <p className="text-[11px]">المبلغ الإجمالي</p>
                  </div>
                  <p className="text-lg font-bold text-emerald-700 dark:text-emerald-400"><Currency amount={viewTarget.totalPrice} /></p>
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                    <User className="w-3.5 h-3.5" />
                    <p className="text-[11px]">الممرض/ـة</p>
                  </div>
                  <p className="text-sm font-medium">{viewTarget.nurseName ?? <span className="text-muted-foreground">غير معيَّن</span>}</p>
                  {viewTarget.nursePhone && (
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className="text-xs text-muted-foreground" dir="ltr">{viewTarget.nursePhone}</span>
                      <a href={getWhatsAppUrl(viewTarget.nursePhone)} target="_blank" rel="noopener noreferrer" className="text-green-600"><MessageCircle className="w-3 h-3" /></a>
                    </div>
                  )}
                </div>
                <div className="p-3 rounded-xl bg-muted/30 border border-border">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1.5">
                    <Calendar className="w-3.5 h-3.5" />
                    <p className="text-[11px]">تاريخ الطلب</p>
                  </div>
                  <p className="text-sm font-medium">{new Date(viewTarget.createdAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                </div>
              </div>

              {/* Location */}
              {viewTarget.beneficiaryAddress && (
                <div className="p-3 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                  <div className="flex items-center gap-1.5 text-red-600 mb-1.5">
                    <MapPin className="w-3.5 h-3.5" />
                    <p className="text-[11px]">الموقع</p>
                  </div>
                  <p className="text-sm font-medium">{viewTarget.beneficiaryAddress}</p>
                  {viewTarget.beneficiaryLat && viewTarget.beneficiaryLng && (
                    <a href={`https://www.google.com/maps?q=${viewTarget.beneficiaryLat},${viewTarget.beneficiaryLng}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 mt-1 hover:underline">
                      <Navigation className="w-3 h-3" /> عرض على الخريطة
                      <ExternalLink className="w-2.5 h-2.5" />
                    </a>
                  )}
                </div>
              )}

              {/* Payment Proof Section - Professional */}
              {viewTarget.hasPaymentProof && viewTarget.paymentProofData && (
                <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 overflow-hidden">
                  <div className="flex items-center gap-2 px-4 py-2.5 bg-gradient-to-l from-emerald-50 to-white dark:from-emerald-900/20 dark:to-slate-900 border-b border-emerald-200 dark:border-emerald-800">
                    <ShieldCheck className="w-4 h-4 text-emerald-600" />
                    <span className="text-sm font-bold text-emerald-700 dark:text-emerald-400">إثبات الدفع</span>
                  </div>
                  <div className="p-4">
                    <button
                      onClick={() => setImageViewerSrc(viewTarget.paymentProofData!)}
                      className="relative group w-full rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all"
                    >
                      <img
                        src={viewTarget.paymentProofData}
                        alt="إثبات الدفع"
                        className="w-full max-h-[400px] object-contain bg-slate-50 dark:bg-slate-900"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                        <div className="bg-black/60 text-white px-4 py-2 rounded-xl flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <ZoomIn className="w-5 h-5" />
                          <span className="text-sm font-medium">اضغط لعرض الصورة بالحجم الكامل</span>
                        </div>
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Payment Info - Enhanced */}
              {viewTarget.paymentStatus && (
                <div className="p-4 rounded-xl bg-muted/30 border border-border space-y-3">
                  <p className="text-sm font-bold flex items-center gap-2">
                    <CircleDollarSign className="w-4 h-4" />
                    معلومات الدفع
                  </p>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between p-2 bg-background rounded-lg">
                      <span className="text-muted-foreground">حالة الدفع</span>
                      {(() => {
                        const pi = paymentStatusConfig[viewTarget.paymentStatus!] || paymentStatusConfig.pending;
                        return <span className={`font-bold ${pi.color}`}>{pi.label}</span>;
                      })()}
                    </div>
                    <div className="flex justify-between p-2 bg-background rounded-lg">
                      <span className="text-muted-foreground">طريقة الدفع</span>
                      <span className="font-bold">{viewTarget.paymentMethodName || (viewTarget.paymentMethod === 'cash' ? '💵 نقدي' : viewTarget.paymentMethod === 'wallet_deposit' ? '📱 محفظة' : viewTarget.paymentMethod === 'bank_transfer' ? '🏦 تحويل' : viewTarget.paymentMethod || '-')}</span>
                    </div>
                    {viewTarget.commission !== undefined && viewTarget.commission > 0 && (
                      <div className="flex justify-between p-2 bg-background rounded-lg">
                        <span className="text-muted-foreground">عمولة المنصة</span>
                        <Currency amount={viewTarget.commission} className="font-bold" />
                      </div>
                    )}
                    {viewTarget.nursePayout !== undefined && viewTarget.nursePayout > 0 && (
                      <div className="flex justify-between p-2 bg-background rounded-lg">
                        <span className="text-muted-foreground">أتعاب الممرض/ـة</span>
                        <Currency amount={viewTarget.nursePayout} className="font-bold" />
                      </div>
                    )}
                  </div>

                  {/* Payment Method Details */}
                  {viewTarget.paymentMethod && viewTarget.paymentMethod !== 'cash' && (
                    <div className="mt-3 p-3 rounded-xl border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-l from-purple-50 to-white dark:from-purple-900/10 dark:to-slate-900">
                      <div className="flex items-center gap-2 mb-2">
                        {viewTarget.paymentMethod === 'wallet_deposit' ? <Smartphone className="w-4 h-4 text-purple-600" /> : <Building2 className="w-4 h-4 text-blue-600" />}
                        <span className="text-xs font-bold text-purple-700 dark:text-purple-400">
                          تفاصيل {viewTarget.paymentMethodName || (viewTarget.paymentMethod === 'wallet_deposit' ? 'المحفظة الإلكترونية' : 'التحويل البنكي')}
                        </span>
                      </div>
                      <div className="space-y-1.5 text-xs">
                        {viewTarget.paymentMethodAccountName && (
                          <div className="flex items-center justify-between p-2 bg-background rounded-lg">
                            <span className="text-muted-foreground">اسم الحساب</span>
                            <span className="font-bold">{viewTarget.paymentMethodAccountName}</span>
                          </div>
                        )}
                        {viewTarget.paymentMethodAccountNumber && (
                          <div className="flex items-center justify-between p-2 bg-background rounded-lg">
                            <span className="text-muted-foreground">{viewTarget.paymentMethod === 'wallet_deposit' ? 'رقم المحفظة' : 'رقم الحساب'}</span>
                            <span className="font-mono font-bold tracking-wider" dir="ltr">{viewTarget.paymentMethodAccountNumber}</span>
                          </div>
                        )}
                        {viewTarget.paymentMethodInstructions && (
                          <div className="p-2 bg-background rounded-lg">
                            <span className="text-muted-foreground">تعليمات:</span>
                            <p className="mt-0.5 text-muted-foreground">{viewTarget.paymentMethodInstructions}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* WhatsApp Proof Note */}
                  {viewTarget.hasPaymentProof && !viewTarget.paymentProofData && (
                    <div className="mt-3 p-3 rounded-xl bg-blue-50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                      <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400">
                        <MessageCircle className="w-4 h-4" />
                        <span className="text-xs font-bold">تم إرسال إثبات الدفع عبر واتساب</span>
                      </div>
                      <p className="text-[10px] text-blue-600 dark:text-blue-400 mt-1">لم يتم رفع صورة إثبات الدفع في النظام. تم إرسال الإثبات عبر رسالة واتساب. يرجى مراجعة محادثة الواتساب.</p>
                    </div>
                  )}
                </div>
              )}

              {/* Notes */}
              {viewTarget.notes && (
                <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs font-bold text-amber-700 dark:text-amber-400 mb-1">ملاحظات</p>
                  <p className="text-sm">{viewTarget.notes}</p>
                </div>
              )}

              {/* Scheduled */}
              {viewTarget.scheduledAt && (
                <div className="flex items-center gap-2 text-xs text-muted-foreground p-3 rounded-xl bg-muted/30">
                  <Clock className="w-3.5 h-3.5" />
                  موعد التنفيذ: {new Date(viewTarget.scheduledAt).toLocaleDateString('ar-SA', { year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </div>
              )}

              {/* Badges */}
              <div className="flex flex-wrap gap-2">
                {viewTarget.isEmergency && <Badge variant="destructive">طلب طوارئ</Badge>}
                {viewTarget.isNightService && <Badge className="bg-indigo-100 text-indigo-700">خدمة ليلية</Badge>}
                {viewTarget.isFridayService && <Badge className="bg-amber-100 text-amber-700">خدمة جمعة</Badge>}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Payment Confirmation Dialog */}
      <Dialog open={!!paymentTarget} onOpenChange={(open) => { if (!open) setPaymentTarget(null); }}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldCheck className="w-5 h-5 text-emerald-600" />
              تأكيد الدفع
            </DialogTitle>
            <DialogDescription>
              سيتم تأكيد استلام الدفع وتحويل الطلب إلى حالة معلق للتعيين
            </DialogDescription>
          </DialogHeader>

          {paymentTarget && (
            <div className="space-y-4 py-2">
              {/* Order Info */}
              <div className="p-3 rounded-xl bg-muted/30 border border-border">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">{paymentTarget.beneficiaryName}</p>
                    <p className="text-xs text-muted-foreground">{paymentTarget.serviceName}</p>
                  </div>
                  <p className="text-lg font-bold text-emerald-600"><Currency amount={paymentTarget.totalPrice} /></p>
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {(() => {
                    const pi = paymentStatusConfig[paymentTarget.paymentStatus!] || paymentStatusConfig.pending;
                    return <Badge className={`${pi.bg} ${pi.color}`}>{pi.label}</Badge>;
                  })()}
                  {paymentTarget.paymentMethod && (
                    <Badge variant="outline">{paymentTarget.paymentMethodName || (paymentTarget.paymentMethod === 'cash' ? '💵 نقدي' : paymentTarget.paymentMethod === 'wallet_deposit' ? '📱 محفظة' : '🏦 تحويل')}</Badge>
                  )}
                </div>
                {/* Payment Method Account Details */}
                {paymentTarget.paymentMethod && paymentTarget.paymentMethod !== 'cash' && paymentTarget.paymentMethodAccountName && (
                  <div className="mt-2 p-2 rounded-lg bg-purple-50 dark:bg-purple-900/10 border border-purple-200 dark:border-purple-800 text-xs">
                    <div className="flex items-center gap-1.5 mb-1">
                      {paymentTarget.paymentMethod === 'wallet_deposit' ? <Smartphone className="w-3 h-3 text-purple-600" /> : <Building2 className="w-3 h-3 text-blue-600" />}
                      <span className="font-bold text-purple-700 dark:text-purple-400">{paymentTarget.paymentMethodName}</span>
                    </div>
                    <div className="flex gap-3 text-[10px]">
                      {paymentTarget.paymentMethodAccountName && <span>الاسم: <b>{paymentTarget.paymentMethodAccountName}</b></span>}
                      {paymentTarget.paymentMethodAccountNumber && <span>الرقم: <b className="font-mono" dir="ltr">{paymentTarget.paymentMethodAccountNumber}</b></span>}
                    </div>
                  </div>
                )}
              </div>

              {/* Payment Proof Preview */}
              {paymentTarget.paymentProofData && (
                <div className="rounded-xl border-2 border-emerald-200 dark:border-emerald-800 overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-emerald-50 dark:bg-emerald-900/20">
                    <ImageIcon className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400">إثبات الدفع المرفق</span>
                  </div>
                  <div className="p-3">
                    <button
                      onClick={() => setImageViewerSrc(paymentTarget.paymentProofData!)}
                      className="relative group w-full rounded-lg overflow-hidden"
                    >
                      <img
                        src={paymentTarget.paymentProofData}
                        alt="إثبات الدفع"
                        className="w-full max-h-[300px] object-contain bg-slate-50 dark:bg-slate-900"
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                        <ZoomIn className="w-6 h-6 text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                      </div>
                    </button>
                  </div>
                </div>
              )}

              {/* Warning */}
              <div className="flex items-start gap-2 p-3 bg-emerald-50 dark:bg-emerald-900/20 rounded-xl border border-emerald-200 dark:border-emerald-800">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  بعد تأكيد الدفع، سيتم تحويل حالة الطلب إلى &quot;معلق&quot; ويمكنك تعيين ممرض/ـة للطلب.
                </p>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => setPaymentTarget(null)}
              disabled={isConfirmingPayment}
            >
              تراجع
            </Button>
            <Button
              className="bg-gradient-to-l from-emerald-600 to-emerald-500 hover:from-emerald-700 hover:to-emerald-600 text-white gap-2 shadow-md"
              onClick={handleConfirmPayment}
              disabled={isConfirmingPayment}
            >
              {isConfirmingPayment ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ShieldCheck className="w-4 h-4" />
              )}
              تأكيد الدفع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reject Order Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => { if (!open) { setRejectTarget(null); setRejectReason(''); } }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-red-600" />
              رفض الطلب
            </DialogTitle>
            <DialogDescription>
              سيتم رفض الطلب وإعادة المبلغ إن لزم
            </DialogDescription>
          </DialogHeader>

          {rejectTarget && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">{rejectTarget.beneficiaryName}</p>
                    <p className="text-xs text-muted-foreground">{rejectTarget.serviceName}</p>
                  </div>
                  <Currency amount={rejectTarget.totalPrice} className="text-sm font-bold" />
                </div>
              </div>

              <div>
                <Label className="text-sm mb-1.5 block font-bold">سبب الرفض <span className="text-destructive">*</span></Label>
                <Textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="أدخل سبب رفض الطلب..."
                  className="min-h-[100px]"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setRejectTarget(null); setRejectReason(''); }}
              disabled={isRejecting}
            >
              تراجع
            </Button>
            <Button
              variant="destructive"
              className="gap-2"
              onClick={handleRejectOrder}
              disabled={isRejecting || !rejectReason.trim()}
            >
              {isRejecting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Ban className="w-4 h-4" />
              )}
              رفض الطلب
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Assign Nurse Dialog */}
      <Dialog open={!!assignTarget} onOpenChange={(open) => { if (!open) { setAssignTarget(null); setSelectedNurse(''); } }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-blue-600" />
              تعيين ممرض/ـة للطلب
            </DialogTitle>
            <DialogDescription>
              اختر الممرض/ـة المناسب لتعيينه/ا على هذا الطلب
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {/* Order info */}
            {assignTarget && (
              <div className="p-3 rounded-xl bg-blue-50/50 dark:bg-blue-900/10 border border-blue-200 dark:border-blue-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">{assignTarget.beneficiaryName}</p>
                    <p className="text-xs text-muted-foreground">{assignTarget.serviceName}</p>
                  </div>
                  <Currency amount={assignTarget.totalPrice} className="text-sm font-bold" />
                </div>
                {assignTarget.beneficiaryLat && assignTarget.beneficiaryLng && (
                  <a href={`https://www.google.com/maps?q=${assignTarget.beneficiaryLat},${assignTarget.beneficiaryLng}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs text-blue-600 mt-2">
                    <MapPin className="w-3 h-3" /> موقع المستفيد
                  </a>
                )}
              </div>
            )}

            {/* Quick Action: Direct Execute by Admin */}
            <button
              onClick={() => {
                if (assignTarget) {
                  setAssignTarget(null);
                  setExecuteTarget(assignTarget);
                  setExecuteNotes('');
                }
              }}
              className="w-full flex items-center gap-3 p-3 rounded-xl border-2 border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/10 hover:bg-amber-100 dark:hover:bg-amber-900/20 transition-all text-right"
            >
              <div className="p-2 rounded-lg bg-gradient-to-bl from-amber-500 to-orange-500 text-white">
                <Shield className="w-5 h-5" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-bold text-amber-800 dark:text-amber-300">تنفيذ مباشر من الإدارة</p>
                <p className="text-[10px] text-amber-600 dark:text-amber-400">تنفيذ الطلب مباشرة بدون تعيين ممرض</p>
              </div>
              <ArrowUpRight className="w-4 h-4 text-amber-600" />
            </button>

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
                <Loader2 className="w-6 h-6 text-blue-600 animate-spin" />
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
                    <div className="flex items-center gap-2 px-1">
                      <MapPin className="w-4 h-4 text-emerald-600" />
                      <Label className="text-sm font-bold text-emerald-700 dark:text-emerald-400">الممرضون الأقرب ({nearbyNurses.length})</Label>
                      <Badge className="text-[9px] bg-emerald-100 text-emerald-700">أقل من 10 كم</Badge>
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
                    <div className="flex items-center gap-2 px-1">
                      <Users className="w-4 h-4 text-muted-foreground" />
                      <Label className="text-sm font-bold text-muted-foreground">
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
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-blue-600">
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
              <Zap className="w-5 h-5 text-amber-600" />
              تنفيذ مباشر من الإدارة
            </DialogTitle>
            <DialogDescription>
              سيتم تحويل حالة الطلب إلى مكتمل مباشرة
            </DialogDescription>
          </DialogHeader>

          {executeTarget && (
            <div className="space-y-4 py-2">
              <div className="p-3 rounded-xl bg-amber-50/50 dark:bg-amber-900/10 border border-amber-200 dark:border-amber-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">{executeTarget.beneficiaryName}</p>
                    <p className="text-xs text-muted-foreground">{executeTarget.serviceName}</p>
                  </div>
                  <Currency amount={executeTarget.totalPrice} className="text-sm" />
                </div>
                <div className="flex items-center gap-2 mt-2">
                  {(() => {
                    const si = statusConfig[executeTarget.status] || statusConfig.pending;
                    return <Badge className={`${si.bg} ${si.color}`}>{si.label}</Badge>;
                  })()}
                </div>
              </div>

              <div className="flex items-start gap-2 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-xl">
                <AlertCircle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-700 dark:text-amber-400">
                  سيتم تنفيذ الطلب مباشرة وتحديث حالته إلى مكتمل. {executeTarget.nurseId && 'سيتم إشعار الممرض المعين بإلغاء تعيينه.'}
                </p>
              </div>

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
              className="bg-gradient-to-l from-amber-600 to-orange-500 hover:from-amber-700 hover:to-orange-600 text-white gap-2 shadow-md"
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
              <div className="p-3 rounded-xl bg-red-50/50 dark:bg-red-900/10 border border-red-200 dark:border-red-800">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">{cancelTarget.beneficiaryName}</p>
                    <p className="text-xs text-muted-foreground">{cancelTarget.serviceName}</p>
                  </div>
                  {(() => {
                    const si = statusConfig[cancelTarget.status] || statusConfig.pending;
                    return <Badge className={`${si.bg} ${si.color}`}>{si.label}</Badge>;
                  })()}
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

      {/* Image Viewer Dialog */}
      <Dialog open={!!imageViewerSrc} onOpenChange={(open) => { if (!open) setImageViewerSrc(null); }}>
        <DialogContent dir="rtl" className="max-w-4xl max-h-[95vh] p-0 overflow-hidden">
          <div className="relative">
            <button
              onClick={() => setImageViewerSrc(null)}
              className="absolute top-3 left-3 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
            {imageViewerSrc && (
              <img
                src={imageViewerSrc}
                alt="إثبات الدفع"
                className="w-full max-h-[95vh] object-contain bg-slate-900"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
