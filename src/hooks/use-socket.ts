'use client';

// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Socket.IO React Hooks
// ============================================================================
// Typed React hooks for real-time communication via Socket.IO.
// Integrates with the auth store for automatic connection management.
// ============================================================================

import { useEffect, useState, useCallback, useRef } from 'react';
import { socketService } from '@/lib/socket';
import { useAuthStore } from '@/lib/stores/auth-store';
import type {
  UserRole,
  MessageType,
  ServiceRequestStatus,
  EmergencyStatus,
  EmergencyType,
  NotificationPriority,
  NotificationType,
} from '@/types';
import type {
  ConnectionState,
  SocketMessage,
  NewMessageEvent,
  TypingEvent,
  ReadReceiptEvent,
  MessageDeliveredEvent,
  OrderCreatedEvent,
  OrderAssignedEvent,
  OrderStatusChangedEvent,
  OrderCancelledEvent,
  OrderUpdateEvent,
  EmergencyCreatedEvent,
  EmergencyDispatchedEvent,
  EmergencyResolvedEvent,
  EmergencyCancelledEvent,
  EmergencyUpdateEvent,
  EmergencyAlertEvent,
  LocationUpdateEvent,
  NurseTrackingStatusEvent,
  NotificationEvent,
  UserOnlineEvent,
  UserOfflineEvent,
  NurseAvailabilityChangedEvent,
  UserStatusEvent,
  OnlineNursesListEvent,
  SocketErrorEvent,
  ClientLocation,
  ClientQuickReply,
} from '@/lib/socket';

// ============================================================================
// useSocket - Core Socket Connection Hook
// ============================================================================

/** Return type for useSocket hook */
interface UseSocketReturn {
  /** Current connection state */
  connectionState: ConnectionState;
  /** Whether the socket is connected */
  isConnected: boolean;
  /** Manually connect with a token */
  connect: (token: string) => void;
  /** Manually disconnect */
  disconnect: () => void;
  /** The underlying socket service instance */
  service: typeof socketService;
}

/**
 * Core socket hook - manages connection lifecycle.
 * Automatically connects/disconnects based on auth state.
 */
export function useSocket(): UseSocketReturn {
  const token = useAuthStore((state) => state.token);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const [connectionState, setConnectionState] = useState<ConnectionState>(
    socketService.connectionState
  );

  useEffect(() => {
    // Subscribe to connection state changes
    const unsubscribe = socketService.onConnectionStateChange((state) => {
      setConnectionState(state);
    });

    return unsubscribe;
  }, []);

  useEffect(() => {
    if (isAuthenticated && token) {
      // Connect when authenticated
      socketService.connect(token);

      // Set user info if available
      if (user?.name) {
        socketService.setUserInfo(user.name);
      }
    } else {
      // Disconnect when not authenticated
      socketService.disconnect();
    }

    // Cleanup on unmount
    return () => {
      // Don't disconnect on unmount - the singleton persists
    };
  }, [isAuthenticated, token, user?.name]);

  const connect = useCallback((tokenStr: string) => {
    socketService.connect(tokenStr);
  }, []);

  const disconnect = useCallback(() => {
    socketService.disconnect();
  }, []);

  return {
    connectionState,
    isConnected: connectionState === 'connected',
    connect,
    disconnect,
    service: socketService,
  };
}

// ============================================================================
// useChat - Chat Room Management Hook
// ============================================================================

/** Chat state managed by useChat hook */
interface UseChatReturn {
  /** Messages in the chat */
  messages: SocketMessage[];
  /** Typing users in the chat */
  typingUsers: Map<string, { userId: string; userName: string }>;
  /** Whether the user has joined the chat room */
  hasJoined: boolean;
  /** Send a text message */
  sendMessage: (content: string, type?: MessageType) => void;
  /** Send a message with image */
  sendImageMessage: (content: string, imageUrl: string) => void;
  /** Send a reply to a message */
  replyToMessage: (content: string, replyToMessageId: string) => void;
  /** Start typing indicator */
  startTyping: () => void;
  /** Stop typing indicator */
  stopTyping: () => void;
  /** Mark messages as read */
  markAsRead: (messageIds: string[]) => void;
  /** Join the chat room */
  joinChat: () => void;
  /** Leave the chat room */
  leaveChat: () => void;
  /** Last error from socket */
  lastError: SocketErrorEvent | null;
}

