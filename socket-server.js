// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Socket.IO Server
// ============================================================================
// Standalone Socket.IO server for real-time notifications.
// Runs on port 3003, behind Caddy reverse proxy.
//
// Features:
//  - JWT authentication on connection
//  - Room-based broadcasting (by userId, role, chat)
//  - Admin + Subadmin notifications: both join 'admins' room
//  - Internal HTTP API for Next.js routes to emit events
//  - Heartbeat health monitoring
//  - MongoDB-backed user tracking
// ============================================================================

const { Server } = require('socket.io');
const http = require('http');
const jwt = require('jsonwebtoken');

// ── Configuration ──────────────────────────────────────────────────
const PORT = parseInt(process.env.SOCKET_PORT || '3003', 10);
const JWT_SECRET = process.env.JWT_SECRET || process.env.NEXTAUTH_SECRET || 'aafiatak-secret-key-change-in-production';
const INTERNAL_API_KEY = process.env.SOCKET_INTERNAL_API_KEY || 'aafiatak-internal-socket-api-key';
const MONGODB_URI = process.env.MONGODB_URI || process.env.DATABASE_URL || '';
const CORS_ORIGINS = (process.env.SOCKET_CORS_ORIGINS || '*').split(',').map(s => s.trim());

// ── MongoDB Connection (optional - for user lookups) ───────────────
let mongoose = null;
let User = null;

async function connectMongo() {
  if (!MONGODB_URI) {
    console.log('[SOCKET] No MongoDB URI - running without database');
    return;
  }
  try {
    mongoose = require('mongoose');
    await mongoose.connect(MONGODB_URI);
    console.log('[SOCKET] Connected to MongoDB');

    // Define User schema if not already defined
    try {
      User = mongoose.model('User');
    } catch {
      const userSchema = new mongoose.Schema({
        name: String,
        email: String,
        role: String,
        permissions: [String],
        isActive: { type: Boolean, default: true },
      }, { collection: 'users' });
      User = mongoose.model('User', userSchema);
    }
  } catch (err) {
    console.error('[SOCKET] MongoDB connection failed:', err.message);
  }
}

// ── Create Socket.IO Server ───────────────────────────────────────
const server = http.createServer();
const io = new Server(server, {
  cors: {
    origin: CORS_ORIGINS,
    methods: ['GET', 'POST'],
    credentials: true,
  },
  pingInterval: 25000,
  pingTimeout: 60000,
  connectTimeout: 10000,
  transports: ['websocket', 'polling'],
});

// ── Connected Users Tracking ──────────────────────────────────────
const connectedUsers = new Map(); // socketId -> { userId, role, name, socket }

function getUserRoom(userId) {
  return `user:${userId}`;
}

function getRoleRoom(role) {
  if (role === 'admin' || role === 'subadmin') return 'admins';
  if (role === 'nurse') return 'nurses';
  if (role === 'beneficiary') return 'beneficiaries';
  return role;
}

// ── JWT Verification ──────────────────────────────────────────────
function verifyToken(token) {
  try {
    if (!token) return null;
    // Remove 'Bearer ' prefix if present
    const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
    const decoded = jwt.verify(cleanToken, JWT_SECRET);
    return decoded;
  } catch (err) {
    return null;
  }
}

// ── Socket Connection Handler ─────────────────────────────────────
io.use(async (socket, next) => {
  const token = socket.handshake.auth?.token || socket.handshake.query?.token;

  if (!token) {
    console.warn('[SOCKET] Connection rejected - no token');
    return next(new Error('Authentication required'));
  }

  const decoded = verifyToken(token);
  if (!decoded) {
    console.warn('[SOCKET] Connection rejected - invalid token');
    return next(new Error('Invalid token'));
  }

  // Attach user info to socket
  socket.data.userId = decoded.userId || decoded.id || decoded.sub;
  socket.data.role = decoded.role;
  socket.data.name = decoded.name || '';
  socket.data.permissions = decoded.permissions || [];

  // Check if user is active (if MongoDB is connected)
  if (User && socket.data.userId) {
    try {
      const user = await User.findById(socket.data.userId).select('isActive role').lean();
      if (!user || !user.isActive) {
        console.warn(`[SOCKET] Connection rejected - user inactive: ${socket.data.userId}`);
        return next(new Error('User account is inactive'));
      }
      // Update role from database (more reliable than JWT)
      socket.data.role = user.role;
    } catch (err) {
      // Continue even if DB lookup fails
    }
  }

  console.log(`[SOCKET] Authenticated: ${socket.data.userId} (${socket.data.role})`);
  next();
});

