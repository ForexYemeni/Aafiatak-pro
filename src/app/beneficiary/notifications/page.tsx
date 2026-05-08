'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Bell,
  CheckCheck,
  ClipboardList,
  CreditCard,
  AlertTriangle,
  MessageCircle,
  Clock,
  Star,
  Settings,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { GlassCard } from '@/components/common/glass-card';
import { EmptyState } from '@/components/common/empty-state';
import { ListSkeleton } from '@/components/common/loading-skeleton';
import { useAuthFetch } from '@/hooks/use-auth';

interface NotificationItem {
  id: string;
  titleAr: string;
  bodyAr: string;
  type: string;
  priority: string;
  read: boolean;
  actionUrl?: string;
  createdAt: string;
  data?: Record<string, unknown>;
}

const notificationTypeIcons: Record<string, React.ElementType> = {
  assignment: ClipboardList,
  payment: CreditCard,
  emergency: AlertTriangle,
  reminder: Clock,
  chat: MessageCircle,
  status_change: Settings,
  appointment: Clock,
  rating: Star,
  system: Bell,
};

const notificationTypeColors: Record<string, string> = {
  assignment: 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400',
  payment: 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400',
  emergency: 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400',
  reminder: 'bg-yellow-100 text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400',
  chat: 'bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400',
  status_change: 'bg-sky-100 text-sky-600 dark:bg-sky-900/30 dark:text-sky-400',
  appointment: 'bg-indigo-100 text-indigo-600 dark:bg-indigo-900/30 dark:text-indigo-400',
  rating: 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400',
  system: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
};

export default function NotificationsPage() {
  const authFetch = useAuthFetch();
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [markingAll, setMarkingAll] = useState(false);

  const fetchNotifications = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/notifications?limit=50');
      const data = await res.json();
      if (data.success && data.data) {
        // API returns { notifications: [...], total, unreadCount, ... }
        const notifs = Array.isArray(data.data) ? data.data : (data.data.notifications || []);
        setNotifications(notifs);
      }
    } catch {
      setNotifications([]);
    } finally {
      setIsLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    fetchNotifications();
  }, [fetchNotifications]);

  const markAsRead = async (notifId: string) => {
    try {
      await authFetch(`/api/notifications/${notifId}/read`, { method: 'PATCH' });
      setNotifications((prev) =>
        prev.map((n) => (n.id === notifId ? { ...n, read: true } : n))
      );
    } catch {
      // Error handled silently
    }
  };

  const markAllAsRead = async () => {
    setMarkingAll(true);
    try {
      await authFetch('/api/notifications', {
        method: 'PATCH',
        body: JSON.stringify({ markAllRead: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    } catch {
      // Error handled silently
    } finally {
      setMarkingAll(false);
    }
  };

  const formatTime = (dateStr: string | Date) => {
    const d = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - d.getTime();
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (minutes < 1) return 'الآن';
    if (minutes < 60) return `منذ ${minutes} دقيقة`;
    if (hours < 24) return `منذ ${hours} ساعة`;
    if (days < 7) return `منذ ${days} يوم`;
    return d.toLocaleDateString('ar-YE', { month: 'short', day: 'numeric' });
  };

  // Group notifications by date
  const groupedNotifications = notifications.reduce<Record<string, NotificationItem[]>>((acc, notif) => {
    const dateKey = new Date(notif.createdAt).toLocaleDateString('ar-YE', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    if (!acc[dateKey]) acc[dateKey] = [];
    acc[dateKey].push(notif);
    return acc;
  }, {});

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex items-center justify-between"
      >
        <div>
          <h1 className="text-2xl font-bold">الإشعارات</h1>
          <p className="text-sm text-muted-foreground">
            {unreadCount > 0 ? `${unreadCount} إشعار غير مقروء` : 'لا توجد إشعارات جديدة'}
          </p>
        </div>
        {unreadCount > 0 && (
          <Button
            variant="outline"
            size="sm"
            className="gap-2"
            onClick={markAllAsRead}
            disabled={markingAll}
          >
            {markingAll ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <CheckCheck className="w-3.5 h-3.5" />
            )}
            قراءة الكل
          </Button>
        )}
      </motion.div>

      {isLoading ? (
        <ListSkeleton items={6} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-10 h-10 text-muted-foreground" />}
          title="لا توجد إشعارات"
          description="ستظهر هنا إشعاراتك الجديدة"
        />
      ) : (
        <div className="space-y-6 max-h-[calc(100vh-220px)] overflow-y-auto custom-scrollbar">
          {Object.entries(groupedNotifications).map(([dateGroup, notifs]) => (
            <div key={dateGroup} className="space-y-2">
              <h3 className="text-xs font-semibold text-muted-foreground px-1">{dateGroup}</h3>
              <div className="space-y-2">
                {notifs.map((notif, index) => {
                  const Icon = notificationTypeIcons[notif.type] ?? Bell;
                  const colorClass = notificationTypeColors[notif.type] ?? 'bg-gray-100 text-gray-600';
                  return (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03 }}
                    >
                      <GlassCard
                        variant="beneficiary"
                        className={`py-3 cursor-pointer transition-all ${
                          !notif.read ? 'border-r-4 border-r-beneficiary bg-beneficiary/5' : ''
                        }`}
                        onClick={() => {
                          if (!notif.read) markAsRead(notif.id);
                          if (notif.actionUrl) {
                            window.location.href = notif.actionUrl;
                          }
                        }}
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${colorClass}`}>
                            <Icon className="w-5 h-5" />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-sm font-medium ${!notif.read ? 'font-bold' : ''}`}>
                              {notif.titleAr}
                            </p>
                            <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                              {notif.bodyAr}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {formatTime(notif.createdAt)}
                            </p>
                          </div>
                          {!notif.read && (
                            <div className="w-2.5 h-2.5 rounded-full bg-beneficiary shrink-0 mt-1.5" />
                          )}
                        </div>
                      </GlassCard>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