/**
 * Hook for managing a specific chat room.
 * Handles joining/leaving, messages, typing indicators, and read receipts.
 */
export function useChat(chatId: string): UseChatReturn {
  const isConnected = useSocket().isConnected;
  const [messages, setMessages] = useState<SocketMessage[]>([]);
  const [typingUsers, setTypingUsers] = useState<
    Map<string, { userId: string; userName: string }>
  >(new Map());
  // Derive hasJoined from connection state and chatId
  const hasJoined = isConnected && Boolean(chatId);
  const [lastError, setLastError] = useState<SocketErrorEvent | null>(null);
  const user = useAuthStore((state) => state.user);

  // Join/leave chat when connection state changes
  useEffect(() => {
    if (isConnected && chatId) {
      socketService.joinChat(chatId);
    }

    return () => {
      if (chatId) {
        socketService.leaveChat(chatId);
      }
    };
  }, [isConnected, chatId]);

  // Listen for new messages
  useEffect(() => {
    const unsubscribe = socketService.onMessage((data: NewMessageEvent) => {
      if (data.chatId === chatId) {
        setMessages((prev) => {
          // Avoid duplicates
          if (prev.some((m) => m.id === data.message.id)) {
            return prev;
          }
          return [...prev, data.message];
        });
      }
    });

    return unsubscribe;
  }, [chatId]);

  // Listen for typing indicators
  useEffect(() => {
    const unsubscribe = socketService.onTyping((data: TypingEvent) => {
      if (data.chatId === chatId) {
        setTypingUsers((prev) => {
          const next = new Map(prev);
          if (data.isTyping) {
            next.set(data.userId, {
              userId: data.userId,
              userName: data.userName,
            });
          } else {
            next.delete(data.userId);
          }
          return next;
        });
      }
    });

    return unsubscribe;
  }, [chatId]);

  // Listen for read receipts
  useEffect(() => {
    const unsubscribe = socketService.onReadReceipt((data: ReadReceiptEvent) => {
      if (data.chatId === chatId) {
        setMessages((prev) =>
          prev.map((msg) => {
            if (data.messageIds.includes(msg.id)) {
              return {
                ...msg,
                readBy: msg.readBy.includes(data.readBy)
                  ? msg.readBy
                  : [...msg.readBy, data.readBy],
              };
            }
            return msg;
          })
        );
      }
    });

    return unsubscribe;
  }, [chatId]);

  // Listen for socket errors
  useEffect(() => {
    const unsubscribe = socketService.onSocketError((error) => {
      setLastError(error);
    });

    return unsubscribe;
  }, []);

  const sendMessage = useCallback(
    (content: string, type: MessageType = 'text') => {
      socketService.sendMessage(chatId, content, type);
    },
    [chatId]
  );

  const sendImageMessage = useCallback(
    (content: string, imageUrl: string) => {
      socketService.sendMessage(chatId, content, 'image', { imageUrl });
    },
    [chatId]
  );

  const replyToMessage = useCallback(
    (content: string, replyToMessageId: string) => {
      socketService.sendMessage(chatId, content, 'text', {
        replyTo: replyToMessageId,
      });
    },
    [chatId]
  );

  const startTyping = useCallback(() => {
    socketService.startTyping(chatId);
  }, [chatId]);

  const stopTyping = useCallback(() => {
    socketService.stopTyping(chatId);
  }, [chatId]);

  const markAsRead = useCallback(
    (messageIds: string[]) => {
      socketService.markMessagesRead(chatId, messageIds);
    },
    [chatId]
  );

  const joinChat = useCallback(() => {
    socketService.joinChat(chatId);
  }, [chatId]);

  const leaveChat = useCallback(() => {
    socketService.leaveChat(chatId);
  }, [chatId]);

  return {
    messages,
    typingUsers,
    hasJoined,
    sendMessage,
    sendImageMessage,
    replyToMessage,
    startTyping,
    stopTyping,
    markAsRead,
    joinChat,
    leaveChat,
    lastError,
  };
}