io.on('connection', (socket) => {
  const { userId, role, name } = socket.data;

  // ── Track connected user ──────────────────────────────────────
  connectedUsers.set(socket.id, { userId, role, name, socket });

  // ── Join rooms ────────────────────────────────────────────────
  // 1. Personal room (for direct messages/notifications)
  socket.join(getUserRoom(userId));

  // 2. Role-based room
  // IMPORTANT: Both admin AND subadmin join the 'admins' room
  // This ensures subadmins receive ALL admin notifications in real-time
  const roleRoom = getRoleRoom(role);
  socket.join(roleRoom);

  // 3. Also join a specific role room (to distinguish admin from subadmin if needed)
  socket.join(`role:${role}`);

  console.log(`[SOCKET] User connected: ${name} (${userId}) role=${role} | Total: ${connectedUsers.size}`);

  // ── Send connection confirmation ──────────────────────────────
  socket.emit('connected', {
    userId,
    role,
    socketId: socket.id,
    serverTime: new Date().toISOString(),
  });

  // ── Heartbeat ─────────────────────────────────────────────────
  socket.on('heartbeat', () => {
    socket.emit('heartbeat_ack', { timestamp: Date.now() });
  });

  // ── Set user info (update display name, etc.) ────────────────
  socket.on('set_user_info', (data) => {
    if (data.name) socket.data.name = data.name;
    if (connectedUsers.has(socket.id)) {
      connectedUsers.set(socket.id, { ...connectedUsers.get(socket.id), ...data });
    }
  });

  // ── Chat Events ──────────────────────────────────────────────
  socket.on('join_chat', (data) => {
    if (data?.chatId) {
      socket.join(`chat:${data.chatId}`);
    }
  });

  socket.on('leave_chat', (data) => {
    if (data?.chatId) {
      socket.leave(`chat:${data.chatId}`);
    }
  });

  socket.on('send_message', (data) => {
    if (!data?.chatId) return;
    // Broadcast to everyone in the chat room EXCEPT sender
    socket.to(`chat:${data.chatId}`).emit('new_message', data);
  });

  socket.on('typing_start', (data) => {
    if (!data?.chatId) return;
    socket.to(`chat:${data.chatId}`).emit('typing', {
      chatId: data.chatId,
      userId,
      userName: name,
      isTyping: true,
    });
  });

  socket.on('typing_stop', (data) => {
    if (!data?.chatId) return;
    socket.to(`chat:${data.chatId}`).emit('typing', {
      chatId: data.chatId,
      userId,
      userName: name,
      isTyping: false,
    });
  });

  socket.on('message_read', (data) => {
    if (!data?.chatId) return;
    socket.to(`chat:${data.chatId}`).emit('read_receipt', {
      chatId: data.chatId,
      messageIds: data.messageIds || [],
      readBy: userId,
    });
  });

  // ── Order Events ──────────────────────────────────────────────
  socket.on('order_created', (data) => {
    // Notify admins room (includes subadmins)
    io.to('admins').emit('order_created', data);
    // Also notify the specific beneficiary
    if (data.beneficiaryId) {
      io.to(getUserRoom(data.beneficiaryId)).emit('notification', {
        id: `order-${data.requestId}-${Date.now()}`,
        userId: data.beneficiaryId,
        titleAr: 'تم إنشاء طلبك',
        titleEn: 'Your order has been created',
        bodyAr: data.isEmergency ? 'طلب طوارئ' : 'طلب خدمة جديد',
        bodyEn: data.isEmergency ? 'Emergency request' : 'New service request',
        type: 'service_request',
        priority: data.isEmergency ? 'urgent' : 'high',
        data: data,
        read: false,
        actionUrl: `/beneficiary/orders/${data.requestId}`,
        createdAt: new Date().toISOString(),
      });
    }
  });

  socket.on('order_assigned', (data) => {
    io.to('admins').emit('order_assigned', data);
    if (data.nurseId) {
      io.to(getUserRoom(data.nurseId)).emit('notification', {
        id: `assign-${data.requestId}-${Date.now()}`,
        userId: data.nurseId,
        titleAr: 'تم تعيينك لطلب جديد',
        titleEn: 'You have been assigned a new order',
        bodyAr: `طلب من ${data.beneficiaryName || 'مستفيد'}`,
        bodyEn: `Order from ${data.beneficiaryName || 'beneficiary'}`,
        type: 'assignment',
        priority: 'high',
        data: data,
        read: false,
        actionUrl: '/nurse',
        createdAt: new Date().toISOString(),
      });
    }
  });

  socket.on('order_status_changed', (data) => {
    io.to('admins').emit('order_status_changed', data);
    io.to('admins').emit('order_update', data);
    if (data.nurseId) io.to(getUserRoom(data.nurseId)).emit('order_update', data);
  });

  socket.on('order_cancelled', (data) => {
    io.to('admins').emit('order_cancelled', data);
  });

  // ── Emergency Events ──────────────────────────────────────────
  socket.on('emergency_created', (data) => {
    // CRITICAL: Notify ALL admins (admin + subadmin) immediately
    io.to('admins').emit('emergency_created', data);
    io.to('admins').emit('emergency_alert', data);
    // Also notify nearby nurses (handled by the API route)
  });

  socket.on('emergency_dispatched', (data) => {
    io.to('admins').emit('emergency_dispatched', data);
    if (data.nurseId) {
      io.to(getUserRoom(data.nurseId)).emit('emergency_dispatched', data);
      io.to(getUserRoom(data.nurseId)).emit('notification', {
        id: `emergency-dispatch-${data.emergencyRequestId}-${Date.now()}`,
        userId: data.nurseId,
        titleAr: '🚨 تم تعيينك لحالة طوارئ!',
        titleEn: '🚨 Emergency assigned to you!',
        bodyAr: `حالة طوارئ - الممرض ${data.nurseName || ''}`,
        bodyEn: `Emergency case - Nurse ${data.nurseName || ''}`,
        type: 'emergency_assigned',
        priority: 'urgent',
        data: { ...data, voiceAlert: true, voiceText: `تم تعيينك لحالة طوارئ` },
        read: false,
        actionUrl: '/nurse',
        createdAt: new Date().toISOString(),
      });
    }
  });

  socket.on('emergency_resolved', (data) => {
    io.to('admins').emit('emergency_resolved', data);
  });

  socket.on('emergency_cancelled', (data) => {
    io.to('admins').emit('emergency_cancelled', data);
  });

  // ── Location Events ───────────────────────────────────────────
  socket.on('location_update', (data) => {
    // Only nurses should send location updates
    if (role !== 'nurse') return;
    socket.broadcast.emit('location_update', data);
    // Also emit to admins room
    io.to('admins').emit('location_update', data);
  });

  // ── Tracking Events ───────────────────────────────────────────
  socket.on('track_nurse', (data) => {
    if (!data?.nurseId) return;
    // Join a tracking room for this nurse
    socket.join(`track:${data.nurseId}`);
  });

  socket.on('stop_tracking', (data) => {
    if (!data?.nurseId) return;
    socket.leave(`track:${data.nurseId}`);
  });

  // ── Notification Events ───────────────────────────────────────
  socket.on('notification_read', (data) => {
    if (!data?.notificationIds) return;
    socket.broadcast.emit('notification_read_confirmed', {
      notificationIds: data.notificationIds,
      readBy: userId,
      readAt: new Date().toISOString(),
    });
  });

  // ── Deployment Events ─────────────────────────────────────────
  socket.on('deployment_updated', (data) => {
    if (!data?.deploymentId) return;
    io.to('admins').emit('deployment_updated', data);
    // Notify the applicant
    if (data.applicantId) {
      io.to(getUserRoom(data.applicantId)).emit('application_updated', {
        deploymentId: data.deploymentId,
        status: data.status,
        updatedBy: userId,
        updatedByRole: role,
        updatedAt: new Date().toISOString(),
      });
    }
  });

  socket.on('application_updated', (data) => {
    io.to('admins').emit('application_updated', data);
  });

  socket.on('payment_updated', (data) => {
    io.to('admins').emit('payment_updated', data);
  });

  socket.on('data_change', (data) => {
    // Broadcast to all admins
    io.to('admins').emit('data_change', data);
    // Also broadcast to the specific entity's room if applicable
    if (data.entityId) {
      io.to(`entity:${data.entityId}`).emit('data_change', data);
    }
  });

  // ── Presence Events ───────────────────────────────────────────
  socket.on('get_online_nurses', async () => {
    const onlineNurses = [];
    for (const [socketId, userData] of connectedUsers) {
      if (userData.role === 'nurse') {
        onlineNurses.push({
          nurseId: userData.userId,
          isOnline: true,
          isAvailable: true,
        });
      }
    }
    socket.emit('online_nurses_list', { nurses: onlineNurses, count: onlineNurses.length });
  });

  socket.on('get_user_status', (data) => {
    if (!data?.userId) return;
    const isOnline = Array.from(connectedUsers.values())
      .some(u => u.userId === data.userId);
    socket.emit('user_status', {
      userId: data.userId,
      isOnline,
      isAvailable: isOnline,
      lastSeen: isOnline ? new Date().toISOString() : null,
    });
  });

  // ── Nurse availability ────────────────────────────────────────
  socket.on('nurse_availability_changed', (data) => {
    io.to('admins').emit('nurse_availability_changed', data);
  });

  // ── Disconnect ────────────────────────────────────────────────
  socket.on('disconnect', (reason) => {
    const userData = connectedUsers.get(socket.id);
    connectedUsers.delete(socket.id);

    if (userData) {
      // Notify admins about nurse going offline
      if (userData.role === 'nurse') {
        io.to('admins').emit('user_offline', {
          userId: userData.userId,
          role: userData.role,
          name: userData.name,
          lastSeen: new Date().toISOString(),
        });
      }
    }

    console.log(`[SOCKET] Disconnected: ${userId} (${role}) reason=${reason} | Total: ${connectedUsers.size}`);
  });
});

