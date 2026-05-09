// POST /api/push/cleanup - Clean up old inactive push subscriptions
// Called when a user logs in to ensure their subscriptions are active

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import FCMToken from '@/models/FCMToken';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const userId = user!.userId;

    // Deactivate all old subscriptions for this user except the current device
    const body = await request.json().catch(() => ({}));
    const { keepDeviceId } = body;

    // Reactivate the current device's subscription if it was inactive
    if (keepDeviceId) {
      await FCMToken.updateMany(
        { userId, deviceId: keepDeviceId },
        { $set: { isActive: true, lastUsedAt: new Date() } }
      );
    }

    // Count active and inactive subscriptions
    const [activeCount, inactiveCount] = await Promise.all([
      FCMToken.countDocuments({ userId, isActive: true }),
      FCMToken.countDocuments({ userId, isActive: false }),
    ]);

    // Clean up very old inactive subscriptions (older than 30 days)
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const deleteResult = await FCMToken.deleteMany({
      userId,
      isActive: false,
      lastUsedAt: { $lt: thirtyDaysAgo },
    });

    return Response.json({
      success: true,
      data: {
        activeSubscriptions: activeCount,
        inactiveSubscriptions: inactiveCount,
        deletedOld: deleteResult.deletedCount,
      },
    });
  } catch (error) {
    console.error('[PUSH CLEANUP ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}
