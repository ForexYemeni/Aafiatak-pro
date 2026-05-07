// GET /api/nurse/ratings - Get nurse ratings
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Rating, Nurse } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const [nurse, ratings, total] = await Promise.all([
      Nurse.findById(user.userId).select('rating reviewCount completedJobs').lean(),
      Rating.find({ toUserId: user.userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Rating.countDocuments({ toUserId: user.userId }),
    ]);

    return Response.json({
      success: true,
      data: {
        summary: {
          averageRating: nurse?.rating || 0,
          reviewCount: nurse?.reviewCount || 0,
          completedJobs: nurse?.completedJobs || 0,
        },
        ratings: ratings.map((r: any) => ({ ...r, id: r._id.toString() })),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[NURSE RATINGS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب التقييمات', 500, 'INTERNAL_ERROR');
  }
}
