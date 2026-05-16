// POST /api/notifications/register-token - Register push notification token
// Supports both Web Push (VAPID) subscriptions and FCM device tokens
// MongoDB/Mongoose based with Firebase Cloud Messaging support

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import FCMToken from '@/models/FCMToken';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const body = await request.json();
    const { fcmToken, platform, deviceId } = body;

    if (!fcmToken) {
      return createErrorResponse('رمز الإشعار مطلوب', 400, 'VALIDATION_ERROR');
    }

    const tokenPlatform = platform || 'android';
    const tokenDeviceId = deviceId || `device-${Date.now()}`;

    // Upsert the FCM token — deactivate old tokens for the same device first
    // This prevents duplicate tokens for the same device
    await FCMToken.updateMany(
      {
        userId: user!.userId,
        deviceId: tokenDeviceId,
        platform: tokenPlatform,
        isActive: true,
      },
      { isActive: false }
    );

    // Also deactivate any other device that has this same FCM token
    // (in case the same token is registered under a different device/user)
    await FCMToken.updateMany(
      { fcmToken, isActive: true },
      { isActive: false }
    );

    // Create new token record
    await FCMToken.create({
      userId: user!.userId,
      fcmToken,
      platform: tokenPlatform,
      deviceId: tokenDeviceId,
      endpoint: '',
      p256dh: '',
      auth: '',
      isActive: true,
      lastUsedAt: new Date(),
    });

    console.log(`[NOTIFICATION] FCM token registered for user ${user!.userId}, platform: ${tokenPlatform}`);

    return Response.json({
      success: true,
      message: 'تم تسجيل رمز الإشعارات بنجاح',
    });
  } catch (error) {
    console.error('[NOTIFICATION REGISTER TOKEN ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تسجيل رمز الإشعارات', 500, 'INTERNAL_ERROR');
  }
}
