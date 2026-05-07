// PATCH /api/nurse/availability - Toggle availability

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireRole, successResponse, handleApiError, logActivity,
} from '@/lib/api/helpers';

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireRole(request, 'nurse');

    const body = await request.json();
    const isAvailable = body.isAvailable;

    if (typeof isAvailable !== 'boolean') {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: 'isAvailable يجب أن يكون قيمة منطقية' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    await db.nurse.update({
      where: { id: user.userId },
      data: {
        isAvailable,
        isOnline: isAvailable,
        lastActiveAt: new Date(),
      },
    });

    await logActivity({
      userId: user.userId,
      userRole: 'nurse',
      action: isAvailable ? 'go_online' : 'go_offline',
      entity: 'Nurse',
      entityId: user.userId,
      details: isAvailable ? 'الممرض متاح الآن' : 'الممرض غير متاح',
      request,
    });

    return successResponse({ isAvailable }, isAvailable ? 'أنت متاح الآن لاستقبال الطلبات' : 'أنت غير متاح الآن');
  } catch (error) {
    return handleApiError(error);
  }
}
