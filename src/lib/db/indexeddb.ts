import { openDB, type DBSchema, type IDBPDatabase } from 'idb';

// ============================================================================
// IndexedDB Schema Types
// ============================================================================

export interface CachedServiceRequest {
  id: string;
  serviceId: string;
  beneficiaryId: string;
  status: string;
  data: Record<string, unknown>;
  updatedAt: number;
}

export interface CachedMessage {
  id: string;
  chatId: string;
  senderId: string;
  content: string;
  type: string;
  timestamp: number;
  synced: boolean;
}

export interface QueuedOperation {
  id: string;
  operation: string;
  endpoint: string;
  method: string;
  data: Record<string, unknown>;
  headers: Record<string, string>;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  lastAttempt: number;
  status: 'pending' | 'processing' | 'failed' | 'completed';
}

export interface CachedNotification {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  createdAt: number;
}

export interface CachedUser {
  id: string;
  role: string;
  data: Record<string, unknown>;
  cachedAt: number;
}

// ============================================================================
// AafiatakDB Schema Definition
// ============================================================================

interface AafiatakDB extends DBSchema {
  serviceRequests: {
    key: string;
    value: CachedServiceRequest;
    indexes: {
      'by-status': string;
      'by-beneficiary': string;
    };
  };
  messages: {
    key: string;
    value: CachedMessage;
    indexes: {
      'by-chat': string;
      'by-synced': number;
    };
  };
  operationQueue: {
    key: string;
    value: QueuedOperation;
    indexes: {
      'by-status': string;
    };
  };
  notifications: {
    key: string;
    value: CachedNotification;
    indexes: {
      'by-user': string;
      'by-read': number;
    };
  };
  users: {
    key: string;
    value: CachedUser;
  };
}

// ============================================================================
// IndexedDB Manager
// ============================================================================

const DB_NAME = 'aafiatak-db';
const DB_VERSION = 1;

