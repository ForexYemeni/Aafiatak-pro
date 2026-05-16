// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Socket.IO Client Service v2
// ============================================================================
// Improved Socket.IO client utility for real-time communication.
// Connects via Caddy gateway using XTransformPort=3003.
//
// IMPROVEMENTS over socket.ts:
//  1. Infinite reconnection with exponential backoff (1s → 30s cap)
//  2. Auto-reconnect on browser `online` event; pause on `offline`
//  3. Connection health monitoring (heartbeat response timeout → reconnect)
//  4. Connection state persisted across page navigations (sessionStorage)
//  5. Duplicate event-listener prevention via tracked registrations
//  6. Proper cleanup on disconnect (timers, browser events, queued events)
//  7. Richer connection state change events for UI feedback
//  8. Offline event queue – events emitted while disconnected are sent on
//     reconnect
//  9. Structured logging via notification-logger
//
// 100 % backward-compatible with the original SocketService API.
// ============================================================================

import { io, Socket } from 'socket.io-client';
import type {
  UserRole,
  MessageType,
  ServiceRequestStatus,
  EmergencyStatus,
  EmergencyType,
  NotificationPriority,
  NotificationType,
} from '@/types';
import { notificationLogger } from '@/lib/notifications/notification-logger';

// ============================================================================
// CLIENT-SIDE EVENT PAYLOAD TYPES  (identical to socket.ts)
// ============================================================================

/** Geographic coordinates */
export interface ClientLocation {
  lat: number;
  lng: number;
  updatedAt?: string;
}

/** Quick reply option */
export interface ClientQuickReply {
  id: string;
  labelAr: string;
  labelEn: string;
  value: string;
}

/** Chat message received from server */
export interface SocketMessage {
  id: string;
  chatId: string;
  senderId: string;
  senderRole: UserRole;
  senderName: string;
  content: string;
  type: MessageType;
  imageUrl: string | null;
  readBy: string[];
  deliveredTo: string[];
  replyTo: string | null;
  quickReplies: ClientQuickReply[] | null;
  isDeleted: boolean;
  createdAt: string;
}

/** New message event payload */
export interface NewMessageEvent {
  message: SocketMessage;
  chatId: string;
}

