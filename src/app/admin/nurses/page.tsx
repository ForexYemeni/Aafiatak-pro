'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Stethoscope,
  Eye,
  ShieldCheck,
  RefreshCw,
  Phone,
  Star,
  MapPin,
  Ban,
  Trash2,
  X,
  ChevronLeft,
  Clock,
  Shield,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  FileText,
  ZoomIn,
  UserX,
  UserCheck,
  Search,
  Filter,
  Loader2,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard } from '@/components/common/glass-card';
import { BadgeStatus } from '@/components/common/badge-status';
import { DateFormatter } from '@/components/common/date-formatter';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { toast } from 'sonner';

interface NurseItem {
  id: string;
  name: string;
  phone: string;
  specialization: string[];
  verificationStatus: string;
  isActive: boolean;
  isAvailable: boolean;
  isBlocked?: boolean;
  blockedReason?: string;
  rating: number;
  reviewCount: number;
  completedJobs: number;
  governorate: string | null;
  experience: number;
  bio: string | null;
  rejectedReason: string | null;
  identityDocumentUrl: string | null;
  licenseDocumentUrl: string | null;
  identityDocumentData?: string | null;
  licenseDocumentData?: string | null;
  createdAt: string;
  licenseNumber?: string;
}

const specializationLabels: Record<string, string> = {
  general_nursing: 'تمريض عام',
  critical_care: 'رعاية حرجة',
  pediatric: 'طب الأطفال',
  elderly_care: 'رعاية المسنين',
  physiotherapy: 'علاج طبيعي',
  wound_care: 'علاج الجروح',
  iv_therapy: 'العلاج الوريدي',
  mental_health: 'صحة نفسية',
  post_surgery: 'ما بعد الجراحة',
  emergency: 'طوارئ',
};

