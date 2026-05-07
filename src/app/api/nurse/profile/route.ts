// GET/PATCH /api/nurse/profile - Get/update nurse profile
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const nurse = await Nurse.findById(user.userId).select('-password').lean();
    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    return Response.json({ success: true, data: { ...nurse, id: nurse._id.toString() } });
  } catch (error) {
    console.error('[NURSE PROFILE GET ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    delete body.password;
    delete body._id;
    delete body.role;
    delete body.verificationStatus;
    delete body.phone;

    const nurse = await Nurse.findByIdAndUpdate(user.userId, body, { new: true }).select('-password').lean();
    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    return Response.json({
      success: true,
      data: { ...nurse, id: nurse._id.toString() },
      message: 'تم تحديث الملف الشخصي بنجاح',
    });
  } catch (error) {
    console.error('[NURSE PROFILE UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحديث', 500, 'INTERNAL_ERROR');
  }
}
