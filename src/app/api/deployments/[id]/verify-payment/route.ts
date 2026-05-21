// ============================================================================
// PATCH /api/deployments/[id]/verify-payment - Admin verifies payment proof
// NEW FLOW: When verified=true → app status = accepted, contactRevealed = true (unlocks all contact data)
//           When verified=false → app status = payment_pending (nurse can re-upload proof)
//           Deployment is already 'assigned' since the new flow assigns immediately.
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
      // NEW FLOW: Set application status to accepted, deployment to assigned, reveal contact
      application.status = 'accepted';
      application.paymentVerifiedAt = new Date();
      application.paymentVerifiedBy = user.userId;

      // ── Set deployment assignment ──
      deployment.assignedTo = application.applicantId;
      deployment.assignedAt = new Date();
      deployment.status = 'assigned';
      deployment.contactRevealed = true;
    } else {
      // Payment rejected — reset to payment_pending so applicant can resubmit
      application.status = 'payment_pending';
      application.hasPaymentProof = false;
      application.paymentProofData = undefined;
      application.paymentProofImage = undefined;
      application.paymentSubmittedAt = undefined;
      application.rejectedReason = 'لم يتم قبول إثبات الدفع من قبل الإدارة. يرجى إعادة التقديم بإثبات صحيح';
    }

    await deployment.save();

    // ═══ NOTIFY: Notify applicant and deployment creator ═══
    const notificationPromises: Promise<any>[] = [];

    try {
      if (verified) {
        // ── Notify applicant: payment verified, contact info revealed ──
        const applicantVoiceText = 'تم التحقق من الدفع. يمكنك الآن التواصل مع صاحب التكليف';
        notificationPromises.push(
          Notification.create({
            userId: application.applicantId,
            userRole: application.applicantRole === 'lab_tech' ? 'nurse' : application.applicantRole,
            titleAr: '✅ تم التحقق من الدفع',
            bodyAr: `تم التحقق من دفعك. يمكنك الآن التواصل مع صاحب التكليف "${deployment.title}"`,
            type: 'deployment',
            priority: 'urgent',
            data: {
              deploymentId: id,
              applicationId: applicationId,
              status: 'accepted',
              contactRevealed: true,
              voiceAlert: true,
              voiceText: applicantVoiceText,
            },
            actionUrl: '/nurse/deployments',
            voiceEnabled: true,
          }),
          sendPushToUser(application.applicantId.toString(), {
            title: '✅ تم التحقق من الدفع',
            body: `تم التحقق من دفعك. يمكنك الآن التواصل مع صاحب التكليف "${deployment.title}"`,
            type: 'deployment',
            priority: 'urgent',
            url: '/nurse/deployments',
            userRole: application.applicantRole === 'lab_tech' ? 'nurse' : application.applicantRole,
            sound: true,
            data: {
              deploymentId: id,
              applicationId: applicationId,
              status: 'accepted',
              contactRevealed: true,
              voiceAlert: true,
              voiceText: applicantVoiceText,
            },
          })
        );

        // ── Notify deployment creator: payment verified, deployment ready ──
        const creatorVoiceText = 'تم التحقق من دفع المكلف. التكليف جاهز للبدء';
        notificationPromises.push(
          Notification.create({
            userId: deployment.createdBy,
            userRole: deployment.creatorRole === 'admin' ? 'admin' : 'nurse',
            titleAr: '✅ تم التحقق من الدفع',
            bodyAr: `تم التحقق من دفع المكلف ${application.applicantName} على التكليف "${deployment.title}". التكليف جاهز للبدء`,
            type: 'deployment',
            priority: 'high',
            data: {
              deploymentId: id,
              applicationId: applicationId,
              applicantName: application.applicantName,
              status: 'assigned',
              contactRevealed: true,
              voiceAlert: true,
              voiceText: creatorVoiceText,
            },
            actionUrl: deployment.creatorRole === 'admin' ? '/admin/deployments' : '/nurse/deployments',
            voiceEnabled: true,
          }),
          sendPushToUser(deployment.createdBy.toString(), {
            title: '✅ تم التحقق من الدفع',
            body: `تم التحقق من دفع المكلف ${application.applicantName}. التكليف جاهز للبدء`,
            type: 'deployment',
            priority: 'high',
            url: deployment.creatorRole === 'admin' ? '/admin/deployments' : '/nurse/deployments',
            userRole: deployment.creatorRole === 'admin' ? 'admin' : 'nurse',
            sound: true,
            data: {
              deploymentId: id,
              applicationId: applicationId,
              applicantName: application.applicantName,
              status: 'assigned',
              contactRevealed: true,
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
            actionUrl: '/nurse/deployments',
            voiceEnabled: true,
          }),
          sendPushToUser(application.applicantId.toString(), {
            title: '⚠️ لم يتم قبول إثبات الدفع',
            body: `لم يتم قبول إثبات الدفع للتقديم على التكليف "${deployment.title}"`,
            type: 'deployment',
            priority: 'high',
            url: '/nurse/deployments',
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

    // ── Emit real-time socket event ──
    try {
      const { emitRealtimeEvent } = await import('@/lib/notifications/emit-realtime-event');
      await emitRealtimeEvent.paymentChanged({
        deploymentId: id,
        applicationId: applicationId,
        applicantId: application.applicantId.toString(),
        status: verified ? 'accepted' : 'payment_pending',
        paymentAction: verified ? 'verified' : 'rejected',
      }, { changedBy: user!.userId, changedByRole: user!.role });

      // Also emit deployment change if verified (deployment status changes)
      if (verified) {
        await emitRealtimeEvent.deploymentChanged({
          deploymentId: id,
          status: 'assigned',
          creatorId: deployment.createdBy?.toString(),
        }, { changedBy: user!.userId, changedByRole: user!.role });
      }
    } catch {}

    return Response.json({
      success: true,
      data: {
        deploymentId: id,
        applicationId,
        applicationStatus: verified ? 'accepted' : 'payment_pending',
        deploymentStatus: verified ? 'assigned' : deployment.status,
        contactRevealed: verified ? true : undefined,
      },
      message: verified
        ? 'تم التحقق من الدفع بنجاح. تم تعيين التكليف'
        : 'تم رفض إثبات الدفع. يمكن للمتقدم إعادة التقديم',
    });
  } catch (error) {
    console.error('[DEPLOYMENT VERIFY PAYMENT ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحقق من الدفع', 500, 'INTERNAL_ERROR');
  }
}
