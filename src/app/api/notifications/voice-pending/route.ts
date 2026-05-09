// GET /api/notifications/voice-pending - Get voice-pending notifications
// Returns notifications where voiceEnabled=true and voicePlayedAt doesn't exist
// Automatically marks them as played to prevent re-playing
// This is the PRIMARY delivery mechanism for voice notifications on Vercel
// (since Socket.IO server doesn't run on Vercel serverless)

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    // Find voice-pending notifications: voiceEnabled=true, voicePlayedAt not set, unread
    const voicePending = await Notification.find({
      userId: user.userId,
      voiceEnabled: true,
      voicePlayedAt: { $exists: false },
      read: false,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    if (!voicePending.length) {
      return Response.json({
        success: true,
        data: { notifications: [] },
      });
    }

    // Immediately mark them as played to prevent re-playing on next poll
    const notificationIds = voicePending.map((n: any) => n._id);
    await Notification.updateMany(
      { _id: { $in: notificationIds }, userId: user.userId },
      { voicePlayedAt: new Date() }
    );

    // Return the notifications with all data needed for sound + TTS
    const mapped = voicePending.map((n: any) => {
      let parsedData: Record<string, string> = {};
      try {
        parsedData = typeof n.data === 'string' ? JSON.parse(n.data) : (n.data || {});
      } catch {
        parsedData = {};
      }

      return {
        id: n._id.toString(),
        userId: n.userId?.toString(),
        title: n.titleAr || n.titleEn || '',
        body: n.bodyAr || n.bodyEn || '',
        type: n.type,
        priority: n.priority,
        data: parsedData,
        read: n.read,
        actionUrl: n.actionUrl,
        voiceEnabled: n.voiceEnabled,
        createdAt: n.createdAt,
      };
    });

    return Response.json({
      success: true,
      data: { notifications: mapped },
    });
  } catch (err) {
    console.error('[VOICE-PENDING GET ERROR]', err);
    return createErrorResponse('حدث خطأ أثناء جلب الإشعارات الصوتية', 500, 'INTERNAL_ERROR');
  }
}
