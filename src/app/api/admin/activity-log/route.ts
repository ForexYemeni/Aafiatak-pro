// GET /api/admin/activity-log - List activity logs with populated user names
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ActivityLog, User } from '@/models/mongoose';
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
    const search = searchParams.get('search');
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

    // If search term provided, find matching users first
    if (search) {
      const matchedUsers = await User.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search } },
        ]
      }).select('_id').lean();
      const matchedUserIds = matchedUsers.map((u: any) => u._id);
      filter.userId = { $in: matchedUserIds };
    }

    const [logs, total] = await Promise.all([
      ActivityLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ActivityLog.countDocuments(filter),
    ]);

    // Populate userName by fetching from User collection
    const userIds = [...new Set(logs.map((l: any) => l.userId?.toString()).filter(Boolean))];
    const users = await User.find({ _id: { $in: userIds } }).select('name').lean();
    const userMap = new Map(users.map((u: any) => [u._id.toString(), u.name]));

    const populatedLogs = logs.map((l: any) => ({
      ...l,
      id: l._id.toString(),
      userName: userMap.get(l.userId?.toString()) || 'مستخدم محذوف',
    }));

    return Response.json({
      success: true,
      data: {
        logs: populatedLogs,
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