// ============================================================================
// useOrderUpdates - Order Real-Time Updates Hook
// ============================================================================

/** Order update state */
interface UseOrderUpdatesReturn {
  /** Latest order created event */
  latestOrderCreated: OrderCreatedEvent | null;
  /** Latest order assigned event */
  latestOrderAssigned: OrderAssignedEvent | null;
  /** Latest order status changed event */
  latestStatusChange: OrderStatusChangedEvent | null;
  /** Latest order cancelled event */
  latestOrderCancelled: OrderCancelledEvent | null;
  /** Latest general order update */
  latestOrderUpdate: OrderUpdateEvent | null;
  /** All order events (for activity feed) */
  orderEvents: Array<
    | { type: 'created'; data: OrderCreatedEvent }
    | { type: 'assigned'; data: OrderAssignedEvent }
    | { type: 'status_changed'; data: OrderStatusChangedEvent }
    | { type: 'cancelled'; data: OrderCancelledEvent }
  >;
}

/**
 * Hook for listening to real-time order updates.
 * Used by nurses (for new orders), beneficiaries (for status changes),
 * and admins (for all order events).
 */
export function useOrderUpdates(): UseOrderUpdatesReturn {
  const [latestOrderCreated, setLatestOrderCreated] =
    useState<OrderCreatedEvent | null>(null);
  const [latestOrderAssigned, setLatestOrderAssigned] =
    useState<OrderAssignedEvent | null>(null);
  const [latestStatusChange, setLatestStatusChange] =
    useState<OrderStatusChangedEvent | null>(null);
  const [latestOrderCancelled, setLatestOrderCancelled] =
    useState<OrderCancelledEvent | null>(null);
  const [latestOrderUpdate, setLatestOrderUpdate] =
    useState<OrderUpdateEvent | null>(null);
  const [orderEvents, setOrderEvents] = useState<
    UseOrderUpdatesReturn['orderEvents']
  >([]);

  useEffect(() => {
    const unsubCreated = socketService.onOrderCreated((data) => {
      setLatestOrderCreated(data);
      setOrderEvents((prev) => [
        ...prev.slice(-49), // Keep last 50 events
        { type: 'created', data },
      ]);
    });

    const unsubAssigned = socketService.onOrderAssigned((data) => {
      setLatestOrderAssigned(data);
      setOrderEvents((prev) => [
        ...prev.slice(-49),
        { type: 'assigned', data },
      ]);
    });

    const unsubStatus = socketService.onOrderStatusChanged((data) => {
      setLatestStatusChange(data);
      setOrderEvents((prev) => [
        ...prev.slice(-49),
        { type: 'status_changed', data },
      ]);
    });

    const unsubCancelled = socketService.onOrderCancelled((data) => {
      setLatestOrderCancelled(data);
      setOrderEvents((prev) => [
        ...prev.slice(-49),
        { type: 'cancelled', data },
      ]);
    });

    const unsubUpdate = socketService.onOrderUpdate((data) => {
      setLatestOrderUpdate(data);
    });

    return () => {
      unsubCreated();
      unsubAssigned();
      unsubStatus();
      unsubCancelled();
      unsubUpdate();
    };
  }, []);

  return {
    latestOrderCreated,
    latestOrderAssigned,
    latestStatusChange,
    latestOrderCancelled,
    latestOrderUpdate,
    orderEvents,
  };
}

// ============================================================================
// useEmergencyAlerts - Emergency Real-Time Alerts Hook
// ============================================================================

/** Emergency alert state */
interface UseEmergencyAlertsReturn {
  /** Active emergency alert (for nurse notifications) */
  activeAlert: EmergencyAlertEvent | null;
  /** Latest emergency created event */
  latestEmergencyCreated: EmergencyCreatedEvent | null;
  /** Latest emergency dispatched event */
  latestEmergencyDispatched: EmergencyDispatchedEvent | null;
  /** Latest emergency resolved event */
  latestEmergencyResolved: EmergencyResolvedEvent | null;
  /** Latest emergency cancelled event */
  latestEmergencyCancelled: EmergencyCancelledEvent | null;
  /** Latest emergency update event */
  latestEmergencyUpdate: EmergencyUpdateEvent | null;
  /** Clear the active alert */
  clearActiveAlert: () => void;
}

