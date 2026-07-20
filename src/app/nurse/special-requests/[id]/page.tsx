'use client';

// ============================================================================
// عافيتك - صفحة تفاصيل مهمة الخدمة الخاصة للممرض
// ============================================================================
// تعرض هذه الصفحة:
// - تفاصيل المهمة (الخدمة، العنوان، المبلغ)
// - محادثة مع الإدارة والمستفيد
// - أزرار قبول/رفض المهمة
// - زر إكمال الخدمة
// ============================================================================

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  ArrowRight, Send, Image as ImageIcon, Loader2, MessageSquare,
  RefreshCw, AlertCircle, Tag, MapPin, Clock, CheckCircle2, XCircle,
  HandCoins, Stethoscope, Phone, User, Calendar, CheckCheck, Eye,
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
  agreedPrice?: number;
  agreedDuration?: string;
  commissionRate?: number;
  commission?: number;
  nursePayout?: number;
  nurseAssignedAt?: string;
  nurseAcceptedAt?: string;
  nurseRejectedAt?: string;
  startedAt?: string;
  completedAt?: string;
  beneficiaryConfirmedAt?: string;
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
  createdAt: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  awaiting_nurse: { label: 'بانتظار قبولك', color: 'text-cyan-700', bg: 'bg-cyan-50 dark:bg-cyan-900/30', border: 'border-cyan-200 dark:border-cyan-800' },
  in_progress: { label: 'جار التنفيذ', color: 'text-indigo-700', bg: 'bg-indigo-50 dark:bg-indigo-900/30', border: 'border-indigo-200 dark:border-indigo-800' },
  completed: { label: 'مكتمل', color: 'text-green-700', bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-green-200 dark:border-green-800' },
  cancelled: { label: 'ملغي', color: 'text-red-700', bg: 'bg-red-50 dark:bg-red-900/30', border: 'border-red-200 dark:border-red-800' },
};

