// GET/POST /api/beneficiary/ratings - List/Create ratings
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// Supports both ServiceRequest and EmergencyRequest ratings

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Rating, ServiceRequest, EmergencyRequest, Nurse, Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { sendPushToUser } from '@/lib/notifications/push-service';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const [ratings, total] = await Promise.all([
      Rating.find({ fromUserId: user.userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Rating.countDocuments({ fromUserId: user.userId }),
    ]);

    return Response.json({
      success: true,
      data: {
        ratings: ratings.map((r: any) => ({ ...r, id: r._id.toString() })),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[BENEFICIARY RATINGS LIST ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب التقييمات', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    const { requestId, ratingType, score, comment, tags, isAnonymous } = body;

    if (!requestId || !score) {
      return createErrorResponse('معرف الطلب والتقييم مطلوبان', 400, 'VALIDATION_ERROR');
    }

    if (score < 1 || score > 5) {
      return createErrorResponse('التقييم يجب أن يكون بين 1 و 5', 400, 'VALIDATION_ERROR');
    }

    const isEmergencyRating = ratingType === 'emergency';

    let nurseId: string | null = null;
    let serviceName = '';

    if (isEmergencyRating) {
      // Verify emergency request exists and belongs to user
      const emergency = await EmergencyRequest.findOne({ _id: requestId, beneficiaryId: user.userId });
      if (!emergency) return createErrorResponse('طلب الطوارئ غير موجود', 404, 'NOT_FOUND');

      if (emergency.status !== 'resolved') {
        return createErrorResponse('يمكن تقييم طلبات الطوارئ المحلولة فقط', 400, 'INVALID_STATUS');
      }

      nurseId = emergency.nurseId?.toString() || null;
      if (!nurseId) {
        return createErrorResponse('لا يوجد ممرض مُعيَّن لهذا الطلب', 400, 'NO_NURSE');
      }

      // Build service name from emergency type
      const typeLabels: Record<string, string> = {
        medical: 'طبية عامة',
        injury: 'إصابة',
        breathing: 'صعوبة تنفس',
        cardiac: 'أزمة قلبية',
        fall: 'سقوط',
        other: 'أخرى',
      };
      serviceName = `طوارئ - ${typeLabels[emergency.type] || emergency.type}`;
    } else {
      // Verify service request exists and belongs to user
      const order = await ServiceRequest.findOne({ _id: requestId, beneficiaryId: user.userId });
      if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

      if (order.status !== 'completed') {
        return createErrorResponse('يمكن تقييم الطلبات المكتملة فقط', 400, 'INVALID_STATUS');
      }

      nurseId = order.nurseId?.toString() || null;
      if (!nurseId) {
        return createErrorResponse('لا يوجد ممرض مُعيَّن لهذا الطلب', 400, 'NO_NURSE');
      }
    }

    // Check if already rated
    const existingRating = await Rating.findOne({ requestId });
    if (existingRating) {
      return createErrorResponse('تم تقييم هذا الطلب بالفعل', 409, 'ALREADY_RATED');
    }

    // Create rating
    const rating = await Rating.create({
      requestId,
      ratingType: isEmergencyRating ? 'emergency' : 'service',
      fromUserId: user.userId,
      toUserId: nurseId,
      fromRole: 'beneficiary',
      toRole: 'nurse',
      score,
      comment,
      tags: tags || [],
      isAnonymous: isAnonymous || false,
    });

    // Update nurse rating
    const nurseRatings = await Rating.find({ toUserId: nurseId });
    const totalScore = nurseRatings.reduce((sum: number, r: any) => sum + r.score, 0);
    const avgRating = nurseRatings.length > 0 ? totalScore / nurseRatings.length : 0;

    await Nurse.findByIdAndUpdate(nurseId, {
      rating: Math.round(avgRating * 10) / 10,
      reviewCount: nurseRatings.length,
    });

    // Notify nurse
    try {
      await Notification.create({
        userId: nurseId,
        userRole: 'nurse',
        titleAr: 'تقييم جديد',
        bodyAr: `حصلت على تقييم ${score} من 5${comment ? `: "${comment.substring(0, 50)}"` : ''}${isEmergencyRating ? ' (حالة طوارئ)' : ''}`,
        type: 'rating',
        priority: 'medium',
        actionUrl: '/nurse/ratings',
        data: { ratingId: rating._id.toString(), score: String(score), ratingType: isEmergencyRating ? 'emergency' : 'service', voiceAlert: true, voiceText: `حصلت على تقييم ${score} من 5${isEmergencyRating ? ' لحالة طوارئ' : ''}` },
        voiceEnabled: true,
      });

      // Send push notification to nurse about new rating
      sendPushToUser(nurseId, {
        title: 'تقييم جديد',
        body: `حصلت على تقييم ${score} من 5${isEmergencyRating ? ' لحالة طوارئ' : ''}`,
        type: 'rating',
        priority: 'medium',
        url: '/nurse/ratings',
        userRole: 'nurse',
        data: { ratingId: rating._id.toString(), score: String(score), voiceAlert: true, voiceText: `حصلت على تقييم ${score} من 5${isEmergencyRating ? ' لحالة طوارئ' : ''}` },
      }).catch(() => {});
    } catch {
      // Non-critical
    }

    return Response.json({
      success: true,
      data: { ...rating.toObject(), id: rating._id.toString() },
      message: 'تم إرسال التقييم بنجاح',
    }, { status: 201 });
  } catch (error) {
    console.error('[BENEFICIARY RATING CREATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إرسال التقييم', 500, 'INTERNAL_ERROR');
  }
}
