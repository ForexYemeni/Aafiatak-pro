// POST /api/notifications/test-push - Send a test push notification
// Admin-only: Sends a test notification to verify Firebase FCM is working.
// Can target a specific userId or test the Firebase Admin SDK connection.

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { sendNotificationWithPush } from '@/lib/notifications/push-service';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { getFirebaseMessaging } from '@/lib/notifications/firebase-admin-sdk';
import FCMToken from '@/models/FCMToken';

export async function POST(request: NextRequest) {
  try {
    await connectDB();

    // Require admin or subadmin authentication
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const body = await request.json();
    const { userId, userRole, title, body: notificationBody, type, priority } = body;

    // ── Step 1: Check if Firebase Admin SDK is initialized ─────────────
    const messaging = await getFirebaseMessaging();
    if (!messaging) {
      return Response.json({
        success: false,
        message: 'Firebase Admin SDK غير مُعد — أدخل بيانات Service Account في إعدادات Firebase',
        error: { code: 'FIREBASE_NOT_CONFIGURED' },
      });
    }

    // ── Step 2: If userId provided, send to that specific user ──────────
    if (userId) {
      const pushResult = await sendNotificationWithPush(userId, {
        title: title || 'تنبيه تجريبي',
        body: notificationBody || 'هذا إشعار تجريبي من عافيتك — إذا وصلك هذا الإشعار فالنظام يعمل!',
        type: type || 'system',
        priority: priority || 'high',
        userRole: userRole || 'nurse',
        sound: true,
      });

      return Response.json({
        success: true,
        message: 'تم إرسال التنبيه التجريبي',
        data: { push: pushResult },
      });
    }

    // ── Step 3: General test — check FCM tokens count and SDK status ───
    const totalTokens = await FCMToken.countDocuments({ isActive: true });
    const androidTokens = await FCMToken.countDocuments({ isActive: true, platform: 'android' });
    const webTokens = await FCMToken.countDocuments({ isActive: true, platform: 'web' });

    // If there are Android tokens, send a test to the first one
    let testResult = 'Firebase Admin SDK متصل بنجاح';
    if (androidTokens > 0) {
      try {
        const sampleToken = await FCMToken.findOne({ isActive: true, platform: 'android' }).lean();
        if (sampleToken) {
          await sendNotificationWithPush(String(sampleToken.userId), {
            title: title || 'اختبار الإشعارات',
            body: notificationBody || 'تم إرسال إشعار اختبار من لوحة الإدارة — إذا رأيت هذا فالإشعارات تعمل!',
            type: 'system',
            priority: 'high',
            userRole: sampleToken.platform === 'android' ? 'nurse' : 'beneficiary',
            sound: true,
          });
          testResult += ' — تم إرسال إشعار اختبار إلى جهاز Android';
        }
      } catch (sendErr: any) {
        testResult += ` — فشل إرسال الإشعار: ${sendErr.message}`;
      }
    }

    return Response.json({
      success: true,
      message: testResult,
      data: {
        firebaseConnected: true,
        totalTokens,
        androidTokens,
        webTokens,
        hint: androidTokens === 0
          ? 'لا توجد أجهزة Android مسجلة حالياً. يجب فتح التطبيق على جهاز Android أولاً لتسجيل رمز FCM.'
          : undefined,
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
