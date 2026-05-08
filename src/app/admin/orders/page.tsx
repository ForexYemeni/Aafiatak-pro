'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { ClipboardList, Eye, UserPlus, RefreshCw, Phone, MessageCircle, MapPin, Clock, Calendar, Banknote, User, Stethoscope, Navigation } from 'lucide-react';
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
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
  specialization: string[];
  rating: number;
  lat?: number;
  lng?: number;
  distance?: number;
}

const statusLabels: Record<string, string> = {
  pending: 'معلق',
  assigned: 'مُعيَّن',
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
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng/2) * Math.sin(dLng/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
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
  const [selectedNurse, setSelectedNurse] = useState('');
  const [isAssigning, setIsAssigning] = useState(false);

  // View dialog
  const [viewTarget, setViewTarget] = useState<OrderItem | null>(null);

  // Status update
  const [statusTarget, setStatusTarget] = useState<OrderItem | null>(null);
  const [newStatus, setNewStatus] = useState('');
  const [isUpdating, setIsUpdating] = useState(false);

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
    try {
      const res = await authFetch('/api/admin/nurses?limit=100&status=active');
      const json = await res.json();
      if (json.success && json.data) {
        const nursesArray = json.data.nurses ?? json.data;
        let nurseList = (Array.isArray(nursesArray) ? nursesArray : []).map((n: Record<string, unknown>) => ({
          id: String(n.id ?? n._id ?? ''),
          name: String(n.name ?? ''),
          specialization: Array.isArray(n.specialization) ? n.specialization : [],
          rating: Number(n.rating ?? 0),
          lat: Number(n.lat ?? 0) || undefined,
          lng: Number(n.lng ?? 0) || undefined,
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
    }
  };

  const handleAssign = async () => {
    if (!assignTarget || !selectedNurse) return;
    setIsAssigning(true);
    try {
      const res = await authFetch(`/api/admin/orders/${assignTarget.id}/assign`, {
        method: 'POST',
        body: JSON.stringify({ nurseId: selectedNurse }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تعيين الممرض/ـة بنجاح');
        void fetchOrders();
      } else {
        toast.error(json.message ?? 'فشل التعيين');
      }
    } catch {
      toast.error('حدث خطأ أثناء التعيين');
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
      const res = await authFetch(`/api/admin/orders/${statusTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: newStatus }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تحديث حالة الطلب');
        void fetchOrders();
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
      onClick: (row: Record<string, unknown>) => setViewTarget(row as unknown as OrderItem),
    },
    {
      label: 'تعيين ممرض/ـة',
      onClick: (row: Record<string, unknown>) => {
        const order = row as unknown as OrderItem;
        setAssignTarget(order);
        void fetchAvailableNurses(order.beneficiaryLat, order.beneficiaryLng);
      },
    },
    {
      label: 'تحديث الحالة',
      onClick: (row: Record<string, unknown>) => {
        setStatusTarget(row as unknown as OrderItem);
        setNewStatus((row as unknown as OrderItem).status);
      },
    },
  ];

  const tabs = [
    { value: 'all', label: 'الكل' },
    { value: 'pending', label: 'معلق' },
    { value: 'assigned', label: 'مُعيَّن' },
    { value: 'in_progress', label: 'قيد التنفيذ' },
    { value: 'completed', label: 'مكتمل' },
    { value: 'cancelled', label: 'ملغي' },
  ];

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

      {/* Assign Nurse Dialog - with nearby suggestions */}
      <Dialog open={!!assignTarget} onOpenChange={(open) => { if (!open) setAssignTarget(null); }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>تعيين ممرض/ـة</DialogTitle>
            <DialogDescription>
              {assignTarget?.beneficiaryLat ? 'الممرضون مرتبون حسب القرب من موقع المستفيد' : 'اختر ممرض/ـة لتعيينه/ا للطلب'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label>اختر ممرض/ـة</Label>
            <Select value={selectedNurse} onValueChange={setSelectedNurse}>
              <SelectTrigger>
                <SelectValue placeholder="اختر ممرض/ـة" />
              </SelectTrigger>
              <SelectContent>
                {nurses.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    <div className="flex items-center gap-2">
                      <span>{n.name}</span>
                      {n.distance !== undefined && (
                        <span className="text-xs text-muted-foreground">({n.distance} كم)</span>
                      )}
                      <span className="text-xs text-amber-500">({n.rating.toFixed(1)} ⭐)</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Nearby nurses list */}
            {nurses.length > 0 && assignTarget?.beneficiaryLat && (
              <div className="space-y-2 mt-3">
                <p className="text-xs text-muted-foreground">الممرضون الأقرب للموقع:</p>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {nurses.slice(0, 10).map((n) => (
                    <button
                      key={n.id}
                      onClick={() => setSelectedNurse(n.id)}
                      className={`w-full text-right p-3 rounded-xl border transition-colors ${
                        selectedNurse === n.id
                          ? 'border-admin bg-admin/5 dark:bg-admin/10'
                          : 'border-border hover:border-admin/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="text-xs bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-400">
                              {n.name.slice(0, 2)}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="text-sm font-medium">{n.name}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {Array.isArray(n.specialization) ? n.specialization.slice(0, 2).join(' • ') : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-left">
                          {n.distance !== undefined && (
                            <p className="text-xs font-medium text-muted-foreground">{n.distance} كم</p>
                          )}
                          <p className="text-xs text-amber-500">{n.rating.toFixed(1)} ⭐</p>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignTarget(null)} disabled={isAssigning}>
              إلغاء
            </Button>
            <Button
              onClick={handleAssign}
              disabled={isAssigning || !selectedNurse}
              className="bg-admin hover:bg-admin/90"
            >
              {isAssigning ? 'جارٍ التعيين...' : 'تعيين'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Status Update Dialog */}
      <Dialog open={!!statusTarget} onOpenChange={(open) => { if (!open) setStatusTarget(null); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تحديث حالة الطلب</DialogTitle>
            <DialogDescription>اختر الحالة الجديدة للطلب</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <Label>الحالة الجديدة</Label>
            <Select value={newStatus} onValueChange={setNewStatus}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(statusLabels).map(([key, label]) => (
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
