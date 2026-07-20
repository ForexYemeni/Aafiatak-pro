'use client';

// ============================================================================
// عافيتك - صفحة قائمة طلبات الخدمات الخاصة للمستفيد
// ============================================================================

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  Plus, RefreshCw, Loader2, MessageSquare, Clock, MapPin, Tag,
  Inbox, ChevronLeft, AlertCircle,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { GlassCard } from '@/components/common/glass-card';
import { useAuthFetch } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { formatYemeniRial } from '@/components/common/currency';
import { toArabicNum } from '@/components/common/date-formatter';
import { toast } from 'sonner';

interface SpecialRequestItem {
  _id: string;
  id?: string;
  orderNumber: number;
  serviceName: string;
  status: string;
  agreedPrice?: number;
  address: string;
  unreadCount: number;
  lastMessageContent?: string;
  lastMessageAt?: string;
  lastMessageSender?: string;
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

function timeAgo(date: string): string {
  const now = new Date();
  const past = new Date(date);
  const diffMs = now.getTime() - past.getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'الآن';
  if (mins < 60) return `منذ ${toArabicNum(mins)} دقيقة`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `منذ ${toArabicNum(hours)} ساعة`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `منذ ${toArabicNum(days)} يوم`;
  return past.toLocaleDateString('ar-EG');
}

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function BeneficiarySpecialRequestsPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const [requests, setRequests] = useState<SpecialRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [servicesEnabled, setServicesEnabled] = useState(true);

  const fetchRequests = useCallback(async () => {
    try {
      const res = await authFetch('/api/beneficiary/special-requests');
      const json = await res.json();
      if (json.success && json.data) {
        setRequests(json.data);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  const fetchServicesStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/settings/services-status');
      const json = await res.json();
      if (json.success && json.data) {
        setServicesEnabled(json.data.servicesEnabled !== false);
      }
    } catch {}
  }, []);

  useEffect(() => {
    void fetchRequests();
    void fetchServicesStatus();
  }, [fetchRequests, fetchServicesStatus]);

  useRealtimeRefresh({
    entities: ['special_request', 'chat'],
    onRefresh: () => void fetchRequests(),
    fallbackInterval: 15000,
  });

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <PageHeader
          title="طلبات الخدمات الخاصة"
          description="محادثاتك مع الإدارة لطلبات الخدمات المخصصة"
          action={{
            label: 'طلب جديد',
            onClick: () => router.push('/beneficiary/special-requests/new'),
            icon: <Plus className="w-4 h-4" />,
          }}
        />
      </motion.div>

      {!servicesEnabled && (
        <motion.div variants={itemAnim}>
          <div className="rounded-xl border-2 border-rose-300 bg-rose-50 dark:bg-rose-900/20 p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />
            <div>
              <p className="font-bold text-rose-700 text-sm">الخدمات غير متاحة حالياً</p>
              <p className="text-xs text-rose-600 mt-0.5">لا يمكن إنشاء طلبات جديدة في الوقت الحالي. يرجى المحاولة لاحقاً.</p>
            </div>
          </div>
        </motion.div>
      )}

      <motion.div variants={itemAnim} className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => { setIsLoading(true); void fetchRequests(); }}
          className="gap-2"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          تحديث
        </Button>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-beneficiary animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <motion.div variants={itemAnim}>
          <GlassCard variant="beneficiary" className="p-8 text-center">
            <Inbox className="w-16 h-16 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium mb-1">لا توجد طلبات خدمات خاصة</p>
            <p className="text-xs text-muted-foreground mb-4">ابدأ بإنشاء طلب خدمة مخصص وسيتواصل معك فريق الإدارة</p>
            <Button
              onClick={() => router.push('/beneficiary/special-requests/new')}
              className="gap-2 bg-beneficiary hover:bg-beneficiary/90"
              disabled={!servicesEnabled}
            >
              <Plus className="w-4 h-4" />
              إنشاء طلب جديد
            </Button>
          </GlassCard>
        </motion.div>
      ) : (
        <motion.div variants={container} className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {requests.map((req) => {
            const status = statusConfig[req.status] || statusConfig.new;
            const reqId = req._id || req.id || '';
            return (
              <motion.div
                key={reqId}
                variants={itemAnim}
                whileHover={{ y: -2 }}
                onClick={() => router.push(`/beneficiary/special-requests/${reqId}`)}
                className="relative cursor-pointer rounded-2xl border-2 border-border bg-card overflow-hidden transition-all hover:shadow-lg hover:border-beneficiary/30 group"
              >
                {req.unreadCount > 0 && (
                  <div className="absolute top-3 left-3 z-10 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-md">
                    {toArabicNum(req.unreadCount)}
                  </div>
                )}

                <div className={`h-1 ${status.bg.replace('/50', '')}`} />

                <div className="p-4 space-y-3">
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10 border-2 border-background shadow-sm shrink-0">
                      <AvatarFallback className="text-xs bg-gradient-to-br from-beneficiary to-rose-600 text-white font-bold">
                        ع
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm truncate">{req.serviceName}</p>
                        <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md shrink-0">
                          #{toArabicNum(req.orderNumber)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {timeAgo(req.lastMessageAt || req.createdAt)}
                      </p>
                    </div>
                    <Badge className={`text-[10px] px-2 py-0.5 font-bold ${status.bg} ${status.color} ${status.border} border shrink-0`}>
                      {status.label}
                    </Badge>
                  </div>

                  {req.lastMessageContent && (
                    <div className="flex items-start gap-2 text-xs">
                      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-muted-foreground line-clamp-2 flex-1 leading-relaxed">
                        {req.lastMessageContent}
                      </p>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    {req.agreedPrice ? (
                      <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        {formatYemeniRial(req.agreedPrice)}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate max-w-[120px]">{req.address}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-beneficiary font-bold">
                      <span>فتح المحادثة</span>
                      <ChevronLeft className="w-3 h-3" />
                    </div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </motion.div>
      )}
    </motion.div>
  );
}