/**
 * Hook for listening to real-time emergency alerts.
 * Used by nurses (for dispatch notifications) and admins (for monitoring).
 */
export function useEmergencyAlerts(): UseEmergencyAlertsReturn {
  const [activeAlert, setActiveAlert] = useState<EmergencyAlertEvent | null>(
    null
  );
  const [latestEmergencyCreated, setLatestEmergencyCreated] =
    useState<EmergencyCreatedEvent | null>(null);
  const [latestEmergencyDispatched, setLatestEmergencyDispatched] =
    useState<EmergencyDispatchedEvent | null>(null);
  const [latestEmergencyResolved, setLatestEmergencyResolved] =
    useState<EmergencyResolvedEvent | null>(null);
  const [latestEmergencyCancelled, setLatestEmergencyCancelled] =
    useState<EmergencyCancelledEvent | null>(null);
  const [latestEmergencyUpdate, setLatestEmergencyUpdate] =
    useState<EmergencyUpdateEvent | null>(null);

  useEffect(() => {
    const unsubAlert = socketService.onEmergencyAlert((data) => {
      setActiveAlert(data);
    });

    const unsubCreated = socketService.onEmergencyCreated((data) => {
      setLatestEmergencyCreated(data);
      // Also set as active alert for nurses
      setActiveAlert({
        emergencyRequestId: data.emergencyRequestId,
        type: data.type,
        location: data.location,
        beneficiaryId: data.beneficiaryId,
        description: data.description,
      });
    });

    const unsubDispatched = socketService.onEmergencyDispatched((data) => {
      setLatestEmergencyDispatched(data);
    });

    const unsubResolved = socketService.onEmergencyResolved((data) => {
      setLatestEmergencyResolved(data);
    });

    const unsubCancelled = socketService.onEmergencyCancelled((data) => {
      setLatestEmergencyCancelled(data);
    });

    const unsubUpdate = socketService.onEmergencyUpdate((data) => {
      setLatestEmergencyUpdate(data);
      // Clear active alert if resolved or cancelled
      if (data.status === 'resolved' || data.status === 'cancelled') {
        setActiveAlert(null);
      }
    });

    return () => {
      unsubAlert();
      unsubCreated();
      unsubDispatched();
      unsubResolved();
      unsubCancelled();
      unsubUpdate();
    };
  }, []);

  const clearActiveAlert = useCallback(() => {
    setActiveAlert(null);
  }, []);

  return {
    activeAlert,
    latestEmergencyCreated,
    latestEmergencyDispatched,
    latestEmergencyResolved,
    latestEmergencyCancelled,
    latestEmergencyUpdate,
    clearActiveAlert,
  };
}

// ============================================================================
// useNurseTracking - Nurse Location Tracking Hook
// ============================================================================

/** Nurse tracking state */
interface UseNurseTrackingReturn {
  /** Current nurse location */
  location: ClientLocation | null;
  /** Whether the nurse is online */
  isOnline: boolean;
  /** Whether the nurse is available */
  isAvailable: boolean;
  /** Last seen timestamp */
  lastSeen: string | null;
  /** Location heading (direction) */
  heading: number;
  /** Speed of movement */
  speed: number;
  /** Battery level of nurse's device */
  batteryLevel: number | null;
  /** Whether tracking is active */
  isTracking: boolean;
  /** Start tracking the nurse */
  startTracking: () => void;
  /** Stop tracking the nurse */
  stopTracking: () => void;
}

/**
 * Hook for tracking a nurse's real-time location.
 * Used by beneficiaries and admins to track nurse approach.
 */
