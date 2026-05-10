// ============================================================================
// POST /api/deployments/[id]/submit-payment - Submit payment proof for application
// NEW FLOW: Accept paymentProofImage (base64), allow payment_pending (after admin approval)
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// ============================================================================

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Deployment, Notification, User } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { sendPushToUser } from '@/lib/notifications/push-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const { paymentProofData, paymentProofImage } = body;

    // ── Validate payment proof (at least one must be provided) ──
    if (!paymentProofData && !paymentProofImage) {
      return createErrorResponse('إثبات الدفع مطلوب', 400, 'VALIDATION_ERROR');
    }

    // ── Find deployment ──
    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return createErrorResponse('التكليف غير موجود', 404, 'NOT_FOUND');
    }

    // ── Find the applicant's application ──
    const applicationIndex = deployment.applications.findIndex(
      (app: any) => app.applicantId.toString() === user.userId
    );

    if (applicationIndex === -1) {
      return createErrorResponse('لم تقدم على هذا التكليف بعد', 404, 'APPLICATION_NOT_FOUND');
    }

    const application = deployment.applications[applicationIndex] as any;

    // ── Validate application status - must be payment_pending (after admin approval) ──
    if (application.status !== 'payment_pending') {
      return createErrorResponse(
        'لا يمكنك تقديم إثبات الدفع في هذه المرحلة. حالة التقديم: ' + application.status,
        400,
        'INVALID_APPLICATION_STATUS'
      );
    }

    // ── Update application with payment proof ──
    application.hasPaymentProof = true;
    if (paymentProofData) {
      application.paymentProofData = paymentProofData;
    }
    if (paymentProofImage) {
      application.paymentProofImage = paymentProofImage;
    }
    application.paymentSubmittedAt = new Date();
    application.status = 'payment_submitted';

    await deployment.save();

    // ═══ NOTIFY: Notify admins with voice notification ═══
    const notificationPromises: Promise<any>[] = [];

    try {
      const voiceText = 'تم تقديم إثبات دفع رسوم تكليف';

      // Notify all admins
      const admins = await User.find({ role: 'admin' }).select('_id').lean();
      for (const admin of admins) {
        notificationPromises.push(
          Notification.create({
            userId: admin._id,
            userRole: 'admin',
            titleAr: '💰 إثبات دفع رسوم تكليف',
            bodyAr: `تم تقديم إثبات دفع رسوم تكليف "${deployment.title}" من ${application.applicantName}. يرجى التحقق`,
            type: 'deployment',
            priority: 'high',
            data: {
              deploymentId: id,
              applicantId: user.userId,
              applicantName: application.applicantName,
              voiceAlert: true,
              voiceText,
            },
            actionUrl: '/admin/orders',
            voiceEnabled: true,
          }),
          sendPushToUser(admin._id.toString(), {
            title: '💰 إثبات دفع رسوم تكليف',
            body: `تم تقديم إثبات دفع من ${application.applicantName} على التكليف "${deployment.title}"`,
            type: 'deployment',
            priority: 'high',
            url: '/admin/orders',
            userRole: 'admin',
            sound: true,
            data: {
              deploymentId: id,
              applicantId: user.userId,
              applicantName: application.applicantName,
              voiceAlert: true,
              voiceText,
            },
          })
        );
      }

      // Also notify deployment creator (if different from admin)
      if (deployment.creatorRole === 'nurse') {
        notificationPromises.push(
          Notification.create({
            userId: deployment.createdBy,
            userRole: 'nurse',
            titleAr: '💰 إثبات دفع رسوم تكليف',
            bodyAr: `تم تقديم إثبات دفع رسوم التقديم من ${application.applicantName} على التكليف "${deployment.title}"`,
            type: 'deployment',
            priority: 'high',
            data: {
              deploymentId: id,
              applicantId: user.userId,
              applicantName: application.applicantName,
              voiceAlert: true,
              voiceText,
            },
            actionUrl: '/nurse/my-requests',
            voiceEnabled: true,
          }),
          sendPushToUser(deployment.createdBy.toString(), {
            title: '💰 إثبات دفع رسوم تكليف',
            body: `تم تقديم إثبات دفع من ${application.applicantName}`,
            type: 'deployment',
            priority: 'high',
            url: '/nurse/my-requests',
            userRole: 'nurse',
            sound: true,
            data: {
              deploymentId: id,
              applicantId: user.userId,
              applicantName: application.applicantName,
              voiceAlert: true,
              voiceText,
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
        applicationStatus: 'payment_submitted',
      },
      message: 'تم تقديم إثبات الدفع بنجاح. سيتم مراجعته قريباً',
    });
  } catch (error) {
    console.error('[DEPLOYMENT SUBMIT PAYMENT ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تقديم إثبات الدفع', 500, 'INTERNAL_ERROR');
  }
}
