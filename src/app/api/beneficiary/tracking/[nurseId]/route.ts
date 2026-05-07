// GET /api/beneficiary/tracking/[nurseId] - Track nurse location
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse, ServiceRequest } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ nurseId: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const { nurseId } = await params;

    // Verify that the beneficiary has an active order with this nurse
    const activeOrder = await ServiceRequest.findOne({
      beneficiaryId: user.userId,
      nurseId,
      status: { $in: ['assigned', 'accepted', 'in_progress'] },
    }).lean();

    if (!activeOrder) {
      return createErrorResponse('ليس لديك طلب نشط مع هذا الممرض', 403, 'NO_ACTIVE_ORDER');
    }

    // Get nurse location
    const nurse = await Nurse.findById(nurseId)
      .select('name isOnline lat lng locationUpdatedAt phone')
      .lean();

    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    return Response.json({
      success: true,
      data: {
        nurseId: nurse._id.toString(),
        name: nurse.name,
        isOnline: nurse.isOnline,
        lat: nurse.lat,
        lng: nurse.lng,
        locationUpdatedAt: nurse.locationUpdatedAt,
        orderId: activeOrder._id.toString(),
        orderStatus: activeOrder.status,
      },
    });
  } catch (error) {
    console.error('[BENEFICIARY TRACKING ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تتبع الممرض', 500, 'INTERNAL_ERROR');
  }
}
