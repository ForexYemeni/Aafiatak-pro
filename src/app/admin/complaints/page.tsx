'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion } from 'framer-motion';
import { MessageSquare, Eye, RefreshCw, CheckCircle } from 'lucide-react';
import { DataTable } from '@/components/common/data-table';
import { PageHeader } from '@/components/layout/page-header';
import { GlassCard } from '@/components/common/glass-card';
import { BadgeStatus } from '@/components/common/badge-status';
import { DateFormatter } from '@/components/common/date-formatter';
import { useAuthFetch } from '@/hooks/use-auth';
import { Button } from '@/components/ui/button';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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

interface ComplaintItem {
  id: string;
  fromUserName: string;
  againstUserName: string;
  subject: string;
  description: string;
  status: string;
  priority: string;
  resolution: string | null;
  resolvedBy: string | null;
  resolvedAt: string | null;
  createdAt: string;
}

const priorityColors: Record<string, string> = {
  low: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  medium: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  high: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
  urgent: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
};

const container = { hidden: { opacity: 0 }, show: { opacity: 1, transition: { staggerChildren: 0.05 } } };
const itemAnim = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };

export default function AdminComplaintsPage() {
  const authFetch = useAuthFetch();
  const [complaints, setComplaints] = useState<ComplaintItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [statusTab, setStatusTab] = useState('all');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const [viewTarget, setViewTarget] = useState<ComplaintItem | null>(null);
  const [resolveTarget, setResolveTarget] = useState<ComplaintItem | null>(null);
  const [resolution, setResolution] = useState('');
  const [isResolving, setIsResolving] = useState(false);

  const fetchComplaints = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        limit: '10',
        ...(statusTab !== 'all' ? { status: statusTab } : {}),
      });
      const res = await authFetch(`/api/admin/complaints?${params}`);
      const json = await res.json();
      if (json.success && json.data) {
        const items = json.data.complaints ?? json.data;
        setComplaints(Array.isArray(items) ? items : []);
        if (json.data.pages) setTotalPages(json.data.pages);
      }
    } catch {
      toast.error('فشل تحميل الشكاوى');
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, page, statusTab]);

  useEffect(() => {
    void fetchComplaints();
  }, [fetchComplaints]);

  const handleResolve = async () => {
    if (!resolveTarget || !resolution) return;
    setIsResolving(true);
    try {
      const res = await authFetch(`/api/admin/complaints/${resolveTarget.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: 'resolved', resolution }),
      });
      const json = await res.json();
      if (json.success) {
        toast.success('تم حل الشكوى بنجاح');
        void fetchComplaints();
      } else {
        toast.error(json.message ?? 'فشل الحل');
      }
    } catch {
      toast.error('حدث خطأ');
    } finally {
      setIsResolving(false);
      setResolveTarget(null);
      setResolution('');
    }
  };

  const columns: ColumnDef<ComplaintItem, unknown>[] = [
    {
      accessorKey: 'subject',
      header: 'الموضوع',
      cell: ({ row }) => (
        <div>
          <p className="font-medium text-sm line-clamp-1">{row.original.subject}</p>
          <p className="text-xs text-muted-foreground">{row.original.fromUserName} → {row.original.againstUserName}</p>
        </div>
      ),
    },
    {
      accessorKey: 'priority',
      header: 'الأولوية',
      cell: ({ row }) => (
        <span className={`text-xs px-2 py-1 rounded-full ${priorityColors[row.original.priority] ?? ''}`}>
          {row.original.priority === 'urgent' ? 'عاجل' :
           row.original.priority === 'high' ? 'مرتفع' :
           row.original.priority === 'medium' ? 'متوسط' : 'منخفض'}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'الحالة',
      cell: ({ row }) => <BadgeStatus status={row.original.status} />,
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
      onClick: (row: Record<string, unknown>) => setViewTarget(row as unknown as ComplaintItem),
    },
    {
      label: 'حل الشكوى',
      onClick: (row: Record<string, unknown>) => {
        const c = row as unknown as ComplaintItem;
        if (c.status !== 'resolved' && c.status !== 'dismissed') {
          setResolveTarget(c);
        }
      },
    },
  ];

  const tabs = [
    { value: 'all', label: 'الكل' },
    { value: 'open', label: 'مفتوحة' },
    { value: 'under_review', label: 'قيد المراجعة' },
    { value: 'resolved', label: 'تم الحل' },
    { value: 'dismissed', label: 'مرفوضة' },
  ];

  return (
    <motion.div variants={container} initial="hidden" animate="show" className="space-y-6">
      <motion.div variants={itemAnim}>
        <PageHeader title="إدارة الشكاوى" description="عرض وحل شكاوى المستخدمين" />
      </motion.div>

      <motion.div variants={itemAnim}>
        <GlassCard variant="admin">
          <div className="flex flex-col gap-4 mb-6">
            <Tabs value={statusTab} onValueChange={setStatusTab}>
              <TabsList className="flex-wrap h-auto gap-1">
                {tabs.map((tab) => (
                  <TabsTrigger key={tab.value} value={tab.value} className="text-xs">
                    {tab.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>
            <Button variant="outline" size="icon" className="w-fit" onClick={() => void fetchComplaints()}>
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </GlassCard>
      </motion.div>

      <motion.div variants={itemAnim}>
        <DataTable
          columns={columns}
          data={complaints}
          isLoading={isLoading}
          emptyMessage="لا توجد شكاوى"
          emptyAction={{ label: 'تحديث', onClick: () => void fetchComplaints() }}
          rowActions={rowActions as never}
          currentPage={page}
          pageCount={totalPages}
          onPageChange={setPage}
        />
      </motion.div>

      {/* View Details */}
      <Dialog open={!!viewTarget} onOpenChange={(open) => { if (!open) setViewTarget(null); }}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>تفاصيل الشكوى</DialogTitle>
          </DialogHeader>
          {viewTarget && (
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <BadgeStatus status={viewTarget.status} size="md" />
                <span className={`text-xs px-2 py-1 rounded-full ${priorityColors[viewTarget.priority] ?? ''}`}>
                  {viewTarget.priority === 'urgent' ? 'عاجل' :
                   viewTarget.priority === 'high' ? 'مرتفع' :
                   viewTarget.priority === 'medium' ? 'متوسط' : 'منخفض'}
                </span>
              </div>
              <div className="glass rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">الموضوع</p>
                <p className="text-sm font-medium">{viewTarget.subject}</p>
              </div>
              <div className="glass rounded-xl p-3">
                <p className="text-xs text-muted-foreground mb-1">التفاصيل</p>
                <p className="text-sm">{viewTarget.description}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">من</p>
                  <p className="text-sm font-medium">{viewTarget.fromUserName}</p>
                </div>
                <div className="glass rounded-xl p-3">
                  <p className="text-xs text-muted-foreground">ضد</p>
                  <p className="text-sm font-medium">{viewTarget.againstUserName}</p>
                </div>
              </div>
              {viewTarget.resolution && (
                <div className="bg-green-50 dark:bg-green-950/20 rounded-xl p-3">
                  <p className="text-xs text-green-700 dark:text-green-400 mb-1">الحل</p>
                  <p className="text-sm">{viewTarget.resolution}</p>
                  {viewTarget.resolvedAt && (
                    <p className="text-xs text-muted-foreground mt-2">
                      <DateFormatter date={viewTarget.resolvedAt} format="full" />
                    </p>
                  )}
                </div>
              )}
              <div className="text-xs text-muted-foreground">
                تاريخ الشكوى: <DateFormatter date={viewTarget.createdAt} format="full" />
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Resolve Dialog */}
      <Dialog open={!!resolveTarget} onOpenChange={(open) => { if (!open) setResolveTarget(null); }}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>حل الشكوى</DialogTitle>
            <DialogDescription>
              أدخل ملاحظات الحل للشكوى: {resolveTarget?.subject ?? ''}
            </DialogDescription>
          </DialogHeader>
          <div className="py-2">
            <Label>ملاحظات الحل *</Label>
            <Textarea
              value={resolution}
              onChange={(e) => setResolution(e.target.value)}
              placeholder="أدخل ملاحظات الحل..."
              rows={4}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResolveTarget(null)} disabled={isResolving}>
              إلغاء
            </Button>
            <Button
              onClick={handleResolve}
              disabled={isResolving || !resolution}
              className="bg-admin hover:bg-admin/90"
            >
              {isResolving ? 'جارٍ الحل...' : 'حل الشكوى'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </motion.div>
  );
}
