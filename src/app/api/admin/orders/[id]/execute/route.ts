// POST /api/admin/orders/[id]/execute - Direct execution by admin
// Sets order to completed immediately without nurse
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, Notification } from '@/models/mongoose';
import { requireSubadminPermission, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity, creditNurseEarnings } from '@/lib/api/helpers';
import { sendPushToUser } from '@/lib/notifications/push-service';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
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
    if (!['pending', 'assigned', 'accepted', 'in_progress'].includes(order.status)) {
      return createErrorResponse('لا يمكن تنفيذ هذا الطلب في حالته الحالية', 400, 'INVALID_STATUS');
    }

    // Update order status to completed directly
    order.status = 'completed';
    order.completedAt = new Date();
    order.startedAt = order.startedAt || new Date();
    if (notes) order.notes = notes;
    await order.save();

    // Credit nurse earnings if nurse is assigned
    if (order.nurseId && order.nursePayout > 0) {
      await creditNurseEarnings({
        requestId: order._id.toString(),
        nurseId: order.nurseId.toString(),
        beneficiaryId: order.beneficiaryId.toString(),
        amount: order.totalPrice || 0,
        commission: order.commission || 0,
        nursePayout: order.nursePayout || 0,
        paymentMethod: order.paymentMethod,
      });
    }

    // Notify beneficiary
    try {
      await Notification.create({
        userId: order.beneficiaryId,
        userRole: 'beneficiary',
        titleAr: 'تم إكمال طلبك',
        bodyAr: 'تم تنفيذ طلب الخدمة مباشرة من قبل الإدارة',
        type: 'service_completed',
        priority: 'high',
        data: { requestId: id, status: 'completed', executedBy: 'admin' },
        voiceEnabled: true,
      });

      // Send push notification to beneficiary
      sendPushToUser(order.beneficiaryId.toString(), {
        title: 'تم إكمال طلبك',
        body: 'تم تنفيذ طلب الخدمة مباشرة من قبل الإدارة',
        type: 'service_completed',
        priority: 'high',
        url: `/beneficiary/orders/${id}`,
        userRole: 'beneficiary',
        data: { requestId: id, status: 'completed', executedBy: 'admin' },
      }).catch(() => {});
    } catch {
      // Non-critical
    }

    // Notify assigned nurse if any (to remove from their list)
    if (order.nurseId) {
      try {
        await Notification.create({
          userId: order.nurseId,
          userRole: 'nurse',
          titleAr: 'تم إكمال الطلب المعين لك',
          bodyAr: 'تم إكمال الطلب وتم إضافة أرباحك إلى رصيدك المتاح',
          type: 'payment',
          priority: 'high',
          data: { requestId: id, status: 'completed', executedBy: 'admin' },
          voiceEnabled: true,
        });

        // Send push notification to nurse
        sendPushToUser(order.nurseId.toString(), {
          title: 'تم إكمال الطلب وإضافة أرباحك',
          body: `تمت إضافة ${order.nursePayout || 0} ر.ي إلى رصيدك المتاح`,
          type: 'payment',
          priority: 'high',
          url: '/nurse/earnings',
          userRole: 'nurse',
          data: { requestId: id, status: 'completed', earnings: order.nursePayout },
        }).catch(() => {});
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
      data: serializeDoc(order.toObject()),
      message: 'تم تنفيذ الطلب مباشرة بنجاح',
    });
  } catch (error) {
    console.error('[ADMIN EXECUTE ORDER ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تنفيذ الطلب', 500, 'INTERNAL_ERROR');
  }
}
