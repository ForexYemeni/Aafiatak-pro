// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Notification Store (Zustand)
// ============================================================================
// Central state management for notifications using Zustand with persist.
// Manages notification list, unread count, and user preferences.
// ============================================================================

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { NotificationType, NotificationPriority, ApiResponse, PaginationMeta } from '@/types';
import { notificationManager, type AppNotification } from '@/lib/notifications/notification-manager';

// ============================================================================
// Types
// ============================================================================

/** Notification item stored in state */
export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  type: NotificationType;
  priority: NotificationPriority;
  data: Record<string, string>;
  read: boolean;
  actionUrl: string | null;
  createdAt: string;
}

/** Raw notification data from API (matches Prisma schema) */
interface ApiNotificationData {
  id: string;
  userId: string;
  userRole: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  type: string;
  priority: string;
  data: string;
  read: boolean;
  actionUrl: string | null;
  createdAt: string;
}

/** Notification store state and actions */
interface NotificationState {
  // State
  notifications: NotificationItem[];
  unreadCount: number;
  isLoading: boolean;
  soundEnabled: boolean;
  ttsEnabled: boolean;
  browserNotificationsEnabled: boolean;
  error: string | null;

  // Actions
  addNotification: (notification: AppNotification) => void;
  markAsRead: (id: string) => void;
  markAllAsRead: () => void;
  removeNotification: (id: string) => void;
  clearAll: () => void;
  setSoundEnabled: (enabled: boolean) => void;
  setTtsEnabled: (enabled: boolean) => void;
  setBrowserNotificationsEnabled: (enabled: boolean) => void;
  fetchNotifications: () => Promise<void>;
}

// ============================================================================
// API Helper
// ============================================================================

async function notificationApiRequest<T>(
  url: string,
  options: RequestInit = {}
): Promise<ApiResponse<T>> {
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
    ...options,
  });

  const data: ApiResponse<T> = await response.json();

  if (!data.success) {
    throw new Error(data.message ?? 'حدث خطأ في تحميل الإشعارات');
  }

  return data;
}

// ============================================================================
// Notification Store
// ============================================================================

