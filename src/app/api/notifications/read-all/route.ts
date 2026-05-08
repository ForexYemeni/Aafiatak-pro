// POST /api/notifications/read-all - Mark all notifications as read
// MongoDB/Mongoose based

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const body = await request.json().catch(() => ({}));
    const { type, chatId } = body;

    const filter: any = { userId: user.userId, read: false };
    if (type) filter.type = type;
    if (chatId) filter['data.chatId'] = chatId;

    const result = await Notification.updateMany(filter, { read: true });

    return Response.json({
      success: true,
      data: { modifiedCount: result.modifiedCount },
      message: 'تم قراءة جميع الإشعارات',
    });
  } catch (err) {
    console.error('[NOTIFICATION READ ALL ERROR]', err);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}
