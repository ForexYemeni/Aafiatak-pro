// PATCH /api/nurse/orders/[id] - Update order status (start/complete)
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, Nurse, Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { creditNurseEarnings } from '@/lib/api/helpers';
import { sendPushToUser } from '@/lib/notifications/push-service';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const { id } = await params;
    const { action } = await request.json();

    const order = await ServiceRequest.findById(id);
    if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

    if (order.nurseId?.toString() !== user.userId) {
      return createErrorResponse('هذا الطلب غير معين لك', 403, 'FORBIDDEN');
    }

    const nurse = await Nurse.findById(user.userId).select('name').lean();
    const nurseName = nurse?.name || 'الممرض/ـة';

    if (action === 'start') {
      // Start the service: accepted → in_progress
      if (order.status !== 'accepted') {
        return createErrorResponse('لا يمكن بدء الطلب في حالته الحالية', 400, 'INVALID_STATUS');
      }

      // ── Payment gate (server-side enforcement) ──
      // ALL orders (including cash) require admin payment confirmation before
      // the nurse can start execution. paymentStatus must be 'completed'.
      if (order.paymentStatus !== 'completed') {
        return createErrorResponse(
          'لا يمكن بدء تنفيذ الطلب قبل تأكيد الدفع من الإدارة',
          403,
          'PAYMENT_NOT_CONFIRMED'
        );
      }

      order.status = 'in_progress';
      order.startedAt = new Date();
      await order.save();

      // ── Notifications for ALL parties ──
      try {
        // 1️⃣ Notify BENEFICIARY: Service has started
        await Notification.create({
          userId: order.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: 'بدأ تنفيذ طلبك',
          bodyAr: `بدأ ${nurseName} بتنفيذ طلب الخدمة الخاص بك`,
          type: 'status_change',
          priority: 'high',
          data: { requestId: id, status: 'in_progress', voiceAlert: true, voiceText: `بدأ ${nurseName} بتنفيذ طلب الخدمة الخاص بك` },
          actionUrl: `/beneficiary/orders/${id}`,
          voiceEnabled: true,
        });

        sendPushToUser(order.beneficiaryId.toString(), {
          title: 'بدأ تنفيذ طلبك',
          body: `بدأ ${nurseName} بتنفيذ طلب الخدمة الخاص بك`,
          type: 'service_started',
          priority: 'high',
          url: `/beneficiary/orders/${id}`,
          userRole: 'beneficiary',
          data: { requestId: id, status: 'in_progress', voiceAlert: true, voiceText: `بدأ ${nurseName} بتنفيذ طلب الخدمة الخاص بك` },
        }).catch(() => {});

        // 2️⃣ Notify ADMIN: Nurse started the service
        const { User } = await import('@/models/mongoose');
        const admins = await User.find({ role: { $in: ['admin', 'subadmin'] } }).select('_id role').lean();
        for (const admin of admins) {
          const adminRole = (admin as any).role || 'admin';
          await Notification.create({
            userId: admin._id,
            userRole: adminRole,
            titleAr: 'بدأ تنفيذ الطلب',
            bodyAr: `بدأ ${nurseName} تنفيذ الطلب #${id.slice(-6)}`,
            type: 'status_change',
            priority: 'medium',
            data: { requestId: id, status: 'in_progress', voiceAlert: true, voiceText: `بدأ ${nurseName} تنفيذ طلب الخدمة` },
            actionUrl: '/admin/orders',
            read: false,
          });

          sendPushToUser(admin._id.toString(), {
            title: 'بدأ تنفيذ الطلب',
            body: `بدأ ${nurseName} تنفيذ الطلب #${id.slice(-6)}`,
            type: 'service_started',
            priority: 'medium',
            url: '/admin/orders',
            userRole: adminRole,
            data: { requestId: id, status: 'in_progress', voiceAlert: true, voiceText: `بدأ ${nurseName} تنفيذ طلب الخدمة` },
          }).catch(() => {});
        }
      } catch {
        // Non-critical
      }

      // ── Emit real-time socket event ──
      try {
        const { emitRealtimeEvent } = await import('@/lib/notifications/emit-realtime-event');
        emitRealtimeEvent.orderStatusChanged({
          requestId: id,
          beneficiaryId: order.beneficiaryId?.toString(),
          nurseId: user.userId,
          status: 'in_progress',
        }, { changedBy: user.userId, changedByRole: user.role });
      } catch {}

      return Response.json({
        success: true,
        data: serializeDoc(order.toObject()),
        message: 'تم بدء تنفيذ الطلب',
      });
    }

    if (action === 'complete') {
      // Complete the service: in_progress → completed
      if (order.status !== 'in_progress') {
        return createErrorResponse('لا يمكن إكمال الطلب في حالته الحالية', 400, 'INVALID_STATUS');
      }
      order.status = 'completed';
      order.completedAt = new Date();
      await order.save();

      // Credit nurse earnings
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

      // ── Notifications for ALL parties ──
      try {
        // 1️⃣ Notify BENEFICIARY: Service completed, please rate
        await Notification.create({
          userId: order.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: 'تم إكمال طلبك',
          bodyAr: 'تم إكمال طلب الخدمة بنجاح. يرجى تقييم الخدمة',
          type: 'status_change',
          priority: 'high',
          data: { requestId: id, status: 'completed', voiceAlert: true, voiceText: 'تم إكمال طلب الخدمة بنجاح. يرجى تقييم الخدمة' },
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
          data: { requestId: id, status: 'completed', voiceAlert: true, voiceText: 'تم إكمال طلب الخدمة بنجاح. يرجى تقييم الخدمة' },
        }).catch(() => {});

        // 2️⃣ Notify NURSE: Service completed, earnings credited
        await Notification.create({
          userId: user.userId,
          userRole: 'nurse',
          titleAr: 'تم إكمال الطلب وإضافة أرباحك',
          bodyAr: `تم إكمال الطلب #${id.slice(-6)} بنجاح وتمت إضافة ${order.nursePayout || 0} ر.ي إلى رصيدك`,
          type: 'payment',
          priority: 'medium',
          data: { requestId: id, status: 'completed', earnings: order.nursePayout, voiceAlert: true, voiceText: `تم إكمال الطلب وإضافة ${order.nursePayout || 0} ريال إلى رصيدك` },
          actionUrl: '/nurse/earnings',
          voiceEnabled: true,
        });

        sendPushToUser(user.userId, {
          title: 'تم إكمال الطلب وإضافة أرباحك',
          body: `تم إضافة ${order.nursePayout || 0} ر.ي إلى رصيدك`,
          type: 'payment',
          priority: 'medium',
          url: '/nurse/earnings',
          userRole: 'nurse',
          data: { requestId: id, earnings: order.nursePayout, voiceAlert: true, voiceText: `تم إكمال الطلب وإضافة ${order.nursePayout || 0} ريال إلى رصيدك` },
        }).catch(() => {});

        // 3️⃣ Notify ADMIN: Order completed
        const { User } = await import('@/models/mongoose');
        const admins = await User.find({ role: { $in: ['admin', 'subadmin'] } }).select('_id role').lean();
        for (const admin of admins) {
          const adminRole = (admin as any).role || 'admin';
          await Notification.create({
            userId: admin._id,
            userRole: adminRole,
            titleAr: 'تم إكمال الطلب',
            bodyAr: `أكمل ${nurseName} الطلب #${id.slice(-6)} بنجاح`,
            type: 'status_change',
            priority: 'medium',
            data: { requestId: id, status: 'completed', voiceAlert: true, voiceText: `أكمل ${nurseName} طلب الخدمة بنجاح` },
            actionUrl: '/admin/orders',
            read: false,
          });

          sendPushToUser(admin._id.toString(), {
            title: 'تم إكمال الطلب',
            body: `أكمل ${nurseName} الطلب #${id.slice(-6)} بنجاح`,
            type: 'service_completed',
            priority: 'medium',
            url: '/admin/orders',
            userRole: adminRole,
            data: { requestId: id, status: 'completed', voiceAlert: true, voiceText: `أكمل ${nurseName} طلب الخدمة بنجاح` },
          }).catch(() => {});
        }
      } catch {
        // Non-critical
      }

      // ── Emit real-time socket event ──
      try {
        const { emitRealtimeEvent } = await import('@/lib/notifications/emit-realtime-event');
        emitRealtimeEvent.orderStatusChanged({
          requestId: id,
          beneficiaryId: order.beneficiaryId?.toString(),
          nurseId: user.userId,
          status: 'completed',
        }, { changedBy: user.userId, changedByRole: user.role });
      } catch {}

      return Response.json({
        success: true,
        data: serializeDoc(order.toObject()),
        message: 'تم إكمال الطلب بنجاح',
      });
    }

    return createErrorResponse('إجراء غير معروف. استخدم: start أو complete', 400, 'INVALID_ACTION');
  } catch (error) {
    console.error('[NURSE ORDER ACTION ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}
