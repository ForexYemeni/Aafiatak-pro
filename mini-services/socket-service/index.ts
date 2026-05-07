// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Socket.IO Real-Time Service
// ============================================================================
// Complete real-time communication service for the healthcare platform.
// Handles chat, orders, emergencies, location tracking, notifications,
// and online status with JWT authentication.
// ============================================================================

import { createServer } from 'http';
import { Server, Socket } from 'socket.io';
import jwt from 'jsonwebtoken';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/** User roles within the platform */
type UserRole = 'admin' | 'subadmin' | 'nurse' | 'beneficiary';

/** JWT token payload */
interface TokenPayload {
  userId: string;
  phone: string;
  role: UserRole;
}

/** Geographic coordinates */
interface Location {
  lat: number;
  lng: number;
  updatedAt: string;
}

/** Chat message type */
type MessageType = 'text' | 'image' | 'system' | 'quick_reply';

/** Service request status */
type ServiceRequestStatus =
  | 'pending'
  | 'assigned'
  | 'accepted'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'rejected';

/** Emergency status */
type EmergencyStatus = 'pending' | 'dispatched' | 'in_progress' | 'resolved' | 'cancelled';

/** Emergency type */
type EmergencyType = 'medical' | 'injury' | 'breathing' | 'cardiac' | 'fall' | 'other';

/** Assignment status */
type AssignmentStatus = 'pending' | 'accepted' | 'rejected' | 'completed' | 'cancelled';

/** Notification type */
type NotificationType =
  | 'assignment'
  | 'payment'
  | 'emergency'
  | 'reminder'
  | 'chat'
  | 'status_change'
  | 'appointment'
  | 'rating'
  | 'system';

/** Notification priority */
type NotificationPriority = 'low' | 'medium' | 'high' | 'urgent';

/** Blood type */
type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

// ---- Event Payload Types ----

/** Payload for join_chat event */
interface JoinChatPayload {
  chatId: string;
}

/** Payload for leave_chat event */
interface LeaveChatPayload {
  chatId: string;
}

/** Payload for send_message event */
interface SendMessagePayload {
  chatId: string;
  content: string;
  type: MessageType;
  imageUrl?: string;
  replyTo?: string;
  quickReplies?: QuickReply[];
}

/** Quick reply option */
interface QuickReply {
  id: string;
  labelAr: string;
  labelEn: string;
  value: string;
}

/** Payload for typing events */
interface TypingPayload {
  chatId: string;
}

/** Payload for message_read event */
interface MessageReadPayload {
  chatId: string;
  messageIds: string[];
}

/** Chat message structure */
interface ChatMessage {
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
  quickReplies: QuickReply[] | null;
  isDeleted: boolean;
  createdAt: string;
}

/** New message event payload (emitted) */
interface NewMessagePayload {
  message: ChatMessage;
  chatId: string;
}

/** Typing indicator payload (emitted) */
interface TypingIndicatorPayload {
  chatId: string;
  userId: string;
  userName: string;
  isTyping: boolean;
}

/** Read receipt payload (emitted) */
interface ReadReceiptPayload {
  chatId: string;
  messageIds: string[];
  readBy: string;
}

/** Message delivered payload (emitted) */
interface MessageDeliveredPayload {
  chatId: string;
  messageIds: string[];
  deliveredTo: string;
}

/** Order created payload */
interface OrderCreatedPayload {
  requestId: string;
  serviceId: string;
  beneficiaryId: string;
  beneficiaryName: string;
  beneficiaryAddress: string;
  beneficiaryLocation: Location;
  isEmergency: boolean;
  scheduledAt: string | null;
  notes: string | null;
  createdAt: string;
}

/** Order assigned payload */
interface OrderAssignedPayload {
  requestId: string;
  nurseId: string;
  nurseName: string;
  assignedBy: string;
  assignedByRole: UserRole;
  estimatedArrivalMinutes: number | null;
  assignedAt: string;
}

/** Order status changed payload */
interface OrderStatusChangedPayload {
  requestId: string;
  status: ServiceRequestStatus;
  nurseId: string | null;
  updatedAt: string;
  notes: string | null;
}

/** Order cancelled payload */
interface OrderCancelledPayload {
  requestId: string;
  cancelledBy: string;
  cancelledByRole: UserRole;
  cancelReason: string | null;
  cancelledAt: string;
}

/** Emergency created payload */
interface EmergencyCreatedPayload {
  emergencyRequestId: string;
  type: EmergencyType;
  description: string;
  beneficiaryId: string;
  beneficiaryName: string;
  location: Location;
  address: string;
  priority: NotificationPriority;
  createdAt: string;
}

/** Emergency dispatched payload */
interface EmergencyDispatchedPayload {
  emergencyRequestId: string;
  nurseId: string;
  nurseName: string;
  estimatedArrivalMinutes: number | null;
  dispatchedAt: string;
}

/** Emergency resolved payload */
interface EmergencyResolvedPayload {
  emergencyRequestId: string;
  nurseId: string;
  resolvedAt: string;
  notes: string | null;
}

/** Emergency cancelled payload */
interface EmergencyCancelledPayload {
  emergencyRequestId: string;
  cancelledBy: string;
  cancelReason: string | null;
  cancelledAt: string;
}

