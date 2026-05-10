// ============================================================================
// GET/PATCH /api/deployments/[id] - Get deployment details / Update deployment
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// ============================================================================

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Deployment, Notification, Nurse, User } from '@/models/mongoose';
import { requireAuth, requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { sendPushToUser } from '@/lib/notifications/push-service';

// ── GET: Get deployment details by ID ───────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { id } = await params;
    const deployment = await Deployment.findById(id)
      .populate('createdBy', 'name phone')
      .populate('assignedTo', 'name phone')
      .lean();

    if (!deployment) {
      return createErrorResponse('التكليف غير موجود', 404, 'NOT_FOUND');
    }

    // Serialize
    const serialized = {
      ...deployment,
      id: deployment._id.toString(),
      createdBy: deployment.createdBy
        ? { ...(deployment.createdBy as any), id: (deployment.createdBy as any)._id?.toString() }
        : null,
      assignedTo: deployment.assignedTo
        ? { ...(deployment.assignedTo as any), id: (deployment.assignedTo as any)._id?.toString() }
        : null,
      applications: (deployment.applications || []).map((a: any) => ({
        ...a,
        applicantId: a.applicantId?.toString(),
        paymentVerifiedBy: a.paymentVerifiedBy?.toString(),
      })),
    };

    return Response.json({
      success: true,
      data: serialized,
    });
  } catch (error) {
    console.error('[DEPLOYMENT DETAIL ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب تفاصيل التكليف', 500, 'INTERNAL_ERROR');
  }
}

