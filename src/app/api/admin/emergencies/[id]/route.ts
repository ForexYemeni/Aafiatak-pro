// GET/PATCH /api/admin/emergencies/[id] - Get/update emergency request
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { EmergencyRequest } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { id } = await params;
    const emergency = await EmergencyRequest.findById(id).lean();
    if (!emergency) return createErrorResponse('طلب الطوارئ غير موجود', 404, 'NOT_FOUND');

    return Response.json({ success: true, data: { ...emergency, id: emergency._id.toString() } });
  } catch (error) {
    console.error('[ADMIN EMERGENCY DETAIL ERROR]', error);
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

    delete body._id;

    const updateData: any = { ...body };
    if (body.status === 'dispatched') updateData.dispatchedAt = new Date();
    if (body.status === 'resolved') {
      updateData.resolvedAt = new Date();
      if (updateData.dispatchedAt) {
        updateData.responseTime = Math.round((Date.now() - new Date(updateData.dispatchedAt).getTime()) / 1000);
      }
    }

    const emergency = await EmergencyRequest.findByIdAndUpdate(id, updateData, { new: true }).lean();
    if (!emergency) return createErrorResponse('طلب الطوارئ غير موجود', 404, 'NOT_FOUND');

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'update_emergency',
      entity: 'EmergencyRequest',
      entityId: id,
      details: `تحديث حالة طلب الطوارئ إلى: ${body.status || 'محدث'}`,
      request,
    });

    return Response.json({ success: true, data: { ...emergency, id: emergency._id.toString() }, message: 'تم تحديث طلب الطوارئ بنجاح' });
  } catch (error) {
    console.error('[ADMIN EMERGENCY UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحديث', 500, 'INTERNAL_ERROR');
  }
}
