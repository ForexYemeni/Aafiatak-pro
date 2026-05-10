// ============================================================================
// POST /api/deployments/[id]/apply - Apply for a deployment (nurse/lab_tech/midwife)
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// ============================================================================

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Deployment, Notification, Nurse, AdminSettings, User } from '@/models/mongoose';
import { requireAuth, requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { sendPushToUser } from '@/lib/notifications/push-service';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['nurse']);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const { coverLetter } = body;

    // ── Validate deployment exists and is open ──
    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return createErrorResponse('التكليف غير موجود', 404, 'NOT_FOUND');
    }

    if (deployment.status !== 'open') {
      return createErrorResponse('هذا التكليف غير متاح للتقديم', 400, 'DEPLOYMENT_NOT_OPEN');
    }

    // ── Check if already applied ──
    const alreadyApplied = deployment.applications.some(
      (app: any) => app.applicantId.toString() === user.userId
    );
    if (alreadyApplied) {
      return createErrorResponse('لقد تقدمت بالفعل على هذا التكليف', 409, 'ALREADY_APPLIED');
    }

    // ── Get applicant info ──
    const applicant = await Nurse.findById(user.userId).select('name').lean();
    if (!applicant) {
      return createErrorResponse('لم يتم العثور على بيانات الممرض', 404, 'NURSE_NOT_FOUND');
    }

    // ── Determine applicant role based on specialization ──
    let applicantRole: 'nurse' | 'lab_tech' | 'midwife' = 'nurse';
    if (deployment.type === 'lab') {
      applicantRole = 'lab_tech';
    } else if (deployment.type === 'midwife') {
      applicantRole = 'midwife';
    }

    // ── Get service fee from settings ──
    const settings = await AdminSettings.findOne().lean();
    const serviceFee = settings?.deploymentServiceFee ?? 500;

    // ── Create application ──
    const application = {
      applicantId: user.userId,
      applicantRole,
      applicantName: applicant.name,
      status: 'payment_pending',
      appliedAt: new Date(),
      hasPaymentProof: false,
      serviceFee,
      coverLetter: coverLetter || undefined,
    };

    deployment.applications.push(application);
    await deployment.save();

    // ═══ NOTIFY: Notify deployment creator with voice notification ═══
    const notificationPromises: Promise<any>[] = [];

    try {
      const voiceText = `تقدم ${applicant.name} على التكليف: ${deployment.title}`;

      // Notify the creator of the deployment
      notificationPromises.push(
        Notification.create({
          userId: deployment.createdBy,
          userRole: deployment.creatorRole === 'admin' ? 'admin' : 'nurse',
          titleAr: '📋 تقديم جديد على التكليف',
          bodyAr: `تقدم ${applicant.name} على التكليف "${deployment.title}". بانتظار دفع رسوم التقديم`,
          type: 'deployment',
          priority: 'high',
          data: {
            deploymentId: id,
            applicantId: user.userId,
            applicantName: applicant.name,
            voiceAlert: true,
            voiceText,
          },
          actionUrl: deployment.creatorRole === 'admin' ? '/admin/orders' : '/nurse/my-requests',
          voiceEnabled: true,
        }),
        sendPushToUser(deployment.createdBy.toString(), {
          title: '📋 تقديم جديد على التكليف',
          body: `تقدم ${applicant.name} على التكليف "${deployment.title}"`,
          type: 'deployment',
          priority: 'high',
          url: deployment.creatorRole === 'admin' ? '/admin/orders' : '/nurse/my-requests',
          userRole: deployment.creatorRole === 'admin' ? 'admin' : 'nurse',
          sound: true,
          data: {
            deploymentId: id,
            applicantId: user.userId,
            applicantName: applicant.name,
            voiceAlert: true,
            voiceText,
          },
        })
      );

      // Also notify admins if the creator is a nurse
      if (deployment.creatorRole === 'nurse') {
        const admins = await User.find({ role: 'admin' }).select('_id').lean();
        for (const admin of admins) {
          notificationPromises.push(
            Notification.create({
              userId: admin._id,
              userRole: 'admin',
              titleAr: '📋 تقديم جديد على تكليف',
              bodyAr: `تقدم ${applicant.name} على التكليف "${deployment.title}"`,
              type: 'deployment',
              priority: 'high',
              data: {
                deploymentId: id,
                applicantId: user.userId,
                applicantName: applicant.name,
                voiceAlert: true,
                voiceText,
              },
              actionUrl: '/admin/orders',
              voiceEnabled: true,
            }),
            sendPushToUser(admin._id.toString(), {
              title: '📋 تقديم جديد على تكليف',
              body: `تقدم ${applicant.name} على التكليف "${deployment.title}"`,
              type: 'deployment',
              priority: 'high',
              url: '/admin/orders',
              userRole: 'admin',
              sound: true,
              data: {
                deploymentId: id,
                applicantId: user.userId,
                applicantName: applicant.name,
                voiceAlert: true,
                voiceText,
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

    // Get the newly created application's ID
    const savedDeployment = await Deployment.findById(id).lean();
    const newApplication = savedDeployment?.applications
      ?.filter((a: any) => a.applicantId.toString() === user.userId)
      .sort((a: any, b: any) => new Date(b.appliedAt).getTime() - new Date(a.appliedAt).getTime())[0];

    return Response.json({
      success: true,
      data: {
        deploymentId: id,
        application: newApplication ? {
          ...newApplication,
          applicantId: newApplication.applicantId?.toString(),
          _id: newApplication._id?.toString(),
        } : null,
        serviceFee,
        bankAccountInfo: settings?.bankAccountInfo || '',
      },
      message: 'تم التقديم على التكليف بنجاح. يرجى دفع رسوم التقديم',
    }, { status: 201 });
  } catch (error) {
    console.error('[DEPLOYMENT APPLY ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التقديم على التكليف', 500, 'INTERNAL_ERROR');
  }
}
