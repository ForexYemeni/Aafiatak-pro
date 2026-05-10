// ============================================================================
// POST /api/deployments/[id]/apply - Apply for a deployment (nurse/lab_tech/midwife)
// NEW FLOW: status = pending (NO payment needed at apply time)
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

    // ── Get applicant info with specialization, experience, rating, completedJobs, verificationStatus ──
    const applicant = await Nurse.findById(user.userId)
      .select('name specialization experience rating completedJobs verificationStatus')
      .lean();
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
    const serviceFee = settings?.deploymentApplicantFee ?? 500;

    // ── Create application with status = pending (NO payment at apply time) ──
    const application = {
      applicantId: user.userId,
      applicantRole,
      applicantName: applicant.name,
      applicantSpecialization: applicant.specialization || [],
      applicantExperience: applicant.experience || 0,
      applicantRating: applicant.rating || 0,
      applicantCompletedJobs: applicant.completedJobs || 0,
      applicantVerificationStatus: applicant.verificationStatus || 'unverified',
      status: 'pending',
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
          actionUrl: deployment.creatorRole === 'admin' ? '/admin/deployments' : '/nurse/deployments',
          voiceEnabled: true,
        }),
        sendPushToUser(deployment.createdBy.toString(), {
          title: '📋 تقديم جديد على التكليف',
          body: `تقدم ${applicant.name} على التكليف "${deployment.title}"`,
          type: 'deployment',
          priority: 'high',
          url: deployment.creatorRole === 'admin' ? '/admin/deployments' : '/nurse/deployments',
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
        const admins = await User.find({ role: { $in: ['admin', 'subadmin'] } }).select('_id role').lean();
        for (const admin of admins) {
          const adminRole = (admin as any).role || 'admin';
          notificationPromises.push(
            Notification.create({
              userId: admin._id,
              userRole: adminRole,
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
              actionUrl: '/admin/deployments',
              voiceEnabled: true,
            }),
            sendPushToUser(admin._id.toString(), {
              title: '📋 تقديم جديد على تكليف',
              body: `تقدم ${applicant.name} على التكليف "${deployment.title}"`,
              type: 'deployment',
              priority: 'high',
              url: '/admin/deployments',
              userRole: adminRole,
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
      },
      message: 'تم التقديم على التكليف بنجاح. سيتم مراجعة تقديمك',
    }, { status: 201 });
  } catch (error) {
    console.error('[DEPLOYMENT APPLY ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التقديم على التكليف', 500, 'INTERNAL_ERROR');
  }
}
