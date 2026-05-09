// POST /api/push/test - Send a test push notification to the authenticated user
// Used for verifying that push notifications work end-to-end

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import FCMToken from '@/models/FCMToken';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { sendPushToUser } from '@/lib/notifications/push-service';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const userId = user!.userId;

    // Check active subscriptions
    const activeTokens = await FCMToken.find({ userId, isActive: true }).lean();

    if (activeTokens.length === 0) {
      return Response.json({
        success: false,
        error: 'لا يوجد اشتراك Push نشط لهذا المستخدم',
        data: {
          userId,
          activeSubscriptions: 0,
          hint: 'يجب فتح التطبيق في المتصفح والسماح بالإشعارات أولاً',
        },
      }, { status: 400 });
    }

    // Send test push
    const result = await sendPushToUser(userId, {
      title: 'اختبار الإشعارات 🔔',
      body: 'إشعار تجريبي - إذا وصلتك هذا الإشعار فالنظام يعمل بشكل صحيح!',
      type: 'system',
      priority: 'high',
      sound: true,
      data: {
        voiceAlert: true,
        voiceText: 'هذا إشعار تجريبي، نظام الإشعارات يعمل بشكل صحيح',
      },
    });

    return Response.json({
      success: true,
      data: {
        userId,
        activeSubscriptions: activeTokens.length,
        sent: result.sent,
        failed: result.failed,
      },
    });
  } catch (error) {
    console.error('[PUSH TEST ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء اختبار الإشعارات', 500, 'INTERNAL_ERROR');
  }
}
