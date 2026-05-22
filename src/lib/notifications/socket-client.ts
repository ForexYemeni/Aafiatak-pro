// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Socket.IO Server Client
// ============================================================================
// Client utility for Next.js API routes to emit events to the Socket.IO server.
// The Socket.IO server runs as a separate process on port 3003.
// This module communicates via HTTP requests to the server's internal API.
// ============================================================================

const SOCKET_SERVER_URL = process.env.SOCKET_SERVER_URL || 'http://localhost:3003';
const INTERNAL_API_KEY = process.env.SOCKET_INTERNAL_API_KEY || 'aafiatak-internal-socket-api-key';

interface SocketEmitOptions {
  userId?: string;
  userIds?: string[];
  role?: string;
  chatId?: string;
  event: string;
  payload: Record<string, unknown>;
}

type EmitTarget = 'user' | 'admins' | 'role' | 'chat' | 'broadcast' | 'notification';

interface SocketEmitResult {
  success: boolean;
  delivered?: number;
  room?: string;
  error?: string;
}

/**
 * Send an HTTP request to the Socket.IO server's internal API.
 */
async function sendToSocketServer(
  path: string,
  data: Record<string, unknown>
): Promise<SocketEmitResult> {
  try {
    const response = await fetch(`${SOCKET_SERVER_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-API-Key': INTERNAL_API_KEY,
      },
      body: JSON.stringify(data),
      signal: AbortSignal.timeout(500), // 500ms timeout - fail fast when socket server is down
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      console.warn('[SOCKET-CLIENT] Server error:', response.status, errorData);
      return { success: false, error: `Server error: ${response.status}` };
    }

    const result = await response.json();
    return { success: true, ...result };
  } catch (error: unknown) {
    // Socket server might not be running - that's OK, notifications still work via polling/push
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    if (errorMessage.includes('fetch') || errorMessage.includes('ECONNREFUSED') || errorMessage.includes('timeout')) {
      // Socket server not available - this is non-critical
      return { success: false, error: 'Socket server unavailable' };
    }
    console.warn('[SOCKET-CLIENT] Emit failed:', errorMessage);
    return { success: false, error: errorMessage };
  }
}

/**
 * Emit a real-time notification event to specific users via the Socket.IO server.
 * This is used alongside MongoDB notifications and Web Push for triple-delivery.
 *
 * @param userIds - Array of user IDs to receive the notification
 * @param notification - The notification data to emit
 * @returns Result indicating success/failure
 */
export async function emitNotificationToUsers(
  userIds: string[],
  notification: {
    id?: string;
    titleAr?: string;
    titleEn?: string;
    bodyAr?: string;
    bodyEn?: string;
    type?: string;
    priority?: string;
    data?: Record<string, unknown>;
    actionUrl?: string;
    voiceEnabled?: boolean;
    voiceText?: string;
  }
): Promise<SocketEmitResult> {
  const notifId = notification.id || `notif-${Date.now()}-${Math.random().toString(36).slice(2)}`;

  const payload = {
    id: notifId,
    titleAr: notification.titleAr || '',
    titleEn: notification.titleEn || '',
    bodyAr: notification.bodyAr || '',
    bodyEn: notification.bodyEn || '',
    type: notification.type || 'system',
    priority: notification.priority || 'medium',
    data: {
      ...(notification.data || {}),
      voiceAlert: notification.voiceEnabled || false,
      voiceText: notification.voiceText || '',
    },
    read: false,
    actionUrl: notification.actionUrl || null,
    createdAt: new Date().toISOString(),
  };

  return sendToSocketServer('/internal/notification', {
    userIds,
    event: 'notification',
    payload,
  });
}

/**
 * Emit an event to all admin and subadmin users.
 * Both roles are in the 'admins' room on the Socket.IO server.
 */
export async function emitToAdmins(
  event: string,
  payload: Record<string, unknown>
): Promise<SocketEmitResult> {
  return sendToSocketServer('/internal/emit-to-admins', { event, payload });
}

/**
 * Emit an event to a specific user's personal room.
 */
export async function emitToUser(
  userId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<SocketEmitResult> {
  return sendToSocketServer('/internal/emit-to-user', { userId, event, payload });
}

/**
 * Emit an event to all users of a specific role.
 */
export async function emitToRole(
  role: string,
  event: string,
  payload: Record<string, unknown>
): Promise<SocketEmitResult> {
  return sendToSocketServer('/internal/emit-to-role', { role, event, payload });
}

/**
 * Emit an event to a specific chat room.
 */
export async function emitToChat(
  chatId: string,
  event: string,
  payload: Record<string, unknown>
): Promise<SocketEmitResult> {
  return sendToSocketServer('/internal/emit-to-chat', { chatId, event, payload });
}

/**
 * Broadcast an event to all connected clients.
 */
export async function broadcast(
  event: string,
  payload: Record<string, unknown>
): Promise<SocketEmitResult> {
  return sendToSocketServer('/internal/broadcast', { event, payload });
}

/**
 * Check if the Socket.IO server is running and healthy.
 */
export async function isSocketServerHealthy(): Promise<boolean> {
  try {
    const response = await fetch(`${SOCKET_SERVER_URL}/health`, {
      signal: AbortSignal.timeout(2000),
    });
    return response.ok;
  } catch {
    return false;
  }
}