export default function NurseSpecialRequestDetailPage() {
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

  // Reject dialog
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [isActing, setIsActing] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const fetchDetail = useCallback(async () => {
    try {
      const res = await authFetch(`/api/special-requests/${requestId}`);
      const json = await res.json();
      if (json.success && json.data) {
        setDetail(json.data);
      }
    } catch {
      toast.error('فشل تحميل تفاصيل المهمة');
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
      toast.error('حدث خطأ');
    } finally {
      setIsSending(false);
    }
  };

  const handleNurseAction = async (action: 'accept' | 'reject') => {
    setIsActing(true);
    try {
      const res = await authFetch(`/api/special-requests/${requestId}/nurse-action`, {
        method: 'POST',
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success(json.message);
        setShowRejectDialog(false);
        await fetchMessages();
        await fetchDetail();
        if (action === 'reject') {
          setTimeout(() => router.push('/nurse/special-requests'), 1500);
        }
      } else {
        toast.error(json.message ?? 'فشل الإجراء');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setIsActing(false);
    }
  };

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

  if (isLoading || !detail) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 text-nurse animate-spin" />
      </div>
    );
  }

  const status = statusConfig[detail.status] || statusConfig.awaiting_nurse;
  const canAcceptOrReject = detail.status === 'awaiting_nurse';
  const canComplete = detail.status === 'in_progress';
  const canSendMessages = !['cancelled', 'completed'].includes(detail.status);

  return (
    <div className="space-y-4 pb-4">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.push('/nurse/special-requests')}
          className="shrink-0"
        >
          <ArrowRight className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl font-bold truncate">
              مهمة #{toArabicNum(detail.orderNumber)}
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

      {/* Action banner */}
      {canAcceptOrReject && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard variant="nurse" className="border-2 border-cyan-300 dark:border-cyan-700">
            <GlassCardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Stethoscope className="w-5 h-5 text-cyan-600" />
                <h3 className="font-bold">لديك مهمة جديدة</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                تم تعيينك لهذه المهمة. يرجى قبولها للبدء في التنفيذ أو رفضها إذا لم تتمكن من تنفيذها.
              </p>
              {detail.nursePayout ? (
                <div className="bg-emerald-50 dark:bg-emerald-900/20 p-2 rounded text-sm">
                  <span className="text-muted-foreground">مستحقاتك بعد خصم العمولة: </span>
                  <span className="font-bold text-emerald-700">{formatYemeniRial(detail.nursePayout)}</span>
                </div>
              ) : null}
              <div className="flex gap-2">
                <Button
                  onClick={() => handleNurseAction('accept')}
                  disabled={isActing}
                  className="flex-1 gap-2 bg-emerald-600 hover:bg-emerald-700"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  قبول المهمة
                </Button>
                <Button
                  onClick={() => setShowRejectDialog(true)}
                  disabled={isActing}
                  variant="outline"
                  className="flex-1 gap-2 text-rose-600 border-rose-300 hover:bg-rose-50"
                >
                  <XCircle className="w-4 h-4" />
                  رفض المهمة
                </Button>
              </div>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      )}

      {canComplete && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}>
          <GlassCard variant="nurse" className="border-2 border-indigo-300 dark:border-indigo-700">
            <GlassCardContent className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <CheckCheck className="w-5 h-5 text-indigo-600" />
                <h3 className="font-bold">المهمة قيد التنفيذ</h3>
              </div>
              <p className="text-sm text-muted-foreground">
                عند الانتهاء من تنفيذ الخدمة، اضغط زر "إكمال الخدمة" لإعلام المستفيد والإدارة.
              </p>
              <Button
                onClick={handleComplete}
                className="w-full gap-2 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle2 className="w-4 h-4" />
                إكمال الخدمة
              </Button>
            </GlassCardContent>
          </GlassCard>
        </motion.div>
      )}

      {/* Task info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <GlassCard variant="nurse">
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
            {detail.notes && (
              <div>
                <p className="text-xs text-muted-foreground mb-1">ملاحظات</p>
                <p className="text-xs bg-muted/30 rounded p-2">{detail.notes}</p>
              </div>
            )}
            <div className="flex items-start gap-2 text-xs">
              <MapPin className="w-3.5 h-3.5 text-nurse mt-0.5 shrink-0" />
              <span>{detail.address}</span>
            </div>
            {detail.scheduledDate && (
              <div className="flex items-center gap-2 text-xs">
                <Calendar className="w-3.5 h-3.5 text-nurse" />
                <span>{formatDate(new Date(detail.scheduledDate))}</span>
                {detail.scheduledTime && <span>• {detail.scheduledTime}</span>}
              </div>
            )}
          </GlassCardContent>
        </GlassCard>

        <GlassCard variant="nurse">
          <GlassCardHeader className="pb-2">
            <GlassCardTitle className="text-sm flex items-center gap-2">
              <User className="w-4 h-4" /> المستفيد
            </GlassCardTitle>
          </GlassCardHeader>
          <GlassCardContent className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <Avatar className="w-10 h-10">
                <AvatarFallback className="bg-gradient-to-br from-beneficiary to-rose-600 text-white">
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

        {detail.agreedPrice ? (
          <GlassCard variant="nurse">
            <GlassCardHeader className="pb-2">
              <GlassCardTitle className="text-sm flex items-center gap-2">
                <HandCoins className="w-4 h-4" /> التسعير
              </GlassCardTitle>
            </GlassCardHeader>
            <GlassCardContent className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">السعر الإجمالي:</span>
                <span className="font-bold">{formatYemeniRial(detail.agreedPrice)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">المدة:</span>
                <span className="font-medium">{detail.agreedDuration}</span>
              </div>
              {detail.commission ? (
                <>
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">العمولة ({toArabicNum(detail.commissionRate || 0)}%):</span>
                    <span className="text-orange-600">- {formatYemeniRial(detail.commission)}</span>
                  </div>
                  <div className="flex justify-between pt-1 border-t border-border/50">
                    <span className="font-bold">مستحقاتك:</span>
                    <span className="font-bold text-emerald-700">{formatYemeniRial(detail.nursePayout || 0)}</span>
                  </div>
                </>
              ) : null}
            </GlassCardContent>
          </GlassCard>
        ) : null}
      </div>

      {/* Chat */}
      <GlassCard variant="nurse" className="overflow-hidden">
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
                <p className="text-sm">لا توجد رسائل</p>
              </div>
            ) : (
              messages.map((msg, idx) => {
                const isOwn = msg.senderRole === 'nurse';
                const isSystem = msg.senderRole === 'system' || msg.type === 'system';
                const senderLabel =
                  msg.senderRole === 'beneficiary' ? detail.beneficiaryName :
                  msg.senderRole === 'nurse' ? 'أنت' :
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
                      {msg.imageUrl ? (
                        <div className={`rounded-2xl p-2 ${isOwn ? 'bg-nurse/10 rounded-tr-md' : 'bg-card border border-border rounded-tl-md'}`}>
                          <button onClick={() => setPreviewImage(msg.imageUrl!)} className="block">
                            <img src={msg.imageUrl} alt="صورة" className="max-w-full h-auto max-h-48 rounded-lg" />
                          </button>
                          {msg.content && <p className="text-xs mt-1">{msg.content}</p>}
                        </div>
                      ) : (
                        <div className={`rounded-2xl px-3 py-2 ${
                          isOwn
                            ? 'bg-nurse text-white rounded-tr-md'
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
                  className="shrink-0 bg-nurse hover:bg-nurse/90"
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

      {/* ── Reject Confirmation ── */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد رفض المهمة</DialogTitle>
            <DialogDescription>
              سيتم إعلام الإدارة برفضك للمهمة وسيتم تعيين ممرض آخر. لا يمكن التراجع عن هذا الإجراء.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowRejectDialog(false)}>تراجع</Button>
            <Button
              onClick={() => handleNurseAction('reject')}
              disabled={isActing}
              variant="destructive"
              className="gap-2"
            >
              {isActing ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />}
              نعم، ارفض المهمة
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
