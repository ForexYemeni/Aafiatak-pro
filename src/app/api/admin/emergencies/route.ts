// GET /api/admin/emergencies - List emergency requests
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { EmergencyRequest } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');

    const filter: any = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const [emergencies, total] = await Promise.all([
      EmergencyRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      EmergencyRequest.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: {
        emergencies: emergencies.map((e: any) => ({ ...e, id: e._id.toString() })),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[ADMIN EMERGENCIES ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب طلبات الطوارئ', 500, 'INTERNAL_ERROR');
  }
}