/** Typing indicator event */
export interface TypingEvent {
  chatId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

/** Read receipt event */
export interface ReadReceiptEvent {
  chatId: string;
  messageIds: string[];
  readBy: string;
}

/** Message delivered event */
export interface MessageDeliveredEvent {
  chatId: string;
  messageIds: string[];
  deliveredTo: string;
}

/** User joined chat event */
export interface UserJoinedChatEvent {
  chatId: string;
  userId: string;
  role: UserRole;
  joinedAt: string;
}

/** User left chat event */
export interface UserLeftChatEvent {
  chatId: string;
  userId: string;
  leftAt: string;
}

/** Order created event */
export interface OrderCreatedEvent {
  requestId: string;
  serviceId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  beneficiaryAddress: string;
  beneficiaryLocation: ClientLocation;
  isEmergency: boolean;
  scheduledAt: string | null;
  notes: string | null;
  createdAt: string;
}

/** Order assigned event */
export interface OrderAssignedEvent {
  requestId: string;
  nurseId: string;
  nurseName: string;
  assignedBy: string;
  assignedByRole: UserRole;
  estimatedArrivalMinutes: number | null;
  assignedAt: string;
}

/** Order status changed event */
export interface OrderStatusChangedEvent {
  requestId: string;
  status: ServiceRequestStatus;
  nurseId: string | null;
  updatedAt: string;
  notes: string | null;
}

/** Order cancelled event */
export interface OrderCancelledEvent {
  requestId: string;
  cancelledBy: string;
  cancelledByRole: UserRole;
  cancelReason: string | null;
  cancelledAt: string;
}

/** Emergency created event */
export interface EmergencyCreatedEvent {
  emergencyRequestId: string;
  type: EmergencyType;
  description: string;
  beneficiaryId: string;
  beneficiaryName: string;
  location: ClientLocation;
  address: string;
  priority: NotificationPriority;
  createdAt: string;
}

/** Emergency dispatched event */
export interface EmergencyDispatchedEvent {
  emergencyRequestId: string;
  nurseId: string;
  nurseName: string;
  estimatedArrivalMinutes: number | null;
  dispatchedAt: string;
}

/** Emergency resolved event */
export interface EmergencyResolvedEvent {
  emergencyRequestId: string;
  nurseId: string;
  resolvedAt: string;
  notes: string | null;
}

/** Emergency cancelled event */
export interface EmergencyCancelledEvent {
  emergencyRequestId: string;
  cancelledBy: string;
  cancelReason: string | null;
  cancelledAt: string;
}

/** Emergency update event */
export interface EmergencyUpdateEvent {
  emergencyRequestId: string;
  status: EmergencyStatus;
  nurseId: string | null;
  updatedAt: string;
}

/** Emergency alert event */
export interface EmergencyAlertEvent {
  emergencyRequestId: string;
  type: EmergencyType;
  location: ClientLocation;
  beneficiaryId: string;
  description: string;
}

/** Location update event */
export interface LocationUpdateEvent {
  nurseId: string;
  location: ClientLocation;
  heading: number;
  speed: number;
  batteryLevel: number | null;
  currentRequestId: string | null;
}

/** Nurse tracking status event */
export interface NurseTrackingStatusEvent {
  nurseId: string;
  isOnline: boolean;
  isAvailable: boolean;
  lastSeen: string | null;
}

/** Notification event */
export interface NotificationEvent {
  id: string;
  userId: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  type: NotificationType;
  priority: NotificationPriority;
  data: Record<string, string>;
  read: boolean;
  actionUrl: string | null;
  createdAt: string;
}

/** Notification read confirmed event */
export interface NotificationReadConfirmedEvent {
  notificationIds: string[];
  readBy: string;
  readAt: string;
}

/** User online event */
export interface UserOnlineEvent {
  userId: string;
  role: UserRole;
  name: string;
}

/** User offline event */
export interface UserOfflineEvent {
  userId: string;
  role: UserRole;
  name: string;
  lastSeen: string;
}

/** Nurse availability changed event */
export interface NurseAvailabilityChangedEvent {
  nurseId: string;
  isAvailable: boolean;
  isOnline: boolean;
}

/** User status response */
export interface UserStatusEvent {
  userId: string;
  isOnline: boolean;
  isAvailable: boolean | null;
  lastSeen: string | null;
}

/** Online nurses list response */
export interface OnlineNursesListEvent {
  nurses: Array<{
    nurseId: string;
    isAvailable: boolean;
    location: ClientLocation | null;
  }>;
  count: number;
}

/** Connection confirmed event */
export interface ConnectionConfirmedEvent {
  userId: string;
  role: UserRole;
  socketId: string;
  serverTime: string;
}

/** Error event from server */
export interface SocketErrorEvent {
  event: string;
  message: string;
  code: string;
}

/** Order update event (general) */
export type OrderUpdateEvent = OrderStatusChangedEvent;

// ============================================================================
// v2 ADDITIONS — extended types
// ============================================================================

/** Connection state (same values as v1, plus extra metadata in listeners) */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

/** Detailed state change payload emitted to UI listeners */
export interface ConnectionStateChangeEvent {
  state: ConnectionState;
  previousState: ConnectionState;
  /** Number of consecutive reconnection attempts (0 when connected) */
  reconnectAttempts: number;
  /** True when the browser reports offline */
  isNetworkOffline: boolean;
  /** Milliseconds until the next reconnection attempt (null when not reconnecting) */
  nextRetryIn: number | null;
  /** Number of queued events waiting to be sent */
  queuedEventCount: number;
}

/** Internal representation of a queued (offline) event */
interface QueuedEvent {
  event: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  args: any[];
  queuedAt: number;
}

/** Key used for tracking duplicate listener registrations */
interface ListenerKey {
  event: string;
  // We store a weak reference to the original callback for identity checks
  callback: (...args: unknown[]) => void;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SOCKET_PORT = 3003;
const HEARTBEAT_INTERVAL_MS = 25_000;
const HEARTBEAT_TIMEOUT_MS = 60_000;
const BACKOFF_INITIAL_MS = 1_000;
const BACKOFF_MAX_MS = 30_000;
const SESSION_STORAGE_KEY = 'aafiatak_socket_state';

// ============================================================================
// SOCKET SERVICE CLASS v2
// ============================================================================

class SocketService {
  // ---- Core state ----
  private socket: Socket | null = null;
  private token: string | null = null;
  private _connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;

  // ---- v2: Infinite reconnection via manual backoff ----
  // We disable socket.io's built-in reconnect so we can control it ourselves.
  private manualReconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private isIntentionalDisconnect = false;

  // ---- v2: Network online/offline detection ----
  private isNetworkOffline = false;
  private boundHandleOnline: () => void;
  private boundHandleOffline: () => void;

  // ---- v2: Connection health monitoring ----
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private heartbeatTimeoutTimer: ReturnType<typeof setTimeout> | null = null;
  private lastHeartbeatResponseAt: number | null = null;

  // ---- v2: Event listener tracking (duplicate prevention) ----
  private registeredListeners: Map<string, Set<(...args: unknown[]) => void>> = new Map();

  // ---- v2: Offline event queue ----
  private eventQueue: QueuedEvent[] = [];
  private readonly MAX_QUEUE_SIZE = 200;

  // ---- v2: Connection state persistence ----
  private persistedUserId: string | null = null;

