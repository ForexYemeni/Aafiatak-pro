'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, Check, MessageSquare, CreditCard, AlertTriangle, Calendar, Star, Settings, Loader2, Trash2, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/lib/stores/auth-store';
import { useNotificationStore } from '@/lib/stores/notification-store';
import type { NotificationType } from '@/types';

// ============================================================================
// Notification icon by type
// ============================================================================

function getNotificationIcon(type: NotificationType | string) {
  switch (type) {
    case 'assignment':
    case 'service_assigned':
      return <MessageSquare className="w-4 h-4" />;
    case 'payment':
      return <CreditCard className="w-4 h-4" />;
    case 'emergency':
    case 'emergency_assigned':
      return <AlertTriangle className="w-4 h-4" />;
    case 'appointment':
      return <Calendar className="w-4 h-4" />;
    case 'rating':
      return <Star className="w-4 h-4" />;
    case 'system':
    case 'status_change':
      return <Settings className="w-4 h-4" />;
    default:
      return <Bell className="w-4 h-4" />;
  }
}

function getNotificationColor(type: NotificationType | string): string {
  switch (type) {
    case 'emergency':
    case 'emergency_assigned':
      return 'bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400';
    case 'payment':
    case 'service_completed':
      return 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400';
    case 'assignment':
    case 'service_assigned':
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
// *** Uses notification store — NO independent API polling ***
// *** Does NOT play sounds. Sounds are ONLY from Push/Socket events. ***
// ============================================================================

interface NotificationBellProps {
  className?: string;
}

export function NotificationBell({ className }: NotificationBellProps) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const token = useAuthStore((s) => s.token);
  const [isOpen, setIsOpen] = useState(false);

  // Read from notification store (populated by NotificationPoller in PWA provider)
  const notifications = useNotificationStore((s) => s.notifications);
  const unreadCount = useNotificationStore((s) => s.unreadCount);
  const isLoading = useNotificationStore((s) => s.isLoading);
  const storeMarkAsRead = useNotificationStore((s) => s.markAsRead);
  const storeMarkAllAsRead = useNotificationStore((s) => s.markAllAsRead);
  const storeRemoveNotification = useNotificationStore((s) => s.removeNotification);
  const storeClearAll = useNotificationStore((s) => s.clearAll);
  const fetchNotifications = useNotificationStore((s) => s.fetchNotifications);

  // Fetch fresh data when popover opens
  useEffect(() => {
    if (isOpen && token) {
      fetchNotifications();
    }
  }, [isOpen, token, fetchNotifications]);

  // Delete a single notification (optimistic)
  const deleteNotification = useCallback(async (id: string) => {
    storeRemoveNotification(id);
    try {
      await fetch(`/api/notifications/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
    } catch {
      // Silently fail - local state already updated
    }
  }, [token, storeRemoveNotification]);

  // Delete all notifications (optimistic)
  const deleteAllNotifications = useCallback(async () => {
    storeClearAll();
    try {
      await fetch('/api/notifications/delete-all', {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });
    } catch {
      // Silently fail
    }
  }, [token, storeClearAll]);

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className={cn('w-9 h-9 relative', className)}>
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <Badge
              variant="destructive"
              className="absolute -top-1 -right-1 min-w-[18px] h-[18px] p-0 flex items-center justify-center text-[10px]"
            >
              {unreadCount > 9 ? '٩+' : unreadCount}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[calc(100vw-2rem)] sm:w-[380px] max-w-[420px] p-0 shadow-xl border rounded-lg z-[9999]"
        align="start"
        side="bottom"
        sideOffset={8}
        collisionPadding={16}
        avoidCollisions={true}
        dir="rtl"
        onOpenAutoFocus={(e) => e.preventDefault()}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="font-bold text-sm">الإشعارات</h3>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="w-7 h-7"
              onClick={fetchNotifications}
              title="تحديث"
            >
              <Loader2 className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            </Button>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] h-7 px-2 text-blue-600 hover:text-blue-700"
                onClick={storeMarkAllAsRead}
                title="تحديد الكل كمقروء"
              >
                <Check className="w-3.5 h-3.5 ml-1" />
                قراءة الكل
              </Button>
            )}
            {notifications.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="text-[11px] h-7 px-2 text-red-500 hover:text-red-600"
                onClick={deleteAllNotifications}
                title="حذف جميع الإشعارات"
              >
                <Trash2 className="w-3.5 h-3.5 ml-1" />
                حذف الكل
              </Button>
            )}
          </div>
        </div>

        {/* Notification List */}
        <ScrollArea className="max-h-[420px]">
          {isLoading && notifications.length === 0 ? (
            <div className="p-6 text-center text-sm text-muted-foreground flex flex-col items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              جاري التحميل...
            </div>
          ) : notifications.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground flex flex-col items-center gap-3">
              <Bell className="w-10 h-10 text-muted-foreground/40" />
              <p>لا توجد إشعارات</p>
            </div>
          ) : (
            <div className="divide-y divide-border/50">
              {notifications.map((notification) => (
                <div
                  key={notification.id}
                  className={cn(
                    'flex items-start gap-3 p-3 transition-colors hover:bg-accent/30 relative group',
                    !notification.read && 'bg-blue-50/50 dark:bg-blue-950/20'
                  )}
                >
                  {/* Icon */}
                  <div
                    className={cn(
                      'w-9 h-9 rounded-full flex items-center justify-center shrink-0',
                      getNotificationColor(notification.type)
                    )}
                  >
                    {getNotificationIcon(notification.type)}
                  </div>

                  {/* Content */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => {
                      if (!notification.read) storeMarkAsRead(notification.id);
                      // Navigate based on notification type and actionUrl
                      if (notification.actionUrl) {
                        router.push(notification.actionUrl);
                        setIsOpen(false);
                      } else if (notification.type === 'rating') {
                        const role = user?.role;
                        if (role === 'nurse') {
                          router.push('/nurse/ratings');
                        } else if (role === 'admin' || role === 'subadmin') {
                          router.push('/admin/ratings');
                        }
                        setIsOpen(false);
                      } else if (notification.type === 'emergency' || notification.type === 'emergency_assigned') {
                        const role = user?.role;
                        if (role === 'nurse') {
                          router.push('/nurse');
                        } else if (role === 'admin' || role === 'subadmin') {
                          router.push('/admin/emergencies');
                        } else if (role === 'beneficiary') {
                          router.push('/beneficiary/emergency');
                        }
                        setIsOpen(false);
                      } else if (notification.type === 'assignment' || notification.type === 'service_assigned') {
                        const role = user?.role;
                        if (role === 'nurse') {
                          router.push('/nurse');
                        } else if (role === 'admin' || role === 'subadmin') {
                          router.push('/admin/orders');
                        }
                        setIsOpen(false);
                      } else if (notification.type === 'payment' || notification.type === 'service_completed') {
                        const role = user?.role;
                        if (role === 'nurse') {
                          router.push('/nurse/earnings');
                        } else if (role === 'beneficiary') {
                          router.push('/beneficiary/orders');
                        }
                        setIsOpen(false);
                      }
                    }}
                  >
                    <p className={cn(
                      'text-sm leading-5',
                      !notification.read && 'font-semibold'
                    )}>
                      {notification.title}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5 leading-4 line-clamp-2">
                      {notification.body}
                    </p>
                    <p className="text-[10px] text-muted-foreground/70 mt-1" suppressHydrationWarning>
                      {getRelativeTimeString(notification.createdAt)}
                    </p>
                  </div>

                  {/* Unread indicator + Delete button */}
                  <div className="flex flex-col items-center gap-2 shrink-0">
                    {notification.read ? null : (
                      <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity text-muted-foreground hover:text-red-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteNotification(notification.id);
                      }}
                      title="حذف"
                    >
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer - count info */}
        {notifications.length > 0 && (
          <div className="p-2 border-t bg-muted/20 text-center">
            <p className="text-[10px] text-muted-foreground">
              {notifications.length} إشعار
              {unreadCount > 0 && ` · ${unreadCount} غير مقروء`}
            </p>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}
