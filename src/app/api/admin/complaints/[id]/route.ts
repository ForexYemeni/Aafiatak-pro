// PATCH /api/admin/complaints/[id] - Update complaint (respond)
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Rating } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    const rating = await Rating.findByIdAndUpdate(
      id,
      { response: body.response },
      { new: true }
    ).lean();

    if (!rating) return createErrorResponse('الشكوى غير موجودة', 404, 'NOT_FOUND');

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'respond_complaint',
      entity: 'Rating',
      entityId: id,
      details: 'الرد على شكوى',
      request,
    });

    return Response.json({
      success: true,
      data: { ...rating, id: rating._id.toString() },
      message: 'تم الرد على الشكوى بنجاح',
    });
  } catch (error) {
    console.error('[ADMIN COMPLAINT UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تحديث الشكوى', 500, 'INTERNAL_ERROR');
  }
}
