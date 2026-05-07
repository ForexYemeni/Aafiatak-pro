// POST /api/nurse/location - Update GPS location

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireRole, successResponse, handleApiError, validateRequired,
} from '@/lib/api/helpers';

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, 'nurse');

    const body = await request.json();
    const validationError = validateRequired(body, ['lat', 'lng']);
    if (validationError) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: validationError }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    await db.nurse.update({
      where: { id: user.userId },
      data: {
        lat: body.lat,
        lng: body.lng,
        locationUpdatedAt: new Date(),
        isOnline: true,
        lastActiveAt: new Date(),
      },
    });

    return successResponse({ lat: body.lat, lng: body.lng, updatedAt: new Date().toISOString() }, 'تم تحديث الموقع بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}
