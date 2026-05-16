// PATCH /api/nurse/cv - Update nurse CV sections (requires nurse auth)
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
export async function PATCH(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const body = await request.json();

    // Only allow CV-related fields
    const allowedFields = [
      'skills',
      'experiences',
      'certificates',
      'languages',
      'professionalTitle',
      'bio',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (Object.keys(updateData).length === 0) {
      return createErrorResponse('لا توجد بيانات للتحديث', 400, 'NO_DATA');
    }

    const nurse = await Nurse.findByIdAndUpdate(
      user.userId,
      { $set: updateData },
      { new: true }
    )
      .select(
        'name avatar professionalTitle specialization experience governorate district bio ' +
        'skills experiences certificates languages ' +
        'rating reviewCount completedJobs emergencyCases responseRate complianceRate ' +
        'verificationStatus isAvailable isOnline'
      )
      .lean();

    if (!nurse) {
      return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');
    }

    return Response.json({
      success: true,
      data: serializeDoc(nurse),
      message: 'تم تحديث السيرة الذاتية بنجاح',
    });
  } catch (error) {
    console.error('[NURSE CV UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحديث', 500, 'INTERNAL_ERROR');
  }
}
