// ============================================================================
// PATCH /api/deployments/[id]/select-applicant - Creator selects best applicant
// NEW FLOW: Creator selects → deployment IMMEDIATELY assigned (no admin approval for deployment)
//   - If applicant pays fees: app=payment_pending, dep=assigned, contactRevealed=false
//   - If creator pays fees:   app=accepted, dep=assigned, contactRevealed=true
//   - Admin only verifies payment proof (approve/reject)
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

    // ── NEW FLOW: Immediately assign deployment (skip admin approval for deployment) ──
    const feeResponsible = deployment.feeResponsible || 'applicant';

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

    // ── Set assignment immediately (no admin approval needed for deployment) ──
    deployment.assignedTo = application.applicantId;
    deployment.assignedAt = new Date();

    if (feeResponsible === 'creator') {
      // Creator pays fees → go directly to accepted/assigned, contact revealed
      application.status = 'accepted';
      deployment.status = 'assigned';
      deployment.contactRevealed = true;
    } else {
      // Applicant pays fees → need payment first, contact BLOCKED until admin verifies payment
      application.status = 'payment_pending';
      deployment.status = 'assigned';
      // contactRevealed stays false — will be set to true when admin verifies payment
    }

    await deployment.save();

    // ═══ NOTIFY: Notify applicant and admins with voice notifications ═══
    const notificationPromises: Promise<any>[] = [];

    try {
      // ── Get creator name for notifications ──
      const creatorNurse = await Nurse.findById(deployment.createdBy).select('name').lean();
      const creatorName = creatorNurse?.name || 'المستخدم';

      if (feeResponsible === 'creator') {
        // ── Creator pays: accepted directly, no payment needed ──
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
              applicationId,
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
              applicationId,
              status: 'accepted',
              voiceAlert: true,
              voiceText: applicantVoiceText,
            },
          })
        );
      } else {
        // ── Applicant pays: need to submit payment proof ──
        const fee = application.serviceFee || deployment.serviceFee || 0;
        const applicantVoiceText = `تم اختيارك للتكليف ${deployment.title}. يرجى دفع رسوم التقديم بمبلغ ${fee} ريال`;
        notificationPromises.push(
          Notification.create({
            userId: application.applicantId,
            userRole: application.applicantRole === 'lab_tech' ? 'nurse' : application.applicantRole,
            titleAr: '🎯 تم اختيارك للتكليف! يرجى الدفع',
            bodyAr: `تم اختيارك للتكليف "${deployment.title}". يرجى دفع رسوم التقديم بمبلغ ${fee} ريال`,
            type: 'deployment',
            priority: 'urgent',
            data: {
              deploymentId: id,
              applicationId,
              status: 'payment_pending',
              fee,
              voiceAlert: true,
              voiceText: applicantVoiceText,
            },
            actionUrl: '/nurse/deployments',
            voiceEnabled: true,
          }),
          sendPushToUser(application.applicantId.toString(), {
            title: '🎯 تم اختيارك للتكليف! يرجى الدفع',
            body: `تم اختيارك للتكليف "${deployment.title}". يرجى دفع رسوم التقديم`,
            type: 'deployment',
            priority: 'urgent',
            url: '/nurse/deployments',
            userRole: application.applicantRole === 'lab_tech' ? 'nurse' : application.applicantRole,
            sound: true,
            data: {
              deploymentId: id,
              applicationId,
              status: 'payment_pending',
              fee,
              voiceAlert: true,
              voiceText: applicantVoiceText,
            },
          })
        );

        // ── Notify admins about the assignment (for awareness, not for approval) ──
        const adminVoiceText = `تم تعيين ${application.applicantName} على التكليف ${deployment.title}. بانتظار الدفع`;
        const admins = await User.find({ role: { $in: ['admin', 'subadmin'] } }).select('_id role').lean();
        for (const admin of admins) {
          const adminRole = (admin as any).role || 'admin';
          notificationPromises.push(
            Notification.create({
              userId: admin._id,
              userRole: adminRole,
              titleAr: '📋 تم تعيين مكلف - بانتظار الدفع',
              bodyAr: `تم تعيين ${application.applicantName} على التكليف "${deployment.title}" من قبل ${creatorName}. بانتظار دفع الرسوم`,
              type: 'deployment',
              priority: 'high',
              data: {
                deploymentId: id,
                applicationId,
                applicantId: application.applicantId.toString(),
                applicantName: application.applicantName,
                creatorName,
                status: 'assigned',
                voiceAlert: true,
                voiceText: adminVoiceText,
              },
              actionUrl: '/admin/deployments',
              voiceEnabled: true,
            }),
            sendPushToUser(admin._id.toString(), {
              title: '📋 تم تعيين مكلف - بانتظار الدفع',
              body: `تم تعيين ${application.applicantName} على التكليف "${deployment.title}"`,
              type: 'deployment',
              priority: 'high',
              url: '/admin/deployments',
              userRole: adminRole,
              sound: true,
              data: {
                deploymentId: id,
                applicationId,
                applicantId: application.applicantId.toString(),
                status: 'assigned',
                voiceAlert: true,
                voiceText: adminVoiceText,
              },
            })
          );
        }
      }

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

    // ── Emit real-time socket event ──
    try {
      const { emitRealtimeEvent } = await import('@/lib/notifications/emit-realtime-event');
      await emitRealtimeEvent.applicationChanged({
        deploymentId: id,
        applicationId: applicationId,
        applicantId: application.applicantId.toString(),
        status: 'selected_by_creator',
      }, { changedBy: user!.userId, changedByRole: user!.role });
    } catch {}

    // ── Response ──
    const responseAppStatus = application.status;
    const responseDepStatus = deployment.status;

    return Response.json({
      success: true,
      data: {
        deploymentId: id,
        applicationId,
        selectedApplicantId: application.applicantId.toString(),
        selectedApplicantName: application.applicantName,
        applicationStatus: responseAppStatus,
        deploymentStatus: responseDepStatus,
      },
      message: feeResponsible === 'creator'
        ? `تم اختيار وقبول ${application.applicantName} على التكليف مباشرة`
        : `تم اختيار ${application.applicantName} وتعيينه على التكليف. يرجى تقديم إشعار الدفع`,
    });
  } catch (error) {
    console.error('[DEPLOYMENT SELECT APPLICANT ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء اختيار المتقدم', 500, 'INTERNAL_ERROR');
  }
}
