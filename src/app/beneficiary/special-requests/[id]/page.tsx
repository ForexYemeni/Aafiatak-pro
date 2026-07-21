'use client';

// ============================================================================
// عافيتك - صفحة محادثة طلب الخدمة الخاصة للمستفيد
// ============================================================================
// تعرض هذه الصفحة محادثة المستفيد مع الإدارة وتتيح له:
// - إرسال الرسائل (نص/صورة)
// - قبول/رفض عروض الأسعار
// - رفع إثبات الدفع
// - تأكيد استلام الخدمة
// - تقييم الخدمة والممرض
// - إلغاء الطلب
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight, Send, Image as ImageIcon, Loader2, MessageSquare,
  RefreshCw, AlertCircle, Tag, MapPin, Clock, CheckCircle2, XCircle,
  HandCoins, Star, Upload, X, CheckCheck, Phone, Stethoscope,
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
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard, GlassCardHeader, GlassCardTitle, GlassCardContent } from '@/components/common/glass-card';
import { useAuthFetch } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { formatYemeniRial } from '@/components/common/currency';
import { toArabicNum, formatDateOnly as formatDate, formatTimeOnly as formatTime } from '@/components/common/date-formatter';
import { toast } from 'sonner';

interface SpecialRequestDetail {
  _id: string;
  id?: string;
  orderNumber: number;
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
  paymentMethod?: string;
  hasPaymentProof?: boolean;
  paymentProofData?: string;
  paymentStatus?: string;
  paymentRejectionReason?: string;
  nurseId?: string;
  nurseName?: string | null;
  nursePhone?: string | null;
  startedAt?: string;
  completedAt?: string;
  beneficiaryConfirmedAt?: string;
  executeByAdmin?: boolean;
  serviceRating?: number;
  nurseRating?: number;
  ratingComment?: string;
  createdAt: string;
}

interface ChatMessage {
  _id?: string;
  id?: string;
  senderId: string;
  senderRole: string;
  type: string;
  content: string;
  imageUrl?: string;
  offerData?: {
    price: number;
    duration: string;
    notes?: string;
    status?: string;
    offerIndex: number;
  };
  createdAt: string;
}

interface PaymentMethod {
  id: string;
  nameAr: string;
  nameEn?: string;
  type: string;
  walletType?: string | null;
  exchangeType?: string | null;
  customProviderName?: string;
  accountName?: string;
  accountNumber?: string;
  instructions?: string;
}

// ── خريطة أسماء المحافظ الإلكترونية ──
const walletTypeLabels: Record<string, string> = {
  jeep: 'جيب',
  jawali: 'جوالي',
  cash_wallet: 'محفظة كاش',
  one_cash: 'وان كاش',
  flousk: 'فلوسك',
  saba_cash: 'سبا كاش',
  other: 'محفظة أخرى',
};

// ── خريطة أسماء شركات الصرافة ──
const exchangeTypeLabels: Record<string, string> = {
  al_najm: 'النجم للصرافة',
  yemen_express: 'يمن إكسبرس',
  al_imtiaz: 'الإمتياز',
  al_hazmi: 'ال hazmi',
  other: 'صرافة أخرى',
};

// ── الحصول على اسم طريقة الدفع المعروض ──
const getPaymentMethodDisplayName = (method: PaymentMethod): string => {
  // إذا كان هناك اسم مخصص في nameAr، استخدمه
  if (method.nameAr && method.nameAr.trim()) return method.nameAr.trim();
  // حسب النوع
  if (method.type === 'cash') return 'نقدي عند الوصول';
  if (method.type === 'wallet_deposit' && method.walletType) {
    return walletTypeLabels[method.walletType] || 'محفظة إلكترونية';
  }
  if (method.type === 'bank_transfer') {
    if (method.exchangeType && exchangeTypeLabels[method.exchangeType]) {
      return exchangeTypeLabels[method.exchangeType];
    }
    return 'تحويل بنكي / صرافة';
  }
  // اسم مخصص إذا موجود
  if (method.customProviderName) return method.customProviderName;
  return 'طريقة دفع';
};

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

