// ============================================================================
// Sync Manager - Stub for SSR/BUILD compatibility
// The real implementation is loaded at runtime in the browser only.
// ============================================================================

import { localDb } from './indexeddb';
import { offlineQueue } from './offline-queue';

interface SyncStatus {
  isSyncing: boolean;
  lastSyncAt: Date;
  pendingChanges: number;
}

class SyncManagerStub {
  private isSyncing: boolean = false;
  private lastSyncAt: number = 0;

  async fullSync(): Promise<void> { /* Browser only */ }
  async pushChanges(): Promise<void> { /* Browser only */ }

  getStatus(): SyncStatus {
    return {
      isSyncing: this.isSyncing,
      lastSyncAt: new Date(this.lastSyncAt),
      pendingChanges: 0,
    };
  }
}

export const syncManager = new SyncManagerStub();
