// ============================================================================
// IndexedDB Manager - Stub for SSR/BUILD compatibility
// The real implementation is loaded at runtime in the browser only.
// This stub prevents Turbopack build errors.
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

// Stub implementation - all methods are no-ops during SSR
class IndexedDBManagerStub {
  async init(): Promise<void> { /* Browser only */ }
  async saveServiceRequest(): Promise<void> { /* Browser only */ }
  async getServiceRequests(): Promise<CachedServiceRequest[]> { return []; }
  async updateServiceRequest(): Promise<void> { /* Browser only */ }
  async saveMessage(): Promise<void> { /* Browser only */ }
  async getMessages(): Promise<CachedMessage[]> { return []; }
  async getUnsyncedMessages(): Promise<CachedMessage[]> { return []; }
  async markMessageSynced(): Promise<void> { /* Browser only */ }
  async addToQueue(): Promise<void> { /* Browser only */ }
  async getPendingOperations(): Promise<QueuedOperation[]> { return []; }
  async updateOperationStatus(): Promise<void> { /* Browser only */ }
  async removeOperation(): Promise<void> { /* Browser only */ }
  async incrementAttempts(): Promise<void> { /* Browser only */ }
  async saveNotification(): Promise<void> { /* Browser only */ }
  async getNotifications(): Promise<CachedNotification[]> { return []; }
  async markNotificationRead(): Promise<void> { /* Browser only */ }
  async saveUser(): Promise<void> { /* Browser only */ }
  async getUser(): Promise<CachedUser | undefined> { return undefined; }
  async clearAll(): Promise<void> { /* Browser only */ }
  async clearOldEntries(): Promise<void> { /* Browser only */ }
}

export const localDb = new IndexedDBManagerStub();
