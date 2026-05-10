// ============================================================================
// PATCH /api/deployments/[id]/select-applicant - Creator selects best applicant
// NEW FLOW: Creator selects → app status = selected_by_creator, deployment status = creator_selected
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// ============================================================================

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Deployment, Notification, Nurse, User } from '@/models/mongoose';
import { requireAuth, requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { sendPushToUser } from '@/lib/notifications/push-service';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const { applicationId } = body;

    // ── Validate ──
    if (!applicationId) {
      return createErrorResponse('معرف التقديم مطلوب', 400, 'VALIDATION_ERROR');
    }

    // ── Find deployment ──
    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return createErrorResponse('التكليف غير موجود', 404, 'NOT_FOUND');
    }

    // ── Validate deployment status ──
    if (deployment.status !== 'open') {
      return createErrorResponse('هذا التكليف غير متاح للاختيار. حالته: ' + deployment.status, 400, 'DEPLOYMENT_NOT_OPEN');
    }

    // ── Authorization: only creator or admin can select applicant ──
    const isAdminOrSubadmin = ['admin', 'subadmin'].includes(user.role);
    const isCreator = deployment.createdBy.toString() === user.userId;

    if (!isAdminOrSubadmin && !isCreator) {
      return createErrorResponse('ليس لديك صلاحية لاختيار متقدم على هذا التكليف', 403, 'FORBIDDEN');
    }

    // ── Find the selected application ──
    const applicationIndex = deployment.applications.findIndex(
      (app: any) => app._id.toString() === applicationId
    );

    if (applicationIndex === -1) {
      return createErrorResponse('التقديم غير موجود', 404, 'APPLICATION_NOT_FOUND');
    }

    const application = deployment.applications[applicationIndex] as any;

    // ── Validate application status ──
    if (application.status !== 'pending') {
      return createErrorResponse(
        'لا يمكن اختيار هذا التقديم. حالته: ' + application.status,
        400,
        'INVALID_APPLICATION_STATUS'
      );
    }

    // ── Set selected application to selected_by_creator ──
    application.status = 'selected_by_creator';

    // ── Reject all other applications ──
    for (let i = 0; i < deployment.applications.length; i++) {
      if (i !== applicationIndex) {
        const otherApp = deployment.applications[i] as any;
        if (otherApp.status === 'pending') {
          otherApp.status = 'rejected';
          otherApp.rejectedReason = 'تم اختيار متقدم آخر على هذا التكليف';
        }
      }
    }

    // ── Set deployment status to creator_selected ──
    deployment.status = 'creator_selected';

    await deployment.save();

    // ═══ NOTIFY: Notify admins and selected applicant with voice notifications ═══
    const notificationPromises: Promise<any>[] = [];

    try {
      // ── Get creator name for admin notification ──
      const creatorNurse = await Nurse.findById(deployment.createdBy).select('name').lean();
      const creatorName = creatorNurse?.name || 'المستخدم';

      // ── Notify admins with voice notification ──
      const adminVoiceText = `الممرض ${creatorName} اختار ${application.applicantName} للتكليف ${deployment.title}. يرجى الموافقة`;
      const admins = await User.find({ role: { $in: ['admin', 'subadmin'] } }).select('_id role').lean();
      for (const admin of admins) {
        const adminRole = (admin as any).role || 'admin';
        notificationPromises.push(
          Notification.create({
            userId: admin._id,
            userRole: adminRole,
            titleAr: '📋 اختيار متقدم للتكليف',
            bodyAr: `اختار ${creatorName} المتقدم ${application.applicantName} للتكليف "${deployment.title}". يرجى الموافقة`,
            type: 'deployment',
            priority: 'high',
            data: {
              deploymentId: id,
              applicationId,
              applicantId: application.applicantId.toString(),
              applicantName: application.applicantName,
              creatorName,
              status: 'creator_selected',
              voiceAlert: true,
              voiceText: adminVoiceText,
            },
            actionUrl: '/admin/deployments',
            voiceEnabled: true,
          }),
          sendPushToUser(admin._id.toString(), {
            title: '📋 اختيار متقدم للتكليف',
            body: `اختار ${creatorName} المتقدم ${application.applicantName} للتكليف "${deployment.title}"`,
            type: 'deployment',
            priority: 'high',
            url: '/admin/deployments',
            userRole: adminRole,
            sound: true,
            data: {
              deploymentId: id,
              applicationId,
              applicantId: application.applicantId.toString(),
              status: 'creator_selected',
              voiceAlert: true,
              voiceText: adminVoiceText,
            },
          })
        );
      }

      // ── Notify selected applicant with voice notification ──
      const applicantVoiceText = `تم اختيارك للتكليف ${deployment.title}. بانتظار موافقة الإدارة`;
      notificationPromises.push(
        Notification.create({
          userId: application.applicantId,
          userRole: application.applicantRole === 'lab_tech' ? 'nurse' : application.applicantRole,
          titleAr: '🎯 تم اختيارك للتكليف!',
          bodyAr: `تم اختيارك للتكليف "${deployment.title}". بانتظار موافقة الإدارة`,
          type: 'deployment',
          priority: 'high',
          data: {
            deploymentId: id,
            applicationId,
            status: 'selected_by_creator',
            voiceAlert: true,
            voiceText: applicantVoiceText,
          },
          actionUrl: '/nurse/deployments',
          voiceEnabled: true,
        }),
        sendPushToUser(application.applicantId.toString(), {
          title: '🎯 تم اختيارك للتكليف!',
          body: `تم اختيارك للتكليف "${deployment.title}". بانتظار موافقة الإدارة`,
          type: 'deployment',
          priority: 'high',
          url: '/nurse/deployments',
          userRole: application.applicantRole === 'lab_tech' ? 'nurse' : application.applicantRole,
          sound: true,
          data: {
            deploymentId: id,
            applicationId,
            status: 'selected_by_creator',
            voiceAlert: true,
            voiceText: applicantVoiceText,
          },
        })
      );

      // ── Notify rejected applicants ──
      for (let i = 0; i < deployment.applications.length; i++) {
        if (i === applicationIndex) continue;

        const otherApp = deployment.applications[i] as any;
        if (otherApp.status === 'rejected' && otherApp.rejectedReason === 'تم اختيار متقدم آخر على هذا التكليف') {
          const rejectedVoiceText = `لم يتم اختيارك على التكليف: ${deployment.title}`;
          notificationPromises.push(
            Notification.create({
              userId: otherApp.applicantId,
              userRole: otherApp.applicantRole === 'lab_tech' ? 'nurse' : otherApp.applicantRole,
              titleAr: 'رد التقديم على التكليف',
              bodyAr: `لم يتم اختيار تقديمك على التكليف "${deployment.title}". تم اختيار متقدم آخر`,
              type: 'deployment',
              priority: 'medium',
              data: {
                deploymentId: id,
                status: 'rejected',
                voiceAlert: false,
                voiceText: rejectedVoiceText,
              },
              actionUrl: '/nurse/deployments',
              voiceEnabled: false,
            }),
            sendPushToUser(otherApp.applicantId.toString(), {
              title: 'رد التقديم على التكليف',
              body: `لم يتم اختيار تقديمك على التكليف "${deployment.title}"`,
              type: 'deployment',
              priority: 'medium',
              url: '/nurse/deployments',
              userRole: otherApp.applicantRole === 'lab_tech' ? 'nurse' : otherApp.applicantRole,
              data: {
                deploymentId: id,
                status: 'rejected',
              },
            })
          );
        }
      }
    } catch {
      // Non-critical
    }

    // Fire ALL notifications in parallel
    await Promise.allSettled(notificationPromises);

    return Response.json({
      success: true,
      data: {
        deploymentId: id,
        applicationId,
        selectedApplicantId: application.applicantId.toString(),
        selectedApplicantName: application.applicantName,
        applicationStatus: 'selected_by_creator',
        deploymentStatus: 'creator_selected',
      },
      message: `تم اختيار ${application.applicantName} للتكليف. بانتظار موافقة الإدارة`,
    });
  } catch (error) {
    console.error('[DEPLOYMENT SELECT APPLICANT ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء اختيار المتقدم', 500, 'INTERNAL_ERROR');
  }
}
