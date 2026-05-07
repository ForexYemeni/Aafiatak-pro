// POST /api/beneficiary/emergency - Create emergency request
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { EmergencyRequest, Notification, Nurse } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    const { type, description, lat, lng, address } = body;

    if (!description) {
      return createErrorResponse('وصف الحالة الطارئة مطلوب', 400, 'VALIDATION_ERROR');
    }

    const emergency = await EmergencyRequest.create({
      beneficiaryId: user.userId,
      type: type || 'medical',
      description,
      lat,
      lng,
      address,
      status: 'pending',
      priority: 'high',
    });

    // Notify nearby available nurses (best effort)
    try {
      if (lat && lng) {
        // Find verified nurses nearby (within 20km radius)
        const nearbyNurses = await Nurse.find({
          verificationStatus: 'verified',
          isAvailable: true,
          lat: { $ne: null },
          lng: { $ne: null },
        }).select('_id').limit(10).lean();

        for (const nurse of nearbyNurses) {
          await Notification.create({
            userId: nurse._id,
            userRole: 'nurse',
            titleAr: '🚨 حالة طوارئ!',
            bodyAr: `حالة طوارئ جديدة بالقرب منك: ${description.substring(0, 100)}`,
            type: 'emergency',
            priority: 'urgent',
            data: { emergencyRequestId: emergency._id.toString(), type: type || 'medical' },
            voiceEnabled: true,
          });
        }
      }
    } catch {
      // Non-critical notification
    }

    return Response.json({
      success: true,
      data: { ...emergency.toObject(), id: emergency._id.toString() },
      message: 'تم إرسال طلب الطوارئ بنجاح. سيتم إرسال مساعدة فوراً',
    }, { status: 201 });
  } catch (error) {
    console.error('[BENEFICIARY EMERGENCY ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إرسال طلب الطوارئ', 500, 'INTERNAL_ERROR');
  }
}
