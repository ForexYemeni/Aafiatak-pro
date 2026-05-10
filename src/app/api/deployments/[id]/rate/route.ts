// ============================================================================
// POST /api/deployments/[id]/rate - Creator rates the assigned nurse after completion
// NEW FLOW: Only creator can rate, deployment must be completed
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// ============================================================================

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Deployment, Notification, Nurse, Rating } from '@/models/mongoose';
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
    const { rating, ratingComment } = body;

    // ── Validate rating ──
    if (!rating || rating < 1 || rating > 5) {
      return createErrorResponse('التقييم مطلوب ويجب أن يكون بين 1 و 5', 400, 'VALIDATION_ERROR');
    }

    // ── Find deployment ──
    const deployment = await Deployment.findById(id);
    if (!deployment) {
      return createErrorResponse('التكليف غير موجود', 404, 'NOT_FOUND');
    }

    // ── Validate deployment status must be completed ──
    if (deployment.status !== 'completed') {
      return createErrorResponse('لا يمكن تقييم التكليف إلا بعد إكماله', 400, 'DEPLOYMENT_NOT_COMPLETED');
    }

    // ── Only the creator can rate ──
    if (deployment.createdBy.toString() !== user.userId) {
      return createErrorResponse('فقط منشئ التكليف يمكنه التقييم', 403, 'FORBIDDEN');
    }

    // ── Check if already rated ──
    if (deployment.rating) {
      return createErrorResponse('تم تقييم هذا التكليف بالفعل', 400, 'ALREADY_RATED');
    }

    // ── Validate deployment has an assigned nurse ──
    if (!deployment.assignedTo) {
      return createErrorResponse('لا يوجد ممرض معين على هذا التكليف', 400, 'NO_ASSIGNED_NURSE');
    }

    // ── Store rating on the deployment document ──
    deployment.rating = rating;
    deployment.ratingComment = ratingComment || undefined;
    deployment.ratedAt = new Date();
    deployment.ratedBy = user.userId;

    await deployment.save();

    // ── Create a Rating document for the nurse ──
    try {
      await Rating.create({
        requestId: deployment._id,
        ratingType: 'deployment',
        fromUserId: deployment.createdBy,
        toUserId: deployment.assignedTo,
        fromRole: deployment.creatorRole,
        toRole: 'nurse',
        score: rating,
        comment: ratingComment || undefined,
        tags: [],
        isAnonymous: false,
      });
    } catch (ratingError: any) {
      // If duplicate key error (already rated), ignore
      if (ratingError?.code !== 11000) {
        console.error('[DEPLOYMENT RATING CREATE ERROR]', ratingError);
      }
    }

    // ── Update nurse's average rating ──
    try {
      const nurseRatings = await Rating.find({
        toUserId: deployment.assignedTo,
        ratingType: { $in: ['service', 'deployment'] },
      }).select('score').lean();

      if (nurseRatings.length > 0) {
        const totalScore = nurseRatings.reduce((sum, r) => sum + r.score, 0);
        const avgRating = Math.round((totalScore / nurseRatings.length) * 10) / 10;

        await Nurse.findByIdAndUpdate(deployment.assignedTo, {
          rating: avgRating,
          reviewCount: nurseRatings.length,
          $inc: { completedJobs: 0 }, // completedJobs already incremented elsewhere
        });
      }
    } catch {
      // Non-critical — nurse rating update should not block
    }

    // ═══ NOTIFY: Notify the rated nurse ═══
    const notificationPromises: Promise<any>[] = [];

    try {
      const nurseVoiceText = `تم تقييمك على التكليف ${deployment.title}. تقييمك: ${rating} من 5`;
      notificationPromises.push(
        Notification.create({
          userId: deployment.assignedTo,
          userRole: 'nurse',
          titleAr: '⭐ تقييم جديد',
          bodyAr: `تم تقييمك على التكليف "${deployment.title}". تقييمك: ${rating} من 5${ratingComment ? `. تعليق: ${ratingComment}` : ''}`,
          type: 'rating',
          priority: 'medium',
          data: {
            deploymentId: id,
            rating,
            ratingComment: ratingComment || undefined,
            voiceAlert: true,
            voiceText: nurseVoiceText,
          },
          actionUrl: '/nurse/ratings',
          voiceEnabled: true,
        }),
        sendPushToUser(deployment.assignedTo.toString(), {
          title: '⭐ تقييم جديد',
          body: `تم تقييمك على التكليف "${deployment.title}". تقييمك: ${rating} من 5`,
          type: 'rating',
          priority: 'medium',
          url: '/nurse/ratings',
          userRole: 'nurse',
          sound: true,
          data: {
            deploymentId: id,
            rating,
            voiceAlert: true,
            voiceText: nurseVoiceText,
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
        rating,
        ratingComment: ratingComment || null,
        ratedAt: deployment.ratedAt,
      },
      message: 'تم تقييم المكلف بنجاح',
    });
  } catch (error) {
    console.error('[DEPLOYMENT RATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تقييم التكليف', 500, 'INTERNAL_ERROR');
  }
}
