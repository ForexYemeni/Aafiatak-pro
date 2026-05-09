// POST /api/push/check-subscription - Check if a push subscription is still active
// Used by the client to validate its subscription status with the server

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

    // Check if this subscription exists and is active for this user
    const token = await FCMToken.findOne({
      userId: user!.userId,
      endpoint,
      isActive: true,
    }).lean();

    return Response.json({
      success: true,
      data: {
        isActive: !!token,
        subscriptionId: token?._id?.toString() || null,
      },
    });
  } catch (error) {
    console.error('[PUSH CHECK SUBSCRIPTION ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}
