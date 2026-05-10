// PATCH /api/notifications/voice-played - Mark notification(s) as voice-played
// Called by the CLIENT after successfully playing sound + TTS for a notification.
// This is a separate step from GET /voice-pending to prevent losing voice alerts
// if the browser tab is throttled or audio playback fails.

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function PATCH(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const body = await request.json();
    const { notificationIds } = body;

    if (!notificationIds || !Array.isArray(notificationIds) || notificationIds.length === 0) {
      return createErrorResponse('قائمة معرفات الإشعارات مطلوبة', 400, 'VALIDATION_ERROR');
    }

    // Mark the specified notifications as voice-played
    const result = await Notification.updateMany(
      {
        _id: { $in: notificationIds },
        userId: user.userId, // Security: only mark own notifications
        voicePlayedAt: { $exists: false }, // Only if not already marked
      },
      { voicePlayedAt: new Date() }
    );

    return Response.json({
      success: true,
      data: {
        marked: result.modifiedCount,
      },
    });
  } catch (err) {
    console.error('[VOICE-PLAYED PATCH ERROR]', err);
    return createErrorResponse('حدث خطأ أثناء تحديث الإشعارات', 500, 'INTERNAL_ERROR');
  }
}
