// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Notification Logger
// ============================================================================
// Production-safe diagnostic logger for the notification subsystem.
// Tracks lifecycle, WebSocket, Service Worker, audio, permission, and
// hydration events in a circular buffer. Console output is suppressed
// in production unless debug mode is enabled via localStorage key
// 'aafiatak-debug'. Logs can be exported as JSON for the debug page.
// ============================================================================

// ── Types ──────────────────────────────────────────────────────────

/** Supported log levels, ordered by severity */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Event categories tracked by the logger */
export type LogCategory =
  | 'notification'
  | 'websocket'
  | 'service-worker'
  | 'audio'
  | 'permission'
  | 'hydration';

/** A single log entry stored in the circular buffer */
export interface LogEntry {
  /** Unique sequential ID for this entry */
  id: number;
  /** ISO-8601 timestamp */
  timestamp: string;
  /** Severity level */
  level: LogLevel;
  /** Event category */
  category: LogCategory;
  /** Human-readable message */
  message: string;
  /** Optional structured data attached to the event */
  data?: Record<string, unknown>;
}

/** Notification lifecycle event types */
export type NotificationLifecycleEvent =
  | 'received'
  | 'displayed'
  | 'clicked'
  | 'dismissed'
  | 'failed'
  | 'sound-played'
  | 'sound-skipped'
  | 'voice-started'
  | 'voice-completed'
  | 'voice-failed';

/** WebSocket event types */
export type WebSocketEventType =
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'reconnected'
  | 'message-received'
  | 'message-sent'
  | 'error'
  | 'join-room'
  | 'leave-room';

/** Service Worker event types */
export type ServiceWorkerEventType =
  | 'registered'
  | 'updated'
  | 'push-received'
  | 'notification-click'
  | 'notification-close'
  | 'install'
  | 'activate'
  | 'fetch'
  | 'error';

/** Audio / sound event types */
export type AudioEventType =
  | 'play'
  | 'play-blocked'
  | 'play-fallback'
  | 'play-pending'
  | 'volume-change'
  | 'enabled-change'
  | 'preload'
  | 'preload-error'
  | 'debounced'
  | 'destroy';

/** Permission event types */
export type PermissionEventType =
  | 'request'
  | 'granted'
  | 'denied'
  | 'dismissed'
  | 'status-check';

/** Hydration event types */
export type HydrationEventType =
  | 'start'
  | 'complete'
  | 'mismatch'
  | 'error'
  | 'retry'
  | 'fallback';

// ── Constants ─────────────────────────────────────────────────────

/** localStorage key used to toggle debug mode */
const DEBUG_KEY = 'aafiatak-debug';

/** Maximum number of entries kept in the circular buffer */
const MAX_BUFFER_SIZE = 100;

/** Numeric severity ranking for level comparison */
const LEVEL_SEVERITY: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

// ── Helper: detect production environment ──────────────────────────

function isProduction(): boolean {
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'production') {
    return true;
  }
  return false;
}

// ── Helper: read debug flag from localStorage (client-only) ────────

function readDebugFlag(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(DEBUG_KEY) === 'true';
  } catch {
    // localStorage may be blocked (private browsing, quota, etc.)
    return false;
  }
}

// ============================================================================
// NotificationLogger Class
// ============================================================================

class NotificationLogger {
  /** Circular buffer of log entries */
  private buffer: LogEntry[] = [];

  /** Auto-incrementing entry ID */
  private nextId = 1;

  /** Cached debug-mode flag — re-evaluated lazily */
  private debugMode: boolean | null = null;

  /** Whether the logger has been initialised */
  private initialized = false;

  /** Minimum level that will be emitted to console when debug mode is on */
  private consoleMinLevel: LogLevel = 'debug';

  // ── Initialisation ────────────────────────────────────────────

  /** Initialise the logger. Safe to call multiple times. */
  init(): void {
    if (this.initialized) return;
    if (typeof window === 'undefined') return;

    this.initialized = true;
    this.debugMode = readDebugFlag();

    // Listen for storage changes so debug mode can be toggled from
    // another tab or the DevTools console without a page reload.
    try {
      window.addEventListener('storage', (event) => {
        if (event.key === DEBUG_KEY) {
          this.debugMode = event.newValue === 'true';
        }
      });
    } catch {
      // Ignore — SSR or restricted environment
    }
  }