export function useNurseTracking(nurseId: string): UseNurseTrackingReturn {
  const isConnected = useSocket().isConnected;
  const [location, setLocation] = useState<ClientLocation | null>(null);
  const [isOnline, setIsOnline] = useState(false);
  const [isAvailable, setIsAvailable] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const [heading, setHeading] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const [isTracking, setIsTracking] = useState(false);

  // Start/stop tracking when connected
  useEffect(() => {
    if (isConnected && nurseId && isTracking) {
      socketService.trackNurse(nurseId);
    }

    return () => {
      if (nurseId) {
        socketService.stopTracking(nurseId);
      }
    };
  }, [isConnected, nurseId, isTracking]);

  // Listen for location updates
  useEffect(() => {
    const unsubLocation = socketService.onLocationUpdate((data) => {
      if (data.nurseId === nurseId) {
        setLocation(data.location);
        setHeading(data.heading);
        setSpeed(data.speed);
        setBatteryLevel(data.batteryLevel);
      }
    });

    const unsubStatus = socketService.onNurseTrackingStatus((data) => {
      if (data.nurseId === nurseId) {
        setIsOnline(data.isOnline);
        setIsAvailable(data.isAvailable);
        setLastSeen(data.lastSeen ?? null);
      }
    });

    const unsubAvailability = socketService.onNurseAvailabilityChanged(
      (data) => {
        if (data.nurseId === nurseId) {
          setIsOnline(data.isOnline);
          setIsAvailable(data.isAvailable);
        }
      }
    );

    const unsubOffline = socketService.onUserOffline((data) => {
      if (data.userId === nurseId) {
        setIsOnline(false);
        setLastSeen(data.lastSeen);
      }
    });

    const unsubOnline = socketService.onUserOnline((data) => {
      if (data.userId === nurseId) {
        setIsOnline(true);
      }
    });

    return () => {
      unsubLocation();
      unsubStatus();
      unsubAvailability();
      unsubOffline();
      unsubOnline();
    };
  }, [nurseId]);

  const startTracking = useCallback(() => {
    setIsTracking(true);
  }, []);

  const stopTracking = useCallback(() => {
    setIsTracking(false);
    socketService.stopTracking(nurseId);
  }, [nurseId]);

  return {
    location,
    isOnline,
    isAvailable,
    lastSeen,
    heading,
    speed,
    batteryLevel,
    isTracking,
    startTracking,
    stopTracking,
  };
}

// ============================================================================
// useNotifications - Real-Time Notifications Hook
// ============================================================================

/** Notification state */
interface UseNotificationsReturn {
  /** Unread notifications */
  unreadNotifications: NotificationEvent[];
  /** All received notifications (limited to last 100) */
  notifications: NotificationEvent[];
  /** Count of unread notifications */
  unreadCount: number;
  /** Mark notifications as read */
  markAsRead: (notificationIds: string[]) => void;
  /** Clear all local notifications */
  clearAll: () => void;
}

/**
 * Hook for listening to real-time notifications.
 * Manages unread count and notification list in local state.
 */
export function useNotifications(): UseNotificationsReturn {
  const [notifications, setNotifications] = useState<NotificationEvent[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState<
    NotificationEvent[]
  >([]);

  // Listen for notifications
  useEffect(() => {
    const unsub = socketService.onNotification((data) => {
      setNotifications((prev) => [data, ...prev].slice(0, 100));
      if (!data.read) {
        setUnreadNotifications((prev) => [data, ...prev]);
      }
    });

    return unsub;
  }, []);

  // Listen for notification read confirmations
  useEffect(() => {
    const unsub = socketService.onNotificationReadConfirmed((data) => {
      setUnreadNotifications((prev) =>
        prev.filter((n) => !data.notificationIds.includes(n.id))
      );
      setNotifications((prev) =>
        prev.map((n) =>
          data.notificationIds.includes(n.id) ? { ...n, read: true } : n
        )
      );
    });

    return unsub;
  }, []);

  const markAsRead = useCallback((notificationIds: string[]) => {
    socketService.markNotificationsRead(notificationIds);
  }, []);

  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadNotifications([]);
  }, []);

  return {
    unreadNotifications,
    notifications,
    unreadCount: unreadNotifications.length,
    markAsRead,
    clearAll,
  };
}

// ============================================================================
// useOnlineNurses - Online Nurse Status Hook
// ============================================================================

/** Online nurse info */
interface OnlineNurse {
  nurseId: string;
  isAvailable: boolean;
  location: ClientLocation | null;
}

