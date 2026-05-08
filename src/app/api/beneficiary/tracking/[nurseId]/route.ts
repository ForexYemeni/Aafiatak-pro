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

    // Get nurse full details
    const nurse = await Nurse.findById(nurseId)
      .select('name phone rating isOnline lat lng locationUpdatedAt specialization')
      .lean();

    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    // Calculate ETA based on distance (simple approximation)
    let eta: number | null = null;
    if (
      nurse.lat && nurse.lng &&
      activeOrder.beneficiaryLat && activeOrder.beneficiaryLng
    ) {
      // Haversine formula for distance in km
      const R = 6371;
      const dLat = (activeOrder.beneficiaryLat - nurse.lat) * Math.PI / 180;
      const dLon = (activeOrder.beneficiaryLng - nurse.lng) * Math.PI / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(nurse.lat * Math.PI / 180) * Math.cos(activeOrder.beneficiaryLat * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      const distance = R * c;
      // Assume average speed 30 km/h in urban area
      eta = Math.max(1, Math.round((distance / 30) * 60));
    }

    // Map specializations to Arabic labels
    const specializationLabels: Record<string, string> = {
      general_nursing: 'تمريض عام',
      critical_care: 'رعاية حرجة',
      pediatric: 'أطفال',
      elderly_care: 'مسنين',
      physiotherapy: 'علاج طبيعي',
      wound_care: 'جروح',
      iv_therapy: 'علاج وريدي',
      mental_health: 'صحة نفسية',
      post_surgery: 'بعد الجراحة',
      emergency: 'طوارئ',
    };

    return Response.json({
      success: true,
      data: {
        nurseId: nurse._id.toString(),
        // Nurse details for display
        nurseName: nurse.name,
        nursePhone: nurse.phone || null,
        nurseRating: nurse.rating || 0,
        nurseAvatar: null,
        nurseSpecialization: nurse.specialization
          ?.map((s: string) => specializationLabels[s] || s)
          .join(' • ') || null,
        isOnline: nurse.isOnline || false,
        // Location data
        location: nurse.lat && nurse.lng
          ? { lat: nurse.lat, lng: nurse.lng, updatedAt: nurse.locationUpdatedAt }
          : null,
        // Order info
        orderId: activeOrder._id.toString(),
        orderStatus: activeOrder.status,
        // Tracking info
        eta,
        speed: 0,
        heading: 0,
        batteryLevel: null,
        currentRequestId: activeOrder._id.toString(),
      },
    });
  } catch (error) {
    console.error('[BENEFICIARY TRACKING ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تتبع الممرض', 500, 'INTERNAL_ERROR');
  }
}
