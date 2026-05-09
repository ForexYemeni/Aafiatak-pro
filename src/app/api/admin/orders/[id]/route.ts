// GET/PATCH /api/admin/orders/[id] - Get/update order
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, Nurse, Notification } from '@/models/mongoose';
import { requireSubadminPermission, requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity, creditNurseEarnings } from '@/lib/api/helpers';
import { sendPushToUser } from '@/lib/notifications/push-service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_orders');
    if (error) return error;

    const { id } = await params;
    const order = await ServiceRequest.findById(id).lean();
    if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

    return Response.json({ success: true, data: { ...order, id: order._id.toString() } });
  } catch (error) {
    console.error('[ADMIN ORDER DETAIL ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_orders');
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    delete body._id;

    const updateData: any = { ...body };
    if (body.status === 'completed') updateData.completedAt = new Date();
    if (body.status === 'cancelled') {
      updateData.cancelledAt = new Date();
      updateData.cancelReason = body.cancelReason || 'إلغاء بواسطة الإدارة';
    }

    // If status is changing to completed, we need the full order first for earnings credit
    if (body.status === 'completed') {
      const order = await ServiceRequest.findById(id);
      if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

      // Don't re-complete already completed orders
      if (order.status === 'completed') {
        return createErrorResponse('الطلب مكتمل بالفعل', 400, 'ALREADY_COMPLETED');
      }

      order.status = 'completed';
      order.completedAt = new Date();
      if (body.notes) order.notes = body.notes;
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

      // ── Notify ALL parties about completion ──
      try {
        const nurse = order.nurseId ? await Nurse.findById(order.nurseId).select('name').lean() : null;
        const nurseName = nurse?.name || 'الممرض/ـة';

        // Notify beneficiary
        await Notification.create({
          userId: order.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: 'تم إكمال طلبك',
          bodyAr: 'تم إكمال طلب الخدمة بنجاح. يرجى تقييم الخدمة',
          type: 'status_change',
          priority: 'high',
          data: { requestId: id, status: 'completed' },
          actionUrl: `/beneficiary/orders/${id}`,
          voiceEnabled: true,
        });
        sendPushToUser(order.beneficiaryId.toString(), {
          title: 'تم إكمال طلبك',
          body: 'تم إكمال طلب الخدمة بنجاح. يرجى تقييم الخدمة',
          type: 'service_completed',
          priority: 'high',
          url: `/beneficiary/orders/${id}`,
          userRole: 'beneficiary',
        }).catch(() => {});

        // Notify nurse
        if (order.nurseId) {
          await Notification.create({
            userId: order.nurseId,
            userRole: 'nurse',
            titleAr: 'تم إكمال الطلب وإضافة أرباحك',
            bodyAr: `تم إكمال الطلب #${id.slice(-6)} وتمت إضافة ${order.nursePayout || 0} ر.ي إلى رصيدك`,
            type: 'payment',
            priority: 'medium',
            data: { requestId: id, status: 'completed', earnings: order.nursePayout },
            actionUrl: '/nurse/earnings',
            voiceEnabled: true,
          });
          sendPushToUser(order.nurseId.toString(), {
            title: 'تم إكمال الطلب وإضافة أرباحك',
            body: `تمت إضافة ${order.nursePayout || 0} ر.ي إلى رصيدك`,
            type: 'payment',
            priority: 'medium',
            url: '/nurse/earnings',
            userRole: 'nurse',
          }).catch(() => {});
        }
      } catch {
        // Non-critical
      }

      await logActivity({
        userId: user!.userId,
        userRole: user!.role,
        action: 'update_order',
        entity: 'ServiceRequest',
        entityId: id,
        details: 'تحديث حالة الطلب إلى: مكتمل',
        request,
      });

      return Response.json({ success: true, data: { ...order.toObject(), id: order._id.toString() }, message: 'تم تحديث الطلب بنجاح' });
    }

    // For cancellation by admin
    if (body.status === 'cancelled') {
      const order = await ServiceRequest.findById(id);
      if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

      order.status = 'cancelled';
      order.cancelledAt = new Date();
      order.cancelReason = body.cancelReason || 'إلغاء بواسطة الإدارة';
      if (body.notes) order.notes = body.notes;
      await order.save();

      const cancelReason = body.cancelReason || 'إلغاء بواسطة الإدارة';

      // ── Notify ALL parties about cancellation ──
      try {
        // Notify beneficiary
        await Notification.create({
          userId: order.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: 'تم إلغاء طلبك',
          bodyAr: `تم إلغاء طلبك - السبب: ${cancelReason}`,
          type: 'status_change',
          priority: 'high',
          data: { requestId: id, status: 'cancelled' },
          actionUrl: `/beneficiary/orders/${id}`,
          voiceEnabled: true,
        });
        sendPushToUser(order.beneficiaryId.toString(), {
          title: 'تم إلغاء طلبك',
          body: `تم إلغاء طلبك - السبب: ${cancelReason}`,
          type: 'service_cancelled',
          priority: 'high',
          url: `/beneficiary/orders/${id}`,
          userRole: 'beneficiary',
        }).catch(() => {});

        // Notify nurse if assigned
        if (order.nurseId) {
          await Notification.create({
            userId: order.nurseId,
            userRole: 'nurse',
            titleAr: 'تم إلغاء الطلب',
            bodyAr: `تم إلغاء الطلب المُعيَّن لك - السبب: ${cancelReason}`,
            type: 'status_change',
            priority: 'high',
            data: { requestId: id, status: 'cancelled' },
            actionUrl: '/nurse',
            voiceEnabled: true,
          });
          sendPushToUser(order.nurseId.toString(), {
            title: 'تم إلغاء الطلب',
            body: `تم إلغاء الطلب المُعيَّن لك - السبب: ${cancelReason}`,
            type: 'service_cancelled',
            priority: 'high',
            url: '/nurse',
            userRole: 'nurse',
          }).catch(() => {});
        }
      } catch {
        // Non-critical
      }

      await logActivity({
        userId: user!.userId,
        userRole: user!.role,
        action: 'cancel_order',
        entity: 'ServiceRequest',
        entityId: id,
        details: `إلغاء الطلب - السبب: ${cancelReason}`,
        request,
      });

      return Response.json({ success: true, data: { ...order.toObject(), id: order._id.toString() }, message: 'تم إلغاء الطلب بنجاح' });
    }

    // For other status changes, use simple update and notify all parties
    const order = await ServiceRequest.findByIdAndUpdate(id, updateData, { new: true }).lean();
    if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

    // ── Notify ALL parties about status change (e.g., payment confirmation) ──
    if (body.status) {
      try {
        const statusLabels: Record<string, string> = {
          pending: 'قيد الانتظار',
          assigned: 'تم التعيين',
          accepted: 'مقبول',
          in_progress: 'قيد التنفيذ',
          awaiting_payment: 'بانتظار الدفع',
          paid: 'تم الدفع',
        };
        const statusLabel = statusLabels[body.status] || body.status;

        // ── Special handling for PAYMENT CONFIRMATION ──
        // When admin confirms payment (paymentStatus: 'completed' + status: 'pending')
        // Notify beneficiary with clear message about what happens next
        const isPaymentConfirmation = body.paymentStatus === 'completed' && body.status === 'pending';

        // Notify beneficiary about status change
        if (order.beneficiaryId) {
          const beneficiaryTitle = isPaymentConfirmation
            ? 'تم تأكيد الدفع ✓'
            : 'تحديث على طلبك';
          const beneficiaryBody = isPaymentConfirmation
            ? 'تم تأكيد الدفع بنجاح. جاري البحث عن ممرض/ـة مناسب لتنفيذ طلبك وسيتم إشعارك فوراً عند التعيين'
            : `تم تحديث حالة طلبك إلى: ${statusLabel}`;

          await Notification.create({
            userId: order.beneficiaryId,
            userRole: 'beneficiary',
            titleAr: beneficiaryTitle,
            bodyAr: beneficiaryBody,
            type: isPaymentConfirmation ? 'payment' : 'status_change',
            priority: 'high',
            data: { requestId: id, status: body.status, paymentConfirmed: isPaymentConfirmation || undefined },
            actionUrl: `/beneficiary/orders/${id}`,
            voiceEnabled: true,
          });
          sendPushToUser(order.beneficiaryId.toString(), {
            title: beneficiaryTitle,
            body: beneficiaryBody,
            type: isPaymentConfirmation ? 'payment' : 'status_change',
            priority: 'high',
            url: `/beneficiary/orders/${id}`,
            userRole: 'beneficiary',
            data: { requestId: id, status: body.status, paymentConfirmed: isPaymentConfirmation || undefined },
          }).catch(() => {});
        }

        // Notify nurse if assigned
        if (order.nurseId) {
          await Notification.create({
            userId: order.nurseId,
            userRole: 'nurse',
            titleAr: 'تحديث على الطلب',
            bodyAr: `تم تحديث حالة الطلب إلى: ${statusLabel}`,
            type: 'status_change',
            priority: 'high',
            data: { requestId: id, status: body.status },
            actionUrl: '/nurse',
            voiceEnabled: true,
          });
          sendPushToUser(order.nurseId.toString(), {
            title: 'تحديث على الطلب',
            body: `تم تحديث حالة الطلب إلى: ${statusLabel}`,
            type: 'status_change',
            priority: 'high',
            url: '/nurse',
            userRole: 'nurse',
            data: { requestId: id, status: body.status },
          }).catch(() => {});
        }
      } catch {
        // Non-critical
      }
    }

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'update_order',
      entity: 'ServiceRequest',
      entityId: id,
      details: `تحديث حالة الطلب إلى: ${body.status || 'محدث'}`,
      request,
    });

    return Response.json({ success: true, data: { ...order, id: order._id.toString() }, message: 'تم تحديث الطلب بنجاح' });
  } catch (error) {
    console.error('[ADMIN ORDER UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحديث', 500, 'INTERNAL_ERROR');
  }
}
