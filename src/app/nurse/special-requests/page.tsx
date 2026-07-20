'use client';

// ============================================================================
// عافيتك - صفحة قائمة طلبات الخدمات الخاصة المعينة للممرض
// ============================================================================

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  RefreshCw, Loader2, MessageSquare, Clock, MapPin, Tag,
  Inbox, ChevronLeft, HandCoins, Stethoscope,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/page-header';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { useAuthFetch } from '@/hooks/use-auth';
import { useRealtimeRefresh } from '@/hooks/use-realtime-refresh';
import { formatYemeniRial } from '@/components/common/currency';
import { toArabicNum } from '@/components/common/date-formatter';

interface SpecialRequestItem {
  _id: string;
  id?: string;
  orderNumber: number;
  serviceName: string;
  status: string;
  nursePayout?: number;
  agreedPrice?: number;
  address: string;
  beneficiaryName: string;
  unreadCount: number;
  lastMessageContent?: string;
  lastMessageAt?: string;
  createdAt: string;
}

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string }> = {
  awaiting_nurse: { label: 'بانتظار قبولك', color: 'text-cyan-700', bg: 'bg-cyan-50 dark:bg-cyan-900/30', border: 'border-cyan-200 dark:border-cyan-800' },
  in_progress: { label: 'جار التنفيذ', color: 'text-indigo-700', bg: 'bg-indigo-50 dark:bg-indigo-900/30', border: 'border-indigo-200 dark:border-indigo-800' },
  completed: { label: 'مكتمل', color: 'text-green-700', bg: 'bg-green-50 dark:bg-green-900/30', border: 'border-green-200 dark:border-green-800' },
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

export default function NurseSpecialRequestsPage() {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const [requests, setRequests] = useState<SpecialRequestItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusTab, setStatusTab] = useState('all');

  const fetchRequests = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (statusTab !== 'all') params.set('status', statusTab);
      const res = await authFetch(`/api/nurse/special-requests?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        setRequests(json.data);
      }
    } catch {
      // silent
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, statusTab]);

  useEffect(() => {
    setIsLoading(true);
    void fetchRequests();
  }, [fetchRequests]);

  useRealtimeRefresh({
    entities: ['special_request', 'chat'],
    onRefresh: () => void fetchRequests(),
    fallbackInterval: 15000,
  });

  const tabs = [
    { value: 'all', label: 'الكل' },
    { value: 'awaiting_nurse', label: 'بانتظار القبول' },
    { value: 'in_progress', label: 'قيد التنفيذ' },
    { value: 'completed', label: 'مكتمل' },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <PageHeader
          title="مهمات الخدمات الخاصة"
          description="الطلبات الخاصة المعينة إليك"
        />
      </motion.div>

      <motion.div variants={itemAnim} className="flex items-center justify-between gap-3">
        <div className="flex gap-2 overflow-x-auto scrollbar-none pb-1">
          {tabs.map((tab) => {
            const isActive = statusTab === tab.value;
            const count = tab.value === 'all' ? requests.length : requests.filter(r => r.status === tab.value).length;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusTab(tab.value)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-nurse text-white shadow-md shadow-nurse/25'
                    : 'bg-card border border-border hover:border-nurse/30 text-muted-foreground'
                }`}
              >
                {tab.label}
                {count > 0 && (
                  <span className={`px-1.5 py-0.5 rounded-full text-[9px] ${
                    isActive ? 'bg-white/20' : 'bg-muted'
                  }`}>
                    {toArabicNum(count)}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        <Button
          variant="outline"
          size="icon"
          onClick={() => { setIsLoading(true); void fetchRequests(); }}
          className="shrink-0"
        >
          <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
        </Button>
      </motion.div>

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-nurse animate-spin" />
        </div>
      ) : requests.length === 0 ? (
        <motion.div variants={itemAnim} className="flex flex-col items-center justify-center py-20">
          <Inbox className="w-16 h-16 text-muted-foreground/30 mb-3" />
          <p className="text-muted-foreground font-medium">لا توجد مهمات</p>
          <p className="text-xs text-muted-foreground mt-1">ستظهر المهام المعينة لك هنا</p>
        </motion.div>
      ) : (
        <motion.div variants={container} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {requests.map((req) => {
            const status = statusConfig[req.status] || statusConfig.awaiting_nurse;
            const reqId = req._id || req.id || '';
            return (
              <motion.div
                key={reqId}
                variants={itemAnim}
                whileHover={{ y: -2 }}
                onClick={() => router.push(`/nurse/special-requests/${reqId}`)}
                className="relative cursor-pointer rounded-2xl border-2 border-border bg-card overflow-hidden transition-all hover:shadow-lg hover:border-nurse/30 group"
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
                      <AvatarFallback className="text-xs bg-gradient-to-br from-nurse to-cyan-700 text-white font-bold">
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
                      <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                        <Stethoscope className="w-3 h-3 inline ml-1" />
                        {req.serviceName}
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
                    {req.nursePayout ? (
                      <div className="text-sm font-bold text-emerald-700 dark:text-emerald-400">
                        {formatYemeniRial(req.nursePayout)}
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        <span className="truncate max-w-[80px]">{req.address}</span>
                      </div>
                    )}
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      <span>{timeAgo(req.lastMessageAt || req.createdAt)}</span>
                    </div>
                  </div>

                  <div className="absolute bottom-3 left-3 opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="flex items-center gap-1 text-[10px] text-nurse font-bold">
                      <span>فتح</span>
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
