// GET/PATCH /api/admin/emergencies/[id] - Get/update emergency request
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { EmergencyRequest, Notification } from '@/models/mongoose';
import { requireSubadminPermission, requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';
import { sendPushToUser } from '@/lib/notifications/push-service';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_emergencies');
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
    const { user, error } = await requireSubadminPermission(request, 'manage_emergencies');
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

    // ── Notify beneficiary and nurse about emergency status change ──
    try {
      const statusMessages: Record<string, { titleAr: string; bodyAr: string; type: string }> = {
        dispatched: {
          titleAr: 'تم إرسال مساعدة',
          bodyAr: 'تم تعيين ممرض لحالة الطوارئ الخاصة بك. المساعدة في الطريق',
          type: 'emergency_assigned',
        },
        in_progress: {
          titleAr: 'جاري التعامل مع الطوارئ',
          bodyAr: 'الممرض في موقع الطوارئ وبدأ العلاج',
          type: 'status_change',
        },
        resolved: {
          titleAr: 'تم حل حالة الطوارئ',
          bodyAr: 'تم حل حالة الطوارئ بنجاح',
          type: 'service_completed',
        },
        cancelled: {
          titleAr: 'تم إلغاء طلب الطوارئ',
          bodyAr: 'تم إلغاء طلب الطوارئ',
          type: 'service_cancelled',
        },
      };

      const msg = statusMessages[body.status];
      if (msg && emergency.beneficiaryId) {
        // Notify beneficiary
        await Notification.create({
          userId: emergency.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: msg.titleAr,
          bodyAr: msg.bodyAr,
          type: msg.type,
          priority: body.status === 'dispatched' ? 'urgent' : 'high',
          data: { emergencyRequestId: id, status: body.status },
          actionUrl: '/beneficiary/emergency',
          voiceEnabled: true,
        });

        sendPushToUser(emergency.beneficiaryId.toString(), {
          title: msg.titleAr,
          body: msg.bodyAr,
          type: msg.type,
          priority: body.status === 'dispatched' ? 'urgent' : 'high',
          url: '/beneficiary/emergency',
          userRole: 'beneficiary',
          data: { emergencyRequestId: id, status: body.status },
        }).catch(() => {});
      }

      // Notify assigned nurse about emergency status change
      if (msg && emergency.nurseId) {
        const nurseMsg = body.status === 'resolved'
          ? { titleAr: 'تم حل حالة الطوارئ', bodyAr: 'شكراً لاستجابتك السريعة' }
          : body.status === 'cancelled'
          ? { titleAr: 'تم إلغاء حالة الطوارئ', bodyAr: 'تم إلغاء طلب الطوارئ' }
          : null;

        if (nurseMsg) {
          await Notification.create({
            userId: emergency.nurseId,
            userRole: 'nurse',
            titleAr: nurseMsg.titleAr,
            bodyAr: nurseMsg.bodyAr,
            type: 'status_change',
            priority: 'high',
            data: { emergencyRequestId: id, status: body.status },
            actionUrl: '/nurse',
            voiceEnabled: true,
          });

          sendPushToUser(emergency.nurseId.toString(), {
            title: nurseMsg.titleAr,
            body: nurseMsg.bodyAr,
            type: 'status_change',
            priority: 'high',
            url: '/nurse',
            userRole: 'nurse',
            data: { emergencyRequestId: id, status: body.status },
          }).catch(() => {});
        }
      }
    } catch {
      // Non-critical
    }

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
