// POST /api/auth/logout - Logout user and clear cookie
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { createClearAuthCookie, createErrorResponse } from '@/lib/auth';
import { logActivity } from '@/lib/api/helpers';
import { requireAuth } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    const { user } = requireAuth(request);

    // Log activity (best effort)
    if (user) {
      await logActivity({
        userId: user.userId,
        userRole: user.role,
        action: 'logout',
        details: 'تسجيل خروج',
        request,
      });
    }

    const response = Response.json({
      success: true,
      message: 'تم تسجيل الخروج بنجاح',
    });

    response.headers.set('Set-Cookie', createClearAuthCookie());
    return response;
  } catch (error) {
    console.error('[AUTH LOGOUT ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تسجيل الخروج', 500, 'INTERNAL_ERROR');
  }
}
