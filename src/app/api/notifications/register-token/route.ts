// POST /api/notifications/register-token - Register FCM token

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireAuth, successResponse, handleApiError, validateRequired,
} from '@/lib/api/helpers';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const body = await request.json();
    const validationError = validateRequired(body, ['token']);
    if (validationError) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: validationError }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const platform = body.platform ?? 'web';
    const deviceId = body.deviceId ?? 'default';

    // Deactivate existing tokens for this device
    await db.fCMToken.updateMany({
      where: { userId: user.userId, deviceId },
      data: { isActive: false },
    });

    // Create new token
    await db.fCMToken.create({
      data: {
        userId: user.userId,
        userRole: user.role,
        token: body.token,
        platform,
        deviceId,
        isActive: true,
      },
    });

    // Also update the user's fcmToken field
    if (user.role === 'nurse') {
      await db.nurse.update({
        where: { id: user.userId },
        data: { fcmToken: body.token },
      });
    } else if (user.role === 'beneficiary') {
      await db.beneficiary.update({
        where: { id: user.userId },
        data: { fcmToken: body.token },
      });
    }

    return successResponse(null, 'تم تسجيل رمز الإشعارات بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}
