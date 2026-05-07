'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  CheckCheck,
  ClipboardList,
  DollarSign,
  AlertTriangle,
  MessageSquare,
  CalendarClock,
  Star,
  Settings,
  Info,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { GlassCard } from '@/components/common/glass-card';
import { EmptyState } from '@/components/common/empty-state';
import { PullToRefresh } from '@/components/common/pull-to-refresh';
import { ListSkeleton } from '@/components/common/loading-skeleton';
import { PageHeader } from '@/components/layout/page-header';
import { useAuthFetch } from '@/hooks/use-auth';
import { useNotifications } from '@/hooks/use-socket';
import { formatDateOnly, getRelativeTime } from '@/components/common/date-formatter';

// ---- Types ----

interface NotificationItem {
  id: string;
  titleAr: string;
  bodyAr: string;
  type: string;
  priority: string;
  read: boolean;
  createdAt: string;
  actionUrl: string | null;
}

// ---- Notification icon by type ----

function getNotificationIcon(type: string) {
  switch (type) {
    case 'assignment': return <ClipboardList className="w-5 h-5 text-sky-500" />;
    case 'payment': return <DollarSign className="w-5 h-5 text-green-500" />;
    case 'emergency': return <AlertTriangle className="w-5 h-5 text-red-500" />;
    case 'chat': return <MessageSquare className="w-5 h-5 text-blue-500" />;
    case 'appointment': return <CalendarClock className="w-5 h-5 text-purple-500" />;
    case 'rating': return <Star className="w-5 h-5 text-amber-500" />;
    case 'status_change': return <Settings className="w-5 h-5 text-gray-500" />;
    default: return <Info className="w-5 h-5 text-gray-500" />;
  }
}

function getNotificationBg(type: string): string {
  switch (type) {
    case 'assignment': return 'bg-sky-50 dark:bg-sky-900/20';
    case 'payment': return 'bg-green-50 dark:bg-green-900/20';
    case 'emergency': return 'bg-red-50 dark:bg-red-900/20';
    case 'chat': return 'bg-blue-50 dark:bg-blue-900/20';
    case 'appointment': return 'bg-purple-50 dark:bg-purple-900/20';
    case 'rating': return 'bg-amber-50 dark:bg-amber-900/20';
    default: return 'bg-gray-50 dark:bg-gray-900/20';
  }
}

// ---- Group by date ----

type GroupedNotifications = {
  label: string;
  items: NotificationItem[];
}[];

function groupByDate(notifications: NotificationItem[]): GroupedNotifications {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterdayStart = new Date(todayStart);
  yesterdayStart.setDate(yesterdayStart.getDate() - 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(weekStart.getDate() - 7);

  const groups: GroupedNotifications = [
    { label: 'اليوم', items: [] },
    { label: 'أمس', items: [] },
    { label: 'هذا الأسبوع', items: [] },
    { label: 'أقدم', items: [] },
  ];

  for (const n of notifications) {
    const date = new Date(n.createdAt);
    if (date >= todayStart) {
      groups[0].items.push(n);
    } else if (date >= yesterdayStart) {
      groups[1].items.push(n);
    } else if (date >= weekStart) {
      groups[2].items.push(n);
    } else {
      groups[3].items.push(n);
    }
  }

  return groups.filter((g) => g.items.length > 0);
}

// ---- Component ----

export default function NurseNotificationsPage() {
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const authFetch = useAuthFetch();
  const socketNotifications = useNotifications();

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await authFetch('/api/notifications?limit=100');
      const data = await res.json();
      if (data.success && data.data) {
        setNotifications(data.data as NotificationItem[]);
      }
    } catch {
      // silently handle
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  // Merge real-time notifications
  useEffect(() => {
    if (socketNotifications.unreadNotifications.length > 0) {
      fetchNotifications();
    }
  }, [socketNotifications.unreadNotifications, fetchNotifications]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const handleMarkAsRead = async (id: string) => {
    try {
      await authFetch(`/api/notifications/${id}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
    } catch {
      // silently handle
    }
  };

  const handleMarkAllAsRead = async () => {
    try {
      await authFetch('/api/notifications', { method: 'PATCH' });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // silently handle
    }
  };

  const grouped = groupByDate(notifications);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <PageHeader title="الإشعارات" />
        <ListSkeleton items={6} />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PageHeader
        title="الإشعارات"
        description={unreadCount > 0 ? `${unreadCount} إشعار غير مقروء` : 'لا توجد إشعارات جديدة'}
        action={
          unreadCount > 0
            ? {
                label: 'قراءة الكل',
                onClick: handleMarkAllAsRead,
                icon: <CheckCheck className="w-4 h-4" />,
              }
            : undefined
        }
      />

      <PullToRefresh onRefresh={async () => { setIsLoading(true); await fetchNotifications(); }}>
        {notifications.length === 0 ? (
          <EmptyState
            icon={<Bell className="w-10 h-10 text-muted-foreground" />}
            title="لا توجد إشعارات"
            description="ستظهر الإشعارات هنا عند وصول جديدة"
          />
        ) : (
          <div className="space-y-6">
            {grouped.map((group) => (
              <div key={group.label}>
                <h3 className="text-sm font-semibold text-muted-foreground mb-3 px-1">
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {group.items.map((notification) => (
                    <motion.div
                      key={notification.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <button
                        className={`w-full text-right p-4 rounded-2xl transition-all ${
                          notification.read
                            ? 'glass'
                            : `glass-nurse ring-1 ring-nurse/20`
                        }`}
                        onClick={() => {
                          if (!notification.read) handleMarkAsRead(notification.id);
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${getNotificationBg(notification.type)}`}>
                            {getNotificationIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-2">
                              <p className={`text-sm font-semibold leading-tight ${!notification.read ? '' : 'text-muted-foreground'}`}>
                                {notification.titleAr}
                              </p>
                              {!notification.read && (
                                <div className="w-2 h-2 rounded-full bg-nurse shrink-0 mt-1.5" />
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                              {notification.bodyAr}
                            </p>
                            <p className="text-[10px] text-muted-foreground/70 mt-1.5">
                              {getRelativeTime(new Date(notification.createdAt))}
                            </p>
                          </div>
                        </div>
                      </button>
                    </motion.div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </PullToRefresh>
    </div>
  );
}
