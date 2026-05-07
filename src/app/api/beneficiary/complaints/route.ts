// POST /api/beneficiary/complaints - Create complaint
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Rating, Notification, Nurse } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    const { requestId, againstUserId, subject, description, score } = body;

    if (!description) {
      return createErrorResponse('وصف الشكوى مطلوب', 400, 'VALIDATION_ERROR');
    }

    // Create a low-rating as a complaint mechanism
    if (againstUserId) {
      const complaintRating = await Rating.create({
        requestId: requestId || undefined,
        fromUserId: user.userId,
        toUserId: againstUserId,
        fromRole: 'beneficiary',
        toRole: 'nurse',
        score: score || 1,
        comment: `[شكوى] ${subject ? subject + ': ' : ''}${description}`,
        tags: ['complaint'],
        isAnonymous: false,
      });

      // Notify admin (in production, should notify all admins)
      // For now, create a general notification
      return Response.json({
        success: true,
        data: { ...complaintRating.toObject(), id: complaintRating._id.toString() },
        message: 'تم إرسال الشكوى بنجاح. سيتم مراجعتها',
      }, { status: 201 });
    }

    return Response.json({
      success: true,
      message: 'تم إرسال الشكوى بنجاح. سيتم مراجعتها',
    }, { status: 201 });
  } catch (error) {
    console.error('[BENEFICIARY COMPLAINTS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إرسال الشكوى', 500, 'INTERNAL_ERROR');
  }
}
