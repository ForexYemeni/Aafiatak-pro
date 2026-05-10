// ============================================================================
// PATCH /api/deployments/[id]/verify-payment - Admin verifies payment proof
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
    const body = await request.json();
    const { applicationId, verified } = body;

    // ── Validate ──
    if (!applicationId) {
      return createErrorResponse('معرف التقديم مطلوب', 400, 'VALIDATION_ERROR');
    }

    if (verified === undefined || verified === null) {
      return createErrorResponse('حالة التحقق مطلوبة', 400, 'VALIDATION_ERROR');
    }

    // ── Find deployment ──
    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return createErrorResponse('التكليف غير موجود', 404, 'NOT_FOUND');
    }

    // ── Find application by _id ──
    const applicationIndex = deployment.applications.findIndex(
      (app: any) => app._id.toString() === applicationId
    );

    if (applicationIndex === -1) {
      return createErrorResponse('التقديم غير موجود', 404, 'APPLICATION_NOT_FOUND');
    }

    const application = deployment.applications[applicationIndex] as any;

    // ── Validate application status ──
    if (application.status !== 'payment_submitted') {
      return createErrorResponse(
        'لا يمكن التحقق من الدفع في هذه المرحلة. حالة التقديم: ' + application.status,
        400,
        'INVALID_APPLICATION_STATUS'
      );
    }

    // ── Update application ──
    if (verified) {
      application.status = 'payment_verified';
      application.paymentVerifiedAt = new Date();
      application.paymentVerifiedBy = user.userId;
    } else {
      // Payment rejected — reset to payment_pending so applicant can resubmit
      application.status = 'payment_pending';
      application.hasPaymentProof = false;
      application.paymentProofData = undefined;
      application.paymentSubmittedAt = undefined;
    }

    await deployment.save();

    // ═══ NOTIFY: Notify applicant and deployment creator ═══
    const notificationPromises: Promise<any>[] = [];

    try {
      if (verified) {
        // ── Notify applicant: payment verified ──
        const applicantVoiceText = 'تم التحقق من دفعك. تم قبول تقديمك على التكليف';
        notificationPromises.push(
          Notification.create({
            userId: application.applicantId,
            userRole: application.applicantRole === 'lab_tech' ? 'nurse' : application.applicantRole,
            titleAr: '✅ تم التحقق من الدفع',
            bodyAr: `تم التحقق من دفعك. تم قبول تقديمك على التكليف "${deployment.title}"`,
            type: 'deployment',
            priority: 'high',
            data: {
              deploymentId: id,
              applicationId: applicationId,
              status: 'payment_verified',
              voiceAlert: true,
              voiceText: applicantVoiceText,
            },
            actionUrl: '/nurse/my-requests',
            voiceEnabled: true,
          }),
          sendPushToUser(application.applicantId.toString(), {
            title: '✅ تم التحقق من الدفع',
            body: `تم التحقق من دفعك. تم قبول تقديمك على التكليف "${deployment.title}"`,
            type: 'deployment',
            priority: 'high',
            url: '/nurse/my-requests',
            userRole: application.applicantRole === 'lab_tech' ? 'nurse' : application.applicantRole,
            sound: true,
            data: {
              deploymentId: id,
              applicationId: applicationId,
              status: 'payment_verified',
              voiceAlert: true,
              voiceText: applicantVoiceText,
            },
          })
        );

        // ── Notify deployment creator: payment verified for applicant ──
        const creatorVoiceText = `تم التحقق من دفع المتقدم ${application.applicantName}`;
        notificationPromises.push(
          Notification.create({
            userId: deployment.createdBy,
            userRole: deployment.creatorRole === 'admin' ? 'admin' : 'nurse',
            titleAr: '✅ تم التحقق من دفع المتقدم',
            bodyAr: `تم التحقق من دفع المتقدم ${application.applicantName} على التكليف "${deployment.title}"`,
            type: 'deployment',
            priority: 'high',
            data: {
              deploymentId: id,
              applicationId: applicationId,
              applicantName: application.applicantName,
              status: 'payment_verified',
              voiceAlert: true,
              voiceText: creatorVoiceText,
            },
            actionUrl: deployment.creatorRole === 'admin' ? '/admin/orders' : '/nurse/my-requests',
            voiceEnabled: true,
          }),
          sendPushToUser(deployment.createdBy.toString(), {
            title: '✅ تم التحقق من دفع المتقدم',
            body: `تم التحقق من دفع المتقدم ${application.applicantName} على التكليف "${deployment.title}"`,
            type: 'deployment',
            priority: 'high',
            url: deployment.creatorRole === 'admin' ? '/admin/orders' : '/nurse/my-requests',
            userRole: deployment.creatorRole === 'admin' ? 'admin' : 'nurse',
            sound: true,
            data: {
              deploymentId: id,
              applicationId: applicationId,
              applicantName: application.applicantName,
              status: 'payment_verified',
              voiceAlert: true,
              voiceText: creatorVoiceText,
            },
          })
        );
      } else {
        // ── Notify applicant: payment rejected ──
        const rejectedVoiceText = 'لم يتم قبول إثبات الدفع. يرجى إعادة التقديم';
        notificationPromises.push(
          Notification.create({
            userId: application.applicantId,
            userRole: application.applicantRole === 'lab_tech' ? 'nurse' : application.applicantRole,
            titleAr: '⚠️ لم يتم قبول إثبات الدفع',
            bodyAr: `لم يتم قبول إثبات الدفع للتقديم على التكليف "${deployment.title}". يرجى إعادة التقديم بإثبات صحيح`,
            type: 'deployment',
            priority: 'high',
            data: {
              deploymentId: id,
              applicationId: applicationId,
              status: 'payment_pending',
              voiceAlert: true,
              voiceText: rejectedVoiceText,
            },
            actionUrl: '/nurse/my-requests',
            voiceEnabled: true,
          }),
          sendPushToUser(application.applicantId.toString(), {
            title: '⚠️ لم يتم قبول إثبات الدفع',
            body: `لم يتم قبول إثبات الدفع للتقديم على التكليف "${deployment.title}"`,
            type: 'deployment',
            priority: 'high',
            url: '/nurse/my-requests',
            userRole: application.applicantRole === 'lab_tech' ? 'nurse' : application.applicantRole,
            sound: true,
            data: {
              deploymentId: id,
              applicationId: applicationId,
              status: 'payment_pending',
              voiceAlert: true,
              voiceText: rejectedVoiceText,
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
        applicationId,
        applicationStatus: verified ? 'payment_verified' : 'payment_pending',
      },
      message: verified
        ? 'تم التحقق من الدفع بنجاح'
        : 'تم رفض إثبات الدفع. يمكن للمتقدم إعادة التقديم',
    });
  } catch (error) {
    console.error('[DEPLOYMENT VERIFY PAYMENT ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحقق من الدفع', 500, 'INTERNAL_ERROR');
  }
}
