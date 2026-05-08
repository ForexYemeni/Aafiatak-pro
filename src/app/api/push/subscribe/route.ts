// POST /api/push/subscribe - Register a Web Push subscription
// DELETE /api/push/subscribe - Unregister a Web Push subscription

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import FCMToken from '@/models/FCMToken';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const body = await request.json();
    const { endpoint, keys, platform, deviceId } = body;

    if (!endpoint || !keys?.p256dh || !keys?.auth) {
      return createErrorResponse(
        'بيانات الاشتراك غير مكتملة',
        400,
        'VALIDATION_ERROR'
      );
    }

    // Upsert: update if exists, create if not
    const filter = { userId: user!.userId, deviceId: deviceId || 'default' };
    const update = {
      endpoint,
      p256dh: keys.p256dh,
      auth: keys.auth,
      platform: platform || 'web',
      isActive: true,
      lastUsedAt: new Date(),
    };

    await FCMToken.findOneAndUpdate(filter, update, {
      upsert: true,
      new: true,
    });

    return Response.json({
      success: true,
      message: 'تم تسجيل الاشتراك بنجاح',
    });
  } catch (error) {
    console.error('[PUSH SUBSCRIBE ERROR]', error);
    return createErrorResponse(
      'حدث خطأ أثناء تسجيل الاشتراك',
      500,
      'INTERNAL_ERROR'
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return createErrorResponse('endpoint مطلوب', 400, 'VALIDATION_ERROR');
    }

    await FCMToken.findOneAndUpdate(
      { userId: user!.userId, endpoint },
      { isActive: false }
    );

    return Response.json({
      success: true,
      message: 'تم إلغاء الاشتراك',
    });
  } catch (error) {
    console.error('[PUSH UNSUBSCRIBE ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}
