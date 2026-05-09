// DELETE /api/notifications/[id] - Delete a single notification
// MongoDB/Mongoose based

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { id } = await params;

    const result = await Notification.deleteOne({
      _id: id,
      userId: user.userId,
    });

    if (result.deletedCount === 0) {
      return createErrorResponse('الإشعار غير موجود', 404, 'NOT_FOUND');
    }

    return Response.json({
      success: true,
      data: { deletedCount: result.deletedCount },
    });
  } catch (err) {
    console.error('[NOTIFICATION DELETE ERROR]', err);
    return createErrorResponse('حدث خطأ أثناء حذف الإشعار', 500, 'INTERNAL_ERROR');
  }
}
