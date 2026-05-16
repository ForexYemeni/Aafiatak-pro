'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  ClipboardList,
  Clock,
  Eye,
  CheckCircle,
  XCircle,
  SearchCircle,
  AlertTriangle,
  MessageSquare,
  Loader2,
} from 'lucide-react';
import { GlassCard } from '@/components/common/glass-card';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';

interface Complaint {
  id: string;
  _id: string;
  subject: string;
  description: string;
  status: 'open' | 'under_review' | 'resolved' | 'dismissed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  resolution?: string;
  adminNotes?: string;
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; color: string; bg: string }> = {
  open: { label: 'جديد', icon: Clock, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-100 dark:bg-blue-900/30' },
  under_review: { label: 'قيد المراجعة', icon: SearchCircle, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-100 dark:bg-amber-900/30' },
  resolved: { label: 'تم الحل', icon: CheckCircle, color: 'text-green-600 dark:text-green-400', bg: 'bg-green-100 dark:bg-green-900/30' },
  dismissed: { label: 'مرفوض', icon: XCircle, color: 'text-red-600 dark:text-red-400', bg: 'bg-red-100 dark:bg-red-900/30' },
};

const priorityLabels: Record<string, string> = {
  low: 'منخفض',
  medium: 'متوسط',
  high: 'مرتفع',
  urgent: 'عاجل',
};

const categoryLabels: Record<string, string> = {
  general: 'عام',
  service: 'خدمة',
  nurse: 'ممرض/ـة',
  payment: 'دفع',
  technical: 'تقني',
  other: 'أخرى',
};

export default function MyComplaintsPage() {
  const authFetch = useAuthFetch();
  const { toast } = useToast();
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusTab, setStatusTab] = useState('all');
  const [selectedComplaint, setSelectedComplaint] = useState<Complaint | null>(null);

  const fetchComplaints = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: '1',
        limit: '50',
        ...(statusTab !== 'all' ? { status: statusTab } : {}),
      });
      const res = await authFetch(`/api/beneficiary/complaints?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        const items = json.data.complaints ?? [];
        setComplaints(Array.isArray(items) ? items : []);
      }
    } catch {
      toast({ title: 'فشل تحميل البلاغات', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, statusTab, toast]);

  useEffect(() => {
    void fetchComplaints();
  }, [fetchComplaints]);

  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString('ar-YE', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const tabs = [
    { value: 'all', label: 'الكل' },
    { value: 'open', label: 'جديدة' },
    { value: 'under_review', label: 'قيد المراجعة' },
    { value: 'resolved', label: 'تم الحل' },
    { value: 'dismissed', label: 'مرفوضة' },
  ];

  return (
    <div className="space-y-5">
      <PageHeader title="بلاغاتي" description="متابعة حالة البلاغات والشكاوى المرسلة" />

      {/* Tabs */}
      <Tabs value={statusTab} onValueChange={setStatusTab}>
        <TabsList className="flex-wrap h-auto gap-1 bg-muted/50">
          {tabs.map((tab) => (
            <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-beneficiary" />
        </div>
      ) : complaints.length === 0 ? (
        <GlassCard variant="beneficiary" className="text-center py-12">
          <ClipboardList className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm font-medium text-muted-foreground">لا توجد بلاغات</p>
          <p className="text-xs text-muted-foreground mt-1">
            {statusTab === 'all'
              ? 'لم تقم بإرسال أي بلاغ بعد'
              : `لا توجد بلاغات بحالة "${tabs.find(t => t.value === statusTab)?.label || statusTab}"`}
          </p>
        </GlassCard>
      ) : (
        <div className="space-y-3">
          {complaints.map((complaint, i) => {
            const id = complaint._id || complaint.id;
            const statusInfo = statusConfig[complaint.status] || statusConfig.open;
            const StatusIcon = statusInfo.icon;

            return (
              <motion.div
                key={id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
              >
                <button
                  onClick={() => setSelectedComplaint(complaint)}
                  className="w-full text-right"
                >
                  <GlassCard variant="beneficiary" className="p-4 hover:bg-accent/30 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                            <StatusIcon className="w-3 h-3" />
                            {statusInfo.label}
                          </span>
                          <span className="text-[10px] text-muted-foreground">
                            {categoryLabels[complaint.category] || complaint.category}
                          </span>
                        </div>
                        <p className="text-sm font-medium line-clamp-1">{complaint.subject}</p>
                        <p className="text-xs text-muted-foreground line-clamp-2 mt-1">{complaint.description}</p>
                        <p className="text-[10px] text-muted-foreground mt-2">{formatDate(complaint.createdAt)}</p>
                      </div>
                      <Eye className="w-4 h-4 text-muted-foreground shrink-0 mt-1" />
                    </div>
                  </GlassCard>
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Complaint Details Dialog */}
      <Dialog open={!!selectedComplaint} onOpenChange={(open) => { if (!open) setSelectedComplaint(null); }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>تفاصيل البلاغ</DialogTitle>
            <DialogDescription>
              حالة البلاغ وتفاصيله
            </DialogDescription>
          </DialogHeader>
          {selectedComplaint && (
            <div className="space-y-4">
              {/* Status & Priority */}
              <div className="flex items-center gap-2">
                {(() => {
                  const statusInfo = statusConfig[selectedComplaint.status] || statusConfig.open;
                  const StatusIcon = statusInfo.icon;
                  return (
                    <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusInfo.bg} ${statusInfo.color}`}>
                      <StatusIcon className="w-3.5 h-3.5" />
                      {statusInfo.label}
                    </span>
                  );
                })()}
                <Badge variant="outline" className="text-[10px]">
                  {priorityLabels[selectedComplaint.priority] || selectedComplaint.priority}
                </Badge>
              </div>

              {/* Subject */}
              <div className="glass rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">الموضوع</p>
                <p className="text-sm font-medium">{selectedComplaint.subject}</p>
              </div>

              {/* Description */}
              <div className="glass rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">التفاصيل</p>
                <p className="text-sm leading-relaxed whitespace-pre-line">{selectedComplaint.description}</p>
              </div>

              {/* Category & Date */}
              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">التصنيف</p>
                  <p className="text-sm font-medium">{categoryLabels[selectedComplaint.category] || selectedComplaint.category}</p>
                </div>
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">تاريخ الإرسال</p>
                  <p className="text-sm font-medium">{formatDate(selectedComplaint.createdAt)}</p>
                </div>
              </div>

              {/* Resolution */}
              {selectedComplaint.resolution && (
                <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-3 border border-green-200 dark:border-green-800/30">
                  <div className="flex items-center gap-1.5 mb-1">
                    <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                    <p className="text-xs font-medium text-green-700 dark:text-green-400">رد الإدارة</p>
                  </div>
                  <p className="text-sm leading-relaxed">{selectedComplaint.resolution}</p>
                  {selectedComplaint.resolvedAt && (
                    <p className="text-[10px] text-muted-foreground mt-2">{formatDate(selectedComplaint.resolvedAt)}</p>
                  )}
                </div>
              )}

              {/* Admin Notes */}
              {selectedComplaint.adminNotes && (
                <div className="bg-blue-50 dark:bg-blue-950/20 rounded-xl p-3 border border-blue-200 dark:border-blue-800/30">
                  <div className="flex items-center gap-1.5 mb-1">
                    <MessageSquare className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                    <p className="text-xs font-medium text-blue-700 dark:text-blue-400">ملاحظات الإدارة</p>
                  </div>
                  <p className="text-sm leading-relaxed">{selectedComplaint.adminNotes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