export default function BeneficiarySpecialRequestDetailPage() {
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
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  // Payment dialog
  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [selectedPaymentMethodId, setSelectedPaymentMethodId] = useState('');
  const [paymentProofFile, setPaymentProofFile] = useState<File | null>(null);
  const [paymentProofPreview, setPaymentProofPreview] = useState<string | null>(null);
  const [isSubmittingPayment, setIsSubmittingPayment] = useState(false);

  // Rating dialog
  const [showRatingDialog, setShowRatingDialog] = useState(false);
  const [serviceRating, setServiceRating] = useState(0);
  const [nurseRating, setNurseRating] = useState(0);
  const [ratingComment, setRatingComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  // Cancel dialog
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [isCancelling, setIsCancelling] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await authFetch(`/api/special-requests/${requestId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setDetail(json.data);
      }
    } catch {
      toast.error('فشل تحميل تفاصيل الطلب');
    }
  }, [authFetch, requestId]);

  const fetchMessages = useCallback(async () => {
    try {
      const res = await authFetch(`/api/special-requests/${requestId}/messages`);
      const json = await res.json();
      if (json.success && json.data) {
        setMessages(json.data.messages || []);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, requestId]);

  useEffect(() => {
    void fetchDetail();
    void fetchMessages();
  }, [fetchDetail, fetchMessages]);

  useRealtimeRefresh({
    entities: ['special_request', 'chat'],
    onRefresh: () => {
      void fetchDetail();
      void fetchMessages();
    },
    fallbackInterval: 8000,
  });

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // ── جلب طرق الدفع عند فتح نافذة الدفع ──
  useEffect(() => {
    if (showPaymentDialog && paymentMethods.length === 0) {
      fetch('/api/payments/methods')
        .then(r => r.json())
        .then(json => {
          if (json.success && json.data) {
            setPaymentMethods(json.data);
          }
        })
        .catch(() => {});
    }
  }, [showPaymentDialog, paymentMethods.length]);

  // ── إرسال رسالة ──
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

  // ── الرد على عرض سعر ──
  const handleRespondOffer = async (offerIndex: number, action: 'accept' | 'reject') => {
    try {
      const res = await authFetch(`/api/special-requests/${requestId}/respond-offer`, {
        method: 'POST',
        body: JSON.stringify({ offerIndex, action }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        await fetchMessages();
        await fetchDetail();
      } else {
        toast.error(json.message ?? 'فشل الإجراء');
      }
    } catch {
      toast.error('حدث خطأ');
    }
  };

  // ── معالج اختيار صورة إثبات الدفع ──
  const handlePaymentProofFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // التحقق من النوع
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة فقط');
      return;
    }

    // التحقق من الحجم (max 3MB - للتوافق مع حدود API)
    if (file.size > 3 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن لا يتجاوز 3 ميجابايت');
      return;
    }

    setPaymentProofFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPaymentProofPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  // ── إزالة الصورة المختارة ──
  const handleClearPaymentProof = () => {
    setPaymentProofFile(null);
    setPaymentProofPreview(null);
  };

  // ── رفع إثبات الدفع ──
  const handleSubmitPayment = async () => {
    if (!selectedPaymentMethodId) {
      toast.error('يرجى اختيار طريقة الدفع');
      return;
    }
    if (!paymentProofPreview) {
      toast.error('يرجى رفع صورة إثبات الدفع (إيصال التحويل)');
      return;
    }

    const selectedMethod = paymentMethods.find(m => m.id === selectedPaymentMethodId);
    setIsSubmittingPayment(true);
    try {
      const res = await authFetch(`/api/special-requests/${requestId}/payment`, {
        method: 'POST',
        body: JSON.stringify({
          paymentMethod: getPaymentMethodDisplayName(selectedMethod!) || selectedMethod?.type || 'bank_transfer',
          paymentMethodId: selectedPaymentMethodId,
          hasPaymentProof: true,
          paymentProofData: paymentProofPreview, // base64 image data
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message || 'تم رفع إثبات الدفع بنجاح');
        setShowPaymentDialog(false);
        setSelectedPaymentMethodId('');
        handleClearPaymentProof();
        await fetchMessages();
        await fetchDetail();
      } else {
        toast.error(json.message ?? 'فشل رفع الإثبات');
      }
    } catch {
      toast.error('حدث خطأ أثناء رفع الإثبات');
    } finally {
      setIsSubmittingPayment(false);
    }
  };

  // ── تأكيد الاستلام ──
  const handleConfirmReceipt = async () => {
    try {
      const res = await authFetch(`/api/special-requests/${requestId}/confirm-receipt`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم تأكيد الاستلام - يمكنك الآن تقييم الخدمة');
        await fetchMessages();
        await fetchDetail();
      } else {
        toast.error(json.message ?? 'فشل التأكيد');
      }
    } catch {
      toast.error('حدث خطأ');
    }
  };

  // ── إرسال التقييم ──
  const handleSubmitRating = async () => {
    if (serviceRating < 1 || serviceRating > 5) {
      toast.error('يرجى اختيار تقييم الخدمة من 1 إلى 5');
      return;
    }
    if (detail?.nurseId && (nurseRating < 1 || nurseRating > 5)) {
      toast.error('يرجى اختيار تقييم الممرض من 1 إلى 5');
      return;
    }

    setIsSubmittingRating(true);
    try {
      const res = await authFetch(`/api/special-requests/${requestId}/rate`, {
        method: 'POST',
        body: JSON.stringify({
          serviceRating,
          nurseRating: detail?.nurseId ? nurseRating : undefined,
          comment: ratingComment.trim() || undefined,
        }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('شكراً لتقييمك!');
        setShowRatingDialog(false);
        setServiceRating(0);
        setNurseRating(0);
        setRatingComment('');
        await fetchMessages();
        await fetchDetail();
      } else {
        toast.error(json.message ?? 'فشل إرسال التقييم');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setIsSubmittingRating(false);
    }
  };

  // ── إلغاء الطلب ──
  const handleCancel = async () => {
    setIsCancelling(true);
    try {
      const res = await authFetch(`/api/special-requests/${requestId}/cancel`, {
        method: 'POST',
        body: JSON.stringify({ reason: cancelReason.trim() || 'إلغاء من قبل المستفيد' }),
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
        <Loader2 className="w-8 h-8 text-beneficiary animate-spin" />
      </div>
    );
  }

  const status = statusConfig[detail.status] || statusConfig.new;
  const canSendMessages = !['cancelled', 'rejected', 'completed'].includes(detail.status);
  const canPay = detail.status === 'awaiting_payment';
  const canConfirmReceipt = detail.status === 'completed' && !detail.beneficiaryConfirmedAt;
  const canRate = detail.status === 'completed' && !!detail.beneficiaryConfirmedAt && !detail.serviceRating;
  const canCancel = !['completed', 'cancelled', 'rejected', 'in_progress'].includes(detail.status);

  // العثور على آخر عرض معلّق
  const pendingOffer = detail.offers?.find(o => o.status === 'pending');

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/beneficiary/special-requests')}
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
          <p className="text-xs text-muted-foreground truncate">{detail.serviceName}</p>
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

      {/* Pending offer banner */}
      {pendingOffer && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <GlassCard variant="beneficiary" className="border-2 border-amber-300 dark:border-amber-700">
            <GlassCardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Tag className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold">لديك عرض سعر جديد #{toArabicNum(pendingOffer.offerIndex)}</h3>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-xs text-muted-foreground">السعر</p>
                  <p className="font-bold text-emerald-700">{formatYemeniRial(pendingOffer.price)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">المدة</p>
                  <p className="font-bold">{pendingOffer.duration}</p>
                </div>
              </div>
              {pendingOffer.notes && (
                <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded">
                  {pendingOffer.notes}
                </p>
              )}
              <div className="flex gap-2">
                <Button
                  onClick={() => handleRespondOffer(pendingOffer.offerIndex, 'accept')}
                  className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  قبول العرض
                </Button>
                <Button
                  onClick={() => handleRespondOffer(pendingOffer.offerIndex, 'reject')}
                  variant="outline"
                  className="flex-1 gap-2 text-rose-600 border-rose-300 hover:bg-rose-50"
                >
                  <XCircle className="w-4 h-4" />
                  رفض العرض
                </Button>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      )}

      {/* Payment required banner */}
      {canPay && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard variant="beneficiary" className="border-2 border-orange-300 dark:border-orange-700">
            <GlassCardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <HandCoins className="w-5 h-5 text-orange-600" />
                <h3 className="font-bold">بانتظار الدفع</h3>
              </div>
              <p className="text-sm">
                المبلغ المطلوب: <span className="font-bold text-emerald-700">{formatYemeniRial(detail.agreedPrice || 0)}</span>
              </p>
              {detail.paymentRejectionReason && (
                <div className="bg-rose-50 dark:bg-rose-900/20 p-2 rounded text-xs text-rose-700">
                  <p className="font-bold mb-1">سبب رفض الإثبات السابق:</p>
                  {detail.paymentRejectionReason}
                </div>
              )}
              <Button
                onClick={() => setShowPaymentDialog(true)}
                className="w-full gap-2 bg-orange-600 hover:bg-orange-700"
              >
                <Upload className="w-4 h-4" />
                رفع إثبات الدفع
              </Button>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      )}

      {/* Confirm receipt / rate banner */}
      {canConfirmReceipt && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard variant="beneficiary" className="border-2 border-emerald-300 dark:border-emerald-700">
            <GlassCardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCheck className="w-5 h-5 text-emerald-600" />
                <h3 className="font-bold">تم تنفيذ الخدمة</h3>
              </div>
              <p className="text-sm text-muted-foreground">يرجى تأكيد استلام الخدمة لإتمام الطلب</p>
              <Button
                onClick={handleConfirmReceipt}
                className="w-full gap-2 bg-emerald-600 hover:bg-emerald-700"
              >
                <CheckCircle2 className="w-4 h-4" />
                تأكيد الاستلام
              </Button>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      )}

      {canRate && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard variant="beneficiary" className="border-2 border-amber-300 dark:border-amber-700">
            <GlassCardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Star className="w-5 h-5 text-amber-600" />
                <h3 className="font-bold">قيّم الخدمة</h3>
              </div>
              <p className="text-sm text-muted-foreground">رأيك يهمنا - ساعدنا في تحسين خدماتنا</p>
              <Button
                onClick={() => setShowRatingDialog(true)}
                className="w-full gap-2 bg-amber-600 hover:bg-amber-700"
              >
                <Star className="w-4 h-4" />
                تقييم الخدمة
              </Button>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      )}

      {/* Chat */}
      <GlassCard variant="beneficiary" className="overflow-hidden">
        <GlassCardHeader className="pb-3">
          <GlassCardTitle className="flex items-center gap-2 text-base">
            <MessageSquare className="w-4 h-4" />
            المحادثة مع الإدارة
          </GlassCardTitle>
        </GlassCardHeader>
        <GlassCardContent className="p-0">
          <div className="h-[55vh] overflow-y-auto p-4 space-y-3 bg-muted/20">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
                <MessageSquare className="w-12 h-12 mb-2 opacity-40" />
                <p className="text-sm">لا توجد رسائل بعد</p>
                <p className="text-xs mt-1">سيتواصل معك فريق الإدارة قريباً</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isOwn = msg.senderRole === 'beneficiary';
                const isSystem = msg.senderRole === 'system' || msg.type === 'system';
                const senderLabel =
                  msg.senderRole === 'beneficiary' ? 'أنت' :
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
                    <div className="max-w-[80%]">
                      <p className={`text-[10px] text-muted-foreground mb-1 ${isOwn ? 'text-left' : 'text-right'}`}>
                        {senderLabel} • {formatTime(new Date(msg.createdAt))}
                      </p>

                      {msg.type === 'offer' && msg.offerData ? (
                        <div className={`rounded-2xl p-3 border-2 ${
                          isOwn
                            ? 'bg-beneficiary/10 border-beneficiary/30 rounded-tr-md'
                            : 'bg-admin/10 border-admin/30 rounded-tl-md'
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
                        <div className="rounded-2xl p-2 border-2 bg-purple-50 border-purple-200">
                          <div className="flex items-center gap-2 mb-2 text-xs">
                            <HandCoins className="w-4 h-4 text-purple-600" />
                            <span className="font-bold">إثبات الدفع</span>
                          </div>
                          <button onClick={() => setPreviewImage(msg.imageUrl!)} className="block">
                            <img src={msg.imageUrl} alt="إثبات الدفع" className="w-full h-40 object-cover rounded-lg" />
                          </button>
                          {msg.content && <p className="text-xs text-muted-foreground mt-2">{msg.content}</p>}
                        </div>
                      ) : msg.type === 'rejection_reason' ? (
                        <div className="rounded-2xl p-3 border-2 bg-rose-50 border-rose-200">
                          <div className="flex items-center gap-2 mb-1">
                            <XCircle className="w-4 h-4 text-rose-600" />
                            <span className="font-bold text-sm text-rose-700">سبب الرفض</span>
                          </div>
                          <p className="text-sm">{msg.content}</p>
                        </div>
                      ) : msg.imageUrl ? (
                        <div className={`rounded-2xl p-2 ${isOwn ? 'bg-beneficiary/10 rounded-tr-md' : 'bg-card border border-border rounded-tl-md'}`}>
                          <button onClick={() => setPreviewImage(msg.imageUrl!)} className="block">
                            <img src={msg.imageUrl} alt="صورة" className="max-w-full h-auto max-h-48 rounded-lg" />
                          </button>
                          {msg.content && <p className="text-xs mt-1">{msg.content}</p>}
                        </div>
                      ) : (
                        <div className={`rounded-2xl px-3 py-2 ${
                          isOwn
                            ? 'bg-beneficiary text-white rounded-tr-md'
                            : 'bg-card border border-border rounded-tl-md'
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
                  className="shrink-0 bg-beneficiary hover:bg-beneficiary/90"
                >
                  {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                </Button>
              </div>
            </div>
          ) : (
            <div className="border-t border-border p-3 bg-muted/30 text-center text-xs text-muted-foreground">
              المحادثة مغلقة
            </div>
          )}
        </GlassCardContent>
      </GlassCard>

      {/* Info cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <GlassCard variant="beneficiary">
          <GlassCardHeader className="pb-2">
            <GlassCardTitle className="text-sm flex items-center gap-2">
              <Tag className="w-4 h-4" /> تفاصيل الخدمة
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent className="space-y-2 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">الخدمة</p>
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
            <div className="flex items-start gap-2 text-xs">
              <MapPin className="w-3.5 h-3.5 text-beneficiary mt-0.5 shrink-0" />
              <span>{detail.address}</span>
            </div>
          </GlassCardContent>
        </GlassCard>

        {detail.agreedPrice ? (
          <GlassCard variant="beneficiary">
            <GlassCardHeader className="pb-2">
              <GlassCardTitle className="text-sm flex items-center gap-2">
                <HandCoins className="w-4 h-4" /> السعر المتفق عليه
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">المبلغ:</span>
                <span className="font-bold text-emerald-700">{formatYemeniRial(detail.agreedPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">المدة:</span>
                <span className="font-medium">{detail.agreedDuration}</span>
              </div>
              {detail.paymentStatus && (
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">حالة الدفع:</span>
                  <span className="font-bold">
                    {detail.paymentStatus === 'awaiting_confirmation' ? 'بانتظار التأكيد' :
                     detail.paymentStatus === 'completed' ? 'مكتمل' :
                     detail.paymentStatus === 'failed' ? 'مرفوض' :
                     detail.paymentStatus === 'pending' ? 'بانتظار الدفع' : detail.paymentStatus}
                  </span>
                </div>
              )}
            </GlassCardContent>
          </GlassCard>
        ) : null}

        {detail.nurseId && (
          <GlassCard variant="beneficiary">
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
            </GlassCardContent>
          </GlassCard>
        )}

        {canCancel && (
          <GlassCard variant="beneficiary">
            <GlassCardContent className="p-3">
              <Button
                onClick={() => setShowCancelDialog(true)}
                variant="outline"
                className="w-full gap-2 text-rose-600 border-rose-300 hover:bg-rose-50"
                size="sm"
              >
                <X className="w-4 h-4" />
                إلغاء الطلب
              </Button>
            </GlassCardContent>
          </GlassCard>
        )}
      </div>

      {/* ── Image URL Dialog ── */}
      <Dialog open={showImageDialog} onOpenChange={setShowImageDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إرسال صورة</DialogTitle>
            <DialogDescription>أدخل رابط الصورة لإرسالها</DialogDescription>
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

      {/* ── Payment Dialog ── */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>رفع إثبات الدفع</DialogTitle>
            <DialogDescription>
              اختر طريقة الدفع وارفع صورة إيصال التحويل
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="font-semibold">طريقة الدفع *</Label>
              <div className="space-y-2 mt-2">
                {paymentMethods.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">جاري التحميل...</p>
                ) : (
                  paymentMethods.map((method) => {
                    const displayName = getPaymentMethodDisplayName(method);
                    return (
                      <button
                        key={method.id}
                        onClick={() => setSelectedPaymentMethodId(method.id)}
                        className={`w-full text-right p-3 rounded-xl border-2 transition-all ${
                          selectedPaymentMethodId === method.id
                            ? 'border-beneficiary bg-beneficiary/5'
                            : 'border-border hover:border-beneficiary/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <p className="font-bold text-sm">{displayName}</p>
                          {method.type === 'cash' && (
                            <Badge variant="outline" className="text-[10px]">نقدي</Badge>
                          )}
                          {method.type === 'wallet_deposit' && (
                            <Badge variant="outline" className="text-[10px]">محفظة</Badge>
                          )}
                          {method.type === 'bank_transfer' && (
                            <Badge variant="outline" className="text-[10px]">تحويل</Badge>
                          )}
                        </div>
                        {method.accountName && (
                          <p className="text-xs text-muted-foreground mt-1">
                            الاسم: <span className="font-medium">{method.accountName}</span>
                          </p>
                        )}
                        {method.accountNumber && (
                          <p className="text-xs text-muted-foreground mt-1" dir="ltr">
                            الرقم: <span className="font-mono font-medium">{method.accountNumber}</span>
                          </p>
                        )}
                        {method.instructions && (
                          <p className="text-xs text-muted-foreground mt-1 italic">{method.instructions}</p>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>

            <div>
              <Label className="font-semibold">صورة إيصال الدفع *</Label>
              <p className="text-xs text-muted-foreground mb-2">
                ارفع صورة واضحة لإيصال التحويل أو الإيداع
              </p>
              {paymentProofPreview ? (
                <div className="relative rounded-xl overflow-hidden border-2 border-beneficiary/30">
                  <img src={paymentProofPreview} alt="إثبات الدفع" className="w-full max-h-64 object-cover" />
                  <button
                    onClick={handleClearPaymentProof}
                    className="absolute top-2 left-2 p-1.5 rounded-full bg-black/60 text-white hover:bg-black/80 transition-colors"
                    type="button"
                  >
                    <X className="w-4 h-4" />
                  </button>
                  <div className="absolute bottom-2 right-2 px-2 py-1 rounded-full bg-emerald-500/90 text-white text-[10px] font-bold flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" />
                    تم التحديد
                  </div>
                </div>
              ) : (
                <label className="flex flex-col items-center justify-center gap-3 p-8 rounded-xl border-2 border-dashed border-border hover:border-beneficiary/50 cursor-pointer transition-colors bg-muted/30">
                  <div className="w-12 h-12 rounded-full bg-beneficiary/10 flex items-center justify-center">
                    <Upload className="w-6 h-6 text-beneficiary" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium">اضغط لرفع صورة الإيصال</p>
                    <p className="text-xs text-muted-foreground mt-1">PNG, JPG, JPEG - حتى 3 ميجابايت</p>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handlePaymentProofFileChange}
                  />
                </label>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>إلغاء</Button>
            <Button
              onClick={handleSubmitPayment}
              disabled={isSubmittingPayment || !selectedPaymentMethodId || !paymentProofPreview}
              className="gap-2 bg-beneficiary hover:bg-beneficiary/90"
            >
              {isSubmittingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
              رفع الإثبات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Rating Dialog ── */}
      <Dialog open={showRatingDialog} onOpenChange={setShowRatingDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تقييم الخدمة</DialogTitle>
            <DialogDescription>رأيك يساعدنا في تحسين الخدمة</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>تقييم الخدمة *</Label>
              <div className="flex gap-1 mt-2 justify-center">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    onClick={() => setServiceRating(star)}
                    className="p-1"
                  >
                    <Star
                      className={`w-8 h-8 ${
                        star <= serviceRating
                          ? 'fill-amber-400 text-amber-400'
                          : 'text-muted-foreground'
                      }`}
                    />
                  </button>
                ))}
              </div>
            </div>
            {detail.nurseId && (
              <div>
                <Label>تقييم الممرض/ـة *</Label>
                <div className="flex gap-1 mt-2 justify-center">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      onClick={() => setNurseRating(star)}
                      className="p-1"
                    >
                      <Star
                        className={`w-8 h-8 ${
                          star <= nurseRating
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-muted-foreground'
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div>
              <Label htmlFor="ratingComment">تعليق (اختياري)</Label>
              <Textarea
                id="ratingComment"
                value={ratingComment}
                onChange={(e) => setRatingComment(e.target.value)}
                placeholder="شاركنا تجربتك..."
                rows={3}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRatingDialog(false)}>إلغاء</Button>
            <Button
              onClick={handleSubmitRating}
              disabled={isSubmittingRating}
              className="gap-2 bg-amber-600 hover:bg-amber-700"
            >
              {isSubmittingRating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
              إرسال التقييم
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Cancel Dialog ── */}
      <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إلغاء الطلب</DialogTitle>
            <DialogDescription>سيتم إشعار الإدارة بإلغاء الطلب</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label htmlFor="cancelReason">سبب الإلغاء (اختياري)</Label>
              <Textarea
                id="cancelReason"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="مثال: لم أعد بحاجة للخدمة..."
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

      {/* ── Image Preview ── */}
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
