// POST/PATCH /api/notifications/[id]/read - Mark notification as read
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// Also supports marking voice as played

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { id } = await params;
    const body = await request.json().catch(() => ({}));
    const { voicePlayed } = body;

    const updateData: any = { read: true };
    if (voicePlayed) {
      updateData.voicePlayedAt = new Date();
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: user.userId },
      updateData,
      { new: true }
    ).lean();

    if (!notification) return createErrorResponse('الإشعار غير موجود', 404, 'NOT_FOUND');

    return Response.json({
      success: true,
      data: serializeDoc(notification),
      message: 'تم قراءة الإشعار',
    });
  } catch (err) {
    console.error('[NOTIFICATION READ ERROR]', err);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const { voicePlayed, read } = body;

    const updateData: any = {};
    if (read !== undefined) updateData.read = read;
    if (voicePlayed) updateData.voicePlayedAt = new Date();

    if (Object.keys(updateData).length === 0) {
      return createErrorResponse('لا توجد بيانات للتحديث', 400, 'VALIDATION_ERROR');
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: id, userId: user.userId },
      updateData,
      { new: true }
    ).lean();

    if (!notification) return createErrorResponse('الإشعار غير موجود', 404, 'NOT_FOUND');

    return Response.json({
      success: true,
      data: serializeDoc(notification),
      message: 'تم تحديث الإشعار',
    });
  } catch (err) {
    console.error('[NOTIFICATION PATCH ERROR]', err);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}
