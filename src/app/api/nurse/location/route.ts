// POST /api/nurse/location - Update nurse GPS location
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { emitToAdmins } from '@/lib/notifications/socket-client';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const { lat, lng } = await request.json();

    if (typeof lat !== 'number' || typeof lng !== 'number') {
      return createErrorResponse('إحداثيات الموقع مطلوبة', 400, 'VALIDATION_ERROR');
    }

    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      return createErrorResponse('إحداثيات الموقع غير صالحة', 400, 'VALIDATION_ERROR');
    }

    const nurse = await Nurse.findByIdAndUpdate(
      user.userId,
      { lat, lng, locationUpdatedAt: new Date() },
      { new: true }
    ).select('lat lng locationUpdatedAt').lean();

    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    // ═══ EMIT REAL-TIME EVENT ═══
    // Use emitToAdmins directly for performance (location updates are frequent)
    try {
      emitToAdmins('data_change', {
        entity: 'location',
        entityId: user.userId,
        action: 'updated',
        changedBy: user.userId,
        changedByRole: 'nurse',
        timestamp: new Date().toISOString(),
        data: { nurseId: user.userId, lat, lng, updatedAt: nurse.locationUpdatedAt?.toISOString() },
      }).catch(() => {});
    } catch {
      // Non-critical — socket server may be down
    }

    return Response.json({
      success: true,
      data: { lat: nurse.lat, lng: nurse.lng, updatedAt: nurse.locationUpdatedAt },
      message: 'تم تحديث الموقع بنجاح',
    });
  } catch (error) {
    console.error('[NURSE LOCATION ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تحديث الموقع', 500, 'INTERNAL_ERROR');
  }
}
