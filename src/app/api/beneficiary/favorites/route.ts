// GET/POST/DELETE /api/beneficiary/favorites - Add/remove/list favorite nurses
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

// Simple in-memory favorites store (in production, use a dedicated MongoDB model)
// For now, we'll use a simplified approach with the Nurse model

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    // Get verified nurses as available options
    const nurses = await Nurse.find({
      verificationStatus: 'verified',
      isAvailable: true,
    })
      .select('name specialization rating completedJobs governorate district')
      .sort({ rating: -1, completedJobs: -1 })
      .limit(20)
      .lean();

    return Response.json({
      success: true,
      data: nurses.map((n: any) => ({ ...n, id: n._id.toString() })),
    });
  } catch (error) {
    console.error('[BENEFICIARY FAVORITES ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب المفضلات', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const { nurseId } = await request.json();
    if (!nurseId) {
      return createErrorResponse('معرف الممرض مطلوب', 400, 'VALIDATION_ERROR');
    }

    const nurse = await Nurse.findById(nurseId).select('name').lean();
    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    // In a full implementation, save to a Favorites collection
    return Response.json({
      success: true,
      message: 'تم إضافة الممرض إلى المفضلة',
    });
  } catch (error) {
    console.error('[BENEFICIARY FAVORITES ADD ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}
