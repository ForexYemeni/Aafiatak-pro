'use client';

import { useState, useEffect, useCallback } from 'react';
import { Bell, Check, MessageSquare, CreditCard, AlertTriangle, Calendar, Star, Settings, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import type { NotificationType } from '@/types';

// ============================================================================
// Real notification interface from API
// ============================================================================

interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  read: boolean;
  createdAt: string;
  actionUrl?: string;
}

// ============================================================================
// Notification icon by type
// ============================================================================

function getNotificationIcon(type: NotificationType | string) {
  switch (type) {
    case 'assignment':
      return <MessageSquare className="w-4 h-4" />;
    case 'payment':
      return <CreditCard className="w-4 h-4" />;
    case 'emergency':
      return <AlertTriangle className="w-4 h-4" />;
    case 'appointment':
      return <Calendar className="w-4 h-4" />;
    case 'rating':
      return <Star className="w-4 h-4" />;
    case 'system':
      return <Settings className="w-4 h-4" />;
    case 'status_change':
      return <Settings className="w-4 h-4" />;
    default:
      return <Bell className="w-4 h-4" />;
  }
}

function getNotificationColor(type: NotificationType | string): string {
  switch (type) {
    case 'emergency':
      return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
    case 'payment':
      return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
    case 'assignment':
      return 'bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400';
    case 'rating':
      return 'bg-amber-100 text-amber-600 dark:bg-amber-900/30 dark:text-amber-400';
    default:
      return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
  }
}

// ============================================================================
// Relative time helper
// ============================================================================

function getRelativeTimeString(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'الآن';
  if (diffMins < 60) return `منذ ${diffMins} دقيقة`;
  if (diffHours < 24) return `منذ ${diffHours} ساعة`;
  return `منذ ${diffDays} يوم`;
}

// ============================================================================
// Notification Bell Component
// *** Does NOT play sounds. Sounds are ONLY from Push/Socket events. ***
// This component only updates UI state (badge count, notification list).
// ============================================================================

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const token = useAuthStore((s) => s.token);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const fetchNotifications = useCallback(async () => {
    if (!token) return;
    setIsLoading(true);
    try {
      const res = await fetch('/api/notifications?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success && data.data) {
        const notifs = data.data.notifications || [];
        const newUnreadCount = data.data.unreadCount || 0;

        // *** NO SOUND PLAYING HERE ***
        // Sounds are handled ONLY by the PWA provider (push/Socket events)
        // This component ONLY updates UI state

        setNotifications(notifs);
        setUnreadCount(newUnreadCount);
      }
    } catch {
      // silent - keep existing notifications
    } finally {
      setIsLoading(false);
    }
  }, [token]); // Removed unreadCount from deps to prevent re-render loop

  // Fetch on mount and periodically (UI-only, no sounds)
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // poll every 30s for UI updates
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Fetch when popover opens
  useEffect(() => {
    if (isOpen) fetchNotifications();
  }, [isOpen, fetchNotifications]);

  const markAsRead = async (id: string) => {
    // Optimistic update
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      const res = await fetch(`/api/notifications/${id}/read`, {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ read: true }),
      });
      if (!res.ok) {
        // Revert on failure
        setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
        setUnreadCount((prev) => prev + 1);
      }
    } catch {
      // Revert on failure
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: false } : n)));
      setUnreadCount((prev) => prev + 1);
    }
  };

  const markAllAsRead = async () => {
    // Store previous state for rollback
    const prevNotifications = [...notifications];
    const prevUnreadCount = unreadCount;
    // Optimistic update
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
    try {
      const res = await fetch('/api/notifications/read-all', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        // Revert on failure
        setNotifications(prevNotifications.map((n) => ({ ...n })));
        setUnreadCount(prevUnreadCount);
      }
    } catch {
      // Revert on failure
      setNotifications(prevNotifications.map((n) => ({ ...n })));
      setUnreadCount(prevUnreadCount);
    }
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn('w-9 h-9 relative', className)}>
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 w-4 h-4 p-0 flex items-center justify-center text-[10px]"
            >
              {unreadCount > 9 ? '٩+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-80 p-0"
        align="end"
        side="bottom"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions={true}
        dir="rtl"
      >
        <div className="flex items-center justify-between p-3">
          <h3 className="font-semibold text-sm">الإشعارات</h3>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="w-7 h-7" onClick={fetchNotifications} title="تحديث">
              <Loader2 className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" className="text-xs h-auto py-1 px-2" onClick={markAllAsRead}>
                تحديد الكل كمقروء
              </Button>
            )}
          </div>
        </div>
        <Separator />
        <ScrollArea className="max-h-80">
          {isLoading && notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              جاري التحميل...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-4 text-center text-sm text-muted-foreground">
              لا توجد إشعارات
            </div>
          ) : (
            <div className="divide-y divide-border">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'flex items-start gap-3 p-3 transition-colors hover:bg-accent/50 cursor-pointer',
                    !notification.read && 'bg-primary/5'
                  )}
                  onClick={() => markAsRead(notification.id)}
                >
                  <div
                    className={cn(
                      'w-8 h-8 rounded-lg flex items-center justify-center shrink-0',
                      getNotificationColor(notification.type)
                    )}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="flex-1 min-w-0 overflow-hidden">
                    <p className={cn('text-sm leading-5', !notification.read && 'font-medium')}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-4 line-clamp-2">
                      {notification.body}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {getRelativeTimeString(notification.createdAt)}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="w-2 h-2 rounded-full bg-primary shrink-0 mt-2" />
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