export default function AdminNursesPage() {
  const authFetch = useAuthFetch();
  const [nurses, setNurses] = useState<NurseItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [specFilter, setSpecFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);

  // View detail state
  const [viewTarget, setViewTarget] = useState<NurseItem | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [docLoading, setDocLoading] = useState(false);
  const [docData, setDocData] = useState<{ identityDocumentData: string | null; licenseDocumentData: string | null } | null>(null);

  // Image lightbox
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);

  // Verify dialog
  const [verifyTarget, setVerifyTarget] = useState<NurseItem | null>(null);
  const [verifyAction, setVerifyAction] = useState<'verify' | 'reject'>('verify');
  const [rejectedReason, setRejectedReason] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  // Block dialog
  const [blockTarget, setBlockTarget] = useState<NurseItem | null>(null);
  const [blockReason, setBlockReason] = useState('');
  const [isBlocking, setIsBlocking] = useState(false);

  // Delete dialog
  const [deleteTarget, setDeleteTarget] = useState<NurseItem | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteConfirmName, setDeleteConfirmName] = useState('');

  // Toggle active
  const [toggleTarget, setToggleTarget] = useState<NurseItem | null>(null);
  const [isToggling, setIsToggling] = useState(false);

  const fetchNurses = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '12',
        search,
        ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
        ...(specFilter !== 'all' ? { specialization: specFilter } : {}),
      });
      const res = await authFetch(`/api/admin/nurses?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        const items = json.data.nurses ?? json.data;
        setNurses(Array.isArray(items) ? items : []);
        if (json.data.pages) setTotalPages(json.data.pages);
        if (json.data.total) setTotal(json.data.total);
      }
    } catch {
      toast.error('فشل تحميل بيانات الممرضين');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, page, search, statusFilter, specFilter]);

  useEffect(() => {
    void fetchNurses();
  }, [fetchNurses]);

  // View nurse detail
  const handleViewNurse = useCallback(async (nurse: NurseItem) => {
    setViewTarget(nurse);
    setViewLoading(true);
    setDocData(null);
    try {
      const res = await authFetch(`/api/admin/nurses/${nurse.id}`);
      const json = await res.json();
      if (json.success && json.data) {
        setViewTarget({ ...nurse, ...json.data });
      }
    } catch {
      // Keep the list data as fallback
    } finally {
      setViewLoading(false);
    }
  }, [authFetch]);

  // Load documents separately (lazy loading for speed)
  const handleLoadDocuments = useCallback(async (nurseId: string) => {
    setDocLoading(true);
    try {
      const res = await authFetch(`/api/admin/nurses/${nurseId}/documents`);
      const json = await res.json();
      if (json.success && json.data) {
        setDocData(json.data);
      }
    } catch {
      toast.error('فشل تحميل المستندات');
    } finally {
      setDocLoading(false);
    }
  }, [authFetch]);

  // Verify/reject nurse
  const handleVerify = async () => {
    if (!verifyTarget) return;
    setIsVerifying(true);
    try {
      const res = await authFetch(`/api/admin/nurses/${verifyTarget.id}/verify`, {
        method: 'PATCH',
        body: JSON.stringify({
          status: verifyAction === 'verify' ? 'verified' : 'rejected',
          ...(verifyAction === 'reject' ? { rejectedReason } : {}),
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(verifyAction === 'verify' ? 'تم توثيق الممرض/ـة' : 'تم رفض الممرض/ـة');
        void fetchNurses();
        if (viewTarget?.id === verifyTarget.id) {
          setViewTarget((prev) => prev ? { ...prev, verificationStatus: verifyAction === 'verify' ? 'verified' : 'rejected' } : null);
        }
      } else {
        toast.error(json.message ?? 'فشل العملية');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setIsVerifying(false);
      setVerifyTarget(null);
      setRejectedReason('');
    }
  };

  // Toggle active
  const handleToggle = async () => {
    if (!toggleTarget) return;
    setIsToggling(true);
    try {
      const res = await authFetch(`/api/admin/nurses/${toggleTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ isActive: !toggleTarget.isActive }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(toggleTarget.isActive ? 'تم تعطيل الممرض/ـة' : 'تم تفعيل الممرض/ـة');
        void fetchNurses();
      }
    } catch {
      toast.error('فشل تغيير الحالة');
    } finally {
      setIsToggling(false);
      setToggleTarget(null);
    }
  };

  // Block/unblock nurse
  const handleBlock = async () => {
    if (!blockTarget) return;
    setIsBlocking(true);
    try {
      const isBlocked = !blockTarget.isBlocked;
      const res = await authFetch(`/api/admin/nurses/${blockTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          isBlocked,
          blockedReason: isBlocked ? blockReason : '',
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(isBlocked ? 'تم حظر الممرض/ـة' : 'تم إلغاء حظر الممرض/ـة');
        void fetchNurses();
        if (viewTarget?.id === blockTarget.id) {
          setViewTarget((prev) => prev ? { ...prev, isBlocked, blockedReason: isBlocked ? blockReason : '' } : null);
        }
      } else {
        toast.error(json.message ?? 'فشل العملية');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setIsBlocking(false);
      setBlockTarget(null);
      setBlockReason('');
    }
  };

  // Delete nurse permanently
  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (deleteConfirmName !== deleteTarget.name) {
      toast.error('يرجى كتابة اسم الممرض/ـة للتأكيد');
      return;
    }
    setIsDeleting(true);
    try {
      const res = await authFetch(`/api/admin/nurses/${deleteTarget.id}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم حذف الممرض/ـة نهائياً');
        setViewTarget(null);
        void fetchNurses();
      } else {
        toast.error(json.message ?? 'فشل الحذف');
      }
    } catch {
      toast.error('حدث خطأ أثناء الحذف');
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
      setDeleteConfirmName('');
    }
  };

  const getVerificationColor = (status: string) => {
    switch (status) {
      case 'verified': return 'text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400';
      case 'pending': return 'text-amber-600 bg-amber-50 dark:bg-amber-900/20 dark:text-amber-400';
      case 'rejected': return 'text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400';
      default: return 'text-gray-600 bg-gray-50 dark:bg-gray-900/20 dark:text-gray-400';
    }
  };

  const getVerificationIcon = (status: string) => {
    switch (status) {
      case 'verified': return <CheckCircle2 className="w-4 h-4" />;
      case 'pending': return <Clock className="w-4 h-4" />;
      case 'rejected': return <XCircle className="w-4 h-4" />;
      default: return <Shield className="w-4 h-4" />;
    }
  };

  const getVerificationLabel = (status: string) => {
    switch (status) {
      case 'verified': return 'موثق';
      case 'pending': return 'قيد المراجعة';
      case 'rejected': return 'مرفوض';
      default: return 'غير موثق';
    }
  };

  return (
    <div className="space-y-6">
      {/* Image Lightbox */}
      <AnimatePresence>
        {lightboxImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
            onClick={() => setLightboxImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-4xl max-h-[90vh] w-full"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                onClick={() => setLightboxImage(null)}
                className="absolute -top-3 -left-3 w-10 h-10 bg-white dark:bg-gray-800 rounded-full flex items-center justify-center shadow-xl z-10 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <img
                src={lightboxImage.src}
                alt={lightboxImage.alt}
                className="w-full h-full object-contain rounded-2xl shadow-2xl"
              />
              <p className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-black/60 text-white text-sm px-4 py-2 rounded-full">
                {lightboxImage.alt}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <PageHeader title="إدارة الممرضين" description={`إجمالي الممرضين: ${total} ممرض/ـة`} />

      {/* Filters */}
      <GlassCard variant="admin" className="p-4">
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو الهاتف..."
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              className="pr-10"
            />
          </div>
          <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="الحالة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع الحالات</SelectItem>
              <SelectItem value="verified">موثق</SelectItem>
              <SelectItem value="pending">قيد المراجعة</SelectItem>
              <SelectItem value="unverified">غير موثق</SelectItem>
              <SelectItem value="rejected">مرفوض</SelectItem>
            </SelectContent>
          </Select>
          <Select value={specFilter} onValueChange={(v) => { setSpecFilter(v); setPage(1); }}>
            <SelectTrigger className="w-full sm:w-40">
              <SelectValue placeholder="التخصص" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">جميع التخصصات</SelectItem>
              {Object.entries(specializationLabels).map(([key, label]) => (
                <SelectItem key={key} value={key}>{label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => void fetchNurses()}>
            <RefreshCw className="w-4 h-4" />
          </Button>
        </div>
      </GlassCard>

      {/* Nurses Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass rounded-2xl p-5 animate-pulse">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 bg-muted rounded-full" />
                <div className="space-y-2 flex-1">
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
              <div className="space-y-2">
                <div className="h-3 bg-muted rounded" />
                <div className="h-3 bg-muted rounded w-2/3" />
              </div>
            </div>
          ))}
        </div>
      ) : nurses.length === 0 ? (
        <GlassCard variant="admin" className="p-12 text-center">
          <Stethoscope className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
          <p className="text-lg font-medium text-muted-foreground mb-1">لا يوجد ممرضون</p>
          <p className="text-sm text-muted-foreground/60">لم يتم العثور على نتائج مطابقة</p>
        </GlassCard>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {nurses.map((nurse) => (
              <NurseCard
                key={nurse.id}
                nurse={nurse}
                onView={() => handleViewNurse(nurse)}
                onVerify={() => { setVerifyTarget(nurse); setVerifyAction('verify'); }}
                onReject={() => { setVerifyTarget(nurse); setVerifyAction('reject'); }}
                onToggleActive={() => setToggleTarget(nurse)}
                onBlock={() => setBlockTarget(nurse)}
                onDelete={() => setDeleteTarget(nurse)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
              >
                السابق
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let pageNum: number;
                  if (totalPages <= 5) {
                    pageNum = i + 1;
                  } else if (page <= 3) {
                    pageNum = i + 1;
                  } else if (page >= totalPages - 2) {
                    pageNum = totalPages - 4 + i;
                  } else {
                    pageNum = page - 2 + i;
                  }
                  return (
                    <Button
                      key={pageNum}
                      variant={page === pageNum ? 'default' : 'outline'}
                      size="sm"
                      className="w-9 h-9 p-0"
                      onClick={() => setPage(pageNum)}
                    >
                      {pageNum}
                    </Button>
                  );
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              >
                التالي
              </Button>
            </div>
          )}
        </>
      )}

      {/* ====== VIEW DETAIL DIALOG ====== */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) { setViewTarget(null); setDocData(null); } }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5 text-admin" />
              تفاصيل الممرض/ـة
            </DialogTitle>
          </DialogHeader>

          {viewLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-admin" />
            </div>
          ) : viewTarget ? (
            <div className="space-y-5">
              {/* Header */}
              <div className="flex items-center gap-4">
                <Avatar className="w-20 h-20 text-xl border-2 border-admin/20">
                  <AvatarFallback className="bg-gradient-to-br from-sky-100 to-blue-100 dark:from-sky-900/30 dark:to-blue-900/30 text-sky-700 dark:text-sky-400">
                    {viewTarget.name.slice(0, 2)}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1">
                  <h3 className="text-lg font-bold">{viewTarget.name}</h3>
                  <div className="flex items-center gap-2 mt-1 text-sm text-muted-foreground">
                    <Phone className="w-3.5 h-3.5" />
                    <span dir="ltr">{viewTarget.phone}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <Star className="w-3.5 h-3.5 text-yellow-500 fill-yellow-500" />
                    <span className="text-sm">{viewTarget.rating.toFixed(1)}</span>
                    <span className="text-xs text-muted-foreground">({viewTarget.reviewCount} تقييم)</span>
                  </div>
                </div>
              </div>

              {/* Status badges */}
              <div className="flex flex-wrap gap-2">
                <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${getVerificationColor(viewTarget.verificationStatus)}`}>
                  {getVerificationIcon(viewTarget.verificationStatus)}
                  {getVerificationLabel(viewTarget.verificationStatus)}
                </div>
                <Badge variant={viewTarget.isActive ? 'default' : 'secondary'} className="text-xs">
                  {viewTarget.isActive ? 'نشط' : 'معطل'}
                </Badge>
                <Badge variant={viewTarget.isAvailable ? 'default' : 'secondary'} className="text-xs">
                  {viewTarget.isAvailable ? 'متاح' : 'غير متاح'}
                </Badge>
                {viewTarget.isBlocked && (
                  <Badge variant="destructive" className="text-xs">
                    <Ban className="w-3 h-3 ml-1" />
                    محظور
                  </Badge>
                )}
              </div>

              {/* Info grid */}
              <div className="grid grid-cols-2 gap-3">
                <InfoCard label="التخصص" value={(viewTarget.specialization || []).map((s) => specializationLabels[s] ?? s).join('، ') || 'غير محدد'} />
                <InfoCard label="سنوات الخبرة" value={`${viewTarget.experience} سنة`} />
                <InfoCard label="الوظائف المكتملة" value={`${viewTarget.completedJobs}`} />
                <InfoCard label="رقم الترخيص" value={viewTarget.licenseNumber || 'غير محدد'} />
                {viewTarget.governorate && <InfoCard label="المحافظة" value={viewTarget.governorate} />}
              </div>

              {viewTarget.bio && (
                <div className="p-3 rounded-xl bg-muted/30">
                  <p className="text-xs text-muted-foreground mb-1">نبذة</p>
                  <p className="text-sm leading-relaxed">{viewTarget.bio}</p>
                </div>
              )}

              {viewTarget.rejectedReason && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                  <p className="text-xs text-red-600 dark:text-red-400 mb-1">سبب رفض التوثيق</p>
                  <p className="text-sm">{viewTarget.rejectedReason}</p>
                </div>
              )}

              {viewTarget.isBlocked && viewTarget.blockedReason && (
                <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
                  <p className="text-xs text-red-600 dark:text-red-400 mb-1">سبب الحظر</p>
                  <p className="text-sm">{viewTarget.blockedReason}</p>
                </div>
              )}

              {/* Documents Section - Lazy loaded */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <FileText className="w-4 h-4 text-admin" />
                    المستندات
                  </h4>
                  {!docData && !docLoading && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleLoadDocuments(viewTarget.id)}
                      className="text-xs"
                    >
                      <Eye className="w-3.5 h-3.5 ml-1" />
                      عرض المستندات
                    </Button>
                  )}
                </div>

                {docLoading && (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="w-6 h-6 animate-spin text-admin" />
                    <span className="mr-2 text-sm text-muted-foreground">جاري تحميل المستندات...</span>
                  </div>
                )}

                {docData && (
                  <div className="grid grid-cols-2 gap-3">
                    {(() => {
                      const identitySrc = docData.identityDocumentData || (docData.identityDocumentUrl && !docData.identityDocumentUrl.startsWith('data:stored/') ? docData.identityDocumentUrl : null);
                      const licenseSrc = docData.licenseDocumentData || (docData.licenseDocumentUrl && !docData.licenseDocumentUrl.startsWith('data:stored/') ? docData.licenseDocumentUrl : null);

                      if (!identitySrc && !licenseSrc) {
                        return (
                          <div className="col-span-2 text-center py-6 text-muted-foreground">
                            <FileText className="w-8 h-8 mx-auto mb-2 opacity-30" />
                            <p className="text-sm">لم يتم رفع مستندات بعد</p>
                          </div>
                        );
                      }

                      return (
                        <>
                          {identitySrc ? (
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium text-muted-foreground">الهوية الوطنية</p>
                              <div
                                className="relative rounded-xl overflow-hidden border-2 border-border/50 hover:border-admin/30 transition-all cursor-pointer group aspect-[3/4]"
                                onClick={() => setLightboxImage({ src: identitySrc, alt: 'الهوية الوطنية' })}
                              >
                                <img
                                  src={identitySrc}
                                  alt="الهوية الوطنية"
                                  className="w-full h-full object-contain bg-muted/10 p-2"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                  <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-all" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium text-muted-foreground">الهوية الوطنية</p>
                              <div className="rounded-xl border-2 border-dashed border-border/50 aspect-[3/4] flex items-center justify-center">
                                <p className="text-xs text-muted-foreground">لم يتم الرفع</p>
                              </div>
                            </div>
                          )}
                          {licenseSrc ? (
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium text-muted-foreground">مزاولة المهنة</p>
                              <div
                                className="relative rounded-xl overflow-hidden border-2 border-border/50 hover:border-admin/30 transition-all cursor-pointer group aspect-[3/4]"
                                onClick={() => setLightboxImage({ src: licenseSrc, alt: 'مزاولة المهنة' })}
                              >
                                <img
                                  src={licenseSrc}
                                  alt="مزاولة المهنة"
                                  className="w-full h-full object-contain bg-muted/10 p-2"
                                />
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-all flex items-center justify-center">
                                  <ZoomIn className="w-8 h-8 text-white opacity-0 group-hover:opacity-100 transition-all" />
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-1.5">
                              <p className="text-xs font-medium text-muted-foreground">مزاولة المهنة</p>
                              <div className="rounded-xl border-2 border-dashed border-border/50 aspect-[3/4] flex items-center justify-center">
                                <p className="text-xs text-muted-foreground">لم يتم الرفع</p>
                              </div>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </div>
                )}
              </div>

              {/* Registration date */}
              <div className="text-xs text-muted-foreground pt-2 border-t">
                تاريخ التسجيل: <DateFormatter date={viewTarget.createdAt} format="date" />
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2 pt-2">
                {viewTarget.verificationStatus !== 'verified' && (
                  <Button
                    size="sm"
                    className="bg-green-600 hover:bg-green-700 text-xs"
                    onClick={() => { setVerifyTarget(viewTarget); setVerifyAction('verify'); }}
                  >
                    <ShieldCheck className="w-3.5 h-3.5 ml-1" />
                    توثيق
                  </Button>
                )}
                {viewTarget.verificationStatus !== 'rejected' && viewTarget.verificationStatus !== 'unverified' && (
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                    onClick={() => { setVerifyTarget(viewTarget); setVerifyAction('reject'); }}
                  >
                    <XCircle className="w-3.5 h-3.5 ml-1" />
                    رفض التوثيق
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setToggleTarget(viewTarget)}
                  className="text-xs"
                >
                  {viewTarget.isActive ? (
                    <><UserX className="w-3.5 h-3.5 ml-1" />تعطيل</>
                  ) : (
                    <><UserCheck className="w-3.5 h-3.5 ml-1" />تفعيل</>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setBlockTarget(viewTarget)}
                  className={viewTarget.isBlocked ? 'text-green-600 border-green-200 hover:bg-green-50 text-xs' : 'text-orange-600 border-orange-200 hover:bg-orange-50 text-xs'}
                >
                  {viewTarget.isBlocked ? (
                    <><UserCheck className="w-3.5 h-3.5 ml-1" />إلغاء الحظر</>
                  ) : (
                    <><Ban className="w-3.5 h-3.5 ml-1" />حظر</>
                  )}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600 border-red-200 hover:bg-red-50 text-xs"
                  onClick={() => setDeleteTarget(viewTarget)}
                >
                  <Trash2 className="w-3.5 h-3.5 ml-1" />
                  حذف نهائي
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      {/* ====== VERIFY DIALOG ====== */}
      <Dialog open={!!verifyTarget} onOpenChange={(open) => { if (!open) { setVerifyTarget(null); setRejectedReason(''); } }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {verifyAction === 'verify' ? 'توثيق الممرض/ـة' : 'رفض توثيق الممرض/ـة'}
            </DialogTitle>
            <DialogDescription>
              {verifyAction === 'verify'
                ? `هل أنت متأكد من توثيق "${verifyTarget?.name ?? ''}"؟`
                : `يرجى إدخال سبب رفض توثيق "${verifyTarget?.name ?? ''}"`}
            </DialogDescription>
          </DialogHeader>
          {verifyAction === 'reject' && (
            <div className="py-2">
              <Label>سبب الرفض *</Label>
              <Textarea
                value={rejectedReason}
                onChange={(e) => setRejectedReason(e.target.value)}
                placeholder="أدخل سبب الرفض..."
                rows={3}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setVerifyTarget(null)} disabled={isVerifying}>
              إلغاء
            </Button>
            <Button
              onClick={handleVerify}
              disabled={isVerifying || (verifyAction === 'reject' && !rejectedReason)}
              className={verifyAction === 'reject' ? 'bg-destructive hover:bg-destructive/90' : 'bg-admin hover:bg-admin/90'}
            >
              {isVerifying ? 'جارٍ التنفيذ...' : verifyAction === 'verify' ? 'توثيق' : 'رفض'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== TOGGLE ACTIVE DIALOG ====== */}
      <Dialog open={!!toggleTarget} onOpenChange={(open) => { if (!open) setToggleTarget(null); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>{toggleTarget?.isActive ? 'تعطيل الممرض/ـة' : 'تفعيل الممرض/ـة'}</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من {toggleTarget?.isActive ? 'تعطيل' : 'تفعيل'} &quot;{toggleTarget?.name ?? ''}&quot;؟
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToggleTarget(null)} disabled={isToggling}>إلغاء</Button>
            <Button onClick={handleToggle} disabled={isToggling}>
              {isToggling ? 'جارٍ التنفيذ...' : toggleTarget?.isActive ? 'تعطيل' : 'تفعيل'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== BLOCK DIALOG ====== */}
      <Dialog open={!!blockTarget} onOpenChange={(open) => { if (!open) { setBlockTarget(null); setBlockReason(''); } }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Ban className="w-5 h-5 text-orange-600" />
              {blockTarget?.isBlocked ? 'إلغاء حظر الممرض/ـة' : 'حظر الممرض/ـة'}
            </DialogTitle>
            <DialogDescription>
              {blockTarget?.isBlocked
                ? `سيتم إلغاء حظر "${blockTarget?.name ?? ''}" وسيتمكن من استخدام المنصة مرة أخرى`
                : `سيتم حظر "${blockTarget?.name ?? ''}" ولن يتمكن من تسجيل الدخول أو استخدام المنصة`}
            </DialogDescription>
          </DialogHeader>
          {!blockTarget?.isBlocked && (
            <div className="py-2">
              <Label>سبب الحظر</Label>
              <Textarea
                value={blockReason}
                onChange={(e) => setBlockReason(e.target.value)}
                placeholder="أدخل سبب الحظر..."
                rows={3}
              />
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => { setBlockTarget(null); setBlockReason(''); }} disabled={isBlocking}>
              إلغاء
            </Button>
            <Button
              onClick={handleBlock}
              disabled={isBlocking}
              className={blockTarget?.isBlocked ? 'bg-green-600 hover:bg-green-700' : 'bg-orange-600 hover:bg-orange-700'}
            >
              {isBlocking ? 'جارٍ التنفيذ...' : blockTarget?.isBlocked ? 'إلغاء الحظر' : 'حظر'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ====== DELETE DIALOG ====== */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => { if (!open) { setDeleteTarget(null); setDeleteConfirmName(''); } }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="w-5 h-5" />
              حذف الممرض نهائياً
            </DialogTitle>
            <DialogDescription>
              هذا الإجراء لا يمكن التراجع عنه! سيتم حذف الممرض/ـة &quot;{deleteTarget?.name ?? ''}&quot; وجميع بياناته نهائياً.
            </DialogDescription>
          </DialogHeader>
          <div className="py-2 space-y-3">
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-red-600 mt-0.5 shrink-0" />
                <p className="text-sm text-red-700 dark:text-red-400">
                  تحذير: سيتم حذف جميع البيانات بما في ذلك المستندات والتقييمات والمحفظة. لا يمكن استعادة البيانات بعد الحذف.
                </p>
              </div>
            </div>
            <div className="space-y-2">
              <Label>اكتب اسم الممرض/ـة للتأكيد: <strong>{deleteTarget?.name}</strong></Label>
              <Input
                value={deleteConfirmName}
                onChange={(e) => setDeleteConfirmName(e.target.value)}
                placeholder={deleteTarget?.name}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setDeleteTarget(null); setDeleteConfirmName(''); }} disabled={isDeleting}>
              إلغاء
            </Button>
            <Button
              onClick={handleDelete}
              disabled={isDeleting || deleteConfirmName !== deleteTarget?.name}
              variant="destructive"
            >
              {isDeleting ? 'جارٍ الحذف...' : 'حذف نهائياً'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ====== Professional Nurse Card Component ======

function NurseCard({
  nurse,
  onView,
  onVerify,
  onReject,
  onToggleActive,
  onBlock,
  onDelete,
}: {
  nurse: NurseItem;
  onView: () => void;
  onVerify: () => void;
  onReject: () => void;
  onToggleActive: () => void;
  onBlock: () => void;
  onDelete: () => void;
}) {
  const [showActions, setShowActions] = useState(false);

  const verificationColor = nurse.verificationStatus === 'verified'
    ? 'bg-green-500'
    : nurse.verificationStatus === 'pending'
    ? 'bg-amber-500'
    : nurse.verificationStatus === 'rejected'
    ? 'bg-red-500'
    : 'bg-gray-400';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      className="glass rounded-2xl overflow-hidden hover:shadow-lg transition-all duration-300 border border-transparent hover:border-admin/20"
    >
      {/* Top color indicator */}
      <div className={`h-1 ${verificationColor}`} />

      <div className="p-5">
        {/* Header */}
        <div className="flex items-start gap-3 mb-4">
          <Avatar className="w-14 h-14 border-2 border-white/50 dark:border-gray-700/50 shadow-sm">
            <AvatarFallback className="bg-gradient-to-br from-sky-100 to-blue-200 dark:from-sky-900/30 dark:to-blue-900/40 text-sky-700 dark:text-sky-400 text-base font-bold">
              {nurse.name.slice(0, 2)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm truncate">{nurse.name}</h3>
              {nurse.isBlocked && <Ban className="w-3.5 h-3.5 text-red-500 shrink-0" />}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5" dir="ltr">{nurse.phone}</p>
            <div className="flex items-center gap-1.5 mt-1.5">
              <BadgeStatus status={nurse.verificationStatus} size="sm" />
              <Badge variant={nurse.isActive ? 'default' : 'secondary'} className="text-[10px] h-5 px-1.5">
                {nurse.isActive ? 'نشط' : 'معطل'}
              </Badge>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          <div className="text-center p-2 rounded-lg bg-muted/20">
            <div className="flex items-center justify-center gap-1">
              <Star className="w-3 h-3 text-yellow-500 fill-yellow-500" />
              <span className="text-sm font-bold">{nurse.rating.toFixed(1)}</span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">تقييم</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/20">
            <p className="text-sm font-bold">{nurse.completedJobs}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">خدمة</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/20">
            <p className="text-sm font-bold">{nurse.experience}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">سنة خبرة</p>
          </div>
        </div>

        {/* Specialization */}
        <div className="flex flex-wrap gap-1 mb-4">
          {(nurse.specialization || []).slice(0, 2).map((spec) => (
            <Badge key={spec} variant="outline" className="text-[10px] h-5 px-1.5">
              {specializationLabels[spec] ?? spec}
            </Badge>
          ))}
          {(nurse.specialization || []).length > 2 && (
            <Badge variant="outline" className="text-[10px] h-5 px-1.5">
              +{(nurse.specialization || []).length - 2}
            </Badge>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 bg-admin hover:bg-admin/90 text-xs h-9"
            onClick={onView}
          >
            <Eye className="w-3.5 h-3.5 ml-1" />
            عرض التفاصيل
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-9 w-9 p-0"
            onClick={() => setShowActions(!showActions)}
          >
            <ChevronLeft className={`w-4 h-4 transition-transform ${showActions ? '-rotate-90' : ''}`} />
          </Button>
        </div>

        {/* Expandable actions */}
        <AnimatePresence>
          {showActions && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="flex flex-wrap gap-2 pt-3 mt-3 border-t">
                {nurse.verificationStatus !== 'verified' && (
                  <Button size="sm" variant="outline" onClick={onVerify} className="text-green-600 border-green-200 hover:bg-green-50 text-xs h-8">
                    <ShieldCheck className="w-3 h-3 ml-1" />توثيق
                  </Button>
                )}
                {nurse.verificationStatus === 'pending' && (
                  <Button size="sm" variant="outline" onClick={onReject} className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-8">
                    <XCircle className="w-3 h-3 ml-1" />رفض
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={onToggleActive} className="text-xs h-8">
                  {nurse.isActive ? 'تعطيل' : 'تفعيل'}
                </Button>
                <Button size="sm" variant="outline" onClick={onBlock} className={`text-xs h-8 ${nurse.isBlocked ? 'text-green-600' : 'text-orange-600'}`}>
                  <Ban className="w-3 h-3 ml-1" />
                  {nurse.isBlocked ? 'إلغاء الحظر' : 'حظر'}
                </Button>
                <Button size="sm" variant="outline" onClick={onDelete} className="text-red-600 border-red-200 hover:bg-red-50 text-xs h-8">
                  <Trash2 className="w-3 h-3 ml-1" />حذف
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// ====== Info Card Component ======

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-3 rounded-xl bg-muted/20 border border-border/30">
      <p className="text-[10px] text-muted-foreground mb-0.5">{label}</p>
      <p className="text-sm font-medium truncate">{value}</p>
    </div>
  );
}