/** Location update payload */
interface LocationUpdatePayload {
  nurseId: string;
  location: Location;
  heading: number;
  speed: number;
  batteryLevel: number | null;
  currentRequestId: string | null;
}

/** Track nurse request payload */
interface TrackNursePayload {
  nurseId: string;
}

/** Stop tracking payload */
interface StopTrackingPayload {
  nurseId: string;
}

/** Notification payload */
interface NotificationPayload {
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

/** Notification read payload */
interface NotificationReadPayload {
  notificationIds: string[];
}

/** User online event payload */
interface UserOnlinePayload {
  userId: string;
  role: UserRole;
  name: string;
}

/** User offline event payload */
interface UserOfflinePayload {
  userId: string;
  role: UserRole;
  name: string;
  lastSeen: string;
}

/** Nurse availability changed payload */
interface NurseAvailabilityChangedPayload {
  nurseId: string;
  isAvailable: boolean;
  isOnline: boolean;
}

/** Error payload */
interface ErrorPayload {
  event: string;
  message: string;
  code: string;
}

// ---- Internal Types ----

/** Connected user info stored in memory */
interface ConnectedUser {
  socketId: string;
  userId: string;
  role: UserRole;
  name: string;
  connectedAt: string;
  activeChats: Set<string>;
  lastHeartbeat: string;
}

/** Nurse online status tracking */
interface NurseOnlineStatus {
  nurseId: string;
  isOnline: boolean;
  isAvailable: boolean;
  lastSeen: string;
  location: Location | null;
}

// ============================================================================
// CONSTANTS & CONFIG
// ============================================================================

const PORT = 3003;
const JWT_SECRET = process.env.JWT_SECRET ?? 'aafiatak-dev-jwt-secret-change-in-production';

/** Heartbeat interval in ms (check every 30s) */
const HEARTBEAT_CHECK_INTERVAL = 30000;
/** Max time without heartbeat before considering disconnected (90s) */
const HEARTBEAT_TIMEOUT = 90000;

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

/** Connected users indexed by socket ID */
const connectedUsers = new Map<string, ConnectedUser>();

/** User ID to socket IDs mapping (one user can have multiple connections) */
const userSockets = new Map<string, Set<string>>();

/** Nurse online/availability status */
const nurseStatuses = new Map<string, NurseOnlineStatus>();

/** Tracking subscriptions: beneficiaryId -> Set of nurseIds they're tracking */
const trackingSubscriptions = new Map<string, Set<string>>();

/** Generate a unique message ID */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
}

// ============================================================================
// AUTHENTICATION
// ============================================================================

/**
 * Verify JWT token from socket handshake.
 * Returns the decoded payload or null if invalid.
 */
