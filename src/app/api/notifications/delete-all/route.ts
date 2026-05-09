// DELETE /api/notifications/delete-all - Delete all notifications for the authenticated user
// MongoDB/Mongoose based

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const result = await Notification.deleteMany({
      userId: user.userId,
      userRole: user.role,
    });

    return Response.json({
      success: true,
      data: { deletedCount: result.deletedCount },
    });
  } catch (err) {
    console.error('[NOTIFICATIONS DELETE-ALL ERROR]', err);
    return createErrorResponse('حدث خطأ أثناء حذف الإشعارات', 500, 'INTERNAL_ERROR');
  }
}
