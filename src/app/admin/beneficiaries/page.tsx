'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Users, Eye, RefreshCw, MapPin, Phone, MessageCircle, Ban, Trash2, Shield, Heart, Navigation, Activity, TrendingUp, UserCheck, UserPlus, Copy, CheckCircle2, Loader2, Lock, AlertTriangle } from 'lucide-react';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard } from '@/components/common/glass-card';
import { SearchInput } from '@/components/common/search-input';
import { BadgeStatus } from '@/components/common/badge-status';
import { DateFormatter } from '@/components/common/date-formatter';
import { Currency } from '@/components/common/currency';
import { useAuthFetch } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { useAuthStore } from '@/lib/stores/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog';
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer';
import { ConfirmDialog } from '@/components/common/confirm-dialog';
import { toast } from 'sonner';
import { useIsMobile } from '@/hooks/use-mobile';
import { cn } from '@/lib/utils';
import type { ColumnDef } from '@tanstack/react-table';

interface BeneficiaryItem {
  id: string;
  name: string;
  phone: string;
  status: string;
  governorate: string | null;
  address: string | null;
  lat?: number | null;
  lng?: number | null;
  loyaltyPoints: number;
  loyaltyTier: string;
  totalSpent: number;
  orderCount: number;
  referralCode: string;
  referralCount?: number;
  referredByName?: string | null;
  referredByCode?: string | null;
  gender: string | null;
  bloodType?: string | null;
  medicalConditions?: string[];
  allergies?: string[];
  emergencyContactName?: string | null;
  emergencyContactPhone?: string | null;
  isBlocked?: boolean;
  createdAt: string;
}

const tierLabels: Record<string, string> = {
  bronze: 'برونزي',
  silver: 'فضي',
  gold: 'ذهبي',
  platinum: 'بلاتيني',
};

const tierColors: Record<string, string> = {
  bronze: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400 border-amber-200',
  silver: 'bg-gray-100 text-gray-700 dark:bg-gray-800/40 dark:text-gray-300 border-gray-300',
  gold: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400 border-yellow-300',
  platinum: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400 border-purple-300',
};

