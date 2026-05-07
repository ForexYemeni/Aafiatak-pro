// GET /api/admin/orders - List all orders with filters
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest } from '@/models/mongoose';
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
    const beneficiaryId = searchParams.get('beneficiaryId');
    const nurseId = searchParams.get('nurseId');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const filter: any = {};
    if (status) filter.status = status;
    if (beneficiaryId) filter.beneficiaryId = beneficiaryId;
    if (nurseId) filter.nurseId = nurseId;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    const [orders, total] = await Promise.all([
      ServiceRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ServiceRequest.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: {
        orders: orders.map((o: any) => ({ ...o, id: o._id.toString() })),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[ADMIN ORDERS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب الطلبات', 500, 'INTERNAL_ERROR');
  }
}
