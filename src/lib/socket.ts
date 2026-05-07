// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Socket.IO Client Service
// ============================================================================
// Typed Socket.IO client utility for real-time communication.
// Connects via Caddy gateway using XTransformPort=3003.
// Handles authentication, reconnection, and all event types.
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

// ============================================================================
// CLIENT-SIDE EVENT PAYLOAD TYPES
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
// SOCKET SERVICE CLASS
// ============================================================================

/** Connection state */
export type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;
  private _connectionState: ConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 10;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private connectionStateListeners: Set<(state: ConnectionState) => void> = new Set();

  // ---- Connection Management ----

  /** Get current connection state */
  get connectionState(): ConnectionState {
    return this._connectionState;
  }

  /** Set connection state and notify listeners */
  private setConnectionState(state: ConnectionState): void {
    this._connectionState = state;
    for (const listener of this.connectionStateListeners) {
      listener(state);
    }
  }

  /** Register a connection state change listener */
  onConnectionStateChange(listener: (state: ConnectionState) => void): () => void {
    this.connectionStateListeners.add(listener);
    return () => {
      this.connectionStateListeners.delete(listener);
    };
  }

  /** Check if socket is connected */
  get isConnected(): boolean {
    return this.socket?.connected ?? false;
  }

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
    this.setConnectionState('connecting');

    // IMPORTANT: Use relative path with XTransformPort for Caddy gateway
    this.socket = io('/?XTransformPort=3003', {
      transports: ['websocket', 'polling'],
      forceNew: true,
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      timeout: 10000,
      auth: {
        token,
      },
    });

    this.setupEventListeners();
    this.startHeartbeat();
  }

  /** Disconnect from the Socket.IO server */
  disconnect(): void {
    this.stopHeartbeat();

    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }

    this.token = null;
    this.reconnectAttempts = 0;
    this.setConnectionState('disconnected');
  }

  /** Setup internal socket event listeners */
  private setupEventListeners(): void {
    if (!this.socket) return;

    this.socket.on('connect', () => {
      console.log('[Socket] Connected');
      this.reconnectAttempts = 0;
      this.setConnectionState('connected');
    });

    this.socket.on('disconnect', (reason: string) => {
      console.log(`[Socket] Disconnected: ${reason}`);
      this.setConnectionState('disconnected');
    });

    this.socket.on('connect_error', (error: Error) => {
      console.error(`[Socket] Connection error: ${error.message}`);
      this.reconnectAttempts++;
      this.setConnectionState('reconnecting');
    });

    this.socket.on('reconnect', (attemptNumber: number) => {
      console.log(`[Socket] Reconnected after ${attemptNumber} attempts`);
      this.reconnectAttempts = 0;
      this.setConnectionState('connected');
    });

    this.socket.on('reconnect_error', (error: Error) => {
      console.error(`[Socket] Reconnect error: ${error.message}`);
    });

    this.socket.on('reconnect_failed', () => {
      console.error(`[Socket] Reconnect failed after ${this.maxReconnectAttempts} attempts`);
      this.setConnectionState('disconnected');
    });

    // Server error events
    this.socket.on('error', (data: SocketErrorEvent) => {
      console.error(`[Socket] Server error (${data.code}): ${data.message} [${data.event}]`);
    });

    // Connection confirmation
    this.socket.on('connected', (data: ConnectionConfirmedEvent) => {
      console.log(`[Socket] Authenticated as ${data.userId} (${data.role})`);
    });
  }

  /** Start heartbeat to keep connection alive */
  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      if (this.socket?.connected) {
        this.socket.emit('heartbeat');
      }
    }, 25000);
  }

  /** Stop heartbeat */
  private stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  // ---- Chat Methods ----

  /** Join a specific chat room */
  joinChat(chatId: string): void {
    this.socket?.emit('join_chat', { chatId });
  }

  /** Leave a specific chat room */
  leaveChat(chatId: string): void {
    this.socket?.emit('leave_chat', { chatId });
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
    this.socket?.emit('send_message', {
      chatId,
      content,
      type,
      ...options,
    });
  }

  /** Notify others that user started typing */
  startTyping(chatId: string): void {
    this.socket?.emit('typing_start', { chatId });
  }

  /** Notify others that user stopped typing */
  stopTyping(chatId: string): void {
    this.socket?.emit('typing_stop', { chatId });
  }

  /** Mark messages as read */
  markMessagesRead(chatId: string, messageIds: string[]): void {
    this.socket?.emit('message_read', { chatId, messageIds });
  }

  // ---- Chat Event Listeners ----

  /** Listen for new messages */
  onMessage(callback: (data: NewMessageEvent) => void): () => void {
    this.socket?.on('new_message', callback);
    return () => {
      this.socket?.off('new_message', callback);
    };
  }

  /** Listen for typing indicators */
  onTyping(callback: (data: TypingEvent) => void): () => void {
    this.socket?.on('typing', callback);
    return () => {
      this.socket?.off('typing', callback);
    };
  }

  /** Listen for read receipts */
  onReadReceipt(callback: (data: ReadReceiptEvent) => void): () => void {
    this.socket?.on('read_receipt', callback);
    return () => {
      this.socket?.off('read_receipt', callback);
    };
  }

  /** Listen for message delivery confirmations */
  onMessageDelivered(callback: (data: MessageDeliveredEvent) => void): () => void {
    this.socket?.on('message_delivered', callback);
    return () => {
      this.socket?.off('message_delivered', callback);
    };
  }

  /** Listen for user joining a chat */
  onUserJoinedChat(callback: (data: UserJoinedChatEvent) => void): () => void {
    this.socket?.on('user_joined_chat', callback);
    return () => {
      this.socket?.off('user_joined_chat', callback);
    };
  }

  /** Listen for user leaving a chat */
  onUserLeftChat(callback: (data: UserLeftChatEvent) => void): () => void {
    this.socket?.on('user_left_chat', callback);
    return () => {
      this.socket?.off('user_left_chat', callback);
    };
  }

  // ---- Order Methods ----

  /** Emit order created event */
  emitOrderCreated(data: OrderCreatedEvent): void {
    this.socket?.emit('order_created', data);
  }

  /** Emit order assigned event */
  emitOrderAssigned(data: OrderAssignedEvent): void {
    this.socket?.emit('order_assigned', data);
  }

  /** Emit order status changed event */
  emitOrderStatusChanged(data: OrderStatusChangedEvent): void {
    this.socket?.emit('order_status_changed', data);
  }

  /** Emit order cancelled event */
  emitOrderCancelled(data: OrderCancelledEvent): void {
    this.socket?.emit('order_cancelled', data);
  }

  // ---- Order Event Listeners ----

  /** Listen for order created events */
  onOrderCreated(callback: (data: OrderCreatedEvent) => void): () => void {
    this.socket?.on('order_created', callback);
    return () => {
      this.socket?.off('order_created', callback);
    };
  }

  /** Listen for order assigned events */
  onOrderAssigned(callback: (data: OrderAssignedEvent) => void): () => void {
    this.socket?.on('order_assigned', callback);
    return () => {
      this.socket?.off('order_assigned', callback);
    };
  }

  /** Listen for order status changed events */
  onOrderStatusChanged(callback: (data: OrderStatusChangedEvent) => void): () => void {
    this.socket?.on('order_status_changed', callback);
    return () => {
      this.socket?.off('order_status_changed', callback);
    };
  }

  /** Listen for order update events (general) */
  onOrderUpdate(callback: (data: OrderUpdateEvent) => void): () => void {
    this.socket?.on('order_update', callback);
    return () => {
      this.socket?.off('order_update', callback);
    };
  }

  /** Listen for order cancelled events */
  onOrderCancelled(callback: (data: OrderCancelledEvent) => void): () => void {
    this.socket?.on('order_cancelled', callback);
    return () => {
      this.socket?.off('order_cancelled', callback);
    };
  }

  // ---- Emergency Methods ----

  /** Emit emergency created event */
  emitEmergencyCreated(data: EmergencyCreatedEvent): void {
    this.socket?.emit('emergency_created', data);
  }

  /** Emit emergency dispatched event */
  emitEmergencyDispatched(data: EmergencyDispatchedEvent): void {
    this.socket?.emit('emergency_dispatched', data);
  }

  /** Emit emergency resolved event */
  emitEmergencyResolved(data: EmergencyResolvedEvent): void {
    this.socket?.emit('emergency_resolved', data);
  }

  /** Emit emergency cancelled event */
  emitEmergencyCancelled(data: EmergencyCancelledEvent): void {
    this.socket?.emit('emergency_cancelled', data);
  }

  // ---- Emergency Event Listeners ----

  /** Listen for emergency created events */
  onEmergencyCreated(callback: (data: EmergencyCreatedEvent) => void): () => void {
    this.socket?.on('emergency_created', callback);
    return () => {
      this.socket?.off('emergency_created', callback);
    };
  }

  /** Listen for emergency dispatched events */
  onEmergencyDispatched(callback: (data: EmergencyDispatchedEvent) => void): () => void {
    this.socket?.on('emergency_dispatched', callback);
    return () => {
      this.socket?.off('emergency_dispatched', callback);
    };
  }

  /** Listen for emergency resolved events */
  onEmergencyResolved(callback: (data: EmergencyResolvedEvent) => void): () => void {
    this.socket?.on('emergency_resolved', callback);
    return () => {
      this.socket?.off('emergency_resolved', callback);
    };
  }

  /** Listen for emergency cancelled events */
  onEmergencyCancelled(callback: (data: EmergencyCancelledEvent) => void): () => void {
    this.socket?.on('emergency_cancelled', callback);
    return () => {
      this.socket?.off('emergency_cancelled', callback);
    };
  }

  /** Listen for emergency update events */
  onEmergencyUpdate(callback: (data: EmergencyUpdateEvent) => void): () => void {
    this.socket?.on('emergency_update', callback);
    return () => {
      this.socket?.off('emergency_update', callback);
    };
  }

  /** Listen for emergency alert events (for nurses) */
  onEmergencyAlert(callback: (data: EmergencyAlertEvent) => void): () => void {
    this.socket?.on('emergency_alert', callback);
    return () => {
      this.socket?.off('emergency_alert', callback);
    };
  }

  // ---- Location Methods ----

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
    this.socket?.emit('location_update', {
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
    this.socket?.emit('track_nurse', { nurseId });
  }

  /** Stop tracking a nurse */
  stopTracking(nurseId: string): void {
    this.socket?.emit('stop_tracking', { nurseId });
  }

  // ---- Location Event Listeners ----

  /** Listen for location updates */
  onLocationUpdate(callback: (data: LocationUpdateEvent) => void): () => void {
    this.socket?.on('location_update', callback);
    return () => {
      this.socket?.off('location_update', callback);
    };
  }

  /** Listen for nurse tracking status */
  onNurseTrackingStatus(callback: (data: NurseTrackingStatusEvent) => void): () => void {
    this.socket?.on('nurse_tracking_status', callback);
    return () => {
      this.socket?.off('nurse_tracking_status', callback);
    };
  }

  // ---- Notification Methods ----

  /** Mark notifications as read */
  markNotificationsRead(notificationIds: string[]): void {
    this.socket?.emit('notification_read', { notificationIds });
  }

  // ---- Notification Event Listeners ----

  /** Listen for notifications */
  onNotification(callback: (data: NotificationEvent) => void): () => void {
    this.socket?.on('notification', callback);
    return () => {
      this.socket?.off('notification', callback);
    };
  }

  /** Listen for notification read confirmations */
  onNotificationReadConfirmed(
    callback: (data: NotificationReadConfirmedEvent) => void
  ): () => void {
    this.socket?.on('notification_read_confirmed', callback);
    return () => {
      this.socket?.off('notification_read_confirmed', callback);
    };
  }

  // ---- Online Status Event Listeners ----

  /** Listen for user online events */
  onUserOnline(callback: (data: UserOnlineEvent) => void): () => void {
    this.socket?.on('user_online', callback);
    return () => {
      this.socket?.off('user_online', callback);
    };
  }

  /** Listen for user offline events */
  onUserOffline(callback: (data: UserOfflineEvent) => void): () => void {
    this.socket?.on('user_offline', callback);
    return () => {
      this.socket?.off('user_offline', callback);
    };
  }

  /** Listen for nurse availability changes */
  onNurseAvailabilityChanged(
    callback: (data: NurseAvailabilityChangedEvent) => void
  ): () => void {
    this.socket?.on('nurse_availability_changed', callback);
    return () => {
      this.socket?.off('nurse_availability_changed', callback);
    };
  }

  // ---- Utility Methods ----

  /** Set user display name for better identification */
  setUserInfo(name: string): void {
    this.socket?.emit('set_user_info', { name });
  }

  /** Request list of online nurses */
  getOnlineNurses(): void {
    this.socket?.emit('get_online_nurses');
  }

  /** Listen for online nurses list */
  onOnlineNursesList(callback: (data: OnlineNursesListEvent) => void): () => void {
    this.socket?.on('online_nurses_list', callback);
    return () => {
      this.socket?.off('online_nurses_list', callback);
    };
  }

  /** Request online status of a specific user */
  getUserStatus(userId: string): void {
    this.socket?.emit('get_user_status', { userId });
  }

  /** Listen for user status responses */
  onUserStatus(callback: (data: UserStatusEvent) => void): () => void {
    this.socket?.on('user_status', callback);
    return () => {
      this.socket?.off('user_status', callback);
    };
  }

  /** Listen for socket error events */
  onSocketError(callback: (data: SocketErrorEvent) => void): () => void {
    this.socket?.on('error', callback);
    return () => {
      this.socket?.off('error', callback);
    };
  }

  /** Remove all event listeners */
  removeAllListeners(): void {
    this.socket?.removeAllListeners();
  }
}

// ============================================================================
// SINGLETON EXPORT
// ============================================================================

/** Global socket service instance */
export const socketService = new SocketService();

export default socketService;
