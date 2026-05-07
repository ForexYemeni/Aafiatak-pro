// PATCH /api/notifications/[id]/read - Mark notification as read

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireAuth, successResponse, handleApiError,
} from '@/lib/api/helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const notification = await db.notification.findUnique({ where: { id } });
    if (!notification) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الإشعار' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    if (notification.userId !== user.userId) {
      return new Response(JSON.stringify({ success: false, error: 'FORBIDDEN', message: 'ليس لديك صلاحية للوصول لهذا الإشعار' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    await db.notification.update({
      where: { id },
      data: { read: true },
    });

    return successResponse(null, 'تم تحديد الإشعار كمقروء');
  } catch (error) {
    return handleApiError(error);
  }
}