class IndexedDBManager {
  private db: IDBPDatabase<AafiatakDB> | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    this.db = await openDB<AafiatakDB>(DB_NAME, DB_VERSION, {
      upgrade(database) {
        // Service Requests store
        if (!database.objectStoreNames.contains('serviceRequests')) {
          const serviceStore = database.createObjectStore('serviceRequests', { keyPath: 'id' });
          serviceStore.createIndex('by-status', 'status');
          serviceStore.createIndex('by-beneficiary', 'beneficiaryId');
        }

        // Messages store
        if (!database.objectStoreNames.contains('messages')) {
          const messageStore = database.createObjectStore('messages', { keyPath: 'id' });
          messageStore.createIndex('by-chat', 'chatId');
          messageStore.createIndex('by-synced', 'synced');
        }

        // Operation Queue store
        if (!database.objectStoreNames.contains('operationQueue')) {
          const queueStore = database.createObjectStore('operationQueue', { keyPath: 'id' });
          queueStore.createIndex('by-status', 'status');
        }

        // Notifications store
        if (!database.objectStoreNames.contains('notifications')) {
          const notifStore = database.createObjectStore('notifications', { keyPath: 'id' });
          notifStore.createIndex('by-user', 'userId');
          notifStore.createIndex('by-read', 'read');
        }

        // Users store
        if (!database.objectStoreNames.contains('users')) {
          database.createObjectStore('users', { keyPath: 'id' });
        }
      },
      blocked() {
        console.warn('[IndexedDB] Database upgrade blocked by another connection');
      },
      blocking() {
        console.warn('[IndexedDB] Database connection is blocking an upgrade');
      },
      terminated() {
        console.error('[IndexedDB] Database connection terminated unexpectedly');
        this.db = null;
      },
    });
  }

  private async getDb(): Promise<IDBPDatabase<AafiatakDB>> {
    if (!this.db) {
      await this.init();
    }
    if (!this.db) {
      throw new Error('Failed to initialize IndexedDB');
    }
    return this.db;
  }

  // ==========================================================================
  // Service Requests
  // ==========================================================================

  async saveServiceRequest(request: CachedServiceRequest): Promise<void> {
    const db = await this.getDb();
    await db.put('serviceRequests', request);
  }

  async getServiceRequests(beneficiaryId: string): Promise<CachedServiceRequest[]> {
    const db = await this.getDb();
    const index = db.transaction('serviceRequests').store.index('by-beneficiary');
    const allRequests = await index.getAll();
    return allRequests.filter((r) => r.beneficiaryId === beneficiaryId);
  }

  async getAllServiceRequests(): Promise<CachedServiceRequest[]> {
    const db = await this.getDb();
    return db.getAll('serviceRequests');
  }

  async getServiceRequest(id: string): Promise<CachedServiceRequest | undefined> {
    const db = await this.getDb();
    return db.get('serviceRequests', id);
  }

  async updateServiceRequest(id: string, data: Partial<CachedServiceRequest>): Promise<void> {
    const db = await this.getDb();
    const existing = await db.get('serviceRequests', id);
    if (existing) {
      const updated: CachedServiceRequest = {
        ...existing,
        ...data,
        updatedAt: Date.now(),
      };
      await db.put('serviceRequests', updated);
    }
  }

  async deleteServiceRequest(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete('serviceRequests', id);
  }

  // ==========================================================================
  // Messages
  // ==========================================================================

  async saveMessage(message: CachedMessage): Promise<void> {
    const db = await this.getDb();
    await db.put('messages', message);
  }

  async getMessages(chatId: string): Promise<CachedMessage[]> {
    const db = await this.getDb();
    const index = db.transaction('messages').store.index('by-chat');
    const allMessages = await index.getAll();
    return allMessages
      .filter((m) => m.chatId === chatId)
      .sort((a, b) => a.timestamp - b.timestamp);
  }

  async getUnsyncedMessages(): Promise<CachedMessage[]> {
    const db = await this.getDb();
    const allMessages = await db.getAll('messages');
    return allMessages.filter((m) => !m.synced);
  }

  async markMessageSynced(id: string): Promise<void> {
    const db = await this.getDb();
    const message = await db.get('messages', id);
    if (message) {
      const updated: CachedMessage = { ...message, synced: true };
      await db.put('messages', updated);
    }
  }

  async deleteMessage(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete('messages', id);
  }

  // ==========================================================================
  // Operation Queue
  // ==========================================================================

  async addToQueue(operation: QueuedOperation): Promise<void> {
    const db = await this.getDb();
    await db.put('operationQueue', operation);
  }

  async getPendingOperations(): Promise<QueuedOperation[]> {
    const db = await this.getDb();
    const allOps = await db.getAll('operationQueue');
    return allOps
      .filter((op) => op.status === 'pending' || op.status === 'failed')
      .sort((a, b) => a.createdAt - b.createdAt);
  }

  async getOperation(id: string): Promise<QueuedOperation | undefined> {
    const db = await this.getDb();
    return db.get('operationQueue', id);
  }

  async updateOperationStatus(
    id: string,
    status: QueuedOperation['status']
  ): Promise<void> {
    const db = await this.getDb();
    const operation = await db.get('operationQueue', id);
    if (operation) {
      const updated: QueuedOperation = {
        ...operation,
        status,
        lastAttempt: Date.now(),
      };
      await db.put('operationQueue', updated);
    }
  }

  async removeOperation(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete('operationQueue', id);
  }

  async incrementAttempts(id: string): Promise<void> {
    const db = await this.getDb();
    const operation = await db.get('operationQueue', id);
    if (operation) {
      const updated: QueuedOperation = {
        ...operation,
        attempts: operation.attempts + 1,
        lastAttempt: Date.now(),
      };
      await db.put('operationQueue', updated);
    }
  }

  async getQueueCount(): Promise<{
    pending: number;
    processing: number;
    failed: number;
    completed: number;
  }> {
    const db = await this.getDb();
    const allOps = await db.getAll('operationQueue');
    return {
      pending: allOps.filter((op) => op.status === 'pending').length,
      processing: allOps.filter((op) => op.status === 'processing').length,
      failed: allOps.filter((op) => op.status === 'failed').length,
      completed: allOps.filter((op) => op.status === 'completed').length,
    };
  }

  // ==========================================================================
  // Notifications
  // ==========================================================================

  async saveNotification(notification: CachedNotification): Promise<void> {
    const db = await this.getDb();
    await db.put('notifications', notification);
  }

  async getNotifications(userId: string): Promise<CachedNotification[]> {
    const db = await this.getDb();
    const index = db.transaction('notifications').store.index('by-user');
    const allNotifs = await index.getAll();
    return allNotifs
      .filter((n) => n.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }

  async markNotificationRead(id: string): Promise<void> {
    const db = await this.getDb();
    const notification = await db.get('notifications', id);
    if (notification) {
      const updated: CachedNotification = { ...notification, read: true };
      await db.put('notifications', updated);
    }
  }

  async getUnreadNotificationCount(userId: string): Promise<number> {
    const db = await this.getDb();
    const allNotifs = await db.getAll('notifications');
    return allNotifs.filter((n) => n.userId === userId && !n.read).length;
  }

  async deleteNotification(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete('notifications', id);
  }

  // ==========================================================================
  // Users
  // ==========================================================================

  async saveUser(user: CachedUser): Promise<void> {
    const db = await this.getDb();
    await db.put('users', user);
  }

  async getUser(id: string): Promise<CachedUser | undefined> {
    const db = await this.getDb();
    return db.get('users', id);
  }

  async deleteUser(id: string): Promise<void> {
    const db = await this.getDb();
    await db.delete('users', id);
  }

  // ==========================================================================
  // Cleanup
  // ==========================================================================

  async clearAll(): Promise<void> {
    const db = await this.getDb();
    const tx = db.transaction(
      ['serviceRequests', 'messages', 'operationQueue', 'notifications', 'users'],
      'readwrite'
    );
    await Promise.all([
      tx.objectStore('serviceRequests').clear(),
      tx.objectStore('messages').clear(),
      tx.objectStore('operationQueue').clear(),
      tx.objectStore('notifications').clear(),
      tx.objectStore('users').clear(),
      tx.done,
    ]);
  }

  async clearOldEntries(maxAge: number): Promise<void> {
    const db = await this.getDb();
    const cutoff = Date.now() - maxAge;

    // Clear old service requests
    const serviceTx = db.transaction('serviceRequests', 'readwrite');
    const serviceStore = serviceTx.store;
    let serviceCursor = await serviceStore.openCursor();
    while (serviceCursor) {
      if (serviceCursor.value.updatedAt < cutoff) {
        await serviceCursor.delete();
      }
      serviceCursor = await serviceCursor.continue();
    }

    // Clear old messages (synced only)
    const messageTx = db.transaction('messages', 'readwrite');
    const messageStore = messageTx.store;
    let messageCursor = await messageStore.openCursor();
    while (messageCursor) {
      if (messageCursor.value.synced && messageCursor.value.timestamp < cutoff) {
        await messageCursor.delete();
      }
      messageCursor = await messageCursor.continue();
    }

    // Clear completed operations
    const queueTx = db.transaction('operationQueue', 'readwrite');
    const queueStore = queueTx.store;
    let queueCursor = await queueStore.openCursor();
    while (queueCursor) {
      if (
        (queueCursor.value.status === 'completed' || queueCursor.value.status === 'failed') &&
        queueCursor.value.lastAttempt < cutoff
      ) {
        await queueCursor.delete();
      }
      queueCursor = await queueCursor.continue();
    }

    // Clear old read notifications
    const notifTx = db.transaction('notifications', 'readwrite');
    const notifStore = notifTx.store;
    let notifCursor = await notifStore.openCursor();
    while (notifCursor) {
      if (notifCursor.value.read && notifCursor.value.createdAt < cutoff) {
        await notifCursor.delete();
      }
      notifCursor = await notifCursor.continue();
    }
  }

  async getStorageEstimate(): Promise<{
    serviceRequests: number;
    messages: number;
    operationQueue: number;
    notifications: number;
    users: number;
  }> {
    const db = await this.getDb();
    const [serviceRequests, messages, operationQueue, notifications, users] = await Promise.all([
      db.count('serviceRequests'),
      db.count('messages'),
      db.count('operationQueue'),
      db.count('notifications'),
      db.count('users'),
    ]);
    return { serviceRequests, messages, operationQueue, notifications, users };
  }
}

export const localDb = new IndexedDBManager();