/** Online nurses state */
interface UseOnlineNursesReturn {
  /** List of online nurses */
  nurses: OnlineNurse[];
  /** Total count of online nurses */
  count: number;
  /** Refresh the online nurses list */
  refresh: () => void;
}

/**
 * Hook for tracking which nurses are currently online.
 * Used by admins and for order assignment.
 */
export function useOnlineNurses(): UseOnlineNursesReturn {
  const [nurses, setNurses] = useState<OnlineNurse[]>([]);

  // Listen for online nurses list
  useEffect(() => {
    const unsub = socketService.onOnlineNursesList((data) => {
      setNurses(data.nurses);
    });

    return unsub;
  }, []);

  // Listen for nurse availability changes
  useEffect(() => {
    const unsubAvailability = socketService.onNurseAvailabilityChanged(
      (data) => {
        setNurses((prev) => {
          if (data.isOnline) {
            // Add or update nurse
            const exists = prev.find((n) => n.nurseId === data.nurseId);
            if (exists) {
              return prev.map((n) =>
                n.nurseId === data.nurseId
                  ? { ...n, isAvailable: data.isAvailable }
                  : n
              );
            }
            return [
              ...prev,
              {
                nurseId: data.nurseId,
                isAvailable: data.isAvailable,
                location: null,
              },
            ];
          }
          // Remove nurse if offline
          return prev.filter((n) => n.nurseId !== data.nurseId);
        });
      }
    );

    const unsubLocation = socketService.onLocationUpdate((data) => {
      setNurses((prev) =>
        prev.map((n) =>
          n.nurseId === data.nurseId
            ? { ...n, location: data.location }
            : n
        )
      );
    });

    return () => {
      unsubAvailability();
      unsubLocation();
    };
  }, []);

  const refresh = useCallback(() => {
    socketService.getOnlineNurses();
  }, []);

  return {
    nurses,
    count: nurses.length,
    refresh,
  };
}

// ============================================================================
// useUserPresence - User Online/Offline Status Hook
// ============================================================================

/** User presence info */
interface UserPresence {
  userId: string;
  role: UserRole;
  name: string;
  isOnline: boolean;
  lastSeen: string | null;
}

/** User presence state */
interface UseUserPresenceReturn {
  /** Map of user IDs to presence info */
  presences: Map<string, UserPresence>;
  /** Check if a specific user is online */
  isUserOnline: (userId: string) => boolean;
  /** Request status of a specific user */
  requestUserStatus: (userId: string) => void;
}

/**
 * Hook for tracking online/offline status of users.
 */
export function useUserPresence(): UseUserPresenceReturn {
  const [presences, setPresences] = useState<Map<string, UserPresence>>(
    new Map()
  );

  useEffect(() => {
    const unsubOnline = socketService.onUserOnline((data) => {
      setPresences((prev) => {
        const next = new Map(prev);
        next.set(data.userId, {
          userId: data.userId,
          role: data.role,
          name: data.name,
          isOnline: true,
          lastSeen: null,
        });
        return next;
      });
    });

    const unsubOffline = socketService.onUserOffline((data) => {
      setPresences((prev) => {
        const next = new Map(prev);
        const existing = prev.get(data.userId);
        next.set(data.userId, {
          userId: data.userId,
          role: data.role,
          name: data.name,
          isOnline: false,
          lastSeen: data.lastSeen,
        });
        return next;
      });
    });

    const unsubStatus = socketService.onUserStatus((data) => {
      setPresences((prev) => {
        const next = new Map(prev);
        next.set(data.userId, {
          userId: data.userId,
          role: 'nurse', // Default, would need more context
          name: data.userId,
          isOnline: data.isOnline,
          lastSeen: data.lastSeen,
        });
        return next;
      });
    });

    return () => {
      unsubOnline();
      unsubOffline();
      unsubStatus();
    };
  }, []);

  const isUserOnline = useCallback(
    (userId: string): boolean => {
      return presences.get(userId)?.isOnline ?? false;
    },
    [presences]
  );

  const requestUserStatus = useCallback((userId: string) => {
    socketService.getUserStatus(userId);
  }, []);

  return {
    presences,
    isUserOnline,
    requestUserStatus,
  };
}
