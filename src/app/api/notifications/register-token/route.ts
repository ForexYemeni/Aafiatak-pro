// POST /api/notifications/register-token - Register push notification token
// MongoDB/Mongoose based - NO Firebase, NO Firebase Cloud Messaging
// Voice notifications come from MongoDB Notification model, not FCM

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User, Nurse, Beneficiary } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const body = await request.json();
    const { fcmToken } = body;

    if (!fcmToken) {
      return createErrorResponse('رمز الإشعار مطلوب', 400, 'VALIDATION_ERROR');
    }

    // Store the FCM token on the user record for future push notifications
    // This is a simplified approach - in production, use a dedicated Token model
    let Model: any;
    if (user.role === 'nurse') {
      Model = Nurse;
    } else if (user.role === 'beneficiary') {
      Model = Beneficiary;
    } else {
      Model = User;
    }

    await Model.findByIdAndUpdate(user.userId, { fcmToken });

    return Response.json({
      success: true,
      message: 'تم تسجيل رمز الإشعارات بنجاح',
    });
  } catch (error) {
    console.error('[NOTIFICATION REGISTER TOKEN ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تسجيل رمز الإشعارات', 500, 'INTERNAL_ERROR');
  }
}
