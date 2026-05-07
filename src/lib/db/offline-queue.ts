import { localDb, type QueuedOperation } from './indexeddb';

// ============================================================================
// Offline Queue Processor
// ============================================================================

const DEFAULT_PROCESSING_INTERVAL = 30000; // 30 seconds
const MAX_CONCURRENT_OPERATIONS = 3;

interface QueueStatus {
  pending: number;
  processing: number;
  failed: number;
}

class OfflineQueueProcessor {
  private isProcessing = false;
  private processingInterval: ReturnType<typeof setInterval> | null = null;
  private currentlyProcessing = 0;

  /**
   * Start the queue processor at a given interval.
   */
  start(interval: number = DEFAULT_PROCESSING_INTERVAL): void {
    if (this.processingInterval) {
      return; // Already started
    }

    // Process immediately on start
    void this.processQueue();

    this.processingInterval = setInterval(() => {
      void this.processQueue();
    }, interval);
  }

  /**
   * Stop the queue processor.
   */
  stop(): void {
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }
  }

  /**
   * Process all pending operations in the queue.
   */
  async processQueue(): Promise<void> {
    if (this.isProcessing) return;

    // Don't process if offline
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    this.isProcessing = true;

    try {
      await localDb.init();
      const pendingOps = await localDb.getPendingOperations();

      for (const operation of pendingOps) {
        if (this.currentlyProcessing >= MAX_CONCURRENT_OPERATIONS) break;

        // Skip if max attempts reached
        if (operation.attempts >= operation.maxAttempts) {
          await localDb.updateOperationStatus(operation.id, 'failed');
          continue;
        }

        this.currentlyProcessing++;
        void this.processOperation(operation).finally(() => {
          this.currentlyProcessing--;
        });
      }
    } catch (error) {
      console.error('[OfflineQueue] Error processing queue:', error);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single operation from the queue.
   */
  private async processOperation(operation: QueuedOperation): Promise<void> {
    await localDb.updateOperationStatus(operation.id, 'processing');

    try {
      const response = await fetch(operation.endpoint, {
        method: operation.method,
        headers: {
          'Content-Type': 'application/json',
          ...operation.headers,
        },
        body: operation.method !== 'GET' && operation.method !== 'HEAD'
          ? JSON.stringify(operation.data)
          : undefined,
      });

      if (!response.ok) {
        const errorBody = await response.text().catch(() => 'Unknown error');
        throw new Error(`HTTP ${response.status}: ${errorBody}`);
      }

      // Mark as completed
      await localDb.updateOperationStatus(operation.id, 'completed');

      // Remove completed operation after a short delay (to allow status checks)
      setTimeout(() => {
        void localDb.removeOperation(operation.id);
      }, 5000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      console.warn(
        `[OfflineQueue] Operation ${operation.id} failed (attempt ${operation.attempts + 1}/${operation.maxAttempts}):`,
        errorMessage
      );

      await localDb.incrementAttempts(operation.id);

      // If max attempts exceeded, mark as failed permanently
      if (operation.attempts + 1 >= operation.maxAttempts) {
        await localDb.updateOperationStatus(operation.id, 'failed');
      } else {
        // Reset to pending for retry
        await localDb.updateOperationStatus(operation.id, 'pending');
      }
    }
  }

  /**
   * Add an operation to the queue.
   */
  async enqueue(
    operation: Omit<QueuedOperation, 'id' | 'attempts' | 'createdAt' | 'lastAttempt' | 'status'>
  ): Promise<void> {
    await localDb.init();

    const queuedOp: QueuedOperation = {
      ...operation,
      id: crypto.randomUUID(),
      attempts: 0,
      createdAt: Date.now(),
      lastAttempt: 0,
      status: 'pending',
    };

    await localDb.addToQueue(queuedOp);

    // Try to process immediately if online
    if (typeof navigator !== 'undefined' && navigator.onLine) {
      void this.processQueue();
    }
  }

  /**
   * Retry all failed operations.
   */
  async retryFailed(): Promise<void> {
    await localDb.init();

    // Reset failed operations to pending
    const pendingOps = await localDb.getPendingOperations();
    const failedOps = pendingOps.filter((op) => op.status === 'failed');

    for (const op of failedOps) {
      // Reset attempts for a fresh retry
      const db = await localDb.getQueueCount();
      void db; // just access to ensure DB is initialized

      await localDb.updateOperationStatus(op.id, 'pending');
    }

    // Process the queue
    await this.processQueue();
  }

  /**
   * Get current queue status.
   */
  async getStatus(): Promise<QueueStatus> {
    try {
      await localDb.init();
      const counts = await localDb.getQueueCount();
      return {
        pending: counts.pending,
        processing: counts.processing,
        failed: counts.failed,
      };
    } catch {
      return { pending: 0, processing: 0, failed: 0 };
    }
  }
}

export const offlineQueue = new OfflineQueueProcessor();
