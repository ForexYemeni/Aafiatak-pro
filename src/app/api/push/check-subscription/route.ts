// POST /api/push/check-subscription - Check if a push subscription is still active
// Used by the client to validate its subscription status with the server
// IMPORTANT: Checks if the endpoint is registered for ANY user (multi-user device support)
// When multiple users share the same browser/device, the same push endpoint
// may be registered under different userIds. We must NOT destroy another user's
// subscription just because it's not registered under the current user.

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import FCMToken from '@/models/FCMToken';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const body = await request.json();
    const { endpoint } = body;

    if (!endpoint) {
      return createErrorResponse('endpoint مطلوب', 400, 'VALIDATION_ERROR');
    }

    // Check if this subscription is active for the CURRENT user
    const currentUserToken = await FCMToken.findOne({
      userId: user!.userId,
      endpoint,
      isActive: true,
    }).lean();

    // Also check if this subscription exists for ANY other user
    // This is critical for multi-user device support - we must NOT
    // unsubscribe a push endpoint that belongs to another user
    const anyUserToken = await FCMToken.findOne({
      endpoint,
      isActive: true,
    }).lean();

    return Response.json({
      success: true,
      data: {
        // Active for current user - no action needed
        isActive: !!currentUserToken,
        // Exists for another user - don't destroy it!
        belongsToOtherUser: !currentUserToken && !!anyUserToken,
        subscriptionId: currentUserToken?._id?.toString() || anyUserToken?._id?.toString() || null,
      },
    });
  } catch (error) {
    console.error('[PUSH CHECK SUBSCRIPTION ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}
