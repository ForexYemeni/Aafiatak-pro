// POST/PATCH /api/nurse/assignments/[id] - Accept/reject assignment
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, Nurse, Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { sendPushToUser } from '@/lib/notifications/push-service';

async function handleAssignmentAction(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const { id } = await params;
    const body = await request.json();

    // Support both formats:
    // 1. { action: 'accept' | 'reject' } (POST format)
    // 2. { status: 'accepted' | 'rejected' } (PATCH format)
    let action = body.action;
    if (!action && body.status) {
      if (body.status === 'accepted') action = 'accept';
      else if (body.status === 'rejected') action = 'reject';
    }

    if (!['accept', 'reject'].includes(action)) {
      return createErrorResponse('الإجراء مطلوب (accept/reject)', 400, 'VALIDATION_ERROR');
    }

    const order = await ServiceRequest.findById(id);
    if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

    if (order.nurseId?.toString() !== user.userId) {
      return createErrorResponse('هذا الطلب غير معين لك', 403, 'FORBIDDEN');
    }

    if (order.status !== 'assigned') {
      return createErrorResponse('لا يمكن التعامل مع هذا الطلب في حالته الحالية', 400, 'INVALID_STATUS');
    }

    const nurse = await Nurse.findById(user.userId).select('name phone whatsappNumber specialty specialization rating averageRating profileImage avatar').lean();
    const nurseName = nurse?.name || 'الممرض/ـة';
    const nursePhone = nurse?.phone || nurse?.whatsappNumber || '';
    const nurseSpecialty = nurse?.specialty || nurse?.specialization || '';
    const nurseRating = nurse?.rating || nurse?.averageRating || 0;

    if (action === 'accept') {
      order.status = 'accepted';
      await order.save();

      // ── Notifications for ALL parties ──
      try {
        // 1️⃣ Notify BENEFICIARY: Nurse accepted with FULL contact details
        // Build detailed message with nurse info for the beneficiary
        let acceptBody = `تم قبول طلبك من ${nurseName}`;
        if (nurseSpecialty) acceptBody += `\nالتخصص: ${nurseSpecialty}`;
        if (nursePhone) acceptBody += `\nرقم التواصل: ${nursePhone}`;
        acceptBody += '\nسيقوم بالوصول إليك قريباً';

        await Notification.create({
          userId: order.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: '✅ تم قبول طلبك - الممرض في الطريق',
          bodyAr: acceptBody,
          type: 'service_accepted',
          priority: 'high',
          data: {
            requestId: id,
            status: 'accepted',
            nurseId: user.userId,
            nurseName,
            nursePhone,
            nurseSpecialty,
            nurseRating: nurseRating ? String(nurseRating) : undefined,
          },
          actionUrl: `/beneficiary/orders/${id}`,
          voiceEnabled: true,
        });

        sendPushToUser(order.beneficiaryId.toString(), {
          title: 'تم قبول طلبك - الممرض في الطريق',
          body: `تم قبول طلبك من ${nurseName}${nurseSpecialty ? ` (${nurseSpecialty})` : ''}${nursePhone ? `. رقم التواصل: ${nursePhone}` : ''}. سيقوم بالوصول إليك قريباً`,
          type: 'service_accepted',
          priority: 'high',
          url: `/beneficiary/orders/${id}`,
          userRole: 'beneficiary',
          sound: true,
          data: {
            requestId: id,
            status: 'accepted',
            nurseId: user.userId,
            nurseName,
            nursePhone,
            voiceAlert: true,
            voiceText: `تم قبول طلبك من ${nurseName}. سيقوم بالوصول إليك قريباً`,
          },
        }).catch(() => {});

        // 2️⃣ Notify ADMIN: Nurse accepted the order
        const { User } = await import('@/models/mongoose');
        const admins = await User.find({ role: 'admin' }).select('_id').lean();
        for (const admin of admins) {
          await Notification.create({
            userId: admin._id,
            userRole: 'admin',
            titleAr: 'قبول الممرض للطلب',
            bodyAr: `قبل ${nurseName} الطلب #${id.slice(-6)} وسيبدأ التنفيذ قريباً`,
            type: 'status_change',
            priority: 'medium',
            data: { requestId: id, status: 'accepted', nurseId: user.userId },
            actionUrl: '/admin/orders',
            read: false,
          });

          sendPushToUser(admin._id.toString(), {
            title: 'قبول الممرض للطلب',
            body: `قبل ${nurseName} الطلب #${id.slice(-6)} وسيبدأ التنفيذ قريباً`,
            type: 'service_accepted',
            priority: 'medium',
            url: '/admin/orders',
            userRole: 'admin',
            data: { requestId: id, status: 'accepted', voiceAlert: true, voiceText: `قبل ${nurseName} الطلب وسيبدأ التنفيذ قريباً` },
          }).catch(() => {});
        }
      } catch {
        // Non-critical
      }

      return Response.json({
        success: true,
        data: { ...order.toObject(), id: order._id.toString() },
        message: 'تم قبول الطلب بنجاح',
      });
    } else {
      order.status = 'pending';
      order.nurseId = undefined;
      await order.save();

      // ── Notifications for ALL parties ──
      try {
        // 1️⃣ Notify BENEFICIARY: Nurse rejected, looking for another
        await Notification.create({
          userId: order.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: 'جاري البحث عن ممرض بديل',
          bodyAr: `الممرض المعين لم يتمكن من تنفيذ طلبك. جاري البحث عن ممرض بديل`,
          type: 'status_change',
          priority: 'medium',
          data: { requestId: id, status: 'pending' },
          actionUrl: `/beneficiary/orders/${id}`,
          voiceEnabled: true,
        });

        sendPushToUser(order.beneficiaryId.toString(), {
          title: 'جاري البحث عن ممرض بديل',
          body: 'الممرض المعين لم يتمكن من تنفيذ طلبك. جاري البحث عن بديل',
          type: 'status_change',
          priority: 'medium',
          url: `/beneficiary/orders/${id}`,
          userRole: 'beneficiary',
          data: { requestId: id, status: 'pending', voiceAlert: true, voiceText: 'الممرض المعين لم يتمكن من تنفيذ طلبك. جاري البحث عن ممرض بديل' },
        }).catch(() => {});

        // 2️⃣ Notify ADMIN: Nurse rejected the assignment
        const { User } = await import('@/models/mongoose');
        const admins = await User.find({ role: 'admin' }).select('_id').lean();
        for (const admin of admins) {
          await Notification.create({
            userId: admin._id,
            userRole: 'admin',
            titleAr: 'رفض ممرض طلباً',
            bodyAr: `رفض الممرض ${nurseName} الطلب #${id.slice(-6)} - يرجى تعيين ممرض بديل`,
            type: 'status_change',
            priority: 'high',
            data: { requestId: id, status: 'rejected', nurseId: user.userId },
            actionUrl: '/admin/orders',
            voiceEnabled: true,
            read: false,
          });

          sendPushToUser(admin._id.toString(), {
            title: 'رفض ممرض طلباً',
            body: `رفض الممرض ${nurseName} الطلب #${id.slice(-6)} - يرجى تعيين بديل`,
            type: 'service_cancelled',
            priority: 'high',
            url: '/admin/orders',
            userRole: 'admin',
            data: { requestId: id, status: 'rejected', voiceAlert: true, voiceText: `رفض الممرض ${nurseName} الطلب. يرجى تعيين ممرض بديل` },
          }).catch(() => {});
        }
      } catch {
        // Non-critical
      }

      return Response.json({
        success: true,
        data: { ...order.toObject(), id: order._id.toString() },
        message: 'تم رفض الطلب',
      });
    }
  } catch (error) {
    console.error('[NURSE ASSIGNMENT ACTION ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleAssignmentAction(request, { params });
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return handleAssignmentAction(request, { params });
}
