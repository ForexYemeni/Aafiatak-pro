// ============================================================================
// PATCH /api/deployments/[id]/accept - Accept an application for a deployment
// LEGACY ROUTE: Now only works if application status is payment_verified
// In the new flow, this is mostly superseded by verify-payment (which auto-assigns)
// Kept for backwards compatibility
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// ============================================================================

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Deployment, Notification, User } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
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

    // ── Authorization: only creator or admin can accept ──
    const isAdminOrSubadmin = ['admin', 'subadmin'].includes(user.role);
    const isCreator = deployment.createdBy.toString() === user.userId;

    if (!isAdminOrSubadmin && !isCreator) {
      return createErrorResponse('ليس لديك صلاحية لقبول التقديم على هذا التكليف', 403, 'FORBIDDEN');
    }

    // ── Find the application to accept ──
    const applicationIndex = deployment.applications.findIndex(
      (app: any) => app._id.toString() === applicationId
    );

    if (applicationIndex === -1) {
      return createErrorResponse('التقديم غير موجود', 404, 'APPLICATION_NOT_FOUND');
    }

    const application = deployment.applications[applicationIndex] as any;

    // ── In the new flow, this route only works if application is payment_verified ──
    if (application.status !== 'payment_verified') {
      return createErrorResponse(
        'لا يمكن قبول هذا التقديم. يجب التحقق من الدفع أولاً. حالة التقديم: ' + application.status,
        400,
        'INVALID_APPLICATION_STATUS'
      );
    }

    // ── Accept the selected application ──
    application.status = 'accepted';

    // ── Set deployment assignment ──
    deployment.assignedTo = application.applicantId;
    deployment.assignedAt = new Date();
    deployment.status = 'assigned';
    deployment.contactRevealed = true;

    // ── Reject all other applications ──
    for (let i = 0; i < deployment.applications.length; i++) {
      if (i !== applicationIndex) {
        const otherApp = deployment.applications[i] as any;
        if (otherApp.status !== 'rejected') {
          otherApp.status = 'rejected';
          otherApp.rejectedReason = 'تم قبول متقدم آخر على هذا التكليف';
        }
      }
    }

    await deployment.save();

    // ═══ NOTIFY: Acceptance and rejection notifications ═══
    const notificationPromises: Promise<any>[] = [];

    try {
      // ── Notify accepted applicant with voice notification ──
      const acceptedVoiceText = `مبروك! تم قبولك على التكليف: ${deployment.title}`;
      notificationPromises.push(
        Notification.create({
          userId: application.applicantId,
          userRole: application.applicantRole === 'lab_tech' ? 'nurse' : application.applicantRole,
          titleAr: '🎉 تم قبولك على التكليف!',
          bodyAr: `تم قبول تقديمك على التكليف "${deployment.title}". يمكنك الآن التواصل مع صاحب التكليف`,
          type: 'deployment',
          priority: 'urgent',
          data: {
            deploymentId: id,
            applicationId,
            status: 'accepted',
            contactRevealed: true,
            voiceAlert: true,
            voiceText: acceptedVoiceText,
          },
          actionUrl: '/nurse/my-requests',
          voiceEnabled: true,
        }),
        sendPushToUser(application.applicantId.toString(), {
          title: '🎉 تم قبولك على التكليف!',
          body: `تم قبول تقديمك على التكليف "${deployment.title}"`,
          type: 'deployment',
          priority: 'urgent',
          url: '/nurse/my-requests',
          userRole: application.applicantRole === 'lab_tech' ? 'nurse' : application.applicantRole,
          sound: true,
          data: {
            deploymentId: id,
            applicationId,
            status: 'accepted',
            contactRevealed: true,
            voiceAlert: true,
            voiceText: acceptedVoiceText,
          },
        })
      );

      // ── Notify rejected applicants ──
      for (let i = 0; i < deployment.applications.length; i++) {
        if (i === applicationIndex) continue;

        const otherApp = deployment.applications[i] as any;
        if (otherApp.status === 'rejected' && otherApp.applicantId.toString() !== application.applicantId.toString()) {
          const rejectedVoiceText = `لم يتم قبولك على التكليف: ${deployment.title}`;
          notificationPromises.push(
            Notification.create({
              userId: otherApp.applicantId,
              userRole: otherApp.applicantRole === 'lab_tech' ? 'nurse' : otherApp.applicantRole,
              titleAr: 'رد التقديم على التكليف',
              bodyAr: `لم يتم قبول تقديمك على التكليف "${deployment.title}". تم اختيار متقدم آخر`,
              type: 'deployment',
              priority: 'medium',
              data: {
                deploymentId: id,
                status: 'rejected',
                voiceAlert: false,
                voiceText: rejectedVoiceText,
              },
              actionUrl: '/nurse/my-requests',
              voiceEnabled: false,
            }),
            sendPushToUser(otherApp.applicantId.toString(), {
              title: 'رد التقديم على التكليف',
              body: `لم يتم قبول تقديمك على التكليف "${deployment.title}"`,
              type: 'deployment',
              priority: 'medium',
              url: '/nurse/my-requests',
              userRole: otherApp.applicantRole === 'lab_tech' ? 'nurse' : otherApp.applicantRole,
              data: {
                deploymentId: id,
                status: 'rejected',
              },
            })
          );
        }
      }

      // ── Notify admins about the assignment ──
      const admins = await User.find({ role: 'admin' }).select('_id').lean();
      for (const admin of admins) {
        // Skip if the admin is the one who performed the action
        if (admin._id.toString() === user.userId) continue;

        notificationPromises.push(
          Notification.create({
            userId: admin._id,
            userRole: 'admin',
            titleAr: '✅ تم تعيين تكليف',
            bodyAr: `تم قبول ${application.applicantName} على التكليف "${deployment.title}"`,
            type: 'deployment',
            priority: 'high',
            data: {
              deploymentId: id,
              assignedTo: application.applicantId.toString(),
              applicantName: application.applicantName,
              status: 'assigned',
            },
            actionUrl: '/admin/orders',
            voiceEnabled: false,
          }),
          sendPushToUser(admin._id.toString(), {
            title: '✅ تم تعيين تكليف',
            body: `تم قبول ${application.applicantName} على التكليف "${deployment.title}"`,
            type: 'deployment',
            priority: 'high',
            url: '/admin/orders',
            userRole: 'admin',
            data: {
              deploymentId: id,
              assignedTo: application.applicantId.toString(),
              status: 'assigned',
            },
          })
        );
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
        assignedTo: application.applicantId.toString(),
        assignedName: application.applicantName,
        deploymentStatus: 'assigned',
        contactRevealed: true,
      },
      message: `تم قبول ${application.applicantName} على التكليف بنجاح`,
    });
  } catch (error) {
    console.error('[DEPLOYMENT ACCEPT ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء قبول التقديم', 500, 'INTERNAL_ERROR');
  }
}