  // ── Debug Mode ────────────────────────────────────────────────

  /** Check whether debug mode is currently active */
  isDebugMode(): boolean {
    if (this.debugMode === null) {
      this.debugMode = readDebugFlag();
    }
    return this.debugMode;
  }

  /** Enable debug mode and persist the flag to localStorage */
  enableDebug(): void {
    this.debugMode = true;
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem(DEBUG_KEY, 'true');
      }
    } catch {
      // Ignore storage errors
    }
  }

  /** Disable debug mode and remove the flag from localStorage */
  disableDebug(): void {
    this.debugMode = false;
    try {
      if (typeof window !== 'undefined') {
        localStorage.removeItem(DEBUG_KEY);
      }
    } catch {
      // Ignore storage errors
    }
  }

  /** Set the minimum log level that is printed to the console in debug mode */
  setConsoleMinLevel(level: LogLevel): void {
    this.consoleMinLevel = level;
  }

  // ── Core Logging ──────────────────────────────────────────────

  /**
   * Log an event.
   *
   * In production the entry is stored in the circular buffer but is **not**
   * printed to the console unless debug mode is enabled.
   */
  private log(
    level: LogLevel,
    category: LogCategory,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    // Always push to the circular buffer (for diagnostics / export)
    const entry: LogEntry = {
      id: this.nextId++,
      timestamp: new Date().toISOString(),
      level,
      category,
      message,
      data,
    };

    this.pushEntry(entry);

    // Emit to console only when appropriate
    if (this.shouldPrint(level)) {
      this.printEntry(entry);
    }
  }

  /** Push an entry into the circular buffer, evicting the oldest if full */
  private pushEntry(entry: LogEntry): void {
    this.buffer.push(entry);
    if (this.buffer.length > MAX_BUFFER_SIZE) {
      this.buffer.shift();
    }
  }

  /** Determine whether a given level should be printed to the console */
  private shouldPrint(level: LogLevel): boolean {
    // In development, always print warn and error
    if (!isProduction()) {
      return LEVEL_SEVERITY[level] >= LEVEL_SEVERITY['info'];
    }
    // In production, only print when debug mode is active and the
    // level meets the minimum console threshold
    return (
      this.isDebugMode() &&
      LEVEL_SEVERITY[level] >= LEVEL_SEVERITY[this.consoleMinLevel]
    );
  }

  /** Print a single entry to the browser console */
  private printEntry(entry: LogEntry): void {
    const prefix = `[AafiatakLog][${entry.level.toUpperCase()}][${entry.category}]`;
    const payload = entry.data ? entry.data : '';

    switch (entry.level) {
      case 'error':
        console.error(prefix, entry.message, payload);
        break;
      case 'warn':
        console.warn(prefix, entry.message, payload);
        break;
      case 'debug':
        console.debug(prefix, entry.message, payload);
        break;
      default:
        console.info(prefix, entry.message, payload);
        break;
    }
  }

  // ── Public Level Methods ──────────────────────────────────────

  /** Log at debug level */
  debug(category: LogCategory, message: string, data?: Record<string, unknown>): void {
    this.log('debug', category, message, data);
  }

  /** Log at info level */
  info(category: LogCategory, message: string, data?: Record<string, unknown>): void {
    this.log('info', category, message, data);
  }

  /** Log at warn level */
  warn(category: LogCategory, message: string, data?: Record<string, unknown>): void {
    this.log('warn', category, message, data);
  }

  /** Log at error level */
  error(category: LogCategory, message: string, data?: Record<string, unknown>): void {
    this.log('error', category, message, data);
  }

  // ── Notification Lifecycle ────────────────────────────────────

  /** Track a notification lifecycle event */
  logNotification(
    event: NotificationLifecycleEvent,
    notificationId: string,
    details?: Record<string, unknown>,
  ): void {
    const level: LogLevel = event === 'failed' || event === 'voice-failed' ? 'error' : 'info';
    this.log(level, 'notification', `Notification ${event}`, {
      notificationId,
      event,
      ...details,
    });
  }

  // ── WebSocket Events ──────────────────────────────────────────

  /** Track a WebSocket event */
  logWebSocket(
    event: WebSocketEventType,
    details?: Record<string, unknown>,
  ): void {
    const level: LogLevel = event === 'error' ? 'error' : 'info';
    this.log(level, 'websocket', `WebSocket ${event}`, {
      event,
      ...details,
    });
  }

  // ── Service Worker Events ─────────────────────────────────────

  /** Track a Service Worker event */
  logServiceWorker(
    event: ServiceWorkerEventType,
    details?: Record<string, unknown>,
  ): void {
    const level: LogLevel = event === 'error' ? 'error' : 'info';
    this.log(level, 'service-worker', `Service Worker ${event}`, {
      event,
      ...details,
    });
  }

  // ── Audio / Sound Events ──────────────────────────────────────

  /** Track an audio/sound event */
  logAudio(
    event: AudioEventType,
    details?: Record<string, unknown>,
  ): void {
    const level: LogLevel =
      event === 'play-blocked' || event === 'preload-error' || event === 'destroy'
        ? 'warn'
        : 'debug';
    this.log(level, 'audio', `Audio ${event}`, {
      event,
      ...details,
    });
  }

  // ── Permission Events ─────────────────────────────────────────

  /** Track a permission event */
  logPermission(
    event: PermissionEventType,
    details?: Record<string, unknown>,
  ): void {
    const level: LogLevel =
      event === 'denied' ? 'warn' : event === 'request' ? 'info' : 'debug';
    this.log(level, 'permission', `Permission ${event}`, {
      event,
      ...details,
    });
  }

  // ── Hydration Events ──────────────────────────────────────────

  /** Track a hydration event */
  logHydration(
    event: HydrationEventType,
    details?: Record<string, unknown>,
  ): void {
    const level: LogLevel =
      event === 'error' ? 'error' : event === 'mismatch' ? 'warn' : 'info';
    this.log(level, 'hydration', `Hydration ${event}`, {
      event,
      ...details,
    });
  }

  // ── Buffer Access & Export ────────────────────────────────────

  /** Get a shallow copy of all entries currently in the buffer */
  getEntries(): LogEntry[] {
    return [...this.buffer];
  }

  /** Get entries filtered by category */
  getEntriesByCategory(category: LogCategory): LogEntry[] {
    return this.buffer.filter((e) => e.category === category);
  }

  /** Get entries filtered by minimum severity level */
  getEntriesByLevel(minLevel: LogLevel): LogEntry[] {
    const threshold = LEVEL_SEVERITY[minLevel];
    return this.buffer.filter((e) => LEVEL_SEVERITY[e.level] >= threshold);
  }

  /** Export all buffered entries as a JSON string */
  exportAsJSON(): string {
    return JSON.stringify(
      {
        exportedAt: new Date().toISOString(),
        debugMode: this.isDebugMode(),
        entryCount: this.buffer.length,
        entries: this.buffer,
      },
      null,
      2,
    );
  }

  /** Export all buffered entries as a downloadable JSON object */
  exportAsObject(): {
    exportedAt: string;
    debugMode: boolean;
    entryCount: number;
    entries: LogEntry[];
  } {
    return {
      exportedAt: new Date().toISOString(),
      debugMode: this.isDebugMode(),
      entryCount: this.buffer.length,
      entries: [...this.buffer],
    };
  }

  /** Clear all entries from the circular buffer */
  clear(): void {
    this.buffer = [];
  }

  /** Get the current number of entries in the buffer */
  getSize(): number {
    return this.buffer.length;
  }

  // ── Cleanup ───────────────────────────────────────────────────

  /** Reset the logger to its initial state */
  destroy(): void {
    this.buffer = [];
    this.nextId = 1;
    this.debugMode = null;
    this.initialized = false;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/** Global NotificationLogger instance */
export const notificationLogger = new NotificationLogger();
export default notificationLogger;
