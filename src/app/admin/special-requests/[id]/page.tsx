'use client';

// ============================================================================
// عافيتك - صفحة محادثة طلب الخدمة الخاصة للإدارة
// ============================================================================
// تعرض هذه الصفحة المحادثة مع المستفيد وتتيح للإدارة:
// - إرسال الرسائل (نص/صورة/ملف)
// - إرسال عروض الأسعار
// - مراجعة إثبات الدفع (قبول/رفض)
// - تعيين ممرض أو تنفيذ مباشر
// - إكمال الخدمة
// - إلغاء الطلب
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowRight, Send, Image as ImageIcon, Loader2, MessageSquare,
  RefreshCw, AlertCircle, Tag, MapPin, Clock, User, Phone, FileText,
  CheckCircle2, XCircle, HandCoins, Stethoscope, Calendar, X, Plus,
  ShieldCheck, PlayCircle, CheckCheck, Eye,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from '@/components/ui/dialog';
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from '@/components/ui/sheet';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { useAuthFetch, invalidateAuthFetchCache } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { formatYemeniRial } from '@/components/common/currency';
import { toArabicNum, formatDateOnly as formatDate, formatTimeOnly as formatTime } from '@/components/common/date-formatter';
import { toast } from 'sonner';

interface SpecialRequestDetail {
  _id: string;
  id?: string;
  orderNumber: number;
  beneficiaryId: string;
  beneficiaryName: string;
  beneficiaryPhone: string;
  serviceName: string;
  requestedServices: string[];
  notes?: string;
  address: string;
  lat: number;
  lng: number;
  scheduledDate?: string;
  scheduledTime?: string;
  status: string;
  offers: any[];
  agreedPrice?: number;
  agreedDuration?: string;
  adminNotes?: string;
  paymentMethod?: string;
  hasPaymentProof?: boolean;
  paymentProofData?: string;
  paymentStatus?: string;
  paymentVerifiedAt?: string;
  paymentRejectionReason?: string;
  nurseId?: string;
  nurseName?: string | null;
  nursePhone?: string | null;
  nurseRating?: number;
  nurseAssignedAt?: string;
  nurseAcceptedAt?: string;
  nurseRejectedAt?: string;
  commissionRate?: number;
  commission?: number;
  nursePayout?: number;
  startedAt?: string;
  completedAt?: string;
  beneficiaryConfirmedAt?: string;
  executeByAdmin?: boolean;
  serviceRating?: number;
  ratingComment?: string;
  ratedAt?: string;
  cancelledAt?: string;
  cancelReason?: string;
  rejectedAt?: string;
  rejectionReason?: string;
  createdAt: string;
  updatedAt: string;
}

