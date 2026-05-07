// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Monitoring & Logging
// ============================================================================
// Centralized logging, error tracking, API call monitoring, audit logging,
// and performance tracking. Designed for both client-side and server-side use.
// In production, these would integrate with external services (Sentry, DataDog, etc.)
// ============================================================================

// ============================================================================
// Log Levels
// ============================================================================

const enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
  FATAL = 4,
}

/** Current minimum log level based on environment */
const currentLogLevel: LogLevel = typeof process !== 'undefined' && process.env.NODE_ENV === 'production'
  ? LogLevel.WARN
  : LogLevel.DEBUG;

// ============================================================================
// Log Entry Structure
// ============================================================================

interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
  context?: Record<string, unknown>;
  source?: string;
}

/** In-memory log buffer (limited size) for debugging */
const logBuffer: LogEntry[] = [];
const MAX_LOG_BUFFER_SIZE = 100;

/**
 * Format and store a log entry.
 * In production, this would send logs to an external service.
 */
function createLogEntry(level: string, message: string, context?: Record<string, unknown>, source?: string): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    context,
    source,
  };

  // Add to buffer
  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOG_BUFFER_SIZE) {
    logBuffer.shift();
  }

  return entry;
}

/**
 * Get the recent log entries from the buffer.
 * Useful for debugging and support.
 */
export function getRecentLogs(count: number = 50): LogEntry[] {
  return logBuffer.slice(-count);
}

// ============================================================================
// Error Logging
// ============================================================================

/**
 * Log an error with optional context information.
 * In production, this would send the error to an error tracking service
 * (e.g., Sentry, Bugsnag, etc.)
 * @param error - The Error object to log
 * @param context - Optional additional context about the error
 */
export function logError(error: Error, context?: Record<string, unknown>): void {
  const entry = createLogEntry('ERROR', error.message, {
    ...context,
    errorName: error.name,
    errorStack: error.stack,
  });

  if (currentLogLevel <= LogLevel.ERROR) {
    console.error(`[عافيتك ERROR] ${entry.timestamp}`, error.message, context ?? '');
  }

  // In production, send to error tracking service
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    sendToErrorService(entry).catch(() => {
      // Silently fail — don't create infinite error loops
    });
  }
}

// ============================================================================
// API Call Logging
// ============================================================================

/**
 * Log an API call with method, path, status, and duration.
 * Used for monitoring API performance and debugging issues.
 * @param method - HTTP method (GET, POST, etc.)
 * @param path - API endpoint path
 * @param status - HTTP response status code
 * @param duration - Request duration in milliseconds
 */
export function logApiCall(method: string, path: string, status: number, duration: number): void {
  const level = status >= 500 ? 'ERROR' : status >= 400 ? 'WARN' : 'INFO';

  const entry = createLogEntry(level, `API ${method} ${path}`, {
    method,
    path,
    status,
    duration,
    slow: duration > 3000,
  });

  if (currentLogLevel <= LogLevel.INFO) {
    const emoji = status >= 500 ? '🔴' : status >= 400 ? '🟡' : '🟢';
    console.info(`[عافيتك API] ${emoji} ${method} ${path} → ${status} (${duration}ms)`);
  }

  // Log slow API calls as warnings
  if (duration > 3000) {
    if (currentLogLevel <= LogLevel.WARN) {
      console.warn(`[عافيتك SLOW API] ${method} ${path} took ${duration}ms`);
    }
  }
}

// ============================================================================
// Notification Logging
// ============================================================================

/**
 * Log a notification sent to a user.
 * @param userId - The user ID the notification was sent to
 * @param type - The notification type
 * @param success - Whether the notification was sent successfully
 */
export function logNotificationSent(userId: string, type: string, success: boolean): void {
  const level = success ? 'INFO' : 'WARN';

  const entry = createLogEntry(level, `Notification ${success ? 'sent' : 'failed'}: ${type}`, {
    userId,
    type,
    success,
  });

  if (currentLogLevel <= LogLevel.INFO) {
    const emoji = success ? '✅' : '❌';
    console.info(`[عافيتك NOTIFY] ${emoji} ${type} → user:${userId.substring(0, 8)}...`);
  }
}

// ============================================================================
// Audit Logging
// ============================================================================

/**
 * Create an audit log entry for tracking user actions.
 * Audit logs are important for security, compliance, and debugging.
 * @param userId - The ID of the user performing the action
 * @param action - The action being performed (e.g., 'login', 'create_order')
 * @param details - Additional details about the action
 */
export function createAuditLog(userId: string, action: string, details: Record<string, unknown>): void {
  const entry = createLogEntry('INFO', `Audit: ${action}`, {
    userId,
    action,
    details,
  });

  if (currentLogLevel <= LogLevel.INFO) {
    console.info(`[عافيتك AUDIT] ${action} by user:${userId.substring(0, 8)}...`, details);
  }

  // In production, persist audit logs to database or external service
  if (typeof process !== 'undefined' && process.env.NODE_ENV === 'production') {
    persistAuditLog(entry).catch(() => {
      // Silently fail — audit logging should not block operations
    });
  }
}

// ============================================================================
// Performance Monitoring
// ============================================================================

/**
 * Track the performance of an async operation.
 * Measures execution time and logs the result.
 * @param name - The name of the operation being tracked
 * @param fn - The async function to execute and measure
 */
export async function trackPerformance<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const startTime = performance.now();

  try {
    const result = await fn();
    const duration = performance.now() - startTime;

    createLogEntry('INFO', `Performance: ${name}`, {
      name,
      duration: Math.round(duration),
      success: true,
    });

    if (currentLogLevel <= LogLevel.INFO) {
      console.info(`[عافيتك PERF] ⚡ ${name}: ${Math.round(duration)}ms`);
    }

    return result;
  } catch (error) {
    const duration = performance.now() - startTime;

    createLogEntry('ERROR', `Performance: ${name} (failed)`, {
      name,
      duration: Math.round(duration),
      success: false,
      error: error instanceof Error ? error.message : String(error),
    });

    if (currentLogLevel <= LogLevel.ERROR) {
      console.error(`[عافيتك PERF] ❌ ${name}: ${Math.round(duration)}ms (failed)`);
    }

    throw error;
  }
}

// ============================================================================
// Production Integrations (Stubs)
// ============================================================================

/**
 * Send an error to an external error tracking service.
 * In production, this would integrate with Sentry, Bugsnag, etc.
 * @param entry - The log entry to send
 */
async function sendToErrorService(entry: LogEntry): Promise<void> {
  // Placeholder for production error service integration
  // Example: Sentry.captureException(new Error(entry.message), { extra: entry.context });
  void entry;
}

/**
 * Persist an audit log entry to long-term storage.
 * In production, this would write to a database or log aggregation service.
 * @param entry - The audit log entry to persist
 */
async function persistAuditLog(entry: LogEntry): Promise<void> {
  // Placeholder for production audit log persistence
  // Example: await db.auditLog.create({ data: { ... } });
  void entry;
}
