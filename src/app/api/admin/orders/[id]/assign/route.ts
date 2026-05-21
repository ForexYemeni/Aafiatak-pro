// POST /api/admin/orders/[id]/assign - Assign nurse to order
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, Nurse, Service, Beneficiary, Notification } from '@/models/mongoose';
import { requireSubadminPermission, requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';
import { sendPushToUser } from '@/lib/notifications/push-service';
import { serializeDoc } from '@/lib/mongoose/serialize';

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

    const nurseName = nurse.name || 'الممرض/ـة';
    const nursePhone = nurse.phone || nurse.whatsappNumber || '';
    const nurseSpecialty = nurse.specialty || nurse.specialization || '';
    const nurseRating = nurse.rating || nurse.averageRating || 0;
    const nurseAvatar = nurse.profileImage || nurse.avatar || '';
    const orderId = order._id.toString();

    // ── Notifications for ALL parties ──
    try {
      // 1️⃣ Notify NURSE: You have been assigned a new service request
      await Notification.create({
        userId: nurseId,
        userRole: 'nurse',
        titleAr: '🩺 طلب خدمة جديد - تم تعيينك',
        bodyAr: 'تم تعيينك لطلب خدمة جديد. يرجى المراجعة والقبول في أقرب وقت',
        type: 'assignment',
        priority: 'high',
        data: { requestId: id, assignmentType: 'service', voiceAlert: 'true', voiceText: 'تم تعيينك لطلب خدمة جديد. يرجى المراجعة والقبول في أقرب وقت' },
        actionUrl: '/nurse',
        voiceEnabled: true,
      });

      sendPushToUser(nurseId, {
        title: 'طلب خدمة جديد - تم تعيينك',
        body: 'تم تعيينك لطلب خدمة جديد. يرجى المراجعة والقبول',
        type: 'service_assigned',
        priority: 'high',
        url: '/nurse',
        userRole: 'nurse',
        sound: true,
        data: { requestId: id, assignmentType: 'service', voiceAlert: true, voiceText: 'تم تعيينك لطلب خدمة جديد. يرجى المراجعة والقبول في أقرب وقت' },
      }).catch(() => {});

      // 2️⃣ Notify BENEFICIARY: A nurse has been assigned with FULL details
      if (order.beneficiaryId) {
        const service = await Service.findById(order.serviceId).select('nameAr').lean();
        const serviceName = service?.nameAr || 'خدمة طبية';

        // Build detailed notification body with nurse info
        let nurseInfoBody = `تم تعيين ${nurseName} لتنفيذ طلبك لخدمة ${serviceName}`;
        if (nurseSpecialty) nurseInfoBody += `\nالتخصص: ${nurseSpecialty}`;
        if (nursePhone) nurseInfoBody += `\nرقم التواصل: ${nursePhone}`;

        await Notification.create({
          userId: order.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: '👨‍⚕️ تم تعيين ممرض لطلبك',
          bodyAr: nurseInfoBody,
          type: 'service_assigned',
          priority: 'high',
          data: {
            requestId: id,
            status: 'assigned',
            nurseId: nurseId.toString(),
            nurseName,
            nursePhone,
            nurseSpecialty,
            nurseRating: nurseRating ? String(nurseRating) : undefined,
            voiceAlert: 'true',
            voiceText: `تم تعيين ${nurseName} لتنفيذ طلبك. سيقوم بالتواصل معك قريباً`,
          },
          actionUrl: `/beneficiary/orders/${id}`,
          voiceEnabled: true,
        });

        sendPushToUser(order.beneficiaryId.toString(), {
          title: 'تم تعيين ممرض لطلبك',
          body: `تم تعيين ${nurseName}${nurseSpecialty ? ` (${nurseSpecialty})` : ''} لتنفيذ طلبك${nursePhone ? `. رقم التواصل: ${nursePhone}` : ''}`,
          type: 'service_assigned',
          priority: 'high',
          url: `/beneficiary/orders/${id}`,
          userRole: 'beneficiary',
          sound: true,
          data: {
            requestId: id,
            status: 'assigned',
            nurseId: nurseId.toString(),
            nurseName,
            nursePhone,
            voiceAlert: true,
            voiceText: `تم تعيين ${nurseName} لتنفيذ طلبك. سيقوم بالتواصل معك قريباً`,
          },
        }).catch(() => {});
      }

      // 3️⃣ Notify ADMIN (confirmation): Assignment successful
      const { User } = await import('@/models/mongoose');
      const admins = await User.find({ role: { $in: ['admin', 'subadmin'] } }).select('_id role').lean();
      for (const admin of admins) {
        // Don't notify the admin/subadmin who performed the action
        if (admin._id.toString() === user!.userId) continue;
        const adminRole = (admin as any).role || 'admin';

        await Notification.create({
          userId: admin._id,
          userRole: adminRole,
          titleAr: 'تم تعيين ممرض',
          bodyAr: `تم تعيين ${nurseName} للطلب #${id.slice(-6)}`,
          type: 'system',
          priority: 'low',
          data: { requestId: id, nurseId: nurseId.toString() },
          actionUrl: '/admin/orders',
          read: false,
        });

        sendPushToUser(admin._id.toString(), {
          title: 'تم تعيين ممرض',
          body: `تم تعيين ${nurseName} للطلب #${id.slice(-6)}`,
          type: 'system',
          priority: 'low',
          url: '/admin/orders',
          userRole: adminRole,
          data: { requestId: id },
        }).catch(() => {});
      }
    } catch {
      // Non-critical
    }

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'assign_nurse',
      entity: 'ServiceRequest',
      entityId: id,
      details: `تعيين الممرض ${nurseName} للطلب`,
      request,
    });

    return Response.json({
      success: true,
      data: serializeDoc({ ...order, id: orderId }),
      message: 'تم تعيين الممرض للطلب بنجاح',
    });
  } catch (error) {
    console.error('[ADMIN ASSIGN NURSE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تعيين الممرض', 500, 'INTERNAL_ERROR');
  }
}
