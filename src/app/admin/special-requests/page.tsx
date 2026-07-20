'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  MessageSquare, RefreshCw, Loader2, Search, Clock, MapPin, User,
  Tag, AlertCircle, ChevronLeft, Inbox, Filter,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { SearchInput } from '@/components/common/search-input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthFetch } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { formatYemeniRial } from '@/components/common/currency';
import { toArabicNum, formatDateOnly as formatDate } from '@/components/common/date-formatter';
import { toast } from 'sonner';

interface SpecialRequestItem {
  _id: string;
  id?: string;
  orderNumber: number;
  beneficiaryName: string;
  beneficiaryPhone: string;
  serviceName: string;
  requestedServices: string[];
  status: string;
  agreedPrice?: number;
  address: string;
  lat: number;
  lng: number;
  nurseName?: string | null;
  nursePhone?: string | null;
  unreadCount: number;
  lastMessageContent?: string;
  lastMessageAt?: string;
  lastMessageSender?: string;
  createdAt: string;
  scheduledDate?: string;
  scheduledTime?: string;
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

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

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
  return formatDate(new Date(date));
}

export default function AdminSpecialRequestsPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const [requests, setRequests] = useState<SpecialRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusTab, setStatusTab] = useState('all');

  const fetchRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '100',
        search,
        ...(statusTab !== 'all' ? { status: statusTab } : {}),
      });
      const res = await authFetch(`/api/admin/special-requests?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        setRequests(json.data.requests || []);
      }
    } catch {
      // silent for auto-refresh
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, search, statusTab]);

  useEffect(() => {
    setIsLoading(true);
    void fetchRequests();
  }, [fetchRequests]);

  useRealtimeRefresh({
    entities: ['special_request'],
    onRefresh: () => void fetchRequests(),
    fallbackInterval: 10000,
  });

  const tabs = [
    { value: 'all', label: 'الكل' },
    { value: 'new,negotiating', label: 'جديد/تفاوض' },
    { value: 'awaiting_payment,awaiting_payment_review', label: 'الدفع' },
    { value: 'paid,awaiting_nurse', label: 'بانتظار الممرض' },
    { value: 'in_progress', label: 'قيد التنفيذ' },
    { value: 'completed', label: 'مكتمل' },
    { value: 'cancelled,rejected', label: 'ملغي/مرفوض' },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <PageHeader title="طلبات الخدمات الخاصة" description="محادثات الطلبات الخاصة مع المستفيدين - تحديث فوري" />
      </motion.div>

      {/* Search & Refresh */}
      <motion.div variants={itemAnim} className="flex flex-col sm:flex-row gap-3">
        <SearchInput
          placeholder="بحث بالاسم أو الهاتف أو رقم الطلب..."
          onChange={setSearch}
          className="flex-1"
        />
        <Button
          variant="outline"
          size="icon"
          onClick={() => { setIsLoading(true); void fetchRequests(); }}
          className="shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </motion.div>

      {/* Status Tabs */}
      <motion.div variants={itemAnim}>
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {tabs.map((tab) => {
            const isActive = statusTab === tab.value;
            const count = tab.value === 'all'
              ? requests.length
              : requests.filter(r => tab.value.split(',').includes(r.status)).length;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusTab(tab.value)}
                className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
                  isActive
                    ? 'bg-admin text-white shadow-md shadow-admin/25'
                    : 'bg-card border border-border hover:border-admin/30 text-muted-foreground'
                }`}
              >
                <Filter className="w-3 h-3" />
                {tab.label}
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold ${
                    isActive ? 'bg-white/20' : 'bg-muted'
                  }`}>
                    {toArabicNum(count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </motion.div>

      {/* Requests List - Conversation Style */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-admin animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <motion.div variants={itemAnim} className="flex flex-col items-center justify-center py-20">
          <Inbox className="w-16 h-16 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">لا توجد طلبات خدمات خاصة</p>
          <p className="text-xs text-muted-foreground mt-1">ستظهر الطلبات الجديدة هنا كمحادثات</p>
        </motion.div>
      ) : (
        <motion.div variants={container} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {requests.map((req) => {
            const status = statusConfig[req.status] || statusConfig.new;
            const reqId = req._id || req.id || '';
            return (
              <motion.div
                key={reqId}
                variants={itemAnim}
                whileHover={{ y: -2 }}
                onClick={() => router.push(`/admin/special-requests/${reqId}`)}
                className="relative cursor-pointer rounded-2xl border-2 border-border bg-card overflow-hidden transition-all hover:shadow-lg hover:border-admin/30 group"
              >
                {/* Unread indicator */}
                {req.unreadCount > 0 && (
                  <div className="absolute top-3 left-3 z-10 flex items-center justify-center min-w-[20px] h-5 px-1.5 rounded-full bg-red-500 text-white text-[10px] font-bold shadow-md">
                    {toArabicNum(req.unreadCount)}
                  </div>
                )}

                {/* Top status bar */}
                <div className={`h-1 ${status.bg.replace('/50', '')}`} />

                <div className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start gap-3">
                    <Avatar className="w-10 h-10 border-2 border-background shadow-sm shrink-0">
                      <AvatarFallback className="text-xs bg-gradient-to-br from-admin to-purple-700 text-white font-bold">
                        {req.beneficiaryName?.charAt(0) || 'م'}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-sm truncate">{req.beneficiaryName}</p>
                        <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md shrink-0">
                          #{toArabicNum(req.orderNumber)}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">{req.beneficiaryPhone}</p>
                    </div>
                    <Badge className={`text-[10px] px-2 py-0.5 font-bold ${status.bg} ${status.color} ${status.border} border shrink-0`}>
                      {status.label}
                    </Badge>
                  </div>

                  {/* Service name */}
                  <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                    <Tag className="w-3.5 h-3.5 text-admin shrink-0" />
                    <p className="text-xs font-medium truncate flex-1">{req.serviceName}</p>
                    {req.requestedServices?.length > 1 && (
                      <Badge variant="outline" className="text-[9px] px-1.5 py-0 shrink-0">
                        {toArabicNum(req.requestedServices.length)} خدمات
                      </Badge>
                    )}
                  </div>

                  {/* Last message preview */}
                  {req.lastMessageContent && (
                    <div className="flex items-start gap-2 text-xs">
                      <MessageSquare className="w-3.5 h-3.5 text-muted-foreground shrink-0 mt-0.5" />
                      <p className="text-muted-foreground line-clamp-2 flex-1 leading-relaxed">
                        {req.lastMessageContent}
                      </p>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between pt-2 border-t border-border/50">
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{req.lastMessageAt ? timeAgo(req.lastMessageAt) : timeAgo(req.createdAt)}</span>
                    </div>
                    {req.agreedPrice ? (
                      <div className="flex items-center gap-1 text-xs font-bold text-emerald-700 dark:text-emerald-400">
                        <span>{formatYemeniRial(req.agreedPrice)}</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate max-w-[80px]">{req.address}</span>
                      </div>
                    )}
                  </div>

                  {/* Hover action hint */}
                  <div className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-1 text-[10px] text-admin font-bold">
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
