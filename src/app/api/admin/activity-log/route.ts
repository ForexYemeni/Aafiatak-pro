// GET /api/admin/activity-log - List activity logs
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ActivityLog } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const action = searchParams.get('action');
    const userRole = searchParams.get('userRole');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const filter: any = {};
    if (action) filter.action = action;
    if (userRole) filter.userRole = userRole;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: {
        logs: logs.map((l: any) => ({ ...l, id: l._id.toString() })),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[ADMIN ACTIVITY LOG ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب سجل النشاط', 500, 'INTERNAL_ERROR');
  }
}
