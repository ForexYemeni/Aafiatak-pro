// GET/PATCH /api/admin/emergencies/[id] - Get/update emergency request
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { EmergencyRequest, Notification, Nurse, Beneficiary } from '@/models/mongoose';
import { requireSubadminPermission, requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';
import { sendPushToUser } from '@/lib/notifications/push-service';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_emergencies');
    if (error) return error;

    const { id } = await params;
    const emergency = await EmergencyRequest.findById(id).lean();
    if (!emergency) return createErrorResponse('طلب الطوارئ غير موجود', 404, 'NOT_FOUND');

    return Response.json({ success: true, data: serializeDoc(emergency) });
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
    // ALL notifications in PARALLEL for maximum speed
    try {
      const notificationPromises: Promise<any>[] = [];

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
        // Notify beneficiary - create notification + push IN PARALLEL
        notificationPromises.push(
          Notification.create({
            userId: emergency.beneficiaryId,
            userRole: 'beneficiary',
            titleAr: msg.titleAr,
            bodyAr: msg.bodyAr,
            type: msg.type,
            priority: body.status === 'dispatched' ? 'urgent' : 'high',
            data: { emergencyRequestId: id, status: body.status, voiceAlert: body.status === 'dispatched', voiceText: body.status === 'dispatched' ? 'تم إرسال مساعدة، الممرض في الطريق إليك' : undefined },
            actionUrl: '/beneficiary/emergency',
            voiceEnabled: true,
          })
        );
        notificationPromises.push(
          sendPushToUser(emergency.beneficiaryId.toString(), {
            title: msg.titleAr,
            body: msg.bodyAr,
            type: msg.type,
            priority: body.status === 'dispatched' ? 'urgent' : 'high',
            url: '/beneficiary/emergency',
            userRole: 'beneficiary',
            sound: true,
            data: { emergencyRequestId: id, status: body.status, voiceAlert: body.status === 'dispatched', voiceText: body.status === 'dispatched' ? 'تم إرسال مساعدة، الممرض في الطريق إليك' : undefined },
          })
        );
      }

      // ── Notify NURSE about emergency assignment / status change ──
      if (emergency.nurseId) {
        if (body.status === 'dispatched') {
          const [nurseInfo, beneficiaryInfo] = await Promise.all([
            Nurse.findById(emergency.nurseId).select('name').lean(),
            Beneficiary.findById(emergency.beneficiaryId).select('name phone').lean(),
          ]);

          const typeLabels: Record<string, string> = {
            medical: 'طبي عام', injury: 'إصابة', breathing: 'تنفسي',
            cardiac: 'قلبي', fall: 'سقوط', other: 'أخرى', general_medical: 'طبي عام',
          };
          const emergencyType = typeLabels[emergency.type] || emergency.type || 'طوارئ';
          const beneficiaryName = beneficiaryInfo?.name || 'غير معروف';
          const beneficiaryPhone = beneficiaryInfo?.phone || '';

          let nurseBody = `تم تعيينك لحالة طوارئ (${emergencyType})`;
          nurseBody += `\nالمستفيد: ${beneficiaryName}`;
          if (beneficiaryPhone) nurseBody += `\nهاتف المستفيد: ${beneficiaryPhone}`;
          if (emergency.address) nurseBody += `\nالعنوان: ${emergency.address}`;
          if (emergency.description) nurseBody += `\nالوصف: ${emergency.description}`;

          // Nurse notifications IN PARALLEL
          notificationPromises.push(
            Notification.create({
              userId: emergency.nurseId,
              userRole: 'nurse',
              titleAr: '🚨 حالة طوارئ جديدة - تم تعيينك',
              bodyAr: nurseBody,
              type: 'emergency_assigned',
              priority: 'urgent',
              data: {
                emergencyRequestId: id,
                status: 'dispatched',
                emergencyType: emergency.type,
                beneficiaryName,
                beneficiaryPhone,
                address: emergency.address,
                lat: emergency.location?.coordinates?.[1],
                lng: emergency.location?.coordinates?.[0],
                voiceAlert: true,
                voiceText: `تم تعيينك لحالة طوارئ ${emergencyType}، المستفيد ${beneficiaryName}`,
              },
              actionUrl: '/nurse',
              voiceEnabled: true,
            })
          );

          let pushBody = `حالة طوارئ ${emergencyType} - المستفيد: ${beneficiaryName}`;
          if (emergency.address) pushBody += ` - ${emergency.address}`;

          notificationPromises.push(
            sendPushToUser(emergency.nurseId.toString(), {
              title: '🚨 حالة طوارئ جديدة - تم تعيينك',
              body: pushBody,
              type: 'emergency_assigned',
              priority: 'urgent',
              url: '/nurse',
              userRole: 'nurse',
              sound: true,
              data: {
                emergencyRequestId: id,
                status: 'dispatched',
                emergencyType: emergency.type,
                beneficiaryName,
                beneficiaryPhone,
                address: emergency.address,
                voiceAlert: true,
                voiceText: `تم تعيينك لحالة طوارئ ${emergencyType}، المستفيد ${beneficiaryName}`,
              },
            })
          );

        } else if (body.status === 'in_progress') {
          notificationPromises.push(
            Notification.create({
              userId: emergency.nurseId,
              userRole: 'nurse',
              titleAr: 'جاري التعامل مع حالة الطوارئ',
              bodyAr: 'تم تحديث حالة الطوارئ إلى قيد التنفيذ',
              type: 'status_change',
              priority: 'high',
              data: { emergencyRequestId: id, status: body.status },
              actionUrl: '/nurse',
              voiceEnabled: true,
            })
          );
          notificationPromises.push(
            sendPushToUser(emergency.nurseId.toString(), {
              title: 'تحديث حالة الطوارئ',
              body: 'تم تحديث حالة الطوارئ إلى قيد التنفيذ',
              type: 'status_change',
              priority: 'high',
              url: '/nurse',
              userRole: 'nurse',
              data: { emergencyRequestId: id, status: body.status },
            })
          );

        } else if (body.status === 'resolved') {
          notificationPromises.push(
            Notification.create({
              userId: emergency.nurseId,
              userRole: 'nurse',
              titleAr: 'تم حل حالة الطوارئ',
              bodyAr: 'شكراً لاستجابتك السريعة',
              type: 'status_change',
              priority: 'high',
              data: { emergencyRequestId: id, status: body.status },
              actionUrl: '/nurse',
              voiceEnabled: true,
            })
          );
          notificationPromises.push(
            sendPushToUser(emergency.nurseId.toString(), {
              title: 'تم حل حالة الطوارئ',
              body: 'شكراً لاستجابتك السريعة',
              type: 'status_change',
              priority: 'high',
              url: '/nurse',
              userRole: 'nurse',
              data: { emergencyRequestId: id, status: body.status },
            })
          );

        } else if (body.status === 'cancelled') {
          notificationPromises.push(
            Notification.create({
              userId: emergency.nurseId,
              userRole: 'nurse',
              titleAr: 'تم إلغاء حالة الطوارئ',
              bodyAr: 'تم إلغاء طلب الطوارئ',
              type: 'status_change',
              priority: 'high',
              data: { emergencyRequestId: id, status: body.status },
              actionUrl: '/nurse',
              voiceEnabled: true,
            })
          );
          notificationPromises.push(
            sendPushToUser(emergency.nurseId.toString(), {
              title: 'تم إلغاء حالة الطوارئ',
              body: 'تم إلغاء طلب الطوارئ',
              type: 'status_change',
              priority: 'high',
              url: '/nurse',
              userRole: 'nurse',
              data: { emergencyRequestId: id, status: body.status },
            })
          );
        }
      }

      // Fire ALL notifications in PARALLEL for maximum speed
      await Promise.allSettled(notificationPromises);
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

    // ── Emit real-time socket event ──
    try {
      const { emitRealtimeEvent } = await import('@/lib/notifications/emit-realtime-event');
      await emitRealtimeEvent.emergencyStatusChanged({
        emergencyRequestId: id,
        beneficiaryId: (emergency as any).beneficiaryId?.toString(),
        nurseId: (emergency as any).nurseId?.toString(),
        status: body.status,
        type: (emergency as any).type,
      }, { changedBy: user!.userId, changedByRole: user!.role });
    } catch {}

    return Response.json({ success: true, data: serializeDoc(emergency), message: 'تم تحديث طلب الطوارئ بنجاح' });
  } catch (error) {
    console.error('[ADMIN EMERGENCY UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحديث', 500, 'INTERNAL_ERROR');
  }
}
