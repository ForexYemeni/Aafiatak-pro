// GET /api/notifications/voice-pending - Get voice-pending notifications
// Returns notifications where voiceEnabled=true and voicePlayedAt doesn't exist.
// Does NOT auto-mark as played — the CLIENT must confirm playback via
// PATCH /api/notifications/[id]/voice-played after successfully playing sound+TTS.
// This prevents losing voice alerts if the browser tab is throttled or audio fails.

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
    // Also include read=false OR recently created (within 5 minutes) read notifications
    // This ensures we don't miss notifications that were marked as read via the bell
    // but the voice hasn't been played yet
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);

    const voicePending = await Notification.find({
      userId: user.userId,
      voiceEnabled: true,
      voicePlayedAt: { $exists: false },
      $or: [
        { read: false },
        { read: true, createdAt: { $gte: fiveMinutesAgo } },
      ],
    })
      .sort({ priority: -1, createdAt: -1 })
      .limit(15)
      .lean();

    if (!voicePending.length) {
      return Response.json({
        success: true,
        data: { notifications: [] },
      });
    }

    // Return the notifications WITHOUT marking them as played
    // The client must confirm playback via PATCH /api/notifications/[id]/voice-played
    const mapped = voicePending.map((n: any) => {
      let parsedData: Record<string, any> = {};
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
