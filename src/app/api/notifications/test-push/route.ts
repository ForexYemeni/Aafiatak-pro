// POST /api/notifications/test-push - Send a test push notification to a specific user

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { sendNotificationWithPush } from '@/lib/notifications/push-service';
import { createErrorResponse } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    const body = await request.json();
    const { userId, userRole, title, body: notificationBody, type, priority } = body;

    if (!userId) {
      return createErrorResponse('معرف المستخدم مطلوب', 400, 'VALIDATION_ERROR');
    }

    // Send push notification with in-app notification
    const pushResult = await sendNotificationWithPush(userId, {
      title: title || 'تنبيه تجريبي',
      body: notificationBody || 'هذا إشعار تجريبي من عافيتك',
      type: type || 'system',
      priority: priority || 'high',
      userRole: userRole || 'nurse',
      sound: true,
    });

    return Response.json({
      success: true,
      message: 'تم إرسال التنبيه التجريبي',
      data: {
        push: pushResult,
      },
    });
  } catch (error: any) {
    console.error('[TEST PUSH ERROR]', error);
    return createErrorResponse(
      error.message || 'حدث خطأ أثناء إرسال التنبيه التجريبي',
      500,
      'INTERNAL_ERROR'
    );
  }
}
