// POST /api/nurse/location - Update nurse GPS location
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse, ServiceRequest } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { emitToAdmins, emitToUser } from '@/lib/notifications/socket-client';

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

    // ═══ EMIT REAL-TIME EVENT (fire-and-forget) ═══
    const locationPayload = {
      entity: 'location',
      entityId: user.userId,
      action: 'updated',
      changedBy: user.userId,
      changedByRole: 'nurse',
      timestamp: new Date().toISOString(),
      data: { nurseId: user.userId, lat, lng, updatedAt: nurse.locationUpdatedAt?.toISOString() },
    };

    // 1. Emit to admins room (admin + subadmin)
    emitToAdmins('data_change', locationPayload).catch(() => {});

    // 2. Emit to the beneficiary who has an active order with this nurse
    // This is CRITICAL for the tracking page to get instant location updates
    try {
      const activeOrder = await ServiceRequest.findOne({
        nurseId: user.userId,
        status: { $in: ['assigned', 'accepted', 'in_progress'] },
      }).select('beneficiaryId').lean();

      if (activeOrder?.beneficiaryId) {
        const beneficiaryId = activeOrder.beneficiaryId.toString();
        emitToUser(beneficiaryId, 'data_change', locationPayload).catch(() => {});
        emitToUser(beneficiaryId, 'location_update', {
          nurseId: user.userId,
          lat,
          lng,
          updatedAt: nurse.locationUpdatedAt?.toISOString(),
        }).catch(() => {});
      }
    } catch {
      // Non-critical — beneficiary notification
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
