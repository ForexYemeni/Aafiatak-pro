// ============================================================================
// PATCH /api/deployments/[id]/admin-approve - Admin approves creator's selection
// NEW FLOW: Admin approves → app status = admin_approved → payment_pending, deployment status = admin_approved
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// ============================================================================

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Deployment, Notification, User } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { sendPushToUser } from '@/lib/notifications/push-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { id } = await params;

    // ── Find deployment ──
    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return createErrorResponse('التكليف غير موجود', 404, 'NOT_FOUND');
    }

    // ── Validate deployment status ──
    if (deployment.status !== 'creator_selected') {
      return createErrorResponse(
        'هذا التكليف غير متاح للموافقة. حالته: ' + deployment.status,
        400,
        'INVALID_DEPLOYMENT_STATUS'
      );
    }

    // ── Find the selected_by_creator application ──
    const applicationIndex = deployment.applications.findIndex(
      (app: any) => app.status === 'selected_by_creator'
    );

    if (applicationIndex === -1) {
      return createErrorResponse('لم يتم العثور على تقديم محدد من المنشئ', 404, 'APPLICATION_NOT_FOUND');
    }

    const application = deployment.applications[applicationIndex] as any;

    // ── Check fee responsibility ──
    const feeResponsible = deployment.feeResponsible || 'applicant';

    if (feeResponsible === 'creator') {
      // When creator is responsible for fees, skip payment step for applicant
      // Go directly to accepted/assigned
      application.status = 'accepted';
      deployment.status = 'assigned';
      deployment.assignedTo = application.applicantId;
      deployment.assignedAt = new Date();
      deployment.contactRevealed = true;
    } else {
      // When applicant is responsible for fees, they need to pay
      application.status = 'payment_pending';
      deployment.status = 'admin_approved';
    }

    await deployment.save();

    // ═══ NOTIFY: Notify selected applicant and creator with voice notifications ═══
    const notificationPromises: Promise<any>[] = [];

    try {
      if (feeResponsible === 'creator') {
        // ── Notify applicant: accepted directly (no payment needed) ──
        const applicantVoiceText = `تم قبولك على التكليف ${deployment.title}. يمكنك الآن التواصل مع صاحب التكليف`;
        notificationPromises.push(
          Notification.create({
            userId: application.applicantId,
            userRole: application.applicantRole === 'lab_tech' ? 'nurse' : application.applicantRole,
            titleAr: '✅ تم قبولك على التكليف',
            bodyAr: `تم قبولك على التكليف "${deployment.title}". يمكنك الآن التواصل مع صاحب التكليف`,
            type: 'deployment',
            priority: 'urgent',
            data: {
              deploymentId: id,
              applicationId: application._id.toString(),
              status: 'accepted',
              voiceAlert: true,
              voiceText: applicantVoiceText,
            },
            actionUrl: '/nurse/deployments',
            voiceEnabled: true,
          }),
          sendPushToUser(application.applicantId.toString(), {
            title: '✅ تم قبولك على التكليف',
            body: `تم قبولك على التكليف "${deployment.title}". يمكنك الآن التواصل مع صاحب التكليف`,
            type: 'deployment',
            priority: 'urgent',
            url: '/nurse/deployments',
            userRole: application.applicantRole === 'lab_tech' ? 'nurse' : application.applicantRole,
            sound: true,
            data: {
              deploymentId: id,
              applicationId: application._id.toString(),
              status: 'accepted',
              voiceAlert: true,
              voiceText: applicantVoiceText,
            },
          })
        );

        // ── Notify creator ──
        const creatorVoiceText = `تم تعيين مكلف على التكليف ${deployment.title}`;
        notificationPromises.push(
          Notification.create({
            userId: deployment.createdBy,
            userRole: deployment.creatorRole === 'admin' ? 'admin' : 'nurse',
            titleAr: '✅ تم تعيين مكلف',
            bodyAr: `تم تعيين ${application.applicantName} على التكليف "${deployment.title}"`,
            type: 'deployment',
            priority: 'high',
            data: {
              deploymentId: id,
              applicationId: application._id.toString(),
              applicantName: application.applicantName,
              status: 'assigned',
              voiceAlert: true,
              voiceText: creatorVoiceText,
            },
            actionUrl: deployment.creatorRole === 'admin' ? '/admin/deployments' : '/nurse/deployments',
            voiceEnabled: true,
          }),
          sendPushToUser(deployment.createdBy.toString(), {
            title: '✅ تم تعيين مكلف',
            body: `تم تعيين ${application.applicantName} على التكليف "${deployment.title}"`,
            type: 'deployment',
            priority: 'high',
            url: deployment.creatorRole === 'admin' ? '/admin/deployments' : '/nurse/deployments',
            userRole: deployment.creatorRole === 'admin' ? 'admin' : 'nurse',
            sound: true,
            data: {
              deploymentId: id,
              applicationId: application._id.toString(),
              status: 'assigned',
              voiceAlert: true,
              voiceText: creatorVoiceText,
            },
          })
        );
      } else {
        // ── Original flow: applicant needs to pay ──
        const fee = application.serviceFee || deployment.serviceFee || 0;

        // ── Notify selected applicant with voice notification ──
        const applicantVoiceText = `تمت الموافقة على التكليف ${deployment.title}. يرجى دفع رسوم التقديم بمبلغ ${fee} ريال`;
        notificationPromises.push(
          Notification.create({
            userId: application.applicantId,
            userRole: application.applicantRole === 'lab_tech' ? 'nurse' : application.applicantRole,
            titleAr: '✅ تمت الموافقة الإدارية على التكليف',
            bodyAr: `تمت الموافقة على اختيارك للتكليف "${deployment.title}". يرجى دفع رسوم التقديم بمبلغ ${fee} ريال`,
            type: 'deployment',
            priority: 'urgent',
            data: {
              deploymentId: id,
              applicationId: application._id.toString(),
              status: 'payment_pending',
              fee,
              voiceAlert: true,
              voiceText: applicantVoiceText,
            },
            actionUrl: '/nurse/deployments',
            voiceEnabled: true,
          }),
          sendPushToUser(application.applicantId.toString(), {
            title: '✅ تمت الموافقة الإدارية على التكليف',
            body: `تمت الموافقة على اختيارك للتكليف "${deployment.title}". يرجى دفع رسوم التقديم`,
            type: 'deployment',
            priority: 'urgent',
            url: '/nurse/deployments',
            userRole: application.applicantRole === 'lab_tech' ? 'nurse' : application.applicantRole,
            sound: true,
            data: {
              deploymentId: id,
              applicationId: application._id.toString(),
              status: 'payment_pending',
              fee,
              voiceAlert: true,
              voiceText: applicantVoiceText,
            },
          })
        );

        // ── Notify creator with voice notification ──
        const creatorVoiceText = `تمت الموافقة الإدارية على التكليف ${deployment.title}. بانتظار دفع المكلف`;
        notificationPromises.push(
          Notification.create({
            userId: deployment.createdBy,
            userRole: deployment.creatorRole === 'admin' ? 'admin' : 'nurse',
            titleAr: '✅ تمت الموافقة الإدارية',
            bodyAr: `تمت الموافقة الإدارية على التكليف "${deployment.title}". بانتظار دفع المكلف الرسوم`,
            type: 'deployment',
            priority: 'high',
            data: {
              deploymentId: id,
              applicationId: application._id.toString(),
              applicantName: application.applicantName,
              status: 'admin_approved',
              voiceAlert: true,
              voiceText: creatorVoiceText,
            },
            actionUrl: deployment.creatorRole === 'admin' ? '/admin/deployments' : '/nurse/deployments',
            voiceEnabled: true,
          }),
          sendPushToUser(deployment.createdBy.toString(), {
            title: '✅ تمت الموافقة الإدارية',
            body: `تمت الموافقة الإدارية على التكليف "${deployment.title}". بانتظار دفع المكلف الرسوم`,
            type: 'deployment',
            priority: 'high',
            url: deployment.creatorRole === 'admin' ? '/admin/deployments' : '/nurse/deployments',
            userRole: deployment.creatorRole === 'admin' ? 'admin' : 'nurse',
            sound: true,
            data: {
              deploymentId: id,
              applicationId: application._id.toString(),
              status: 'admin_approved',
              voiceAlert: true,
              voiceText: creatorVoiceText,
            },
          })
        );
      } // end else (applicant pays)
    } catch {
      // Non-critical
    }

    // Fire ALL notifications in parallel
    await Promise.allSettled(notificationPromises);

    // ── Emit real-time socket event ──
    try {
      const { emitRealtimeEvent } = await import('@/lib/notifications/emit-realtime-event');
      await emitRealtimeEvent.applicationChanged({
        deploymentId: id,
        applicationId: application._id.toString(),
        applicantId: application.applicantId.toString(),
        status: 'admin_approved',
      }, { changedBy: user!.userId, changedByRole: user!.role });
    } catch {}

    return Response.json({
      success: true,
      data: {
        deploymentId: id,
        applicationId: application._id.toString(),
        applicationStatus: feeResponsible === 'creator' ? 'accepted' : 'payment_pending',
        deploymentStatus: feeResponsible === 'creator' ? 'assigned' : 'admin_approved',
      },
      message: feeResponsible === 'creator'
        ? 'تمت الموافقة الإدارية وتم تعيين المكلف مباشرة (الرسوم على صاحب التكليف)'
        : 'تمت الموافقة الإدارية على التكليف. بانتظار دفع المكلف الرسوم',
    });
  } catch (error) {
    console.error('[DEPLOYMENT ADMIN APPROVE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء الموافقة على التكليف', 500, 'INTERNAL_ERROR');
  }
}
