// GET/PATCH /api/admin/nurses/[id] - Get/update nurse by ID
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { id } = await params;
    const nurse = await Nurse.findById(id).select('-password').lean();
    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    return Response.json({ success: true, data: { ...nurse, id: nurse._id.toString() } });
  } catch (error) {
    console.error('[ADMIN NURSE DETAIL ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    // Prevent updating sensitive fields directly
    delete body.password;
    delete body._id;

    const nurse = await Nurse.findByIdAndUpdate(id, body, { new: true }).select('-password').lean();
    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'update_nurse',
      entity: 'Nurse',
      entityId: id,
      details: `تحديث بيانات الممرض: ${nurse.name}`,
      request,
    });

    return Response.json({ success: true, data: { ...nurse, id: nurse._id.toString() }, message: 'تم تحديث بيانات الممرض بنجاح' });
  } catch (error) {
    console.error('[ADMIN NURSE UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحديث', 500, 'INTERNAL_ERROR');
  }
}
