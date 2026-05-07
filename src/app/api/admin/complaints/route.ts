// GET /api/admin/complaints - List complaints
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Rating } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';

// Since there's no dedicated Complaint mongoose model, we use Rating with low scores as complaints proxy
// In production, a Complaint model should be added

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    // Using ratings with comments as complaints proxy
    const filter: any = { comment: { $exists: true, $ne: '' } };

    const [complaints, total] = await Promise.all([
      Rating.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Rating.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: {
        complaints: complaints.map((c: any) => ({ ...c, id: c._id.toString() })),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[ADMIN COMPLAINTS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جبل الشكاوى', 500, 'INTERNAL_ERROR');
  }
}