// ── PATCH: Update deployment (status changes, etc.) ─────────────────────────

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

    // Prevent modifying internal fields directly
    delete body._id;
    delete body.createdBy;
    delete body.creatorRole;
    delete body.applications;

    const existingDeployment = await Deployment.findById(id);
    if (!existingDeployment) {
      return createErrorResponse('التكليف غير موجود', 404, 'NOT_FOUND');
    }

    // ── Authorization for status changes ──
    const isAdminOrSubadmin = ['admin', 'subadmin'].includes(user.role);
    const isCreator = existingDeployment.createdBy.toString() === user.userId;

    if (body.status && !isAdminOrSubadmin && !isCreator) {
      return createErrorResponse('ليس لديك صلاحية لتغيير حالة هذا التكليف', 403, 'FORBIDDEN');
    }

    // ── Apply status-specific updates ──
    const updateData: any = { ...body };

    if (body.status === 'cancelled') {
      updateData.cancelledAt = new Date();
      updateData.cancelReason = body.cancelReason || 'تم الإلغاء';
    }

    if (body.status === 'completed') {
      updateData.completedAt = new Date();
    }

    if (body.status === 'in_progress') {
      // Can only start if assigned
      if (existingDeployment.status !== 'assigned' && !isAdminOrSubadmin) {
        return createErrorResponse('لا يمكن بدء تكليف لم يتم تعيينه بعد', 400, 'INVALID_STATUS_TRANSITION');
      }
    }

    const deployment = await Deployment.findByIdAndUpdate(id, updateData, { new: true }).lean();
    if (!deployment) {
      return createErrorResponse('التكليف غير موجود', 404, 'NOT_FOUND');
    }

    // ═══ NOTIFY: Status change notifications ═══
    const notificationPromises: Promise<any>[] = [];

    try {
      // ── Cancelled: notify all applicants ──
      if (body.status === 'cancelled') {
        const applicants = deployment.applications || [];
        for (const app of applicants) {
          if (app.status !== 'rejected') {
            const voiceText = `تم إلغاء التكليف: ${deployment.title}`;
            notificationPromises.push(
              Notification.create({
                userId: app.applicantId,
                userRole: app.applicantRole === 'lab_tech' ? 'nurse' : app.applicantRole,
                titleAr: '❌ تم إلغاء التكليف',
                bodyAr: `تم إلغاء التكليف "${deployment.title}". ${updateData.cancelReason || ''}`,
                type: 'deployment',
                priority: 'high',
                data: {
                  deploymentId: id,
                  status: 'cancelled',
                  voiceAlert: true,
                  voiceText,
                },
                actionUrl: '/nurse/my-requests',
                voiceEnabled: true,
              }),
              sendPushToUser(app.applicantId.toString(), {
                title: '❌ تم إلغاء التكليف',
                body: `تم إلغاء التكليف "${deployment.title}"`,
                type: 'deployment',
                priority: 'high',
                url: '/nurse/my-requests',
                userRole: app.applicantRole === 'lab_tech' ? 'nurse' : app.applicantRole,
                sound: true,
                data: {
                  deploymentId: id,
                  status: 'cancelled',
                  voiceAlert: true,
                  voiceText,
                },
              })
            );
          }
        }

        // Also notify assigned person if any
        if (deployment.assignedTo) {
          const voiceText = `تم إلغاء التكليف: ${deployment.title}`;
          notificationPromises.push(
            Notification.create({
              userId: deployment.assignedTo,
              userRole: 'nurse',
              titleAr: '❌ تم إلغاء التكليف',
              bodyAr: `تم إلغاء التكليف المعين لك "${deployment.title}". ${updateData.cancelReason || ''}`,
              type: 'deployment',
              priority: 'urgent',
              data: {
                deploymentId: id,
                status: 'cancelled',
                voiceAlert: true,
                voiceText,
              },
              actionUrl: '/nurse/my-requests',
              voiceEnabled: true,
            }),
            sendPushToUser(deployment.assignedTo.toString(), {
              title: '❌ تم إلغاء التكليف',
              body: `تم إلغاء التكليف المعين لك "${deployment.title}"`,
              type: 'deployment',
              priority: 'urgent',
              url: '/nurse/my-requests',
              userRole: 'nurse',
              sound: true,
              data: {
                deploymentId: id,
                status: 'cancelled',
                voiceAlert: true,
                voiceText,
              },
            })
          );
        }
      }

      // ── Completed: notify assigned person ──
      if (body.status === 'completed' && deployment.assignedTo) {
        const voiceText = `تم إكمال التكليف: ${deployment.title}. شكراً لك`;
        notificationPromises.push(
          Notification.create({
            userId: deployment.assignedTo,
            userRole: 'nurse',
            titleAr: '✅ تم إكمال التكليف',
            bodyAr: `تم إكمال التكليف "${deployment.title}". شكراً لجهودك!`,
            type: 'deployment',
            priority: 'high',
            data: {
              deploymentId: id,
              status: 'completed',
              voiceAlert: true,
              voiceText,
            },
            actionUrl: '/nurse/my-requests',
            voiceEnabled: true,
          }),
          sendPushToUser(deployment.assignedTo.toString(), {
            title: '✅ تم إكمال التكليف',
            body: `تم إكمال التكليف "${deployment.title}"`,
            type: 'deployment',
            priority: 'high',
            url: '/nurse/my-requests',
            userRole: 'nurse',
            sound: true,
            data: {
              deploymentId: id,
              status: 'completed',
              voiceAlert: true,
              voiceText,
            },
          })
        );
      }

      // ── In progress: notify creator ──
      if (body.status === 'in_progress') {
        const voiceText = `بدأ تنفيذ التكليف: ${deployment.title}`;
        notificationPromises.push(
          Notification.create({
            userId: deployment.createdBy,
            userRole: deployment.creatorRole === 'admin' ? 'admin' : 'nurse',
            titleAr: '🔄 بدأ تنفيذ التكليف',
            bodyAr: `بدأ تنفيذ التكليف "${deployment.title}"`,
            type: 'deployment',
            priority: 'high',
            data: {
              deploymentId: id,
              status: 'in_progress',
              voiceAlert: true,
              voiceText,
            },
            actionUrl: deployment.creatorRole === 'admin' ? '/admin/orders' : '/nurse/my-requests',
            voiceEnabled: true,
          }),
          sendPushToUser(deployment.createdBy.toString(), {
            title: '🔄 بدأ تنفيذ التكليف',
            body: `بدأ تنفيذ التكليف "${deployment.title}"`,
            type: 'deployment',
            priority: 'high',
            url: deployment.creatorRole === 'admin' ? '/admin/orders' : '/nurse/my-requests',
            userRole: deployment.creatorRole === 'admin' ? 'admin' : 'nurse',
            sound: true,
            data: {
              deploymentId: id,
              status: 'in_progress',
              voiceAlert: true,
              voiceText,
            },
          })
        );
      }
    } catch {
      // Non-critical — notifications should not block the update
    }

    // Fire ALL notifications in parallel
    await Promise.allSettled(notificationPromises);

    return Response.json({
      success: true,
      data: {
        ...deployment,
        id: deployment._id.toString(),
        applications: (deployment.applications || []).map((a: any) => ({
          ...a,
          applicantId: a.applicantId?.toString(),
          paymentVerifiedBy: a.paymentVerifiedBy?.toString(),
        })),
      },
      message: 'تم تحديث التكليف بنجاح',
    });
  } catch (error) {
    console.error('[DEPLOYMENT UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تحديث التكليف', 500, 'INTERNAL_ERROR');
  }
}
