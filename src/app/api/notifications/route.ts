// GET /api/notifications - Get notifications (with voice support)
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// Supports polling with `since` parameter for real-time updates

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { serializeDoc } from '@/lib/mongoose/serialize';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const unreadOnly = searchParams.get('unread') === 'true';
    const type = searchParams.get('type');
    const since = searchParams.get('since'); // ISO date string for polling

    const filter: any = { userId: user.userId };
    // Only filter by userRole if explicitly set in notification (prevents role-mismatch issues)
    // Since userId is unique per user, userRole is just metadata for routing/display
    if (unreadOnly) filter.read = false;
    if (type) filter.type = type;
    if (since) {
      filter.createdAt = { $gt: new Date(since) };
    }

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip(since ? 0 : (page - 1) * limit)
        .limit(since ? 10 : limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: user.userId, read: false }),
    ]);

    return Response.json({
      success: true,
      data: {
        // CRITICAL: Use serializeDoc to prevent React Error #300
        // Notification.data (Schema.Types.Mixed) can contain non-serializable objects
        notifications: notifications.map((n: any) => {
          const serialized = serializeDoc(n);
          return {
            ...serialized,
            title: n.titleAr || '',
            body: n.bodyAr || '',
            voiceEnabled: !!n.voiceEnabled,
            voicePlayedAt: n.voicePlayedAt ? new Date(n.voicePlayedAt).toISOString() : null,
          };
        }),
        total,
        unreadCount,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (err) {
    console.error('[NOTIFICATIONS GET ERROR]', err);
    return createErrorResponse('حدث خطأ أثناء جلب الإشعارات', 500, 'INTERNAL_ERROR');
  }
}
