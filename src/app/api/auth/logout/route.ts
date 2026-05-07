import { NextRequest, NextResponse } from 'next/server';
import { createClearAuthCookie, extractUserFromRequest } from '@/lib/auth/middleware';
import { db } from '@/lib/prisma';

// ---- POST /api/auth/logout ----

export async function POST(request: NextRequest) {
  try {
    // Try to extract user for activity logging (optional - don't block logout)
    const user = await extractUserFromRequest(request);

    if (user) {
      try {
        const ipAddress = request.headers.get('x-forwarded-for') ?? request.headers.get('x-real-ip') ?? 'unknown';
        await db.activityLog.create({
          data: {
            userId: user.userId,
            userRole: user.role,
            action: 'logout',
            details: 'تسجيل خروج',
            ipAddress: ipAddress.split(',')[0]?.trim() ?? 'unknown',
          },
        });
      } catch {
        // Activity logging should not block logout
      }
    }

    const response = NextResponse.json(
      { success: true, data: null, message: 'تم تسجيل الخروج بنجاح' },
      { status: 200 }
    );

    // Clear auth cookie
    response.headers.set('Set-Cookie', createClearAuthCookie());

    return response;
  } catch {
    // Even if something goes wrong, still clear the cookie and return success
    const response = NextResponse.json(
      { success: true, data: null, message: 'تم تسجيل الخروج بنجاح' },
      { status: 200 }
    );

    response.headers.set('Set-Cookie', createClearAuthCookie());

    return response;
  }
}