  // ---- Connection state listeners (enhanced) ----
  private connectionStateListeners: Set<(state: ConnectionState) => void> = new Set();
  private connectionStateChangeListeners: Set<(change: ConnectionStateChangeEvent) => void> = new Set();

  // ==========================================================================
  // CONSTRUCTOR
  // ==========================================================================

  constructor() {
    // Bind once so we can add/remove browser event listeners cleanly
    this.boundHandleOnline = this.handleNetworkOnline.bind(this);
    this.boundHandleOffline = this.handleNetworkOffline.bind(this);

    // Register browser network listeners
    if (typeof window !== 'undefined') {
      window.addEventListener('online', this.boundHandleOnline);
      window.addEventListener('offline', this.boundHandleOffline);

      // Restore persisted state
      this.restorePersistedState();
    }
  }

  // ==========================================================================
  // CONNECTION MANAGEMENT
  // ==========================================================================

  /** Get current connection state */
  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  /** Check if socket is connected */
  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

  /** Number of events currently queued for delivery */
  get queuedEventCount(): number {
    return this.eventQueue.length;
  }

  /** Set connection state and notify all listeners */
  private setConnectionState(newState: ConnectionState): void {
    const previousState = this._connectionState;
    if (previousState === newState) return;

    this._connectionState = newState;

    // Calculate next retry delay (for UI feedback)
    const nextRetryIn =
      newState === 'reconnecting'
        ? this.calculateBackoffDelay()
        : null;

    const changePayload: ConnectionStateChangeEvent = {
      state: newState,
      previousState,
      reconnectAttempts: this.reconnectAttempts,
      isNetworkOffline: this.isNetworkOffline,
      nextRetryIn,
      queuedEventCount: this.eventQueue.length,
    };

    // Notify simple listeners (backward compat)
    for (const listener of this.connectionStateListeners) {
      try {
        listener(newState);
      } catch (err) {
        notificationLogger.error({ err, context: 'connectionStateListener' }, 'Error in connection state listener');
      }
    }

    // Notify detailed listeners (v2)
    for (const listener of this.connectionStateChangeListeners) {
      try {
        listener(changePayload);
      } catch (err) {
        notificationLogger.error({ err, context: 'connectionStateChangeListener' }, 'Error in detailed connection state listener');
      }
    }

    // Persist across navigations
    this.persistState();
  }

  /**
   * Register a simple connection state change listener (backward compat).
   * Returns an unsubscribe function.
   */
  onConnectionStateChange(listener: (state: ConnectionState) => void): () => void {
    this.connectionStateListeners.add(listener);
    return () => {
      this.connectionStateListeners.delete(listener);
    };
  }

  /**
   * Register a detailed connection state change listener (v2).
   * Receives the full {@link ConnectionStateChangeEvent} payload.
   * Returns an unsubscribe function.
   */
  onConnectionStateChangeDetailed(listener: (change: ConnectionStateChangeEvent) => void): () => void {
    this.connectionStateChangeListeners.add(listener);
    return () => {
      this.connectionStateChangeListeners.delete(listener);
    };
  }

  // --------------------------------------------------------------------------
  // Connect / Disconnect
  // --------------------------------------------------------------------------

  /**
   * Connect to the Socket.IO server with JWT authentication.
   * Uses Caddy gateway via XTransformPort=3003.
   */
  connect(token: string): void {
    if (this.socket?.connected) {
      // Already connected with same token
      if (this.token === token) return;
      // Different token, disconnect first
      this.disconnect();
    }

    this.token = token;
    this.isIntentionalDisconnect = false;
    this.setConnectionState('connecting');

    notificationLogger.info('Connecting to Socket.IO server…');

    // IMPORTANT: Use relative path with XTransformPort for Caddy gateway
    // We disable socket.io's built-in reconnection so we can manage it
    // ourselves with infinite attempts + exponential backoff.
    this.socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: false, // We handle reconnection ourselves
      timeout: 10_000,
      auth: {
        token,
      },
    });

    this.setupEventListeners();
    this.startHealthMonitoring();
  }

  /** Disconnect from the Socket.IO server */
  disconnect(): void {
    this.isIntentionalDisconnect = true;
    this.stopManualReconnect();
    this.stopHealthMonitoring();
    this.clearRegisteredListeners();
    this.eventQueue = [];

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.token = null;
    this.reconnectAttempts = 0;
    this.setConnectionState('disconnected');
    this.clearPersistedState();

    notificationLogger.info('Disconnected from Socket.IO server');
  }

  // --------------------------------------------------------------------------
  // Internal socket event listeners
  // --------------------------------------------------------------------------

  /** Setup internal socket event listeners */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      notificationLogger.info('Socket connected');
      this.reconnectAttempts = 0;
      this.stopManualReconnect();
      this.setConnectionState('connected');

      // Flush any queued events
      this.flushEventQueue();