function verifyAuthToken(token: string): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
    return {
      userId: decoded.userId,
      phone: decoded.phone,
      role: decoded.role,
    };
  } catch {
    return null;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/** Get the user room name for a specific user */
function getUserRoom(userId: string): string {
  return `user_${userId}`;
}

/** Get the role room name */
function getRoleRoom(role: UserRole): string {
  return `role_${role}`;
}

/** Get the chat room name */
function getChatRoom(chatId: string): string {
  return `chat_${chatId}`;
}

/** Get connected user info by socket ID */
function getConnectedUser(socketId: string): ConnectedUser | undefined {
  return connectedUsers.get(socketId);
}

/** Get all socket IDs for a given user ID */
function getUserSocketIds(userId: string): string[] {
  const sockets = userSockets.get(userId);
  return sockets ? Array.from(sockets) : [];
}

/** Register a connected user in our state maps */
function registerUser(socketId: string, user: TokenPayload): void {
  // Add to connected users
  const connectedUser: ConnectedUser = {
    socketId,
    userId: user.userId,
    role: user.role,
    name: '', // Will be populated from client if needed
    connectedAt: new Date().toISOString(),
    activeChats: new Set(),
    lastHeartbeat: new Date().toISOString(),
  };
  connectedUsers.set(socketId, connectedUser);

  // Add to user-sockets mapping
  if (!userSockets.has(user.userId)) {
    userSockets.set(user.userId, new Set());
  }
  userSockets.get(user.userId)!.add(socketId);

  // If nurse, initialize online status
  if (user.role === 'nurse') {
    const existing = nurseStatuses.get(user.userId);
    if (!existing) {
      nurseStatuses.set(user.userId, {
        nurseId: user.userId,
        isOnline: true,
        isAvailable: true,
        lastSeen: new Date().toISOString(),
        location: null,
      });
    } else {
      existing.isOnline = true;
      existing.lastSeen = new Date().toISOString();
    }
  }
}

/** Unregister a connected user from our state maps */
function unregisterUser(socketId: string): ConnectedUser | undefined {
  const user = connectedUsers.get(socketId);
  if (!user) return undefined;

  // Remove from connected users
  connectedUsers.delete(socketId);

  // Remove from user-sockets mapping
  const sockets = userSockets.get(user.userId);
  if (sockets) {
    sockets.delete(socketId);
    if (sockets.size === 0) {
      userSockets.delete(user.userId);
    }
  }

  // If nurse and no more connections, set offline
  if (user.role === 'nurse' && !userSockets.has(user.userId)) {
    const status = nurseStatuses.get(user.userId);
    if (status) {
      status.isOnline = false;
      status.lastSeen = new Date().toISOString();
    }
  }

  return user;
}

/** Check if a user is online */
function isUserOnline(userId: string): boolean {
  const sockets = userSockets.get(userId);
  return sockets !== undefined && sockets.size > 0;
}

/** Get count of online nurses */
function getOnlineNurseCount(): number {
  let count = 0;
  for (const status of nurseStatuses.values()) {
    if (status.isOnline && status.isAvailable) {
      count++;
    }
  }
  return count;
}

/** Get all online nurse IDs */
function getOnlineNurseIds(): string[] {
  const ids: string[] = [];
  for (const [nurseId, status] of nurseStatuses.entries()) {
    if (status.isOnline && status.isAvailable) {
      ids.push(nurseId);
    }
  }
  return ids;
}

// ============================================================================
// HTTP SERVER & SOCKET.IO SETUP
// ============================================================================

const httpServer = createServer();
const io = new Server(httpServer, {
  // Path must be '/' for Caddy gateway to forward correctly
  path: '/',
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// ============================================================================
// SOCKET AUTHENTICATION MIDDLEWARE
// ============================================================================

io.use((socket: Socket, next: (err?: Error) => void) => {
  // Extract token from handshake auth or query
  const token =
    (socket.handshake.auth.token as string | undefined) ??
    (socket.handshake.query.token as string | undefined);

  if (!token) {
    return next(new Error('Authentication required: no token provided'));
  }

  const payload = verifyAuthToken(token);
  if (!payload) {
    return next(new Error('Authentication failed: invalid or expired token'));
  }

  // Attach user payload to socket for later use
  socket.data.user = payload;
  next();
});

// ============================================================================
// CONNECTION HANDLER
// ============================================================================

io.on('connection', (socket: Socket) => {
  const user = socket.data.user as TokenPayload;
  console.log(
    `[CONNECT] User ${user.userId} (${user.role}) connected via socket ${socket.id}`
  );

  // ---- Register & Join Default Rooms ----

  registerUser(socket.id, user);

  // Join personal room (for direct notifications)
  socket.join(getUserRoom(user.userId));

  // Join role room
  socket.join(getRoleRoom(user.role));

  // Broadcast user online status
  const onlinePayload: UserOnlinePayload = {
    userId: user.userId,
    role: user.role,
    name: (socket.data.userName as string) ?? user.userId,
  };
  io.emit('user_online', onlinePayload);

  // If nurse, broadcast availability change
  if (user.role === 'nurse') {
    const nursePayload: NurseAvailabilityChangedPayload = {
      nurseId: user.userId,
      isAvailable: true,
      isOnline: true,
    };
    io.emit('nurse_availability_changed', nursePayload);
    console.log(
      `[NURSE] ${user.userId} is now online. Online nurses: ${getOnlineNurseCount()}`
    );
  }

  // Send connection confirmation to the client
  socket.emit('connected', {
    userId: user.userId,
    role: user.role,
    socketId: socket.id,
    serverTime: new Date().toISOString(),
  });

  // ========================================================================
  // CHAT EVENTS
  // ========================================================================

  /** Join a specific chat room */
  socket.on('join_chat', (data: JoinChatPayload) => {
    try {
      const { chatId } = data;
      if (!chatId || typeof chatId !== 'string') {
        socket.emit('error', {
          event: 'join_chat',
          message: 'Invalid chatId',
          code: 'INVALID_PAYLOAD',
        } satisfies ErrorPayload);
        return;
      }

      const chatRoom = getChatRoom(chatId);
      socket.join(chatRoom);

      // Track active chat for this user
      const connectedUser = getConnectedUser(socket.id);
      if (connectedUser) {
        connectedUser.activeChats.add(chatId);
      }

      // Notify others in the chat room
      socket.to(chatRoom).emit('user_joined_chat', {
        chatId,
        userId: user.userId,
        role: user.role,
        joinedAt: new Date().toISOString(),
      });

      console.log(`[CHAT] User ${user.userId} joined chat ${chatId}`);
    } catch (error) {
      socket.emit('error', {
        event: 'join_chat',
        message: 'Failed to join chat',
        code: 'INTERNAL_ERROR',
      } satisfies ErrorPayload);
      console.error('[CHAT] join_chat error:', error);
    }
  });

  /** Leave a specific chat room */
  socket.on('leave_chat', (data: LeaveChatPayload) => {
    try {
      const { chatId } = data;
      if (!chatId || typeof chatId !== 'string') {
        socket.emit('error', {
          event: 'leave_chat',
          message: 'Invalid chatId',
          code: 'INVALID_PAYLOAD',
        } satisfies ErrorPayload);
        return;
      }

      const chatRoom = getChatRoom(chatId);
      socket.leave(chatRoom);

      // Remove from active chats
      const connectedUser = getConnectedUser(socket.id);
      if (connectedUser) {
        connectedUser.activeChats.delete(chatId);
      }

      // Notify others in the chat room
      socket.to(chatRoom).emit('user_left_chat', {
        chatId,
        userId: user.userId,
        leftAt: new Date().toISOString(),
      });

      console.log(`[CHAT] User ${user.userId} left chat ${chatId}`);
    } catch (error) {
      socket.emit('error', {
        event: 'leave_chat',
        message: 'Failed to leave chat',
        code: 'INTERNAL_ERROR',
      } satisfies ErrorPayload);
      console.error('[CHAT] leave_chat error:', error);
    }
  });

  /** Send a message to a chat room */
  socket.on('send_message', (data: SendMessagePayload) => {
    try {
      const { chatId, content, type, imageUrl, replyTo, quickReplies } = data;

      // Validate required fields
      if (!chatId || typeof chatId !== 'string') {
        socket.emit('error', {
          event: 'send_message',
          message: 'Invalid chatId',
          code: 'INVALID_PAYLOAD',
        } satisfies ErrorPayload);
        return;
      }

      if (!content || typeof content !== 'string' || content.trim().length === 0) {
        socket.emit('error', {
          event: 'send_message',
          message: 'Message content is required',
          code: 'INVALID_PAYLOAD',
        } satisfies ErrorPayload);
        return;
      }

      const validTypes: MessageType[] = ['text', 'image', 'system', 'quick_reply'];
      if (!validTypes.includes(type)) {
        socket.emit('error', {
          event: 'send_message',
          message: 'Invalid message type',
          code: 'INVALID_PAYLOAD',
        } satisfies ErrorPayload);
        return;
      }

      // Build the message object
      const message: ChatMessage = {
        id: generateId(),
        chatId,
        senderId: user.userId,
        senderRole: user.role,
        senderName: (socket.data.userName as string) ?? user.userId,
        content: content.trim(),
        type,
        imageUrl: imageUrl ?? null,
        readBy: [user.userId],
        deliveredTo: [user.userId],
        replyTo: replyTo ?? null,
        quickReplies: quickReplies ?? null,
        isDeleted: false,
        createdAt: new Date().toISOString(),
      };

      const chatRoom = getChatRoom(chatId);

      // Broadcast to everyone in the chat room (including sender for confirmation)
      io.to(chatRoom).emit('new_message', {
        message,
        chatId,
      } satisfies NewMessagePayload);

      // Also emit to user rooms of chat participants who aren't in the chat room
      // (for notification purposes - the API layer would provide participant list)
      // This is handled at a higher level; the socket just broadcasts to the room.

      console.log(
        `[CHAT] Message from ${user.userId} in chat ${chatId}: ${content.substring(0, 50)}`
      );
    } catch (error) {
      socket.emit('error', {
        event: 'send_message',
        message: 'Failed to send message',
        code: 'INTERNAL_ERROR',
      } satisfies ErrorPayload);
      console.error('[CHAT] send_message error:', error);
    }
  });

  /** User started typing in a chat */
  socket.on('typing_start', (data: TypingPayload) => {
    try {
      const { chatId } = data;
      if (!chatId) return;

      const chatRoom = getChatRoom(chatId);
      const payload: TypingIndicatorPayload = {
        chatId,
        userId: user.userId,
        userName: (socket.data.userName as string) ?? user.userId,
        isTyping: true,
      };

      // Broadcast to everyone in chat EXCEPT the sender
      socket.to(chatRoom).emit('typing', payload);
    } catch (error) {
      console.error('[CHAT] typing_start error:', error);
    }
  });

  /** User stopped typing in a chat */
  socket.on('typing_stop', (data: TypingPayload) => {
    try {
      const { chatId } = data;
      if (!chatId) return;

      const chatRoom = getChatRoom(chatId);
      const payload: TypingIndicatorPayload = {
        chatId,
        userId: user.userId,
        userName: (socket.data.userName as string) ?? user.userId,
        isTyping: false,
      };

      socket.to(chatRoom).emit('typing', payload);
    } catch (error) {
      console.error('[CHAT] typing_stop error:', error);
    }
  });

  /** Mark messages as read */
  socket.on('message_read', (data: MessageReadPayload) => {
    try {
      const { chatId, messageIds } = data;

      if (!chatId || !Array.isArray(messageIds) || messageIds.length === 0) {
        socket.emit('error', {
          event: 'message_read',
          message: 'Invalid payload: chatId and messageIds required',
          code: 'INVALID_PAYLOAD',
        } satisfies ErrorPayload);
        return;
      }

      const chatRoom = getChatRoom(chatId);
      const payload: ReadReceiptPayload = {
        chatId,
        messageIds,
        readBy: user.userId,
      };

      // Broadcast read receipt to the chat room
      io.to(chatRoom).emit('read_receipt', payload);

      console.log(
        `[CHAT] User ${user.userId} read ${messageIds.length} messages in chat ${chatId}`
      );
    } catch (error) {
      socket.emit('error', {
        event: 'message_read',
        message: 'Failed to mark messages as read',
        code: 'INTERNAL_ERROR',
      } satisfies ErrorPayload);
      console.error('[CHAT] message_read error:', error);
    }
  });

  // ========================================================================
  // ORDER EVENTS
  // ========================================================================

  /** New order created - notify available nurses */
  socket.on('order_created', (data: OrderCreatedPayload) => {
    try {
      const { requestId, isEmergency } = data;

      console.log(
        `[ORDER] New order ${requestId} created (emergency: ${isEmergency})`
      );

      // Notify all nurses in the nurse role room
      io.to(getRoleRoom('nurse')).emit('order_created', data);

      // Notify admins
      io.to(getRoleRoom('admin')).emit('order_created', data);
      io.to(getRoleRoom('subadmin')).emit('order_created', data);

      // If emergency, also send high-priority notification
      if (isEmergency) {
        io.to(getRoleRoom('nurse')).emit('emergency_alert', {
          emergencyRequestId: requestId,
          type: 'medical' as EmergencyType,
          location: data.beneficiaryLocation,
          beneficiaryId: data.beneficiaryId,
          description: `طلب طوارئ من ${data.beneficiaryName}`,
        });
      }
    } catch (error) {
      socket.emit('error', {
        event: 'order_created',
        message: 'Failed to process order creation',
        code: 'INTERNAL_ERROR',
      } satisfies ErrorPayload);
      console.error('[ORDER] order_created error:', error);
    }
  });

  /** Order assigned to a nurse */
  socket.on('order_assigned', (data: OrderAssignedPayload) => {
    try {
      const { requestId, nurseId } = data;

      console.log(`[ORDER] Order ${requestId} assigned to nurse ${nurseId}`);

      // Notify the specific nurse
      io.to(getUserRoom(nurseId)).emit('order_assigned', data);

      // Notify the beneficiary (if we have the requestId context)
      // The room for the order
      const orderRoom = `order_${requestId}`;
      io.to(orderRoom).emit('order_assigned', data);

      // Notify admins
      io.to(getRoleRoom('admin')).emit('order_assigned', data);
    } catch (error) {
      socket.emit('error', {
        event: 'order_assigned',
        message: 'Failed to process order assignment',
        code: 'INTERNAL_ERROR',
      } satisfies ErrorPayload);
      console.error('[ORDER] order_assigned error:', error);
    }
  });

  /** Order status changed */
  socket.on('order_status_changed', (data: OrderStatusChangedPayload) => {
    try {
      const { requestId, status } = data;

      console.log(`[ORDER] Order ${requestId} status changed to ${status}`);

      // Notify everyone in the order room
      const orderRoom = `order_${requestId}`;
      io.to(orderRoom).emit('order_status_changed', data);

      // Also emit as a general order_update for the user rooms
      io.emit('order_update', data);

      // Notify admins
      io.to(getRoleRoom('admin')).emit('order_status_changed', data);
      io.to(getRoleRoom('subadmin')).emit('order_status_changed', data);
    } catch (error) {
      socket.emit('error', {
        event: 'order_status_changed',
        message: 'Failed to process order status change',
        code: 'INTERNAL_ERROR',
      } satisfies ErrorPayload);
      console.error('[ORDER] order_status_changed error:', error);
    }
  });

  /** Order cancelled */
  socket.on('order_cancelled', (data: OrderCancelledPayload) => {
    try {
      const { requestId } = data;

      console.log(`[ORDER] Order ${requestId} cancelled`);

      // Notify everyone in the order room
      const orderRoom = `order_${requestId}`;
      io.to(orderRoom).emit('order_cancelled', data);

      // Notify admins
      io.to(getRoleRoom('admin')).emit('order_cancelled', data);
      io.to(getRoleRoom('subadmin')).emit('order_cancelled', data);
    } catch (error) {
      socket.emit('error', {
        event: 'order_cancelled',
        message: 'Failed to process order cancellation',
        code: 'INTERNAL_ERROR',
      } satisfies ErrorPayload);
      console.error('[ORDER] order_cancelled error:', error);
    }
  });

  // ========================================================================
  // EMERGENCY EVENTS
  // ========================================================================

  /** New emergency request created */
  socket.on('emergency_created', (data: EmergencyCreatedPayload) => {
    try {
      const { emergencyRequestId, priority } = data;

      console.log(
        `[EMERGENCY] New emergency ${emergencyRequestId} (priority: ${priority})`
      );

      // Broadcast to ALL nurses (emergencies are critical)
      io.to(getRoleRoom('nurse')).emit('emergency_created', data);

      // Notify admins
      io.to(getRoleRoom('admin')).emit('emergency_created', data);
      io.to(getRoleRoom('subadmin')).emit('emergency_created', data);

      // Also emit as emergency_alert for backward compatibility
      io.to(getRoleRoom('nurse')).emit('emergency_alert', {
        emergencyRequestId,
        type: data.type,
        location: data.location,
        beneficiaryId: data.beneficiaryId,
        description: data.description,
      });
    } catch (error) {
      socket.emit('error', {
        event: 'emergency_created',
        message: 'Failed to process emergency creation',
        code: 'INTERNAL_ERROR',
      } satisfies ErrorPayload);
      console.error('[EMERGENCY] emergency_created error:', error);
    }
  });

  /** Emergency dispatched to a nurse */
  socket.on('emergency_dispatched', (data: EmergencyDispatchedPayload) => {
    try {
      const { emergencyRequestId, nurseId } = data;

      console.log(
        `[EMERGENCY] Emergency ${emergencyRequestId} dispatched to nurse ${nurseId}`
      );

      // Notify the specific nurse
      io.to(getUserRoom(nurseId)).emit('emergency_dispatched', data);

      // Notify the beneficiary
      const emergencyRoom = `emergency_${emergencyRequestId}`;
      io.to(emergencyRoom).emit('emergency_dispatched', data);

      // Notify admins
      io.to(getRoleRoom('admin')).emit('emergency_dispatched', data);

      // Also emit as emergency_update
      io.to(emergencyRoom).emit('emergency_update', {
        emergencyRequestId,
        status: 'dispatched' as EmergencyStatus,
        nurseId,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      socket.emit('error', {
        event: 'emergency_dispatched',
        message: 'Failed to process emergency dispatch',
        code: 'INTERNAL_ERROR',
      } satisfies ErrorPayload);
      console.error('[EMERGENCY] emergency_dispatched error:', error);
    }
  });

  /** Emergency resolved */
  socket.on('emergency_resolved', (data: EmergencyResolvedPayload) => {
    try {
      const { emergencyRequestId } = data;

      console.log(`[EMERGENCY] Emergency ${emergencyRequestId} resolved`);

      // Notify everyone in the emergency room
      const emergencyRoom = `emergency_${emergencyRequestId}`;
      io.to(emergencyRoom).emit('emergency_resolved', data);

      // Notify admins
      io.to(getRoleRoom('admin')).emit('emergency_resolved', data);

      // Also emit as emergency_update
      io.to(emergencyRoom).emit('emergency_update', {
        emergencyRequestId,
        status: 'resolved' as EmergencyStatus,
        nurseId: data.nurseId,
        updatedAt: data.resolvedAt,
      });
    } catch (error) {
      socket.emit('error', {
        event: 'emergency_resolved',
        message: 'Failed to process emergency resolution',
        code: 'INTERNAL_ERROR',
      } satisfies ErrorPayload);
      console.error('[EMERGENCY] emergency_resolved error:', error);
    }
  });

  /** Emergency cancelled */
  socket.on('emergency_cancelled', (data: EmergencyCancelledPayload) => {
    try {
      const { emergencyRequestId } = data;

      console.log(`[EMERGENCY] Emergency ${emergencyRequestId} cancelled`);

      // Notify everyone in the emergency room
      const emergencyRoom = `emergency_${emergencyRequestId}`;
      io.to(emergencyRoom).emit('emergency_cancelled', data);

      // Notify admins
      io.to(getRoleRoom('admin')).emit('emergency_cancelled', data);
      io.to(getRoleRoom('subadmin')).emit('emergency_cancelled', data);

      // Also emit as emergency_update
      io.to(emergencyRoom).emit('emergency_update', {
        emergencyRequestId,
        status: 'cancelled' as EmergencyStatus,
        nurseId: null,
        updatedAt: data.cancelledAt,
      });
    } catch (error) {
      socket.emit('error', {
        event: 'emergency_cancelled',
        message: 'Failed to process emergency cancellation',
        code: 'INTERNAL_ERROR',
      } satisfies ErrorPayload);
      console.error('[EMERGENCY] emergency_cancelled error:', error);
    }
  });

  // ========================================================================
  // LOCATION EVENTS
  // ========================================================================

  /** Nurse sends GPS location update */
  socket.on('location_update', (data: Omit<LocationUpdatePayload, 'nurseId'>) => {
    try {
      // Only nurses can send location updates
      if (user.role !== 'nurse') {
        socket.emit('error', {
          event: 'location_update',
          message: 'Only nurses can send location updates',
          code: 'FORBIDDEN',
        } satisfies ErrorPayload);
        return;
      }

      const { location, heading, speed, batteryLevel, currentRequestId } = data;

      if (
        !location ||
        typeof location.lat !== 'number' ||
        typeof location.lng !== 'number'
      ) {
        socket.emit('error', {
          event: 'location_update',
          message: 'Invalid location data: lat and lng are required',
          code: 'INVALID_PAYLOAD',
        } satisfies ErrorPayload);
        return;
      }

      // Update nurse status
      const status = nurseStatuses.get(user.userId);
      if (status) {
        status.location = {
          ...location,
          updatedAt: new Date().toISOString(),
        };
      }

      const payload: LocationUpdatePayload = {
        nurseId: user.userId,
        location: {
          ...location,
          updatedAt: new Date().toISOString(),
        },
        heading: heading ?? 0,
        speed: speed ?? 0,
        batteryLevel: batteryLevel ?? null,
        currentRequestId: currentRequestId ?? null,
      };

      // If nurse has an active order, emit to the order room
      if (currentRequestId) {
        const orderRoom = `order_${currentRequestId}`;
        io.to(orderRoom).emit('location_update', payload);
      }

      // Emit to the nurse's personal room (for admin tracking)
      io.to(getUserRoom(user.userId)).emit('location_update', payload);

      // Emit to all tracking beneficiaries
      for (const [beneficiaryId, trackedNurses] of trackingSubscriptions.entries()) {
        if (trackedNurses.has(user.userId)) {
          io.to(getUserRoom(beneficiaryId)).emit('location_update', payload);
        }
      }

      console.log(
        `[LOCATION] Nurse ${user.userId}: ${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`
      );
    } catch (error) {
      socket.emit('error', {
        event: 'location_update',
        message: 'Failed to process location update',
        code: 'INTERNAL_ERROR',
      } satisfies ErrorPayload);
      console.error('[LOCATION] location_update error:', error);
    }
  });

  /** Beneficiary requests to track a nurse */
  socket.on('track_nurse', (data: TrackNursePayload) => {
    try {
      const { nurseId } = data;

      if (!nurseId || typeof nurseId !== 'string') {
        socket.emit('error', {
          event: 'track_nurse',
          message: 'Invalid nurseId',
          code: 'INVALID_PAYLOAD',
        } satisfies ErrorPayload);
        return;
      }

      // Only beneficiaries and admins can track nurses
      if (user.role !== 'beneficiary' && user.role !== 'admin' && user.role !== 'subadmin') {
        socket.emit('error', {
          event: 'track_nurse',
          message: 'Only beneficiaries and admins can track nurses',
          code: 'FORBIDDEN',
        } satisfies ErrorPayload);
        return;
      }

      // Register tracking subscription
      if (!trackingSubscriptions.has(user.userId)) {
        trackingSubscriptions.set(user.userId, new Set());
      }
      trackingSubscriptions.get(user.userId)!.add(nurseId);

      // Send current nurse location if available
      const nurseStatus = nurseStatuses.get(nurseId);
      if (nurseStatus && nurseStatus.location) {
        const payload: LocationUpdatePayload = {
          nurseId,
          location: nurseStatus.location,
          heading: 0,
          speed: 0,
          batteryLevel: null,
          currentRequestId: null,
        };
        socket.emit('location_update', payload);
      }

      // Send nurse online status
      socket.emit('nurse_tracking_status', {
        nurseId,
        isOnline: nurseStatus?.isOnline ?? false,
        isAvailable: nurseStatus?.isAvailable ?? false,
        lastSeen: nurseStatus?.lastSeen ?? null,
      });

      console.log(
        `[TRACKING] User ${user.userId} started tracking nurse ${nurseId}`
      );
    } catch (error) {
      socket.emit('error', {
        event: 'track_nurse',
        message: 'Failed to start tracking nurse',
        code: 'INTERNAL_ERROR',
      } satisfies ErrorPayload);
      console.error('[LOCATION] track_nurse error:', error);
    }
  });

  /** Stop tracking a nurse */
  socket.on('stop_tracking', (data: StopTrackingPayload) => {
    try {
      const { nurseId } = data;

      // Remove tracking subscription
      const tracked = trackingSubscriptions.get(user.userId);
      if (tracked) {
        tracked.delete(nurseId);
        if (tracked.size === 0) {
          trackingSubscriptions.delete(user.userId);
        }
      }

      console.log(
        `[TRACKING] User ${user.userId} stopped tracking nurse ${nurseId}`
      );
    } catch (error) {
      console.error('[LOCATION] stop_tracking error:', error);
    }
  });

  // ========================================================================
  // NOTIFICATION EVENTS
  // ========================================================================

  /** Push notification to a specific user */
  socket.on('notification', (data: NotificationPayload) => {
    try {
      const { userId } = data;

      if (!userId || typeof userId !== 'string') {
        socket.emit('error', {
          event: 'notification',
          message: 'Invalid userId in notification',
          code: 'INVALID_PAYLOAD',
        } satisfies ErrorPayload);
        return;
      }

      // Only admins/subadmins can send notifications to other users
      if (user.role !== 'admin' && user.role !== 'subadmin' && user.role !== 'system') {
        // Regular users can only receive, not send to others
        socket.emit('error', {
          event: 'notification',
          message: 'Insufficient permissions to send notifications',
          code: 'FORBIDDEN',
        } satisfies ErrorPayload);
        return;
      }

      // Send to the user's personal room
      io.to(getUserRoom(userId)).emit('notification', data);

      console.log(`[NOTIFICATION] Sent to user ${userId}: ${data.titleEn}`);
    } catch (error) {
      socket.emit('error', {
        event: 'notification',
        message: 'Failed to send notification',
        code: 'INTERNAL_ERROR',
      } satisfies ErrorPayload);
      console.error('[NOTIFICATION] notification error:', error);
    }
  });

  /** Mark notifications as read */
  socket.on('notification_read', (data: NotificationReadPayload) => {
    try {
      const { notificationIds } = data;

      if (!Array.isArray(notificationIds) || notificationIds.length === 0) {
        socket.emit('error', {
          event: 'notification_read',
          message: 'Invalid notificationIds',
          code: 'INVALID_PAYLOAD',
        } satisfies ErrorPayload);
        return;
      }

      // Acknowledge the read status
      socket.emit('notification_read_confirmed', {
        notificationIds,
        readBy: user.userId,
        readAt: new Date().toISOString(),
      });

      console.log(
        `[NOTIFICATION] User ${user.userId} read ${notificationIds.length} notifications`
      );
    } catch (error) {
      socket.emit('error', {
        event: 'notification_read',
        message: 'Failed to mark notifications as read',
        code: 'INTERNAL_ERROR',
      } satisfies ErrorPayload);
      console.error('[NOTIFICATION] notification_read error:', error);
    }
  });

  // ========================================================================
  // HEARTBEAT & CONNECTION MONITORING
  // ========================================================================

  /** Client heartbeat to confirm connection is alive */
  socket.on('heartbeat', () => {
    const connectedUser = getConnectedUser(socket.id);
    if (connectedUser) {
      connectedUser.lastHeartbeat = new Date().toISOString();
    }
  });

  // ========================================================================
  // UTILITY EVENTS
  // ========================================================================

  /** Set user display name (for better logging and typing indicators) */
  socket.on('set_user_info', (data: { name: string }) => {
    if (data.name && typeof data.name === 'string') {
      socket.data.userName = data.name;
      const connectedUser = getConnectedUser(socket.id);
      if (connectedUser) {
        connectedUser.name = data.name;
      }
    }
  });

  /** Get online nurses list */
  socket.on('get_online_nurses', () => {
    const onlineNurses: Array<{
      nurseId: string;
      isAvailable: boolean;
      location: Location | null;
    }> = [];

    for (const [nurseId, status] of nurseStatuses.entries()) {
      if (status.isOnline) {
        onlineNurses.push({
          nurseId,
          isAvailable: status.isAvailable,
          location: status.location,
        });
      }
    }

    socket.emit('online_nurses_list', {
      nurses: onlineNurses,
      count: onlineNurses.length,
    });
  });

  /** Get online status of a specific user */
  socket.on('get_user_status', (data: { userId: string }) => {
    const { userId } = data;
    const online = isUserOnline(userId);
    const nurseStatus = nurseStatuses.get(userId);

    socket.emit('user_status', {
      userId,
      isOnline: online,
      isAvailable: nurseStatus?.isAvailable ?? null,
      lastSeen: nurseStatus?.lastSeen ?? null,
    });
  });

  // ========================================================================
  // DISCONNECT HANDLER
  // ========================================================================

  socket.on('disconnect', (reason: string) => {
    const disconnectedUser = unregisterUser(socket.id);

    if (disconnectedUser) {
      console.log(
        `[DISCONNECT] User ${disconnectedUser.userId} (${disconnectedUser.role}) disconnected: ${reason}`
      );

      // Broadcast user offline status
      const offlinePayload: UserOfflinePayload = {
        userId: disconnectedUser.userId,
        role: disconnectedUser.role,
        name: disconnectedUser.name,
        lastSeen: new Date().toISOString(),
      };
      io.emit('user_offline', offlinePayload);

      // If nurse, broadcast availability change
      if (disconnectedUser.role === 'nurse') {
        const nursePayload: NurseAvailabilityChangedPayload = {
          nurseId: disconnectedUser.userId,
          isAvailable: false,
          isOnline: false,
        };
        io.emit('nurse_availability_changed', nursePayload);

        // Clean up tracking subscriptions for this nurse
        for (const [beneficiaryId, trackedNurses] of trackingSubscriptions.entries()) {
          if (trackedNurses.has(disconnectedUser.userId)) {
            // Notify beneficiary that nurse went offline
            io.to(getUserRoom(beneficiaryId)).emit('nurse_tracking_status', {
              nurseId: disconnectedUser.userId,
              isOnline: false,
              isAvailable: false,
              lastSeen: new Date().toISOString(),
            });
          }
        }

        console.log(
          `[NURSE] ${disconnectedUser.userId} went offline. Online nurses: ${getOnlineNurseCount()}`
        );
      }

      // Leave all chat rooms
      for (const chatId of disconnectedUser.activeChats) {
        const chatRoom = getChatRoom(chatId);
        socket.to(chatRoom).emit('user_left_chat', {
          chatId,
          userId: disconnectedUser.userId,
          leftAt: new Date().toISOString(),
        });
      }
    } else {
      console.log(`[DISCONNECT] Unknown socket ${socket.id} disconnected: ${reason}`);
    }
  });

  // ---- Error handler ----
  socket.on('error', (error: Error) => {
    console.error(`[SOCKET ERROR] Socket ${socket.id} (User: ${user.userId}):`, error);
  });
});

// ============================================================================
// HEARTBEAT MONITORING (periodic check for stale connections)
// ============================================================================

setInterval(() => {
  const now = Date.now();
  for (const [socketId, connectedUser] of connectedUsers.entries()) {
    const lastHeartbeat = new Date(connectedUser.lastHeartbeat).getTime();
    if (now - lastHeartbeat > HEARTBEAT_TIMEOUT) {
      console.log(
        `[HEARTBEAT] Forcing disconnect for stale socket ${socketId} (User: ${connectedUser.userId})`
      );
      const socket = io.sockets.sockets.get(socketId);
      if (socket) {
        socket.disconnect(true);
      }
    }
  }
}, HEARTBEAT_CHECK_INTERVAL);

// ============================================================================
// SERVER START & GRACEFUL SHUTDOWN
// ============================================================================

httpServer.listen(PORT, () => {
  console.log(`=============================================`);
  console.log(`  عافيتك Socket.IO Service`);
  console.log(`  Running on port ${PORT}`);
  console.log(`  JWT authentication: enabled`);
  console.log(`  Heartbeat check: ${HEARTBEAT_CHECK_INTERVAL}ms`);
  console.log(`=============================================`);
});

process.on('SIGTERM', () => {
  console.log('[SHUTDOWN] Received SIGTERM, shutting down...');
  io.disconnectSockets(true);
  httpServer.close(() => {
    console.log('[SHUTDOWN] Socket.IO server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[SHUTDOWN] Received SIGINT, shutting down...');
  io.disconnectSockets(true);
  httpServer.close(() => {
    console.log('[SHUTDOWN] Socket.IO server closed');
    process.exit(0);
  });
});