interface ChatMessage {
  _id?: string;
  id?: string;
  senderId: string;
  senderRole: string;
  type: string;
  content: string;
  imageUrl?: string;
  fileUrl?: string;
  fileName?: string;
  fileSize?: number;
  offerData?: {
    price: number;
    duration: string;
    notes?: string;
    status?: string;
    offerIndex: number;
  };
  readBy?: string[];
  createdAt: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  new: { label: 'جديد', color: 'text-blue-700', bg: 'bg-blue-50 dark:bg-blue-900/30', border: 'border-blue-200 dark:border-blue-800' },
  negotiating: { label: 'جاري التفاوض', color: 'text-amber-700', bg: 'bg-amber-50 dark:bg-amber-900/30', border: 'border-amber-200 dark:border-amber-800' },
  awaiting_payment: { label: 'بانتظار الدفع', color: 'text-orange-700', bg: 'bg-orange-50 dark:bg-orange-900/30', border: 'border-orange-200 dark:border-orange-800' },
  awaiting_payment_review: { label: 'بانتظار مراجعة الدفع', color: 'text-purple-700', bg: 'bg-purple-50 dark:bg-purple-900/30', border: 'border-purple-200 dark:border-purple-800' },
  paid: { label: 'تم الدفع', color: 'text-emerald-700', bg: 'bg-emerald-50 dark:bg-emerald-900/30', border: 'border-emerald-200 dark:border-emerald-800' },
  awaiting_nurse: { label: 'بانتظار تعيين ممرض', color: 'text-cyan-700', bg: 'bg-cyan-50 dark:bg-cyan-900/30', border: 'border-cyan-200 dark:border-cyan-800' },
  in_progress: { label: 'جار التنفيذ', color: 'text-indigo-700', bg: 'bg-indigo-50 dark:bg-indigo-900/30', border: 'border-indigo-200 dark:border-indigo-800' },
  completed: { label: 'مكتمل', color: 'text-green-700', bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-green-200 dark:border-green-800' },
  rejected: { label: 'مرفوض', color: 'text-rose-700', bg: 'bg-rose-50 dark:bg-rose-900/30', border: 'border-rose-200 dark:border-rose-800' },
  cancelled: { label: 'ملغي', color: 'text-red-700', bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800' },
};

interface NurseOption {
  _id: string;
  name: string;
  phone?: string;
  rating?: number;
  isAvailable?: boolean;
  isOnline?: boolean;
  specializations?: string[];
}

export default function AdminSpecialRequestDetailPage() {
  const router = useRouter();
  const params = useParams();
  const requestId = params.id as string;
  const authFetch = useAuthFetch();

  const [detail, setDetail] = useState<SpecialRequestDetail | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [showImageDialog, setShowImageDialog] = useState(false);

  // Offer dialog state
  const [showOfferDialog, setShowOfferDialog] = useState(false);
  const [offerPrice, setOfferPrice] = useState('');
  const [offerDuration, setOfferDuration] = useState('');
  const [offerNotes, setOfferNotes] = useState('');
  const [isSendingOffer, setIsSendingOffer] = useState(false);

  // Reject payment dialog
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [isProcessingPayment, setIsProcessingPayment] = useState(false);

  // Assign nurse sheet
  const [showNurseSheet, setShowNurseSheet] = useState(false);
  const [nurses, setNurses] = useState<NurseOption[]>([]);
  const [nurseSearch, setNurseSearch] = useState('');
  const [isLoadingNurses, setIsLoadingNurses] = useState(false);
  const [selectedNurseId, setSelectedNurseId] = useState<string | null>(null);
  const [isAssigningNurse, setIsAssigningNurse] = useState(false);

  // Cancel dialog
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  // Image preview
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  // ── جلب تفاصيل الطلب ──
  const fetchDetail = useCallback(async () => {
    try {
      const res = await authFetch(`/api/special-requests/${requestId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setDetail(json.data);
      }
    } catch (e) {
      toast.error('فشل تحميل تفاصيل الطلب');
    }
  }, [authFetch, requestId]);

  // ── جلب الرسائل ──
  const fetchMessages = useCallback(async () => {
    try {
      const res = await authFetch(`/api/special-requests/${requestId}/messages`);
      const json = await res.json();
      if (json.success && json.data) {
        setMessages(json.data.messages || []);
      }
    } catch (e) {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, requestId]);

  useEffect(() => {
    void fetchDetail();
    void fetchMessages();
  }, [fetchDetail, fetchMessages]);

  // ── تحديث فوري عند استقبال إشعارات Socket ──
  useRealtimeRefresh({
    entities: ['special_request', 'chat'],
    onRefresh: () => {
      void fetchDetail();
      void fetchMessages();
    },
    fallbackInterval: 8000,
  });

  // ── التمرير لأسفل عند وصول رسائل جديدة ──
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── إرسال رسالة نصية/صورة ──
  const handleSendMessage = async () => {
    const content = newMessage.trim();
    const imageUrl = imageUrlInput.trim();
    if (!content && !imageUrl) return;

    setIsSending(true);
    try {
      const res = await authFetch(`/api/special-requests/${requestId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content, imageUrl: imageUrl || undefined }),
      });
      const json = await res.json();
      if (json.success) {
        setNewMessage('');
        setImageUrlInput('');
        setShowImageDialog(false);
        await fetchMessages();
        await fetchDetail();
      } else {
        toast.error(json.message ?? 'فشل إرسال الرسالة');
      }
    } catch {
      toast.error('حدث خطأ أثناء الإرسال');
    } finally {
      setIsSending(false);
    }
  };

  // ── إرسال عرض سعر ──
  const handleSendOffer = async () => {
    const price = parseFloat(offerPrice);
    if (!price || price <= 0) {
      toast.error('السعر يجب أن يكون رقماً موجباً');
      return;
    }
    if (!offerDuration.trim()) {
      toast.error('مدة التنفيذ مطلوبة');
      return;
    }

    setIsSendingOffer(true);
    try {
      const res = await authFetch(`/api/special-requests/${requestId}/offer`, {
        method: 'POST',
        body: JSON.stringify({
          price,
          duration: offerDuration.trim(),
          notes: offerNotes.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم إرسال عرض السعر بنجاح');
        setShowOfferDialog(false);
        setOfferPrice('');
        setOfferDuration('');
        setOfferNotes('');
        await fetchMessages();
        await fetchDetail();
      } else {
        toast.error(json.message ?? 'فشل إرسال العرض');
      }
    } catch {
      toast.error('حدث خطأ أثناء إرسال العرض');
    } finally {
      setIsSendingOffer(false);
    }
  };

  // ── مراجعة الدفع ──
  const handleVerifyPayment = async (action: 'verify' | 'reject') => {
    if (action === 'reject' && !rejectReason.trim()) {
      toast.error('سبب الرفض مطلوب');
      return;
    }
    setIsProcessingPayment(true);
    try {
      const res = await authFetch(`/api/special-requests/${requestId}/verify-payment`, {
        method: 'POST',
        body: JSON.stringify({
          action,
          rejectionReason: action === 'reject' ? rejectReason.trim() : undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        setShowRejectDialog(false);
        setRejectReason('');
        await fetchMessages();
        await fetchDetail();
      } else {
        toast.error(json.message ?? 'فشلت العملية');
      }
    } catch {
      toast.error('حدث خطأ أثناء المعالجة');
    } finally {
      setIsProcessingPayment(false);
    }
  };

  // ── جلب قائمة الممرضين ──
  const fetchNurses = useCallback(async () => {
    setIsLoadingNurses(true);
    try {
      const res = await authFetch(`/api/admin/nurses?limit=100&search=${encodeURIComponent(nurseSearch)}`);
      const json = await res.json();
      if (json.success) {
        const list = json.data?.nurses || json.data || [];
        setNurses(list);
      }
    } catch {
      toast.error('فشل تحميل قائمة الممرضين');
    } finally {
      setIsLoadingNurses(false);
    }
  }, [authFetch, nurseSearch]);

  useEffect(() => {
    if (showNurseSheet) void fetchNurses();
  }, [showNurseSheet, fetchNurses]);

  // ── تعيين ممرض ──
  const handleAssignNurse = async () => {
    if (!selectedNurseId) {
      toast.error('يرجى اختيار ممرض');
      return;
    }
    setIsAssigningNurse(true);
    try {
      const res = await authFetch(`/api/special-requests/${requestId}/assign-nurse`, {
        method: 'POST',
        body: JSON.stringify({ nurseId: selectedNurseId }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        setShowNurseSheet(false);
        setSelectedNurseId(null);
        await fetchMessages();
        await fetchDetail();
      } else {
        toast.error(json.message ?? 'فشل تعيين الممرض');
      }
    } catch {
      toast.error('حدث خطأ أثناء التعيين');
    } finally {
      setIsAssigningNurse(false);
    }
  };

  // ── تنفيذ مباشر من الإدارة ──
  const handleAdminExecute = async () => {
    try {
      const res = await authFetch(`/api/special-requests/${requestId}/execute`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        await fetchMessages();
        await fetchDetail();
      } else {
        toast.error(json.message ?? 'فشل بدء التنفيذ');
      }
    } catch {
      toast.error('حدث خطأ');
    }
  };

  // ── إكمال الخدمة ──
  const handleComplete = async () => {
    try {
      const res = await authFetch(`/api/special-requests/${requestId}/complete`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        await fetchMessages();
        await fetchDetail();
      } else {
        toast.error(json.message ?? 'فشل الإكمال');
      }
    } catch {
      toast.error('حدث خطأ');
    }
  };

  // ── إلغاء الطلب ──
  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const res = await authFetch(`/api/special-requests/${requestId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason.trim() || 'إلغاء بواسطة الإدارة' }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || 'تم إلغاء الطلب');
        setShowCancelDialog(false);
        setCancelReason('');
        await fetchMessages();
        await fetchDetail();
      } else {
        toast.error(json.message ?? 'فشل الإلغاء');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setIsCancelling(false);
    }
  };

  if (isLoading || !detail) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-admin animate-spin" />
      </div>
    );
  }

  const status = statusConfig[detail.status] || statusConfig.new;
  const canSendOffer = ['new', 'negotiating', 'awaiting_payment'].includes(detail.status);
  const canVerifyPayment = detail.status === 'awaiting_payment_review';
  const canAssignOrExecute = detail.status === 'paid';
  const canComplete = detail.status === 'in_progress';
  const canCancel = !['completed', 'cancelled', 'rejected'].includes(detail.status);
  const canSendMessages = !['cancelled', 'rejected', 'completed'].includes(detail.status);

  return (
    <div className="space-y-4 pb-4">
      {/* Header with back button */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/admin/special-requests')}
          className="shrink-0"
        >
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold truncate">
              طلب #{toArabicNum(detail.orderNumber)}
            </h2>
            <Badge className={`text-[10px] ${status.bg} ${status.color} ${status.border} border`}>
              {status.label}
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground truncate">{detail.beneficiaryName} • {detail.serviceName}</p>
        </div>
        <Button
          variant="ghost"
          size="icon"
          onClick={() => { void fetchDetail(); void fetchMessages(); }}
          className="shrink-0"
        >
          <RefreshCw className="w-4 h-4" />
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Right: Chat area (RTL: appears first) */}
        <div className="lg:col-span-2 space-y-3">
          {/* Messages */}
          <GlassCard variant="admin" className="overflow-hidden">
            <GlassCardHeader className="pb-3">
              <GlassCardTitle className="flex items-center gap-2 text-base">
                <MessageSquare className="w-4 h-4" />
                المحادثة
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="p-0">
              <div className="h-[55vh] overflow-y-auto p-4 space-y-3 bg-muted/20">
                {messages.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                    <MessageSquare className="w-12 h-12 mb-2 opacity-40" />
                    <p className="text-sm">لا توجد رسائل بعد</p>
                    <p className="text-xs mt-1">ابدأ بإرسال عرض سعر أو رسالة ترحيبية</p>
                  </div>
                ) : (
                  messages.map((msg, idx) => {
                    const isOwn = msg.senderRole === 'admin' || msg.senderRole === 'subadmin';
                    const isSystem = msg.senderRole === 'system' || msg.type === 'system';
                    const senderLabel =
                      msg.senderRole === 'beneficiary' ? detail.beneficiaryName :
                      msg.senderRole === 'nurse' ? (detail.nurseName || 'الممرض/ـة') :
                      msg.senderRole === 'system' ? 'النظام' : 'الإدارة';

                    if (isSystem) {
                      return (
                        <div key={msg._id || idx} className="flex justify-center">
                          <div className="text-[11px] text-muted-foreground bg-muted/50 rounded-full px-3 py-1 max-w-[85%] text-center">
                            {msg.content}
                          </div>
                        </div>
                      );
                    }

                    return (
                      <motion.div
                        key={msg._id || idx}
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className={`flex ${isOwn ? 'justify-start' : 'justify-end'}`}
                      >
                        <div className={`max-w-[80%] ${isOwn ? 'order-2' : ''}`}>
                          {/* Sender label */}
                          <p className={`text-[10px] text-muted-foreground mb-1 ${isOwn ? 'text-left' : 'text-right'}`}>
                            {senderLabel} • {formatTime(new Date(msg.createdAt))}
                          </p>

                          {/* Offer message */}
                          {msg.type === 'offer' && msg.offerData ? (
                            <div className={`rounded-2xl p-3 border-2 ${
                              isOwn
                                ? 'bg-admin/10 border-admin/30 rounded-tl-md'
                                : 'bg-beneficiary/10 border-beneficiary/30 rounded-tr-md'
                            }`}>
                              <div className="flex items-center gap-2 mb-2">
                                <Tag className="w-4 h-4 text-admin" />
                                <span className="font-bold text-sm">عرض سعر #{toArabicNum(msg.offerData.offerIndex)}</span>
                                {msg.offerData.status && msg.offerData.status !== 'pending' && (
                                  <Badge className={
                                    msg.offerData.status === 'accepted'
                                      ? 'bg-emerald-100 text-emerald-700'
                                      : msg.offerData.status === 'rejected'
                                      ? 'bg-rose-100 text-rose-700'
                                      : 'bg-muted text-muted-foreground'
                                  }>
                                    {msg.offerData.status === 'accepted' ? 'مقبول' : msg.offerData.status === 'rejected' ? 'مرفوض' : 'منتهي'}
                                  </Badge>
                                )}
                              </div>
                              <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">السعر:</span>
                                  <span className="font-bold text-emerald-700">{formatYemeniRial(msg.offerData.price)}</span>
                                </div>
                                <div className="flex justify-between">
                                  <span className="text-muted-foreground">المدة:</span>
                                  <span className="font-medium">{msg.offerData.duration}</span>
                                </div>
                                {msg.offerData.notes && (
                                  <div className="text-xs text-muted-foreground pt-1 border-t border-border/50 mt-1">
                                    {msg.offerData.notes}
                                  </div>
                                )}
                              </div>
                            </div>
                          ) : msg.type === 'payment_proof' && msg.imageUrl ? (
                            <div className={`rounded-2xl p-2 border-2 ${
                              isOwn ? 'bg-purple-50 border-purple-200 rounded-tl-md' : 'bg-purple-50 border-purple-200 rounded-tr-md'
                            }`}>
                              <div className="flex items-center gap-2 mb-2 text-xs">
                                <HandCoins className="w-4 h-4 text-purple-600" />
                                <span className="font-bold">إثبات الدفع</span>
                              </div>
                              <button
                                onClick={() => setPreviewImage(msg.imageUrl!)}
                                className="block relative w-full"
                              >
                                <img
                                  src={msg.imageUrl}
                                  alt="إثبات الدفع"
                                  className="w-full h-40 object-cover rounded-lg"
                                />
                                <div className="absolute inset-0 bg-black/30 opacity-0 hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                                  <Eye className="w-6 h-6 text-white" />
                                </div>
                              </button>
                              {msg.content && (
                                <p className="text-xs text-muted-foreground mt-2">{msg.content}</p>
                              )}
                            </div>
                          ) : msg.type === 'rejection_reason' ? (
                            <div className={`rounded-2xl p-3 border-2 ${
                              isOwn ? 'bg-rose-50 border-rose-200 rounded-tl-md' : 'bg-rose-50 border-rose-200 rounded-tr-md'
                            }`}>
                              <div className="flex items-center gap-2 mb-1">
                                <XCircle className="w-4 h-4 text-rose-600" />
                                <span className="font-bold text-sm text-rose-700">سبب الرفض</span>
                              </div>
                              <p className="text-sm">{msg.content}</p>
                            </div>
                          ) : msg.imageUrl ? (
                            <div className={`rounded-2xl p-2 ${isOwn ? 'bg-admin/10 rounded-tl-md' : 'bg-beneficiary/10 rounded-tr-md'}`}>
                              <button onClick={() => setPreviewImage(msg.imageUrl!)} className="block">
                                <img src={msg.imageUrl} alt="صورة" className="max-w-full h-auto max-h-48 rounded-lg" />
                              </button>
                              {msg.content && <p className="text-xs mt-1">{msg.content}</p>}
                            </div>
                          ) : (
                            <div className={`rounded-2xl px-3 py-2 ${
                              isOwn
                                ? 'bg-admin text-white rounded-tl-md'
                                : 'bg-card border border-border rounded-tr-md'
                            }`}>
                              <p className="text-sm whitespace-pre-wrap break-words">{msg.content}</p>
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input area */}
              {canSendMessages ? (
                <div className="border-t border-border p-3 bg-card">
                  <div className="flex items-end gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      onClick={() => setShowImageDialog(true)}
                      className="shrink-0"
                      title="إرسال صورة"
                    >
                      <ImageIcon className="w-4 h-4" />
                    </Button>
                    <Textarea
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      placeholder="اكتب رسالة..."
                      rows={1}
                      className="flex-1 resize-none min-h-[40px] max-h-[120px]"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          void handleSendMessage();
                        }
                      }}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={isSending || (!newMessage.trim() && !imageUrlInput.trim())}
                      size="icon"
                      className="shrink-0 bg-admin hover:bg-admin/90"
                    >
                      {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="border-t border-border p-3 bg-muted/30 text-center text-xs text-muted-foreground">
                  المحادثة مغلقة - لا يمكن إرسال رسائل في هذا الطلب
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        </div>

        {/* Left: Actions sidebar */}
        <div className="space-y-3">
          {/* Beneficiary info */}
          <GlassCard variant="admin">
            <GlassCardHeader className="pb-2">
              <GlassCardTitle className="text-sm flex items-center gap-2">
                <User className="w-4 h-4" /> معلومات المستفيد
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Avatar className="w-10 h-10">
                  <AvatarFallback className="bg-gradient-to-br from-admin to-purple-700 text-white">
                    {detail.beneficiaryName?.charAt(0) || 'م'}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-bold truncate">{detail.beneficiaryName}</p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    <span dir="ltr">{toArabicNum(detail.beneficiaryPhone || '—')}</span>
                  </p>
                </div>
              </div>
            </GlassCardContent>
          </GlassCard>

          {/* Service info */}
          <GlassCard variant="admin">
            <GlassCardHeader className="pb-2">
              <GlassCardTitle className="text-sm flex items-center gap-2">
                <Tag className="w-4 h-4" /> تفاصيل الخدمة
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="space-y-2 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">الخدمة الرئيسية</p>
                <p className="font-bold">{detail.serviceName}</p>
              </div>
              {detail.requestedServices && detail.requestedServices.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">الخدمات المطلوبة</p>
                  <ul className="space-y-1">
                    {detail.requestedServices.map((s, i) => (
                      <li key={i} className="text-xs bg-muted/50 rounded px-2 py-1">
                        {toArabicNum(i + 1)}. {s}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {detail.notes && (
                <div>
                  <p className="text-xs text-muted-foreground mb-1">ملاحظات</p>
                  <p className="text-xs bg-muted/30 rounded p-2">{detail.notes}</p>
                </div>
              )}
              <div className="flex items-start gap-2 text-xs">
                <MapPin className="w-3.5 h-3.5 text-admin mt-0.5 shrink-0" />
                <span>{detail.address}</span>
              </div>
              {detail.scheduledDate && (
                <div className="flex items-center gap-2 text-xs">
                  <Calendar className="w-3.5 h-3.5 text-admin" />
                  <span>{formatDate(new Date(detail.scheduledDate))}</span>
                  {detail.scheduledTime && <span>• {detail.scheduledTime}</span>}
                </div>
              )}
            </GlassCardContent>
          </GlassCard>

          {/* Pricing info */}
          {detail.agreedPrice ? (
            <GlassCard variant="admin">
              <GlassCardHeader className="pb-2">
                <GlassCardTitle className="text-sm flex items-center gap-2">
                  <HandCoins className="w-4 h-4" /> التسعير المتفق عليه
                </GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">السعر:</span>
                  <span className="font-bold text-emerald-700">{formatYemeniRial(detail.agreedPrice)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المدة:</span>
                  <span className="font-medium">{detail.agreedDuration}</span>
                </div>
                {detail.commission ? (
                  <>
                    <div className="border-t border-border/50 pt-2 space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">العمولة ({toArabicNum(detail.commissionRate || 0)}%):</span>
                        <span className="text-orange-600">{formatYemeniRial(detail.commission)}</span>
                      </div>
                      <div className="flex justify-between text-xs">
                        <span className="text-muted-foreground">مستحقات الممرض:</span>
                        <span className="font-bold text-emerald-700">{formatYemeniRial(detail.nursePayout || 0)}</span>
                      </div>
                    </div>
                  </>
                ) : null}
              </GlassCardContent>
            </GlassCard>
          ) : null}

          {/* Nurse info */}
          {detail.nurseId && (
            <GlassCard variant="admin">
              <GlassCardHeader className="pb-2">
                <GlassCardTitle className="text-sm flex items-center gap-2">
                  <Stethoscope className="w-4 h-4" /> الممرض المعين
                </GlassCardTitle>
              </GlassCardHeader>
              <GlassCardContent className="space-y-2 text-sm">
                <p className="font-bold">{detail.nurseName || '—'}</p>
                {detail.nursePhone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    <span dir="ltr">{toArabicNum(detail.nursePhone)}</span>
                  </p>
                )}
                {detail.nurseAcceptedAt && (
                  <Badge className="bg-emerald-100 text-emerald-700 text-[10px]">
                    <CheckCircle2 className="w-3 h-3 ml-1" /> قبل المهمة
                  </Badge>
                )}
                {detail.nurseRejectedAt && (
                  <Badge className="bg-rose-100 text-rose-700 text-[10px]">
                    <XCircle className="w-3 h-3 ml-1" /> رفض المهمة
                  </Badge>
                )}
              </GlassCardContent>
            </GlassCard>
          )}

          {/* Action buttons */}
          <GlassCard variant="admin">
            <GlassCardHeader className="pb-2">
              <GlassCardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="w-4 h-4" /> إجراءات الإدارة
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="space-y-2">
              {canSendOffer && (
                <Button
                  onClick={() => setShowOfferDialog(true)}
                  className="w-full gap-2 bg-admin hover:bg-admin/90"
                  size="sm"
                >
                  <Tag className="w-4 h-4" />
                  إرسال عرض سعر
                </Button>
              )}

              {canVerifyPayment && (
                <>
                  <Button
                    onClick={() => handleVerifyPayment('verify')}
                    disabled={isProcessingPayment}
                    className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
                    size="sm"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    قبول الدفع
                  </Button>
                  <Button
                    onClick={() => setShowRejectDialog(true)}
                    disabled={isProcessingPayment}
                    variant="destructive"
                    className="w-full gap-2"
                    size="sm"
                  >
                    <XCircle className="w-4 h-4" />
                    رفض الدفع
                  </Button>
                </>
              )}

              {canAssignOrExecute && (
                <>
                  <Button
                    onClick={() => setShowNurseSheet(true)}
                    className="w-full gap-2 bg-cyan-600 hover:bg-cyan-700"
                    size="sm"
                  >
                    <Stethoscope className="w-4 h-4" />
                    تعيين ممرض
                  </Button>
                  <Button
                    onClick={handleAdminExecute}
                    variant="outline"
                    className="w-full gap-2 border-admin text-admin hover:bg-admin/10"
                    size="sm"
                  >
                    <PlayCircle className="w-4 h-4" />
                    تنفيذ مباشر من الإدارة
                  </Button>
                </>
              )}

              {canComplete && (
                <Button
                  onClick={handleComplete}
                  className="w-full gap-2 bg-green-600 hover:bg-green-700"
                  size="sm"
                >
                  <CheckCheck className="w-4 h-4" />
                  إكمال الخدمة
                </Button>
              )}

              {canCancel && (
                <Button
                  onClick={() => setShowCancelDialog(true)}
                  variant="outline"
                  className="w-full gap-2 text-rose-600 border-rose-300 hover:bg-rose-50"
                  size="sm"
                >
                  <X className="w-4 h-4" />
                  إلغاء الطلب
                </Button>
              )}

              {/* Payment status indicator */}
              {detail.paymentStatus && detail.paymentStatus !== 'pending' && (
                <div className="mt-2 p-2 rounded-lg bg-muted/30 text-xs">
                  <p className="text-muted-foreground">حالة الدفع:</p>
                  <p className="font-bold">
                    {detail.paymentStatus === 'awaiting_confirmation' ? 'بانتظار التأكيد' :
                     detail.paymentStatus === 'completed' ? 'مكتمل' :
                     detail.paymentStatus === 'failed' ? 'مرفوض' :
                     detail.paymentStatus === 'refunded' ? 'مسترد' : detail.paymentStatus}
                  </p>
                  {detail.paymentRejectionReason && (
                    <p className="text-rose-600 mt-1">السبب: {detail.paymentRejectionReason}</p>
                  )}
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        </div>
      </div>

      {/* ── Image URL Dialog ── */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إرسال صورة</DialogTitle>
            <DialogDescription>أدخل رابط الصورة لإرسالها في المحادثة</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="imageUrl">رابط الصورة</Label>
              <Input
                id="imageUrl"
                value={imageUrlInput}
                onChange={(e) => setImageUrlInput(e.target.value)}
                placeholder="https://..."
                dir="ltr"
              />
            </div>
            {imageUrlInput && (
              <img src={imageUrlInput} alt="preview" className="max-h-40 rounded-lg border" />
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowImageDialog(false)}>إلغاء</Button>
            <Button onClick={handleSendMessage} disabled={isSending || !imageUrlInput.trim()}>
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              إرسال
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Offer Dialog ── */}
      <Dialog open={showOfferDialog} onOpenChange={setShowOfferDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إرسال عرض سعر</DialogTitle>
            <DialogDescription>
              سيتم إرسال العرض للمستفيد عبر المحادثة ليقوم بقبوله أو رفضه
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="offerPrice">السعر (ر.ي) *</Label>
              <Input
                id="offerPrice"
                type="number"
                value={offerPrice}
                onChange={(e) => setOfferPrice(e.target.value)}
                placeholder="مثال: 15000"
                dir="ltr"
              />
            </div>
            <div>
              <Label htmlFor="offerDuration">مدة التنفيذ *</Label>
              <Input
                id="offerDuration"
                value={offerDuration}
                onChange={(e) => setOfferDuration(e.target.value)}
                placeholder="مثال: 4 ساعات / يومين / أسبوع"
              />
            </div>
            <div>
              <Label htmlFor="offerNotes">ملاحظات (اختياري)</Label>
              <Textarea
                id="offerNotes"
                value={offerNotes}
                onChange={(e) => setOfferNotes(e.target.value)}
                placeholder="أي تفاصيل إضافية عن العرض..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowOfferDialog(false)}>إلغاء</Button>
            <Button
              onClick={handleSendOffer}
              disabled={isSendingOffer}
              className="bg-admin hover:bg-admin/90 gap-2"
            >
              {isSendingOffer ? <Loader2 className="w-4 h-4 animate-spin" /> : <Tag className="w-4 h-4" />}
              إرسال العرض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Reject Payment Dialog ── */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>رفض إثبات الدفع</DialogTitle>
            <DialogDescription>
              سيتم إرسال سبب الرفض للمستفيد عبر المحادثة ويعود الطلب لبانتظار الدفع
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="rejectReason">سبب الرفض *</Label>
              <Textarea
                id="rejectReason"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="مثال: المبلغ الموجود في الإيصال لا يطابق السعر المتفق عليه..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>إلغاء</Button>
            <Button
              onClick={() => handleVerifyPayment('reject')}
              disabled={isProcessingPayment || !rejectReason.trim()}
              variant="destructive"
              className="gap-2"
            >
              {isProcessingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              تأكيد الرفض
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Dialog ── */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إلغاء الطلب</DialogTitle>
            <DialogDescription>سيتم إشعار المستفيد بإلغاء الطلب</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cancelReason">سبب الإلغاء</Label>
              <Textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="مثال: تعذر تنفيذ الطلب لظروف خاصة..."
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCancelDialog(false)}>تراجع</Button>
            <Button
              onClick={handleCancel}
              disabled={isCancelling}
              variant="destructive"
              className="gap-2"
            >
              {isCancelling ? <Loader2 className="w-4 h-4 animate-spin" /> : <X className="w-4 h-4" />}
              تأكيد الإلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Assign Nurse Sheet ── */}
      <Sheet open={showNurseSheet} onOpenChange={setShowNurseSheet}>
        <SheetContent side="left" className="w-full sm:max-w-md overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="flex items-center gap-2">
              <Stethoscope className="w-5 h-5" />
              تعيين ممرض للمهمة
            </SheetTitle>
            <SheetDescription>
              اختر ممرضاً من القائمة لتنفيذ هذا الطلب
            </SheetDescription>
          </SheetHeader>
          <div className="space-y-3 mt-4">
            <Input
              placeholder="بحث بالاسم أو التخصص..."
              value={nurseSearch}
              onChange={(e) => setNurseSearch(e.target.value)}
              className="mb-2"
            />
            {isLoadingNurses ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-admin" />
              </div>
            ) : nurses.length === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-8">لا يوجد ممرضون</p>
            ) : (
              <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                {nurses.map((nurse) => (
                  <button
                    key={nurse._id}
                    onClick={() => setSelectedNurseId(nurse._id)}
                    className={`w-full text-right p-3 rounded-xl border-2 transition-all ${
                      selectedNurseId === nurse._id
                        ? 'border-admin bg-admin/5'
                        : 'border-border hover:border-admin/30'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Avatar className="w-10 h-10">
                        <AvatarFallback className="bg-gradient-to-br from-cyan-500 to-blue-700 text-white">
                          {nurse.name?.charAt(0) || 'م'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="font-bold text-sm truncate">{nurse.name}</p>
                        {nurse.phone && (
                          <p className="text-xs text-muted-foreground" dir="ltr">{toArabicNum(nurse.phone)}</p>
                        )}
                        <div className="flex items-center gap-1 mt-1 flex-wrap">
                          {nurse.isOnline && (
                            <Badge className="bg-emerald-100 text-emerald-700 text-[9px]">متصل</Badge>
                          )}
                          {nurse.isAvailable && (
                            <Badge className="bg-cyan-100 text-cyan-700 text-[9px]">متاح</Badge>
                          )}
                          {nurse.rating ? (
                            <Badge className="bg-amber-100 text-amber-700 text-[9px]">
                              ★ {toArabicNum(nurse.rating.toFixed(1))}
                            </Badge>
                          ) : null}
                        </div>
                      </div>
                      {selectedNurseId === nurse._id && (
                        <CheckCircle2 className="w-5 h-5 text-admin shrink-0" />
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
            <Button
              onClick={handleAssignNurse}
              disabled={!selectedNurseId || isAssigningNurse}
              className="w-full bg-admin hover:bg-admin/90 gap-2"
            >
              {isAssigningNurse ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              تعيين الممرض المحدد
            </Button>
          </div>
        </SheetContent>
      </Sheet>

      {/* ── Image Preview Modal ── */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>معاينة الصورة</DialogTitle>
          </DialogHeader>
          {previewImage && (
            <img src={previewImage} alt="معاينة" className="w-full h-auto rounded-lg" />
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewImage(null)}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