      // Reset heartbeat health tracking
      this.lastHeartbeatResponseAt = Date.now();
    });

    this.socket.on('disconnect', (reason: string) => {
      notificationLogger.warn({ reason }, `Socket disconnected: ${reason}`);

      if (this.isIntentionalDisconnect) {
        this.setConnectionState('disconnected');
        return;
      }

      // Server-initiated or transport disconnect — try to reconnect
      this.setConnectionState('reconnecting');
      this.scheduleManualReconnect();
    });

    this.socket.on('connect_error', (error: Error) => {
      notificationLogger.error({ errMessage: error.message }, `Connection error: ${error.message}`);
      this.reconnectAttempts++;
      this.setConnectionState('reconnecting');
      this.scheduleManualReconnect();
    });

    // Server error events
    this.socket.on('error', (data: SocketErrorEvent) => {
      notificationLogger.error(
        { code: data.code, event: data.event, message: data.message },
        `Server error (${data.code}): ${data.message} [${data.event}]`
      );
    });

    // Connection confirmation
    this.socket.on('connected', (data: ConnectionConfirmedEvent) => {
      notificationLogger.info(
        { userId: data.userId, role: data.role, socketId: data.socketId },
        `Authenticated as ${data.userId} (${data.role})`
      );
      this.persistedUserId = data.userId;
      this.persistState();
    });

    // Heartbeat response — used for health monitoring
    this.socket.on('heartbeat_ack', () => {
      this.lastHeartbeatResponseAt = Date.now();
      // Clear the timeout if we were waiting
      if (this.heartbeatTimeoutTimer) {
        clearTimeout(this.heartbeatTimeoutTimer);
        this.heartbeatTimeoutTimer = null;
      }
    });
  }

  // ==========================================================================
  // v2: INFINITE RECONNECTION WITH EXPONENTIAL BACKOFF
  // ==========================================================================

  /**
   * Calculate the delay before the next reconnection attempt using
   * exponential backoff: 1s, 2s, 4s, 8s, 16s, 30s (capped).
   */
  private calculateBackoffDelay(): number {
    // 2^attempt * initial, capped at max
    const delay = Math.min(
      BACKOFF_INITIAL_MS * Math.pow(2, this.reconnectAttempts),
      BACKOFF_MAX_MS
    );
    // Add ±20 % jitter to avoid thundering herd
    const jitter = delay * 0.2 * (Math.random() * 2 - 1);
    return Math.max(BACKOFF_INITIAL_MS, Math.round(delay + jitter));
  }

  /** Schedule a manual reconnection attempt */
  private scheduleManualReconnect(): void {
    // Don't schedule if we're intentionally disconnected or already scheduled
    if (this.isIntentionalDisconnect) return;
    if (this.manualReconnectTimer) return;

    // Don't attempt if the browser reports offline
    if (this.isNetworkOffline) {
      notificationLogger.info('Network offline — will reconnect when online');
      return;
    }

    const delay = this.calculateBackoffDelay();
    notificationLogger.info(
      { attempt: this.reconnectAttempts, delayMs: delay },
      `Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`
    );

    this.manualReconnectTimer = setTimeout(() => {
      this.manualReconnectTimer = null;
      this.attemptManualReconnect();
    }, delay);
  }

  /** Stop any pending manual reconnect timer */
  private stopManualReconnect(): void {
    if (this.manualReconnectTimer) {
      clearTimeout(this.manualReconnectTimer);
      this.manualReconnectTimer = null;
    }
  }

  /** Perform a single manual reconnection attempt */
  private attemptManualReconnect(): void {
    if (this.isIntentionalDisconnect) return;
    if (this.socket?.connected) return;

    notificationLogger.info({ attempt: this.reconnectAttempts }, `Attempting reconnection #${this.reconnectAttempts}`);

    // If the socket still exists, try to reconnect it
    if (this.socket) {
      this.socket.connect();
    } else if (this.token) {
      // Socket was destroyed — recreate
      this.connect(this.token);
    }
  }

  // ==========================================================================
  // v2: BROWSER ONLINE / OFFLINE EVENT HANDLING
  // ==========================================================================

  /** Called when the browser detects network is offline */
  private handleNetworkOffline(): void {
    this.isNetworkOffline = true;
    notificationLogger.warn('Network went offline');

    // Pause any in-progress reconnection attempts
    this.stopManualReconnect();

    if (this._connectionState !== 'disconnected') {
      this.setConnectionState('reconnecting');
    }
  }

  /** Called when the browser detects network is back online */
  private handleNetworkOnline(): void {
    this.isNetworkOffline = false;
    notificationLogger.info('Network came back online');

    // If we were connected or trying to connect, attempt reconnection immediately
    if (
      !this.isIntentionalDisconnect &&
      this.token &&
      (this._connectionState === 'reconnecting' || this._connectionState === 'disconnected')
    ) {
      // Reset backoff so we try quickly
      this.reconnectAttempts = Math.max(0, this.reconnectAttempts - 2);
      this.stopManualReconnect();
      this.attemptManualReconnect();
    }
  }

  // ==========================================================================
  // v2: CONNECTION HEALTH MONITORING
  // ==========================================================================

  /**
   * Start health monitoring:
   *  - Periodic heartbeat pings (every 25 s)
   *  - If no heartbeat_ack within 60 s → assume stale → force reconnect
   */
  private startHealthMonitoring(): void {
    this.stopHealthMonitoring();

    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat');

        // Set a timeout — if no ack within HEARTBEAT_TIMEOUT_MS, reconnect
        if (!this.heartbeatTimeoutTimer) {
          this.heartbeatTimeoutTimer = setTimeout(() => {
            notificationLogger.warn(
              { lastAckAt: this.lastHeartbeatResponseAt },
              'No heartbeat response — forcing reconnect'
            );
            this.heartbeatTimeoutTimer = null;
            this.forceReconnect();
          }, HEARTBEAT_TIMEOUT_MS);
        }
      }
    }, HEARTBEAT_INTERVAL_MS);
  }

  /** Stop health monitoring timers */
  private stopHealthMonitoring(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.heartbeatTimeoutTimer) {
      clearTimeout(this.heartbeatTimeoutTimer);
      this.heartbeatTimeoutTimer = null;
    }
    this.lastHeartbeatResponseAt = null;
  }

  /** Force a reconnection by disconnecting and reconnecting */
  private forceReconnect(): void {
    notificationLogger.info('Force-reconnecting socket…');

    if (this.socket) {
      this.socket.disconnect();
      // The disconnect handler will see isIntentionalDisconnect=false
      // and schedule a reconnect.
    }

    this.reconnectAttempts++;
    this.setConnectionState('reconnecting');
    this.scheduleManualReconnect();
  }

  // ==========================================================================
  // v2: EVENT LISTENER MANAGEMENT (DUPLICATE PREVENTION)
  // ==========================================================================

  /**
   * Register a socket event listener with duplicate prevention.
   * If the same (event, callback) pair is already registered, this is a no-op.
   * Returns an unsubscribe function.
   */
  private trackListener<T extends (...args: unknown[]) => void>(
    event: string,
    callback: T
  ): () => void {
    if (!this.registeredListeners.has(event)) {
      this.registeredListeners.set(event, new Set());
    }

    const listeners = this.registeredListeners.get(event)!;

    // Prevent duplicate registration
    if (listeners.has(callback)) {
      notificationLogger.debug({ event }, `Duplicate listener prevented for event: ${event}`);
      return () => {
        listeners.delete(callback);
        this.socket?.off(event, callback as (...args: unknown[]) => void);
      };
    }

    listeners.add(callback);
    this.socket?.on(event, callback as (...args: unknown[]) => void);

    return () => {
      listeners.delete(callback);
      this.socket?.off(event, callback as (...args: unknown[]) => void);
    };
  }

  /** Remove all tracked listeners and detach them from the socket */
  private clearRegisteredListeners(): void {
    for (const [event, callbacks] of this.registeredListeners) {
      for (const cb of callbacks) {
        this.socket?.off(event, cb);
      }
    }
    this.registeredListeners.clear();
  }

  // ==========================================================================
  // v2: OFFLINE EVENT QUEUE
  // ==========================================================================

  /**
   * Emit an event. If the socket is not connected, the event is queued
   * and will be flushed automatically upon reconnection.
   */
  private emitOrQueue(event: string, ...args: unknown[]): void {
    if (this.socket?.connected) {
      this.socket.emit(event, ...args);
    } else {
      if (this.eventQueue.length >= this.MAX_QUEUE_SIZE) {
        // Drop the oldest event to make room
        const dropped = this.eventQueue.shift();
        notificationLogger.warn(
          { droppedEvent: dropped?.event, queueSize: this.eventQueue.length },
          'Event queue full — dropping oldest event'
        );
      }
      this.eventQueue.push({ event, args, queuedAt: Date.now() });
      notificationLogger.debug(
        { event, queueSize: this.eventQueue.length },
        `Event queued (offline): ${event}`
      );
    }
  }

  /** Send all queued events now that we are reconnected */
  private flushEventQueue(): void {
    if (this.eventQueue.length === 0) return;

    const count = this.eventQueue.length;
    notificationLogger.info({ count }, `Flushing ${count} queued events`);

    // Copy and clear to avoid re-queueing if emit triggers disconnection
    const queue = this.eventQueue.splice(0);
    for (const { event, args } of queue) {
      try {
        this.socket?.emit(event, ...args);
      } catch (err) {
        notificationLogger.error(
          { err, event },
          `Failed to flush queued event: ${event}`
        );
      }
    }
  }

  // ==========================================================================
  // v2: CONNECTION STATE PERSISTENCE (sessionStorage)
  // ==========================================================================

  /** Persist minimal connection info so it survives page navigations */
  private persistState(): void {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;

    try {
      sessionStorage.setItem(
        SESSION_STORAGE_KEY,
        JSON.stringify({
          state: this._connectionState,
          token: this.token,
          userId: this.persistedUserId,
          reconnectAttempts: this.reconnectAttempts,
          queuedEventCount: this.eventQueue.length,
          updatedAt: Date.now(),
        })
      );
    } catch {
      // sessionStorage may be unavailable (private browsing, quota, etc.)
    }
  }

  /** Restore state from sessionStorage on page load */
  private restorePersistedState(): void {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;

    try {
      const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
      if (!raw) return;

      const data = JSON.parse(raw) as {
        state: ConnectionState;
        token: string | null;
        userId: string | null;
        reconnectAttempts: number;
        queuedEventCount: number;
        updatedAt: number;
      };

      // Only restore if the data is recent (< 5 min)
      if (Date.now() - data.updatedAt > 5 * 60 * 1000) {
        this.clearPersistedState();
        return;
      }

      notificationLogger.info(
        { persistedState: data.state, userId: data.userId },
        'Restoring persisted socket state'
      );

      // If we had an active token, auto-reconnect
      if (data.token && data.state !== 'disconnected') {
        // Defer to next tick so the app can initialise first
        setTimeout(() => {
          this.connect(data.token!);
        }, 0);
      }
    } catch {
      // Corrupt data — ignore
    }
  }

  /** Clear persisted state from sessionStorage */
  private clearPersistedState(): void {
    if (typeof window === 'undefined' || typeof sessionStorage === 'undefined') return;
    try {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
    } catch {
      // ignore
    }
  }

  // ==========================================================================
  // CHAT METHODS (backward compatible)
  // ==========================================================================

  /** Join a specific chat room */
  joinChat(chatId: string): void {
    this.emitOrQueue('join_chat', { chatId });
  }

  /** Leave a specific chat room */
  leaveChat(chatId: string): void {
    this.emitOrQueue('leave_chat', { chatId });
  }

  /** Send a message to a chat */
  sendMessage(
    chatId: string,
    content: string,
    type: MessageType = 'text',
    options?: {
      imageUrl?: string;
      replyTo?: string;
      quickReplies?: ClientQuickReply[];
    }
  ): void {
    this.emitOrQueue('send_message', {
      chatId,
      content,
      type,
      ...options,
    });
  }

  /** Notify others that user started typing */
  startTyping(chatId: string): void {
    this.emitOrQueue('typing_start', { chatId });
  }

  /** Notify others that user stopped typing */
  stopTyping(chatId: string): void {
    this.emitOrQueue('typing_stop', { chatId });
  }

  /** Mark messages as read */
  markMessagesRead(chatId: string, messageIds: string[]): void {
    this.emitOrQueue('message_read', { chatId, messageIds });
  }

  // ==========================================================================
  // CHAT EVENT LISTENERS (backward compatible — now with duplicate prevention)
  // ==========================================================================

  /** Listen for new messages */
  onMessage(callback: (data: NewMessageEvent) => void): () => void {
    return this.trackListener('new_message', callback as (...args: unknown[]) => void);
  }

  /** Listen for typing indicators */
  onTyping(callback: (data: TypingEvent) => void): () => void {
    return this.trackListener('typing', callback as (...args: unknown[]) => void);
  }

  /** Listen for read receipts */
  onReadReceipt(callback: (data: ReadReceiptEvent) => void): () => void {
    return this.trackListener('read_receipt', callback as (...args: unknown[]) => void);
  }

  /** Listen for message delivery confirmations */
  onMessageDelivered(callback: (data: MessageDeliveredEvent) => void): () => void {
    return this.trackListener('message_delivered', callback as (...args: unknown[]) => void);
  }

  /** Listen for user joining a chat */
  onUserJoinedChat(callback: (data: UserJoinedChatEvent) => void): () => void {
    return this.trackListener('user_joined_chat', callback as (...args: unknown[]) => void);
  }

  /** Listen for user leaving a chat */
  onUserLeftChat(callback: (data: UserLeftChatEvent) => void): () => void {
    return this.trackListener('user_left_chat', callback as (...args: unknown[]) => void);
  }

  // ==========================================================================
  // ORDER METHODS (backward compatible)
  // ==========================================================================

  /** Emit order created event */
  emitOrderCreated(data: OrderCreatedEvent): void {
    this.emitOrQueue('order_created', data);
  }

  /** Emit order assigned event */
  emitOrderAssigned(data: OrderAssignedEvent): void {
    this.emitOrQueue('order_assigned', data);
  }

  /** Emit order status changed event */
  emitOrderStatusChanged(data: OrderStatusChangedEvent): void {
    this.emitOrQueue('order_status_changed', data);
  }

  /** Emit order cancelled event */
  emitOrderCancelled(data: OrderCancelledEvent): void {
    this.emitOrQueue('order_cancelled', data);
  }

  // ==========================================================================
  // ORDER EVENT LISTENERS (backward compatible — now with duplicate prevention)
  // ==========================================================================

  /** Listen for order created events */
  onOrderCreated(callback: (data: OrderCreatedEvent) => void): () => void {
    return this.trackListener('order_created', callback as (...args: unknown[]) => void);
  }

  /** Listen for order assigned events */
  onOrderAssigned(callback: (data: OrderAssignedEvent) => void): () => void {
    return this.trackListener('order_assigned', callback as (...args: unknown[]) => void);
  }

  /** Listen for order status changed events */
  onOrderStatusChanged(callback: (data: OrderStatusChangedEvent) => void): () => void {
    return this.trackListener('order_status_changed', callback as (...args: unknown[]) => void);
  }

  /** Listen for order update events (general) */
  onOrderUpdate(callback: (data: OrderUpdateEvent) => void): () => void {
    return this.trackListener('order_update', callback as (...args: unknown[]) => void);
  }

  /** Listen for order cancelled events */
  onOrderCancelled(callback: (data: OrderCancelledEvent) => void): () => void {
    return this.trackListener('order_cancelled', callback as (...args: unknown[]) => void);
  }

  // ==========================================================================
  // EMERGENCY METHODS (backward compatible)
  // ==========================================================================

  /** Emit emergency created event */
  emitEmergencyCreated(data: EmergencyCreatedEvent): void {
    this.emitOrQueue('emergency_created', data);
  }

  /** Emit emergency dispatched event */
  emitEmergencyDispatched(data: EmergencyDispatchedEvent): void {
    this.emitOrQueue('emergency_dispatched', data);
  }

  /** Emit emergency resolved event */
  emitEmergencyResolved(data: EmergencyResolvedEvent): void {
    this.emitOrQueue('emergency_resolved', data);
  }

  /** Emit emergency cancelled event */
  emitEmergencyCancelled(data: EmergencyCancelledEvent): void {
    this.emitOrQueue('emergency_cancelled', data);
  }

  // ==========================================================================
  // EMERGENCY EVENT LISTENERS (backward compatible — now with duplicate prevention)
  // ==========================================================================

  /** Listen for emergency created events */
  onEmergencyCreated(callback: (data: EmergencyCreatedEvent) => void): () => void {
    return this.trackListener('emergency_created', callback as (...args: unknown[]) => void);
  }

  /** Listen for emergency dispatched events */
  onEmergencyDispatched(callback: (data: EmergencyDispatchedEvent) => void): () => void {
    return this.trackListener('emergency_dispatched', callback as (...args: unknown[]) => void);
  }

  /** Listen for emergency resolved events */
  onEmergencyResolved(callback: (data: EmergencyResolvedEvent) => void): () => void {
    return this.trackListener('emergency_resolved', callback as (...args: unknown[]) => void);
  }

  /** Listen for emergency cancelled events */
  onEmergencyCancelled(callback: (data: EmergencyCancelledEvent) => void): () => void {
    return this.trackListener('emergency_cancelled', callback as (...args: unknown[]) => void);
  }

  /** Listen for emergency update events */
  onEmergencyUpdate(callback: (data: EmergencyUpdateEvent) => void): () => void {
    return this.trackListener('emergency_update', callback as (...args: unknown[]) => void);
  }

  /** Listen for emergency alert events (for nurses) */
  onEmergencyAlert(callback: (data: EmergencyAlertEvent) => void): () => void {
    return this.trackListener('emergency_alert', callback as (...args: unknown[]) => void);
  }

  // ==========================================================================
  // LOCATION METHODS (backward compatible)
  // ==========================================================================

  /** Send GPS location update (nurse only) */
  updateLocation(
    lat: number,
    lng: number,
    options?: {
      heading?: number;
      speed?: number;
      batteryLevel?: number;
      currentRequestId?: string;
    }
  ): void {
    this.emitOrQueue('location_update', {
      location: {
        lat,
        lng,
        updatedAt: new Date().toISOString(),
      },
      heading: options?.heading ?? 0,
      speed: options?.speed ?? 0,
      batteryLevel: options?.batteryLevel ?? null,
      currentRequestId: options?.currentRequestId ?? null,
    });
  }

  /** Request to track a nurse's location */
  trackNurse(nurseId: string): void {
    this.emitOrQueue('track_nurse', { nurseId });
  }

  /** Stop tracking a nurse */
  stopTracking(nurseId: string): void {
    this.emitOrQueue('stop_tracking', { nurseId });
  }

  // ==========================================================================
  // LOCATION EVENT LISTENERS (backward compatible — now with duplicate prevention)
  // ==========================================================================

  /** Listen for location updates */
  onLocationUpdate(callback: (data: LocationUpdateEvent) => void): () => void {
    return this.trackListener('location_update', callback as (...args: unknown[]) => void);
  }

  /** Listen for nurse tracking status */
  onNurseTrackingStatus(callback: (data: NurseTrackingStatusEvent) => void): () => void {
    return this.trackListener('nurse_tracking_status', callback as (...args: unknown[]) => void);
  }

  // ==========================================================================
  // NOTIFICATION METHODS (backward compatible)
  // ==========================================================================

  /** Mark notifications as read */
  markNotificationsRead(notificationIds: string[]): void {
    this.emitOrQueue('notification_read', { notificationIds });
  }

  // ==========================================================================
  // NOTIFICATION EVENT LISTENERS (backward compatible — now with duplicate prevention)
  // ==========================================================================

  /** Listen for notifications */
  onNotification(callback: (data: NotificationEvent) => void): () => void {
    return this.trackListener('notification', callback as (...args: unknown[]) => void);
  }

  /** Listen for notification read confirmations */
  onNotificationReadConfirmed(
    callback: (data: NotificationReadConfirmedEvent) => void
  ): () => void {
    return this.trackListener('notification_read_confirmed', callback as (...args: unknown[]) => void);
  }

  // ==========================================================================
  // ONLINE STATUS EVENT LISTENERS (backward compatible — now with duplicate prevention)
  // ==========================================================================

  /** Listen for user online events */
  onUserOnline(callback: (data: UserOnlineEvent) => void): () => void {
    return this.trackListener('user_online', callback as (...args: unknown[]) => void);
  }

  /** Listen for user offline events */
  onUserOffline(callback: (data: UserOfflineEvent) => void): () => void {
    return this.trackListener('user_offline', callback as (...args: unknown[]) => void);
  }

  /** Listen for nurse availability changes */
  onNurseAvailabilityChanged(
    callback: (data: NurseAvailabilityChangedEvent) => void
  ): () => void {
    return this.trackListener('nurse_availability_changed', callback as (...args: unknown[]) => void);
  }

  // ==========================================================================
  // UTILITY METHODS (backward compatible)
  // ==========================================================================

  /** Set user display name for better identification */
  setUserInfo(name: string): void {
    this.emitOrQueue('set_user_info', { name });
  }

  /** Request list of online nurses */
  getOnlineNurses(): void {
    this.emitOrQueue('get_online_nurses');
  }

  /** Listen for online nurses list */
  onOnlineNursesList(callback: (data: OnlineNursesListEvent) => void): () => void {
    return this.trackListener('online_nurses_list', callback as (...args: unknown[]) => void);
  }

  /** Request online status of a specific user */
  getUserStatus(userId: string): void {
    this.emitOrQueue('get_user_status', { userId });
  }

  /** Listen for user status responses */
  onUserStatus(callback: (data: UserStatusEvent) => void): () => void {
    return this.trackListener('user_status', callback as (...args: unknown[]) => void);
  }

  /** Listen for socket error events */
  onSocketError(callback: (data: SocketErrorEvent) => void): () => void {
    return this.trackListener('error', callback as (...args: unknown[]) => void);
  }

  /** Remove all event listeners */
  removeAllListeners(): void {
    this.clearRegisteredListeners();
    this.socket?.removeAllListeners();
  }

  // ==========================================================================
  // v2: GRACEFUL DEGRADATION & CLEANUP
  // ==========================================================================

  /**
   * Destroy the service entirely — removes all listeners, timers,
   * browser event listeners, and persisted state. Call when the app
   * is unmounting or the user logs out.
   */
  destroy(): void {
    this.disconnect();

    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.boundHandleOnline);
      window.removeEventListener('offline', this.boundHandleOffline);
    }

    this.connectionStateListeners.clear();
    this.connectionStateChangeListeners.clear();
    this.eventQueue = [];
    this.persistedUserId = null;

    notificationLogger.info('SocketService v2 destroyed');
  }

  /**
   * Check the health of the connection. Returns an object with diagnostic
   * information that UI components can use for status indicators.
   */
  getHealthDiagnostics(): {
    state: ConnectionState;
    isConnected: boolean;
    reconnectAttempts: number;
    isNetworkOffline: boolean;
    lastHeartbeatAt: number | null;
    queuedEventCount: number;
    socketId: string | undefined;
  } {
    return {
      state: this._connectionState,
      isConnected: this.isConnected,
      reconnectAttempts: this.reconnectAttempts,
      isNetworkOffline: this.isNetworkOffline,
      lastHeartbeatAt: this.lastHeartbeatResponseAt,
      queuedEventCount: this.eventQueue.length,
      socketId: this.socket?.id,
    };
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/** Global socket service instance (v2) */
export const socketService = new SocketService();

export default socketService;
