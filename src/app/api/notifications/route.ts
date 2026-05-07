// GET /api/notifications - Get notifications (with voice support)
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

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

    const filter: any = { userId: user.userId, userRole: user.role };
    if (unreadOnly) filter.read = false;
    if (type) filter.type = type;

    const [notifications, total, unreadCount] = await Promise.all([
      Notification.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Notification.countDocuments(filter),
      Notification.countDocuments({ userId: user.userId, read: false }),
    ]);

    return Response.json({
      success: true,
      data: {
        notifications: notifications.map((n: any) => ({ ...n, id: n._id.toString() })),
        total,
        unreadCount,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[NOTIFICATIONS GET ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب الإشعارات', 500, 'INTERNAL_ERROR');
  }
}