const tierIcons: Record<string, string> = {
  bronze: '🥉',
  silver: '🥈',
  gold: '🥇',
  platinum: '💎',
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function AdminBeneficiariesPage() {
  const authFetch = useAuthFetch();
  const isMobile = useIsMobile();
  const [beneficiaries, setBeneficiaries] = useState<BeneficiaryItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [totalCount, setTotalCount] = useState(0);
  const [viewTarget, setViewTarget] = useState<BeneficiaryItem | null>(null);
  const [toggleTarget, setToggleTarget] = useState<BeneficiaryItem | null>(null);
  const [blockTarget, setBlockTarget] = useState<BeneficiaryItem | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BeneficiaryItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Change password dialog
  const [changePasswordTarget, setChangePasswordTarget] = useState<{id: string; name: string; role: string} | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [newPasswordError, setNewPasswordError] = useState<string | null>(null);

  // Referral detail state
  const [referralTarget, setReferralTarget] = useState<BeneficiaryItem | null>(null);
  const [referredUsers, setReferredUsers] = useState<any[]>([]);
  const [isLoadingReferrals, setIsLoadingReferrals] = useState(false);
  const [copiedCode, setCopiedCode] = useState('');

  const fetchBeneficiaries = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        search,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        // Cache-busting to prevent stale referral data
        _t: String(Date.now()),
      });
      // Use referrals API which includes referralCount
      const res = await authFetch(`/api/admin/referrals?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        const items = json.data.beneficiaries ?? json.data;
        setBeneficiaries(Array.isArray(items) ? items : []);
        if (json.data.pages) setTotalPages(json.data.pages);
        if (json.data.total) setTotalCount(json.data.total);
      }
    } catch {
      toast.error('فشل تحميل بيانات المستفيدين');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, page, search, statusFilter]);

  useEffect(() => {
    void fetchBeneficiaries();
  }, [fetchBeneficiaries]);

  useRealtimeRefresh({
    entities: ['user'],
    onRefresh: () => void fetchBeneficiaries(),
    fallbackInterval: 30000,
  });

  const handleToggle = async () => {
    if (!toggleTarget) return;
    try {
      const res = await authFetch(`/api/admin/beneficiaries/${toggleTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: toggleTarget.status === 'active' ? false : true }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(toggleTarget.status === 'active' ? 'تم تعطيل المستفيد' : 'تم تفعيل المستفيد');
        void fetchBeneficiaries();
      }
    } catch {
      toast.error('فشل تغيير الحالة');
    } finally {
      setToggleTarget(null);
    }
  };

  const handleBlock = async () => {
    if (!blockTarget) return;
    try {
      const res = await authFetch(`/api/admin/beneficiaries/${blockTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          isBlocked: !blockTarget.isBlocked,
          blockedReason: blockTarget.isBlocked ? '' : 'حظر بواسطة الإدارة',
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(blockTarget.isBlocked ? 'تم إلغاء حظر المستفيد' : 'تم حظر المستفيد');
        void fetchBeneficiaries();
      }
    } catch {
      toast.error('فشل تغيير حالة الحظر');
    } finally {
      setBlockTarget(null);
    }
  };

  const fetchReferralDetails = async (ben: BeneficiaryItem) => {
    setReferralTarget(ben);
    setIsLoadingReferrals(true);
    try {
      // Cache-busting to prevent stale referral details
      const res = await authFetch(`/api/admin/referrals/${ben.id}?_t=${Date.now()}`);
      const json = await res.json();
      if (json.success && json.data) {
        setReferredUsers(json.data.referredUsers || []);
      }
    } catch {
      toast.error('فشل تحميل تفاصيل الإحالات');
      setReferredUsers([]);
    } finally {
      setIsLoadingReferrals(false);
    }
  };

  const handleChangePassword = async () => {
    if (!changePasswordTarget) return;
    if (!newPassword || newPassword.length < 6) {
      setNewPasswordError('كلمة المرور يجب أن تكون ٦ أحرف على الأقل');
      return;
    }
    setIsChangingPassword(true);
    try {
      const res = await authFetch(`/api/admin/users/${changePasswordTarget.id}/change-password`, {
        method: 'PATCH',
        body: JSON.stringify({ newPassword }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(`تم تغيير كلمة مرور ${changePasswordTarget.name} بنجاح`);
        setChangePasswordTarget(null);
        setNewPassword('');
        setNewPasswordError(null);
      } else {
        toast.error(json.message ?? 'فشل تغيير كلمة المرور');
      }
    } catch {
      toast.error('حدث خطأ أثناء تغيير كلمة المرور');
    } finally {
      setIsChangingPassword(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await authFetch(`/api/admin/beneficiaries/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم حذف المستفيد نهائياً');
        void fetchBeneficiaries();
      } else {
        toast.error(json.message ?? 'فشل الحذف');
      }
    } catch {
      toast.error('فشل حذف المستفيد');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const getWhatsAppUrl = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    const withCode = cleanPhone.startsWith('0') ? '967' + cleanPhone.substring(1) : cleanPhone.startsWith('967') ? cleanPhone : '967' + cleanPhone;
    return `https://wa.me/${withCode}`;
  };

  const getCallUrl = (phone: string) => `tel:${phone}`;

  const columns: ColumnDef<BeneficiaryItem, unknown>[] = [
    {
      accessorKey: 'name',
      header: 'الاسم',
      cell: ({ row }) => (
        <div className="flex items-center gap-3">
          <Avatar className="w-9 h-9">
            <AvatarFallback className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs">
              {row.original.name.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div>
            <p className="font-medium text-sm">{row.original.name}</p>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground">{row.original.phone}</span>
              <a href={getCallUrl(row.original.phone)} className="text-blue-500 hover:text-blue-700" title="اتصال">
                <Phone className="w-3 h-3" />
              </a>
              <a href={getWhatsAppUrl(row.original.phone)} target="_blank" rel="noopener noreferrer" className="text-green-500 hover:text-green-700" title="واتساب">
                <MessageCircle className="w-3 h-3" />
              </a>
            </div>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'loyaltyTier',
      header: 'الباقة',
      cell: ({ row }) => (
        <span className={`text-xs px-2.5 py-1 rounded-full border ${tierColors[row.original.loyaltyTier] ?? ''}`}>
          {tierIcons[row.original.loyaltyTier] ?? ''} {tierLabels[row.original.loyaltyTier] ?? row.original.loyaltyTier}
        </span>
      ),
    },
    {
      accessorKey: 'totalSpent',
      header: 'إجمالي الإنفاق',
      cell: ({ row }) => <Currency amount={row.original.totalSpent} />,
    },
    {
      accessorKey: 'orderCount',
      header: 'الطلبات',
      cell: ({ row }) => <span className="text-sm font-medium">{row.original.orderCount}</span>,
    },
    {
      accessorKey: 'referralCount',
      header: 'الإحالات',
      cell: ({ row }) => {
        const count = row.original.referralCount || 0;
        return (
          <span className={`text-sm font-medium ${count > 0 ? 'text-beneficiary' : 'text-muted-foreground'}`}>
            {count}
          </span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'الحالة',
      cell: ({ row }) => (
        <div className="flex items-center gap-1.5">
          <BadgeStatus status={row.original.status} />
          {row.original.isBlocked && (
            <Badge variant="destructive" className="text-[10px] px-1.5 py-0">محظور</Badge>
          )}
        </div>
      ),
    },
  ];

  const user = useAuthStore((s) => s.user);
  const isSubadmin = user?.role === 'subadmin';

  const rowActions = [
    {
      label: 'عرض التفاصيل',
      onClick: (row: Record<string, unknown>) => setViewTarget(row as unknown as BeneficiaryItem),
    },
    {
      label: 'عرض التابعين',
      onClick: (row: Record<string, unknown>) => fetchReferralDetails(row as unknown as BeneficiaryItem),
    },
    {
      label: (row: Record<string, unknown>) => ((row as unknown as BeneficiaryItem).status === 'active' ? 'تعطيل' : 'تفعيل'),
      onClick: (row: Record<string, unknown>) => setToggleTarget(row as unknown as BeneficiaryItem),
    },
    {
      label: (row: Record<string, unknown>) => ((row as unknown as BeneficiaryItem).isBlocked ? 'إلغاء الحظر' : 'حظر'),
      onClick: (row: Record<string, unknown>) => setBlockTarget(row as unknown as BeneficiaryItem),
      variant: 'destructive' as const,
    },
    {
      label: 'تغيير كلمة المرور',
      onClick: (row: Record<string, unknown>) => {
        const ben = row as unknown as BeneficiaryItem;
        setChangePasswordTarget({ id: ben.id, name: ben.name, role: 'beneficiary' });
      },
    },
    ...(!isSubadmin ? [{
      label: 'حذف نهائي',
      onClick: (row: Record<string, unknown>) => setDeleteTarget(row as unknown as BeneficiaryItem),
      variant: 'destructive' as const,
    }] : []),
  ];

  const ViewContent = ({ ben }: { ben: BeneficiaryItem }) => (
    <div className="space-y-4 p-4">
      {/* Profile Header */}
      <div className="flex items-center gap-4">
        <Avatar className="w-16 h-16">
          <AvatarFallback className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xl">
            {ben.name.slice(0, 2)}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1">
          <h3 className="text-lg font-semibold">{ben.name}</h3>
          <div className="flex items-center gap-2 mt-1">
            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-sm">{ben.phone}</span>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <BadgeStatus status={ben.status} size="sm" />
            {ben.isBlocked && <Badge variant="destructive" className="text-[10px]">محظور</Badge>}
          </div>
        </div>
        {/* Quick Contact Buttons */}
        <div className="flex flex-col gap-2">
          <a href={getCallUrl(ben.phone)}>
            <Button size="sm" variant="outline" className="w-full gap-1.5 text-xs">
              <Phone className="w-3.5 h-3.5" />
              اتصال
            </Button>
          </a>
          <a href={getWhatsAppUrl(ben.phone)} target="_blank" rel="noopener noreferrer">
            <Button size="sm" className="w-full gap-1.5 text-xs bg-green-600 hover:bg-green-700">
              <MessageCircle className="w-3.5 h-3.5" />
              واتساب
            </Button>
          </a>
        </div>
      </div>

      {/* Package / Loyalty Tier Card */}
      <div className={`rounded-xl border-2 p-4 ${tierColors[ben.loyaltyTier] ?? 'bg-muted'}`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{tierIcons[ben.loyaltyTier] ?? '⭐'}</span>
            <div>
              <p className="font-bold text-sm">باقة {tierLabels[ben.loyaltyTier] ?? ben.loyaltyTier}</p>
              <p className="text-xs opacity-80">{ben.loyaltyPoints} نقطة ولاء</p>
            </div>
          </div>
          <div className="text-left">
            <p className="text-xs opacity-70">إجمالي الإنفاق</p>
            <p className="font-bold text-sm"><Currency amount={ben.totalSpent} /></p>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-muted-foreground">عدد الطلبات</p>
          <p className="text-sm font-bold">{ben.orderCount}</p>
        </div>
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-muted-foreground">كود الإحالة</p>
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-mono font-bold">{ben.referralCode}</p>
            <button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(ben.referralCode);
                  setCopiedCode(ben.referralCode);
                  setTimeout(() => setCopiedCode(''), 2000);
                } catch {}
              }}
              className="text-muted-foreground hover:text-foreground"
            >
              {copiedCode === ben.referralCode ? <CheckCircle2 className="w-3.5 h-3.5 text-green-500" /> : <Copy className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-muted-foreground">عدد التابعين</p>
          <p className={`text-sm font-bold ${(ben.referralCount || 0) > 0 ? 'text-beneficiary' : ''}`}>{ben.referralCount || 0}</p>
        </div>
        {(ben.referralCount || 0) > 0 && (
          <div className="glass rounded-xl p-3 flex items-end">
            <Button size="sm" variant="outline" className="gap-1.5 text-xs w-full" onClick={() => fetchReferralDetails(ben)}>
              <UserPlus className="w-3.5 h-3.5" />
              عرض التابعين
            </Button>
          </div>
        )}
        {ben.referredByName && (
          <div className="glass rounded-xl p-3 col-span-2">
            <p className="text-xs text-muted-foreground">تمت إحالته بواسطة</p>
            <p className="text-sm font-medium">{ben.referredByName} {ben.referredByCode ? `(${ben.referredByCode})` : ''}</p>
          </div>
        )}
        {ben.bloodType && (
          <div className="glass rounded-xl p-3">
            <p className="text-xs text-muted-foreground">فصيلة الدم</p>
            <p className="text-sm font-bold text-red-600">{ben.bloodType}</p>
          </div>
        )}
        {ben.gender && (
          <div className="glass rounded-xl p-3">
            <p className="text-xs text-muted-foreground">الجنس</p>
            <p className="text-sm font-medium">{ben.gender === 'male' ? 'ذكر' : 'أنثى'}</p>
          </div>
        )}
      </div>

      {/* Location */}
      {(ben.governorate || ben.lat) && (
        <div className="glass rounded-xl p-3 space-y-2">
          <div className="flex items-center gap-2 text-sm">
            <MapPin className="w-4 h-4 text-red-500" />
            <span className="font-medium">
              {ben.governorate || 'غير محدد'}
              {ben.address && <span className="text-muted-foreground"> - {ben.address}</span>}
            </span>
          </div>
          {ben.lat && ben.lng && (
            <a
              href={`https://www.google.com/maps?q=${ben.lat},${ben.lng}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-xs text-blue-600 hover:text-blue-800"
            >
              <Navigation className="w-3 h-3" />
              عرض على الخريطة ({ben.lat.toFixed(4)}, {ben.lng.toFixed(4)})
            </a>
          )}
        </div>
      )}

      {/* Emergency Contact */}
      {ben.emergencyContactName && (
        <div className="glass rounded-xl p-3 border-red-200 dark:border-red-900/30">
          <p className="text-xs text-red-600 font-medium">جهة اتصال الطوارئ</p>
          <p className="text-sm font-medium">{ben.emergencyContactName}</p>
          {ben.emergencyContactPhone && (
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-muted-foreground">{ben.emergencyContactPhone}</span>
              <a href={getCallUrl(ben.emergencyContactPhone)} className="text-blue-500">
                <Phone className="w-3 h-3" />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Medical Info */}
      {ben.medicalConditions && ben.medicalConditions.length > 0 && (
        <div className="glass rounded-xl p-3">
          <p className="text-xs text-muted-foreground mb-1">الحالات المرضية</p>
          <div className="flex flex-wrap gap-1">
            {ben.medicalConditions.map((c, i) => (
              <Badge key={i} variant="secondary" className="text-[10px]">{c}</Badge>
            ))}
          </div>
        </div>
      )}

      <div className="text-xs text-muted-foreground">
        تاريخ التسجيل: <DateFormatter date={ben.createdAt} format="date" />
      </div>
    </div>
  );

  const activeCount = beneficiaries.filter(b => b.status === 'active' && !b.isBlocked).length;
  const blockedCount = beneficiaries.filter(b => b.isBlocked).length;
  const goldPlatinumCount = beneficiaries.filter(b => b.loyaltyTier === 'gold' || b.loyaltyTier === 'platinum').length;

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      {/* Professional Header Banner */}
      <motion.div variants={itemAnim}>
        <div className="relative overflow-hidden rounded-2xl border border-beneficiary/20 bg-gradient-to-l from-beneficiary/8 via-beneficiary/4 to-transparent p-5">
          <div className="absolute -top-6 -left-6 w-24 h-24 rounded-full bg-beneficiary/8 blur-xl" />
          <div className="absolute -bottom-4 left-1/3 w-16 h-16 rounded-full bg-beneficiary/5 blur-lg" />
          <div className="relative flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-beneficiary/25 to-beneficiary/10 flex items-center justify-center border border-beneficiary/25 shadow-sm shadow-beneficiary/20">
                <Users className="w-6 h-6 text-beneficiary" />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-0.5">
                  <h1 className="text-xl font-black text-foreground">إدارة المستفيدين</h1>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-beneficiary/15 text-beneficiary border border-beneficiary/25">
                    عافيتك Pro
                  </span>
                </div>
                <p className="text-muted-foreground text-xs">عرض وإدارة حسابات المستفيدين والعملاء</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 bg-beneficiary/10 border border-beneficiary/20 rounded-xl px-3 py-1.5">
                <Users className="w-3.5 h-3.5 text-beneficiary" />
                <span className="text-xs font-bold text-beneficiary">{totalCount || (totalPages * 10)} مستفيد</span>
              </div>
              <Button variant="outline" size="icon" className="border-beneficiary/30 hover:bg-beneficiary/8 hover:border-beneficiary/50" onClick={() => void fetchBeneficiaries()}>
                <RefreshCw className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </motion.div>

      {/* Stat Cards */}
      <motion.div variants={itemAnim} className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-violet-500 to-violet-700 p-4 text-white shadow-lg shadow-violet-500/20">
          <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8" />
          <Users className="w-7 h-7 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{totalCount || (totalPages * 10)}</p>
          <p className="text-xs text-violet-100">إجمالي المستفيدين</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 p-4 text-white shadow-lg shadow-emerald-500/20">
          <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8" />
          <UserCheck className="w-7 h-7 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{activeCount}</p>
          <p className="text-xs text-emerald-100">نشطون (الصفحة الحالية)</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-rose-500 to-rose-700 p-4 text-white shadow-lg shadow-rose-500/20">
          <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8" />
          <Ban className="w-7 h-7 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{blockedCount}</p>
          <p className="text-xs text-rose-100">محظورون (الصفحة الحالية)</p>
        </div>
        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-amber-500 to-amber-700 p-4 text-white shadow-lg shadow-amber-500/20">
          <div className="absolute top-0 left-0 w-24 h-24 bg-white/10 rounded-full -translate-x-8 -translate-y-8" />
          <TrendingUp className="w-7 h-7 mb-2 opacity-80" />
          <p className="text-2xl font-bold">{goldPlatinumCount}</p>
          <p className="text-xs text-amber-100">ذهبي / بلاتيني</p>
        </div>
      </motion.div>

      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <SearchInput placeholder="بحث بالاسم أو الهاتف..." onChange={setSearch} className="flex-1" />
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="active">نشط</SelectItem>
                <SelectItem value="inactive">غير نشط</SelectItem>
                <SelectItem value="suspended">موقوف</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={itemAnim}>
        <DataTable
          columns={columns}
          data={beneficiaries}
          isLoading={isLoading}
          emptyMessage="لا يوجد مستفيدون"
          emptyAction={{ label: 'تحديث', onClick: () => void fetchBeneficiaries() }}
          rowActions={rowActions as never}
          currentPage={page}
          pageCount={totalPages}
          onPageChange={setPage}
        />
      </motion.div>

      {/* View Details Dialog/Drawer */}
      {viewTarget && (
        isMobile ? (
          <Drawer open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
            <DrawerContent>
              <DrawerHeader>
                <DrawerTitle>تفاصيل المستفيد</DrawerTitle>
              </DrawerHeader>
              <ViewContent ben={viewTarget} />
            </DrawerContent>
          </Drawer>
        ) : (
          <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
            <DialogContent dir="rtl" className="max-w-md">
              <DialogHeader>
                <DialogTitle>تفاصيل المستفيد</DialogTitle>
              </DialogHeader>
              <ViewContent ben={viewTarget} />
            </DialogContent>
          </Dialog>
        )
      )}

      {/* Toggle Active/Inactive */}
      <ConfirmDialog
        open={!!toggleTarget}
        onOpenChange={(open) => { if (!open) setToggleTarget(null); }}
        title={toggleTarget?.status === 'active' ? 'تعطيل المستفيد' : 'تفعيل المستفيد'}
        description={`هل أنت متأكد من ${toggleTarget?.status === 'active' ? 'تعطيل' : 'تفعيل'} "${toggleTarget?.name ?? ''}"؟`}
        confirmLabel={toggleTarget?.status === 'active' ? 'تعطيل' : 'تفعيل'}
        variant={toggleTarget?.status === 'active' ? 'warning' : 'info'}
        onConfirm={handleToggle}
      />

      {/* Block/Unblock */}
      <ConfirmDialog
        open={!!blockTarget}
        onOpenChange={(open) => { if (!open) setBlockTarget(null); }}
        title={blockTarget?.isBlocked ? 'إلغاء حظر المستفيد' : 'حظر المستفيد'}
        description={`هل أنت متأكد من ${blockTarget?.isBlocked ? 'إلغاء حظر' : 'حظر'} "${blockTarget?.name ?? ''}"؟${!blockTarget?.isBlocked ? ' لن يتمكن المستفيد من استخدام المنصة.' : ''}`}
        confirmLabel={blockTarget?.isBlocked ? 'إلغاء الحظر' : 'حظر'}
        variant={blockTarget?.isBlocked ? 'info' : 'destructive'}
        onConfirm={handleBlock}
      />

      {/* Delete Permanently */}
      <ConfirmDialog
        open={!!deleteTarget}
        onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}
        title="حذف المستفيد نهائياً"
        description={`هل أنت متأكد من حذف "${deleteTarget?.name ?? ''}" نهائياً؟ هذا الإجراء لا يمكن التراجع عنه وسيتم حذف جميع بيانات المستفيد.`}
        confirmLabel="حذف نهائي"
        variant="destructive"
        onConfirm={handleDelete}
        isLoading={isDeleting}
      />

      {/* Referral Details Dialog */}
      <Dialog open={!!referralTarget} onOpenChange={(open) => { if (!open) { setReferralTarget(null); setReferredUsers([]); } }}>
        <DialogContent dir="rtl" className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <UserPlus className="w-5 h-5 text-beneficiary" />
              تابعو {referralTarget?.name}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {/* Referrer Summary */}
            <div className="glass rounded-xl p-3 flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">كود الإحالة</p>
                <p className="text-lg font-mono font-bold text-beneficiary">{referralTarget?.referralCode}</p>
              </div>
              <div className="text-left">
                <p className="text-xs text-muted-foreground">عدد التابعين</p>
                <p className="text-2xl font-bold text-beneficiary">{referredUsers.length}</p>
              </div>
            </div>

            {/* Referred Users List */}
            {isLoadingReferrals ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
              </div>
            ) : referredUsers.length === 0 ? (
              <div className="text-center py-8">
                <Users className="w-10 h-10 text-muted-foreground mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">لا يوجد تابعون لهذا المستخدم</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-72 overflow-y-auto custom-scrollbar">
                {referredUsers.map((ru: any, i: number) => (
                  <div key={ru.id || i} className="glass rounded-xl p-3 flex items-center gap-3">
                    <Avatar className="w-9 h-9">
                      <AvatarFallback className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400 text-xs">
                        {(ru.name || 'م').slice(0, 2)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium">{ru.name || 'مستخدم'}</p>
                      {ru.phone && <p className="text-xs text-muted-foreground">{ru.phone}</p>}
                    </div>
                    <div className="text-left">
                      <Badge variant={ru.isActive !== false ? 'default' : 'secondary'} className="text-[10px]">
                        {ru.isActive !== false ? 'نشط' : 'غير نشط'}
                      </Badge>
                      {ru.joinedAt && (
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {new Date(ru.joinedAt).toLocaleDateString('ar-YE', { month: 'short', day: 'numeric' })}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {/* Change Password Dialog */}
      <Dialog open={!!changePasswordTarget} onOpenChange={(open) => { if (!open) { setChangePasswordTarget(null); setNewPassword(''); setNewPasswordError(null); } }}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Lock className="w-5 h-5 text-violet-500" />
              تغيير كلمة المرور
            </DialogTitle>
            <DialogDescription>
              تغيير كلمة مرور: {changePasswordTarget?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="new-password" className="text-sm font-semibold">كلمة المرور الجديدة</Label>
              <Input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => { setNewPassword(e.target.value); if (newPasswordError) setNewPasswordError(null); }}
                placeholder="أدخل كلمة المرور الجديدة"
                className={cn('h-12', newPasswordError && 'border-red-400 focus:border-red-500')}
                dir="ltr"
              />
              {newPasswordError && (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3" />
                  {newPasswordError}
                </p>
              )}
              {newPassword && newPassword.length >= 6 && (
                <div className="flex gap-1">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className={cn(
                        'h-1 flex-1 rounded-full transition-all',
                        i < (newPassword.length >= 8 && /[A-Z]/.test(newPassword) && /[0-9]/.test(newPassword) ? 3 : newPassword.length >= 6 ? 1 : 0)
                          ? 'bg-emerald-500'
                          : 'bg-slate-200 dark:bg-slate-700'
                      )}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => { setChangePasswordTarget(null); setNewPassword(''); setNewPasswordError(null); }}
              disabled={isChangingPassword}
            >
              إلغاء
            </Button>
            <Button
              onClick={handleChangePassword}
              disabled={isChangingPassword || !newPassword || newPassword.length < 6}
              className="bg-gradient-to-l from-violet-500 to-purple-600 hover:from-violet-600 hover:to-purple-700"
            >
              {isChangingPassword ? (
                <><Loader2 className="w-4 h-4 animate-spin ml-1" /> جارٍ الحفظ...</>
              ) : (
                <><Lock className="w-4 h-4 ml-1" /> حفظ كلمة المرور</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
