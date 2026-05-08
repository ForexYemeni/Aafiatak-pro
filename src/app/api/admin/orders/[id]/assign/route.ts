// POST /api/admin/orders/[id]/assign - Assign nurse to order
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, Nurse, Notification } from '@/models/mongoose';
import { requireSubadminPermission, requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_orders');
    if (error) return error;

    const { id } = await params;
    const { nurseId } = await request.json();

    if (!nurseId) {
      return createErrorResponse('معرف الممرض مطلوب', 400, 'VALIDATION_ERROR');
    }

    // Verify nurse exists and is verified
    const nurse = await Nurse.findById(nurseId).select('-password').lean();
    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');
    if (nurse.verificationStatus !== 'verified') {
      return createErrorResponse('الممرض غير موثق', 400, 'NURSE_NOT_VERIFIED');
    }

    // Update order
    const order = await ServiceRequest.findByIdAndUpdate(
      id,
      { nurseId, status: 'assigned' },
      { new: true }
    ).lean();
    if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

    // Create notification for the nurse
    try {
      await Notification.create({
        userId: nurseId,
        userRole: 'nurse',
        titleAr: 'طلب خدمة جديد',
        bodyAr: `تم تعيينك لطلب خدمة جديد. يرجى المراجعة والقبول`,
        type: 'assignment',
        priority: 'high',
        data: { requestId: id, assignmentType: 'service' },
        voiceEnabled: true,
      });
    } catch {
      // Non-critical
    }

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'assign_nurse',
      entity: 'ServiceRequest',
      entityId: id,
      details: `تعيين الممرض ${nurse.name} للطلب`,
      request,
    });

    return Response.json({
      success: true,
      data: { ...order, id: order._id.toString() },
      message: 'تم تعيين الممرض للطلب بنجاح',
    });
  } catch (error) {
    console.error('[ADMIN ASSIGN NURSE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تعيين الممرض', 500, 'INTERNAL_ERROR');
  }
}
