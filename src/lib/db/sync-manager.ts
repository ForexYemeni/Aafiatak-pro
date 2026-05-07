import { localDb } from './indexeddb';
import { offlineQueue } from './offline-queue';
import { useAuthStore } from '@/lib/stores/auth-store';

// ============================================================================
// Sync Manager
// ============================================================================

interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt: Date;
  pendingChanges: number;
}

class SyncManager {
  private isSyncing = false;
  private lastSyncAt = 0;

  /**
   * Full sync - pull latest data from server and push local changes.
   */
  async fullSync(): Promise<void> {
    if (this.isSyncing) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this.isSyncing = true;

    try {
      await localDb.init();

      // First push local changes
      await this.pushChanges();

      // Then pull latest data
      await this.syncServiceRequests();
      await this.syncMessages();
      await this.syncNotifications();

      this.lastSyncAt = Date.now();
    } catch (error) {
      console.error('[SyncManager] Full sync failed:', error);
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Sync messages - pull latest messages for active chats.
   */
  private async syncMessages(): Promise<void> {
    try {
      const token = useAuthStore.getState().token;
      if (!token) return;

      // Push unsynced messages
      const unsyncedMessages = await localDb.getUnsyncedMessages();

      for (const message of unsyncedMessages) {
        try {
          const response = await fetch(`/api/chat/${message.chatId}/messages`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({
              content: message.content,
              type: message.type,
            }),
          });

          if (response.ok) {
            await localDb.markMessageSynced(message.id);
          }
        } catch (error) {
          console.warn(`[SyncManager] Failed to sync message ${message.id}:`, error);
        }
      }

      // Pull latest messages from server (for each cached chat)
      // This would require knowing which chats the user is in
      // For now, we sync via the queue processor for new messages
    } catch (error) {
      console.error('[SyncManager] Message sync failed:', error);
    }
  }

  /**
   * Sync service requests - pull latest statuses from server.
   */
  private async syncServiceRequests(): Promise<void> {
    try {
      const token = useAuthStore.getState().token;
      const user = useAuthStore.getState().user;
      if (!token || !user) return;

      // Pull latest service requests from server
      let endpoint = '/api/admin/orders';
      if (user.role === 'beneficiary') {
        endpoint = '/api/beneficiary/orders';
      } else if (user.role === 'nurse') {
        endpoint = '/api/nurse/assignments';
      }

      const response = await fetch(`${endpoint}?page=1&limit=50`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        const orders = result.data?.orders ?? result.data?.assignments ?? result.data ?? [];

        if (Array.isArray(orders)) {
          for (const order of orders) {
            const cached: import('./indexeddb').CachedServiceRequest = {
              id: order.id,
              serviceId: order.serviceId ?? '',
              beneficiaryId: order.beneficiaryId ?? '',
              status: order.status ?? 'pending',
              data: order as Record<string, unknown>,
              updatedAt: Date.now(),
            };
            await localDb.saveServiceRequest(cached);
          }
        }
      }
    } catch (error) {
      console.error('[SyncManager] Service request sync failed:', error);
    }
  }

  /**
   * Sync notifications - pull latest notifications from server.
   */
  private async syncNotifications(): Promise<void> {
    try {
      const token = useAuthStore.getState().token;
      const user = useAuthStore.getState().user;
      if (!token || !user) return;

      const response = await fetch('/api/notifications?page=1&limit=50', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      if (response.ok) {
        const result = await response.json();
        const notifications = result.data?.notifications ?? result.data ?? [];

        if (Array.isArray(notifications)) {
          for (const notif of notifications) {
            const cached: import('./indexeddb').CachedNotification = {
              id: notif.id,
              userId: user.id,
              title: notif.titleAr ?? notif.title ?? '',
              body: notif.bodyAr ?? notif.body ?? '',
              type: notif.type ?? 'system',
              read: notif.read ?? false,
              createdAt: notif.createdAt ? new Date(notif.createdAt).getTime() : Date.now(),
            };
            await localDb.saveNotification(cached);
          }
        }
      }
    } catch (error) {
      console.error('[SyncManager] Notification sync failed:', error);
    }
  }

  /**
   * Push local changes to server via the offline queue.
   */
  async pushChanges(): Promise<void> {
    try {
      await offlineQueue.processQueue();
    } catch (error) {
      console.error('[SyncManager] Push changes failed:', error);
    }
  }

  /**
   * Get sync status.
   */
  getStatus(): SyncStatus {
    return {
      isSyncing: this.isSyncing,
      lastSyncAt: new Date(this.lastSyncAt),
      pendingChanges: 0, // Will be updated asynchronously
    };
  }

  /**
   * Get pending changes count asynchronously.
   */
  async getPendingChangesCount(): Promise<number> {
    try {
      const status = await offlineQueue.getStatus();
      return status.pending + status.failed;
    } catch {
      return 0;
    }
  }
}

export const syncManager = new SyncManager();
