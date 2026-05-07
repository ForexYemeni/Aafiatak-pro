// POST /api/nurse/availability - Toggle nurse availability
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const { isAvailable } = await request.json();

    if (typeof isAvailable !== 'boolean') {
      return createErrorResponse('قيمة التوفر مطلوبة (true/false)', 400, 'VALIDATION_ERROR');
    }

    const nurse = await Nurse.findByIdAndUpdate(
      user.userId,
      { isAvailable, isOnline: isAvailable },
      { new: true }
    ).select('-password').lean();

    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    return Response.json({
      success: true,
      data: { isAvailable: nurse.isAvailable, isOnline: nurse.isOnline },
      message: isAvailable ? 'تم تفعيل التوفر' : 'تم إيقاف التوفر',
    });
  } catch (error) {
    console.error('[NURSE AVAILABILITY ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تحديث التوفر', 500, 'INTERNAL_ERROR');
  }
}