// ============================================================================
// INTERNAL HTTP API - For Next.js API routes to emit events
// ============================================================================
// This allows the Next.js API routes to trigger socket events without
// being in the same process. The API routes send HTTP POST requests
// to this server with an internal API key for authentication.
// ============================================================================

server.on('request', (req, res) => {
  // Only handle POST requests to /internal/*
  if (req.method !== 'POST') {
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        connections: connectedUsers.size,
        uptime: process.uptime(),
      }));
      return;
    }
    return; // Let Socket.IO handle other requests
  }

  // Parse request body
  let body = '';
  req.on('data', (chunk) => { body += chunk; });
  req.on('end', () => {
    try {
      const data = JSON.parse(body);

      // Verify internal API key
      const apiKey = req.headers['x-internal-api-key'];
      if (apiKey !== INTERNAL_API_KEY) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Unauthorized' }));
        return;
      }

      // Route: /internal/emit-to-user
      // Emit an event to a specific user's personal room
      if (req.url === '/internal/emit-to-user') {
        const { userId, event, payload } = data;
        if (!userId || !event) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'userId and event are required' }));
          return;
        }
        io.to(getUserRoom(userId)).emit(event, payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, room: getUserRoom(userId) }));
        return;
      }

      // Route: /internal/emit-to-admins
      // Emit an event to the admins room (includes both admin and subadmin)
      if (req.url === '/internal/emit-to-admins') {
        const { event, payload } = data;
        if (!event) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'event is required' }));
          return;
        }
        io.to('admins').emit(event, payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, room: 'admins' }));
        return;
      }

      // Route: /internal/emit-to-role
      // Emit an event to a specific role's room
      if (req.url === '/internal/emit-to-role') {
        const { role, event, payload } = data;
        if (!role || !event) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'role and event are required' }));
          return;
        }
        const room = getRoleRoom(role);
        io.to(room).emit(event, payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, room }));
        return;
      }

      // Route: /internal/emit-to-chat
      // Emit an event to a specific chat room
      if (req.url === '/internal/emit-to-chat') {
        const { chatId, event, payload } = data;
        if (!chatId || !event) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'chatId and event are required' }));
          return;
        }
        io.to(`chat:${chatId}`).emit(event, payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, room: `chat:${chatId}` }));
        return;
      }

      // Route: /internal/broadcast
      // Broadcast an event to all connected clients
      if (req.url === '/internal/broadcast') {
        const { event, payload } = data;
        if (!event) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'event is required' }));
          return;
        }
        io.emit(event, payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true }));
        return;
      }

      // Route: /internal/notification
      // Create and deliver a notification to specific users
      if (req.url === '/internal/notification') {
        const { userIds, event, payload } = data;
        if (!userIds || !Array.isArray(userIds) || !event) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'userIds (array) and event are required' }));
          return;
        }
        let delivered = 0;
        for (const uid of userIds) {
          io.to(getUserRoom(uid)).emit(event, payload);
          delivered++;
        }
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: true, delivered }));
        return;
      }

      // Unknown route
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Not found' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'Internal server error' }));
    }
  });
});

// ── Start Server ──────────────────────────────────────────────────
async function start() {
  await connectMongo();

  server.listen(PORT, () => {
    console.log(`
╔══════════════════════════════════════════════════════════════╗
║   عافيتك Socket.IO Server                                    ║
║   Port: ${PORT}                                                  ║
║   CORS: ${CORS_ORIGINS.join(', ').substring(0, 35).padEnd(35)}   ║
║   MongoDB: ${MONGODB_URI ? 'Connected' : 'Disabled'}                                         ║
║   Internal API: Enabled                                      ║
╚══════════════════════════════════════════════════════════════╝
    `);
  });
}

start().catch((err) => {
  console.error('[SOCKET] Failed to start:', err);
  process.exit(1);
});

// ── Graceful Shutdown ─────────────────────────────────────────────
process.on('SIGTERM', () => {
  console.log('[SOCKET] SIGTERM received - closing connections...');
  io.disconnectSockets(true);
  server.close(() => {
    console.log('[SOCKET] Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[SOCKET] SIGINT received - closing connections...');
  io.disconnectSockets(true);
  server.close(() => {
    console.log('[SOCKET] Server closed');
    process.exit(0);
  });
});
