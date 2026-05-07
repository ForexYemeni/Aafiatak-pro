// POST /api/notifications/[id]/read - Mark notification as read
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { id } = await params;

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: user.userId },
      { read: true },
      { new: true }
    ).lean();

    if (!notification) return createErrorResponse('الإشعار غير موجود', 404, 'NOT_FOUND');

    return Response.json({
      success: true,
      data: { ...notification, id: notification._id.toString() },
      message: 'تم قراءة الإشعار',
    });
  } catch (error) {
    console.error('[NOTIFICATION READ ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}
