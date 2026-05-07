// ============================================================================
// Offline Queue Processor - Stub for SSR/BUILD compatibility
// The real implementation is loaded at runtime in the browser only.
// ============================================================================

import { localDb, type QueuedOperation } from './indexeddb';

const DEFAULT_PROCESSING_INTERVAL = 30000;
const MAX_CONCURRENT_OPERATIONS = 3;

interface QueueStatus {
  pending: number;
  processing: number;
  failed: number;
}

class OfflineQueueProcessorStub {
  private isProcessing: boolean = false;

  start(_interval: number = DEFAULT_PROCESSING_INTERVAL): void {
    this.isProcessing = true;
  }

  stop(): void {
    this.isProcessing = false;
  }

  async processQueue(): Promise<void> { /* Browser only */ }
  async retryFailed(): Promise<void> { /* Browser only */ }

  async enqueue(_operation: Omit<QueuedOperation, 'id' | 'attempts' | 'createdAt' | 'status'>): Promise<void> {
    /* Browser only */
  }

  getStatus(): QueueStatus {
    return { pending: 0, processing: 0, failed: 0 };
  }
}

export const offlineQueue = new OfflineQueueProcessorStub();
