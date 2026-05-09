// PATCH /api/nurse/emergencies/[id] - Nurse emergency workflow actions
// Actions: accept, arrive, resolve
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { EmergencyRequest, Nurse, Notification, Beneficiary } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { sendPushToUser } from '@/lib/notifications/push-service';
import { creditNurseEarnings } from '@/lib/api/helpers';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const { id } = await params;
    const body = await request.json();
    const { action, outcome, resolvedNotes } = body;

    const emergency = await EmergencyRequest.findById(id);
    if (!emergency) return createErrorResponse('طلب الطوارئ غير موجود', 404, 'NOT_FOUND');

    if (emergency.nurseId?.toString() !== user.userId) {
      return createErrorResponse('هذه الحالة غير معينة لك', 403, 'FORBIDDEN');
    }

    const nurse = await Nurse.findById(user.userId).select('name phone').lean();
    const nurseName = nurse?.name || 'الممرض/ـة';

    const beneficiary = await Beneficiary.findById(emergency.beneficiaryId).select('name phone').lean();

    // ── ACTION: ACCEPT ── dispatched → accepted
    if (action === 'accept') {
      if (emergency.status !== 'dispatched') {
        return createErrorResponse('لا يمكن قبول هذه الحالة في حالتها الحالية', 400, 'INVALID_STATUS');
      }

      emergency.status = 'accepted';
      await emergency.save();

      // ═══ INSTANT NOTIFICATIONS: Fire all in parallel for zero delay ═══
      const notifPromises: Promise<any>[] = [];

      // 1. Notify beneficiary URGENTLY
      notifPromises.push(
        Notification.create({
          userId: emergency.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: 'الممرض في الطريق',
          bodyAr: `قبل ${nurseName} حالة الطوارئ الخاصة بك وسيصل إليك قريباً`,
          type: 'emergency_accepted',
          priority: 'urgent',
          data: { emergencyRequestId: id, status: 'accepted', nurseName },
          actionUrl: '/beneficiary/emergency',
          voiceEnabled: true,
        }),
        sendPushToUser(emergency.beneficiaryId.toString(), {
          title: 'الممرض في الطريق',
          body: `قبل ${nurseName} حالة الطوارئ الخاصة بك وسيصل إليك قريباً`,
          type: 'emergency_accepted',
          priority: 'urgent',
          sound: true,
          url: '/beneficiary/emergency',
          userRole: 'beneficiary',
          data: { emergencyRequestId: id, status: 'accepted', voiceAlert: true, voiceText: `قبل ${nurseName} حالة الطوارئ الخاصة بك وسيصل إليك قريباً` },
        })
      );

      // 2. Notify admins in parallel
      try {
        const { User } = await import('@/models/mongoose');
        const admins = await User.find({ role: 'admin' }).select('_id').lean();
        for (const admin of admins) {
          notifPromises.push(
            Notification.create({
              userId: admin._id,
              userRole: 'admin',
              titleAr: 'قبول الممرض لحالة الطوارئ',
              bodyAr: `قبل ${nurseName} حالة الطوارئ #${id.slice(-6)} وسيصل للموقع قريباً`,
              type: 'status_change',
              priority: 'high',
              data: { emergencyRequestId: id, status: 'accepted', nurseId: user.userId },
              actionUrl: '/admin/emergencies',
              read: false,
            }),
            sendPushToUser(admin._id.toString(), {
              title: 'قبول الممرض لحالة الطوارئ',
              body: `قبل ${nurseName} حالة الطوارئ #${id.slice(-6)}`,
              type: 'status_change',
              priority: 'high',
              url: '/admin/emergencies',
              userRole: 'admin',
              data: { emergencyRequestId: id, status: 'accepted', voiceAlert: true, voiceText: `قبل ${nurseName} حالة الطوارئ وسيصل للموقع قريباً` },
            })
          );
        }
      } catch {
        // Non-critical
      }

      // Fire ALL notifications simultaneously
      await Promise.allSettled(notifPromises);

      return Response.json({
        success: true,
        data: { ...emergency.toObject(), id: emergency._id.toString() },
        message: 'تم قبول حالة الطوارئ',
      });
    }

    // ── ACTION: ARRIVE (start) ── accepted → in_progress
    if (action === 'arrive') {
      if (emergency.status !== 'accepted' && emergency.status !== 'dispatched') {
        return createErrorResponse('لا يمكن بدء التعامل مع هذه الحالة في حالتها الحالية', 400, 'INVALID_STATUS');
      }

      emergency.status = 'in_progress';
      emergency.arrivedAt = new Date();

      // Calculate response time from dispatched to arrived
      if (emergency.dispatchedAt) {
        emergency.responseTime = Math.round((Date.now() - new Date(emergency.dispatchedAt).getTime()) / 1000);
      }

      await emergency.save();

      // ═══ INSTANT NOTIFICATIONS: Fire all in parallel ═══
      const notifPromises: Promise<any>[] = [];

      // 1. Notify beneficiary URGENTLY
      notifPromises.push(
        Notification.create({
          userId: emergency.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: 'الممرض وصل للموقع',
          bodyAr: `وصل ${nurseName} إلى موقعك وبدأ التعامل مع حالة الطوارئ`,
          type: 'status_change',
          priority: 'urgent',
          data: { emergencyRequestId: id, status: 'in_progress' },
          actionUrl: '/beneficiary/emergency',
          voiceEnabled: true,
        }),
        sendPushToUser(emergency.beneficiaryId.toString(), {
          title: 'الممرض وصل للموقع',
          body: `وصل ${nurseName} وبدأ التعامل مع حالة الطوارئ`,
          type: 'service_started',
          priority: 'urgent',
          sound: true,
          url: '/beneficiary/emergency',
          userRole: 'beneficiary',
          data: { emergencyRequestId: id, status: 'in_progress', voiceAlert: true, voiceText: `وصل ${nurseName} إلى موقعك وبدأ التعامل مع حالة الطوارئ` },
        })
      );

      // 2. Notify admins in parallel
      try {
        const { User } = await import('@/models/mongoose');
        const admins = await User.find({ role: 'admin' }).select('_id').lean();
        for (const admin of admins) {
          notifPromises.push(
            Notification.create({
              userId: admin._id,
              userRole: 'admin',
              titleAr: 'بدأ التعامل مع حالة الطوارئ',
              bodyAr: `وصل ${nurseName} للموقع وبدأ التعامل مع حالة الطوارئ #${id.slice(-6)}`,
              type: 'status_change',
              priority: 'high',
              data: { emergencyRequestId: id, status: 'in_progress' },
              actionUrl: '/admin/emergencies',
              read: false,
            }),
            sendPushToUser(admin._id.toString(), {
              title: 'بدأ التعامل مع حالة الطوارئ',
              body: `وصل ${nurseName} للموقع وبدأ التعامل مع الحالة #${id.slice(-6)}`,
              type: 'service_started',
              priority: 'high',
              url: '/admin/emergencies',
              userRole: 'admin',
              data: { emergencyRequestId: id, status: 'in_progress', voiceAlert: true, voiceText: `وصل ${nurseName} للموقع وبدأ التعامل مع حالة الطوارئ` },
            })
          );
        }
      } catch {
        // Non-critical
      }

      // Fire ALL notifications simultaneously
      await Promise.allSettled(notifPromises);

      return Response.json({
        success: true,
        data: { ...emergency.toObject(), id: emergency._id.toString() },
        message: 'تم تسجيل الوصول وبدء التعامل مع حالة الطوارئ',
      });
    }

    // ── ACTION: RESOLVE (complete) ── in_progress → resolved
    if (action === 'resolve') {
      if (emergency.status !== 'in_progress') {
        return createErrorResponse('لا يمكن إنهاء هذه الحالة في حالتها الحالية', 400, 'INVALID_STATUS');
      }

      if (!outcome) {
        return createErrorResponse('يجب تحديد نتيجة الحالة', 400, 'VALIDATION_ERROR');
      }

      const validOutcomes = ['treated_on_site', 'transferred_to_hospital', 'refused_treatment', 'other'];
      if (!validOutcomes.includes(outcome)) {
        return createErrorResponse('نتيجة الحالة غير صالحة', 400, 'VALIDATION_ERROR');
      }

      emergency.status = 'resolved';
      emergency.resolvedAt = new Date();
      emergency.outcome = outcome;
      emergency.resolvedNotes = resolvedNotes || '';

      // Update response time if not already set
      if (!emergency.responseTime && emergency.dispatchedAt) {
        emergency.responseTime = Math.round((Date.now() - new Date(emergency.dispatchedAt).getTime()) / 1000);
      }

      await emergency.save();

      // Credit nurse earnings for emergency
      const emergencyPayout = Math.round((emergency.emergencyFee || 5000) * 0.7); // 70% to nurse
      try {
        await creditNurseEarnings({
          requestId: emergency._id.toString(),
          nurseId: emergency.nurseId!.toString(),
          beneficiaryId: emergency.beneficiaryId.toString(),
          amount: emergency.emergencyFee || 5000,
          commission: (emergency.emergencyFee || 5000) - emergencyPayout,
          nursePayout: emergencyPayout,
          paymentMethod: emergency.paymentMethod || 'cash',
        });
      } catch {
        // Non-critical - earnings credit
      }

      const outcomeLabels: Record<string, string> = {
        treated_on_site: 'تم العلاج في الموقع',
        transferred_to_hospital: 'تم النقل للمستشفى',
        refused_treatment: 'رفض المريض العلاج',
        other: 'أخرى',
      };

      // Notify beneficiary
      try {
        await Notification.create({
          userId: emergency.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: 'تم حل حالة الطوارئ',
          bodyAr: `تم التعامل مع حالة الطوارئ بنجاح. النتيجة: ${outcomeLabels[outcome] || outcome}${resolvedNotes ? `. ملاحظات: ${resolvedNotes}` : ''}`,
          type: 'service_completed',
          priority: 'high',
          data: { emergencyRequestId: id, status: 'resolved', outcome },
          actionUrl: '/beneficiary/emergency',
          voiceEnabled: true,
        });

        sendPushToUser(emergency.beneficiaryId.toString(), {
          title: 'تم حل حالة الطوارئ',
          body: `تم التعامل مع حالة الطوارئ بنجاح. ${outcomeLabels[outcome] || ''}`,
          type: 'service_completed',
          priority: 'high',
          url: '/beneficiary/emergency',
          userRole: 'beneficiary',
          data: { emergencyRequestId: id, status: 'resolved', outcome, voiceAlert: true, voiceText: `تم التعامل مع حالة الطوارئ بنجاح. ${outcomeLabels[outcome] || ''}` },
        }).catch(() => {});

        // Notify nurse about earnings
        await Notification.create({
          userId: user.userId,
          userRole: 'nurse',
          titleAr: 'تم إكمال حالة الطوارئ وإضافة أرباحك',
          bodyAr: `تم إضافة ${emergencyPayout} ر.ي إلى رصيدك مقابل حالة الطوارئ`,
          type: 'payment',
          priority: 'medium',
          data: { emergencyRequestId: id, status: 'resolved', earnings: emergencyPayout },
          actionUrl: '/nurse/earnings',
          voiceEnabled: true,
        });

        sendPushToUser(user.userId, {
          title: 'تم إكمال حالة الطوارئ وإضافة أرباحك',
          body: `تم إضافة ${emergencyPayout} ر.ي إلى رصيدك`,
          type: 'payment',
          priority: 'medium',
          url: '/nurse/earnings',
          userRole: 'nurse',
          data: { emergencyRequestId: id, earnings: emergencyPayout, voiceAlert: true, voiceText: `تم إكمال حالة الطوارئ وإضافة ${emergencyPayout} ريال إلى رصيدك` },
        }).catch(() => {});

        // Notify admins
        const { User } = await import('@/models/mongoose');
        const admins = await User.find({ role: 'admin' }).select('_id').lean();
        for (const admin of admins) {
          await Notification.create({
            userId: admin._id,
            userRole: 'admin',
            titleAr: 'تم حل حالة الطوارئ',
            bodyAr: `أكمل ${nurseName} حالة الطوارئ #${id.slice(-6)}. النتيجة: ${outcomeLabels[outcome] || outcome}${resolvedNotes ? `. ملاحظات: ${resolvedNotes}` : ''}`,
            type: 'status_change',
            priority: 'medium',
            data: { emergencyRequestId: id, status: 'resolved', outcome, nurseId: user.userId },
            actionUrl: '/admin/emergencies',
            read: false,
          });

          sendPushToUser(admin._id.toString(), {
            title: 'تم حل حالة الطوارئ',
            body: `أكمل ${nurseName} حالة الطوارئ #${id.slice(-6)}. ${outcomeLabels[outcome] || ''}`,
            type: 'service_completed',
            priority: 'medium',
            url: '/admin/emergencies',
            userRole: 'admin',
            data: { emergencyRequestId: id, status: 'resolved', outcome, voiceAlert: true, voiceText: `أكمل ${nurseName} حالة الطوارئ بنجاح` },
          }).catch(() => {});
        }
      } catch {
        // Non-critical
      }

      return Response.json({
        success: true,
        data: { ...emergency.toObject(), id: emergency._id.toString() },
        message: 'تم إنهاء حالة الطوارئ بنجاح',
      });
    }

    // ── ACTION: REJECT ── dispatched → pending (release assignment)
    if (action === 'reject') {
      if (emergency.status !== 'dispatched') {
        return createErrorResponse('لا يمكن رفض هذه الحالة في حالتها الحالية', 400, 'INVALID_STATUS');
      }

      emergency.status = 'pending';
      emergency.nurseId = undefined;
      await emergency.save();

      // Notify beneficiary
      try {
        await Notification.create({
          userId: emergency.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: 'جاري البحث عن ممرض بديل',
          bodyAr: 'الممرض المعين لم يتمكن من الاستجابة لحالة الطوارئ. جاري البحث عن ممرض بديل',
          type: 'status_change',
          priority: 'high',
          data: { emergencyRequestId: id, status: 'pending' },
          actionUrl: '/beneficiary/emergency',
          voiceEnabled: true,
        });

        sendPushToUser(emergency.beneficiaryId.toString(), {
          title: 'جاري البحث عن ممرض بديل',
          body: 'الممرض المعين لم يتمكن من الاستجابة. جاري البحث عن بديل',
          type: 'status_change',
          priority: 'high',
          url: '/beneficiary/emergency',
          userRole: 'beneficiary',
          data: { emergencyRequestId: id, status: 'pending', voiceAlert: true, voiceText: 'الممرض المعين لم يتمكن من الاستجابة. جاري البحث عن ممرض بديل' },
        }).catch(() => {});

        // Notify admins - high priority to reassign
        const { User } = await import('@/models/mongoose');
        const admins = await User.find({ role: 'admin' }).select('_id').lean();
        for (const admin of admins) {
          await Notification.create({
            userId: admin._id,
            userRole: 'admin',
            titleAr: 'رفض ممرض حالة طوارئ',
            bodyAr: `رفض الممرض ${nurseName} حالة الطوارئ #${id.slice(-6)} - يرجى تعيين ممرض بديل`,
            type: 'status_change',
            priority: 'high',
            data: { emergencyRequestId: id, status: 'rejected', nurseId: user.userId },
            actionUrl: '/admin/emergencies',
            voiceEnabled: true,
            read: false,
          });

          sendPushToUser(admin._id.toString(), {
            title: 'رفض ممرض حالة طوارئ',
            body: `رفض ${nurseName} حالة الطوارئ #${id.slice(-6)} - يرجى تعيين بديل`,
            type: 'service_cancelled',
            priority: 'high',
            url: '/admin/emergencies',
            userRole: 'admin',
            data: { emergencyRequestId: id, status: 'rejected', voiceAlert: true, voiceText: `رفض الممرض ${nurseName} حالة الطوارئ. يرجى تعيين ممرض بديل` },
          }).catch(() => {});
        }
      } catch {
        // Non-critical
      }

      return Response.json({
        success: true,
        data: { ...emergency.toObject(), id: emergency._id.toString() },
        message: 'تم رفض حالة الطوارئ',
      });
    }

    return createErrorResponse('إجراء غير معروف. استخدم: accept, arrive, resolve, reject', 400, 'INVALID_ACTION');
  } catch (error) {
    console.error('[NURSE EMERGENCY ACTION ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}