export const useNotificationStore = create<NotificationState>()(
  persist(
    (set, get) => ({
      // Initial state
      notifications: [],
      unreadCount: 0,
      isLoading: false,
      soundEnabled: true,
      ttsEnabled: true,
      browserNotificationsEnabled: false,
      error: null,

      // ---- Add Notification ----
      addNotification: (notification: AppNotification) => {
        const item: NotificationItem = {
          id: notification.id,
          title: notification.title,
          body: notification.body,
          type: notification.type,
          priority: notification.priority,
          data: notification.data ?? {},
          read: false,
          actionUrl: notification.clickAction ?? null,
          createdAt: new Date().toISOString(),
        };

        let isNew = false;

        set((state) => {
          // Check for duplicate by ID
          const exists = state.notifications.some((n) => n.id === item.id);
          if (exists) return state; // Duplicate - no state change, no event

          isNew = true;
          const newNotifications = [item, ...state.notifications].slice(0, 100); // Cap at 100

          return {
            notifications: newNotifications,
            unreadCount: newNotifications.filter((n) => !n.read).length,
          };
        });

        // Only dispatch event for NEW notifications (prevents infinite loop)
        // Sound playing is NOT done here - sounds come from push/Socket events only
        if (isNew) {
          const event = new CustomEvent('app-notification', {
            detail: notification,
          });
          if (typeof window !== 'undefined') {
            window.dispatchEvent(event);
          }
        }
      },

      // ---- Mark as Read ----
      markAsRead: (id: string) => {
        set((state) => {
          const notifications = state.notifications.map((n) =>
            n.id === id ? { ...n, read: true } : n
          );

          return {
            notifications,
            unreadCount: notifications.filter((n) => !n.read).length,
          };
        });

        // Mark as read on server
        fetch(`/api/notifications/${id}/read`, { method: 'PATCH' }).catch(() => {
          // Silently fail - local state is already updated
        });
      },

      // ---- Mark All as Read ----
      markAllAsRead: () => {
        set((state) => ({
          notifications: state.notifications.map((n) => ({ ...n, read: true })),
          unreadCount: 0,
        }));

        // Mark all as read on server
        fetch('/api/notifications/read-all', { method: 'POST' }).catch(() => {
          // Silently fail
        });
      },

      // ---- Remove Notification ----
      removeNotification: (id: string) => {
        set((state) => {
          const notifications = state.notifications.filter((n) => n.id !== id);
          return {
            notifications,
            unreadCount: notifications.filter((n) => !n.read).length,
          };
        });
      },

      // ---- Clear All ----
      clearAll: () => {
        set({
          notifications: [],
          unreadCount: 0,
        });
      },

      // ---- Sound Preference ----
      setSoundEnabled: (enabled: boolean) => {
        set({ soundEnabled: enabled });
      },

      // ---- TTS Preference ----
      setTtsEnabled: (enabled: boolean) => {
        set({ ttsEnabled: enabled });
      },

      // ---- Browser Notifications Preference ----
      setBrowserNotificationsEnabled: (enabled: boolean) => {
        if (enabled) {
          // Request permission when enabling
          if (typeof window !== 'undefined' && 'Notification' in window) {
            Notification.requestPermission().then((permission) => {
              set({
                browserNotificationsEnabled: permission === 'granted',
              });
            });
          }
        } else {
          set({ browserNotificationsEnabled: false });
        }
      },

      // ---- Fetch Notifications from API ----
      // NOTE: This method ONLY updates the store state. It does NOT play sounds.
      // Sound playing is handled exclusively by the PWA provider (poller + push).
      fetchNotifications: async () => {
        set({ isLoading: true, error: null });
        try {
          const response = await notificationApiRequest<{
            notifications: ApiNotificationData[];
            unreadCount: number;
            pagination: PaginationMeta;
          }>('/api/notifications?limit=50');

          if (response.success && response.data) {
            const apiNotifications = response.data.notifications;

            // Parse JSON data field and map API response to store format
            const mapped: NotificationItem[] = apiNotifications.map((n: ApiNotificationData) => {
              let parsedData: Record<string, string> = {};
              try {
                parsedData = JSON.parse(n.data) as Record<string, string>;
              } catch {
                parsedData = {};
              }

              return {
                id: n.id,
                title: n.titleAr || n.titleEn || '',
                body: n.bodyAr || n.bodyEn || '',
                type: n.type as NotificationType,
                priority: n.priority as NotificationPriority,
                data: parsedData,
                read: n.read,
                actionUrl: n.actionUrl,
                createdAt: n.createdAt,
              };
            });

            set({
              notifications: mapped,
              unreadCount: response.data.unreadCount ?? mapped.filter((n) => !n.read).length,
              isLoading: false,
            });
          }
        } catch (error) {
          const message = error instanceof Error ? error.message : 'فشل تحميل الإشعارات';
          set({ isLoading: false, error: message });
        }
      },
    }),
    {
      name: 'aafiatak-notification-storage',
      // CRITICAL: skipHydration prevents Zustand from reading localStorage
      // synchronously during store creation. Without this, the store would
      // hydrate from localStorage BEFORE the first React render, causing
      // the client to render different values than the server → React Error #300.
      skipHydration: true,
      storage: createJSONStorage(() => {
        if (typeof window !== 'undefined') {
          return localStorage;
        }
        return {
          getItem: () => null,
          setItem: () => {},
          removeItem: () => {},
        };
      }),
      partialize: (state) => ({
        soundEnabled: state.soundEnabled,
        ttsEnabled: state.ttsEnabled,
        browserNotificationsEnabled: state.browserNotificationsEnabled,
      }),
    }
  )
);

export default useNotificationStore;
