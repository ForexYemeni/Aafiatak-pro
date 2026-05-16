// GET /api/nurse/schedule - Get nurse schedule
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const { searchParams } = new URL(request.url);
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const filter: any = {
      nurseId: user.userId,
      status: { $in: ['assigned', 'accepted', 'in_progress', 'completed'] },
    };

    if (dateFrom || dateTo) {
      filter.scheduledAt = {};
      if (dateFrom) filter.scheduledAt.$gte = new Date(dateFrom);
      if (dateTo) filter.scheduledAt.$lte = new Date(dateTo);
    } else {
      // Default: upcoming 7 days
      const now = new Date();
      const weekFromNow = new Date(now);
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      filter.scheduledAt = { $gte: now, $lte: weekFromNow };
    }

    const schedule = await ServiceRequest.find(filter)
      .sort({ scheduledAt: 1 })
      .limit(50)
      .lean();

    return Response.json({
      success: true,
      data: schedule.map((s: any) => (serializeDoc(s))),
    });
  } catch (error) {
    console.error('[NURSE SCHEDULE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب الجدول', 500, 'INTERNAL_ERROR');
  }
}
