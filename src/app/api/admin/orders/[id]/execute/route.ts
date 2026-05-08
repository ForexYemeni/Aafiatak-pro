// POST /api/admin/orders/[id]/execute - Direct execution by admin
// Sets order to completed immediately without nurse
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, Notification } from '@/models/mongoose';
import { requireSubadminPermission, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_orders');
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const { notes } = body;

    const order = await ServiceRequest.findById(id);
    if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

    // Can only execute orders that are pending or assigned
    if (!['pending', 'assigned', 'accepted'].includes(order.status)) {
      return createErrorResponse('لا يمكن تنفيذ هذا الطلب في حالته الحالية', 400, 'INVALID_STATUS');
    }

    // Update order status to completed directly
    order.status = 'completed';
    order.completedAt = new Date();
    order.startedAt = order.startedAt || new Date();
    if (notes) order.notes = notes;
    await order.save();

    // Notify beneficiary
    try {
      await Notification.create({
        userId: order.beneficiaryId,
        userRole: 'beneficiary',
        titleAr: 'تم إكمال طلبك',
        bodyAr: 'تم تنفيذ طلب الخدمة مباشرة من قبل الإدارة',
        type: 'status_change',
        priority: 'medium',
        data: { requestId: id, status: 'completed', executedBy: 'admin' },
        voiceEnabled: true,
      });
    } catch {
      // Non-critical
    }

    // Notify assigned nurse if any (to remove from their list)
    if (order.nurseId) {
      try {
        await Notification.create({
          userId: order.nurseId,
          userRole: 'nurse',
          titleAr: 'تم إلغاء تعيينك',
          bodyAr: 'تم تنفيذ الطلب مباشرة من قبل الإدارة ولم يعد بحاجة لخدمتك',
          type: 'status_change',
          priority: 'medium',
          data: { requestId: id, status: 'completed', executedBy: 'admin' },
          voiceEnabled: true,
        });
      } catch {
        // Non-critical
      }
    }

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'execute_order_directly',
      entity: 'ServiceRequest',
      entityId: id,
      details: 'تنفيذ مباشر للطلب من الإدارة',
      request,
    });

    return Response.json({
      success: true,
      data: { ...order.toObject(), id: order._id.toString() },
      message: 'تم تنفيذ الطلب مباشرة بنجاح',
    });
  } catch (error) {
    console.error('[ADMIN EXECUTE ORDER ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تنفيذ الطلب', 500, 'INTERNAL_ERROR');
  }
}
