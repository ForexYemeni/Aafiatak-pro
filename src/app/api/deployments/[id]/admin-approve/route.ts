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

    // ── Update application status: admin_approved → payment_pending ──
    application.status = 'payment_pending';

    // ── Update deployment status ──
    deployment.status = 'admin_approved';

    await deployment.save();

    // ═══ NOTIFY: Notify selected applicant and creator with voice notifications ═══
    const notificationPromises: Promise<any>[] = [];

    try {
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
    } catch {
      // Non-critical
    }

    // Fire ALL notifications in parallel
    await Promise.allSettled(notificationPromises);

    return Response.json({
      success: true,
      data: {
        deploymentId: id,
        applicationId: application._id.toString(),
        applicationStatus: 'payment_pending',
        deploymentStatus: 'admin_approved',
      },
      message: 'تمت الموافقة الإدارية على التكليف. بانتظار دفع المكلف الرسوم',
    });
  } catch (error) {
    console.error('[DEPLOYMENT ADMIN APPROVE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء الموافقة على التكليف', 500, 'INTERNAL_ERROR');
  }
}
