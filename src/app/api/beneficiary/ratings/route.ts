// POST /api/beneficiary/ratings - Rate service/nurse

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireRole, successResponse, handleApiError, validateRequired, logActivity,
} from '@/lib/api/helpers';

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, 'beneficiary');

    const body = await request.json();
    const validationError = validateRequired(body, ['requestId', 'score']);
    if (validationError) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: validationError }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (body.score < 1 || body.score > 5) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: 'التقييم يجب أن يكون بين 1 و 5' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const serviceRequest = await db.serviceRequest.findUnique({
      where: { id: body.requestId },
    });

    if (!serviceRequest) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الطلب' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    if (serviceRequest.beneficiaryId !== user.userId) {
      return new Response(JSON.stringify({ success: false, error: 'FORBIDDEN', message: 'لا يمكنك تقييم هذا الطلب' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    if (serviceRequest.status !== 'completed') {
      return new Response(JSON.stringify({ success: false, error: 'INVALID_STATUS', message: 'لا يمكن تقييم طلب غير مكتمل' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    if (!serviceRequest.nurseId) {
      return new Response(JSON.stringify({ success: false, error: 'NO_NURSE', message: 'لا يوجد ممرض مرتبط بهذا الطلب' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Check if already rated
    const existingRating = await db.rating.findUnique({
      where: { requestId: body.requestId },
    });

    if (existingRating) {
      return new Response(JSON.stringify({ success: false, error: 'ALREADY_RATED', message: 'تم تقييم هذا الطلب بالفعل' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    const rating = await db.rating.create({
      data: {
        requestId: body.requestId,
        fromUserId: user.userId,
        toUserId: serviceRequest.nurseId,
        fromRole: 'beneficiary',
        toRole: 'nurse',
        score: body.score,
        comment: body.comment ?? null,
        tags: JSON.stringify(body.tags ?? []),
        isAnonymous: body.isAnonymous ?? false,
      },
    });

    // Update nurse's average rating
    const nurseRatings = await db.rating.findMany({
      where: { toUserId: serviceRequest.nurseId, toRole: 'nurse' },
      select: { score: true },
    });
    const avgRating = nurseRatings.reduce((sum, r) => sum + r.score, 0) / nurseRatings.length;

    await db.nurse.update({
      where: { id: serviceRequest.nurseId },
      data: {
        rating: Math.round(avgRating * 10) / 10,
        reviewCount: nurseRatings.length,
      },
    });

    // Award loyalty points for rating
    const settings = await db.adminSettings.findFirst();
    if (settings) {
      await db.beneficiary.update({
        where: { id: user.userId },
        data: { loyaltyPoints: { increment: 5 } },
      });
      await db.loyaltyTransaction.create({
        data: {
          beneficiaryId: user.userId,
          points: 5,
          type: 'earn',
          referenceId: rating.id,
          description: 'نقاط مكافأة للتقييم',
        },
      });
    }

    await logActivity({
      userId: user.userId,
      userRole: 'beneficiary',
      action: 'rate_service',
      entity: 'Rating',
      entityId: rating.id,
      details: `تم تقييم الخدمة بـ ${body.score}/5`,
      request,
    });

    return successResponse(rating, 'تم إرسال التقييم بنجاح', 201);
  } catch (error) {
    return handleApiError(error);
  }
}
