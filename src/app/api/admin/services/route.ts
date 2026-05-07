// GET/POST /api/admin/services - List/Create services
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Service } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const activeOnly = searchParams.get('active') === 'true';

    const filter: any = {};
    if (category) filter.category = category;
    if (activeOnly) filter.isActive = true;

    const services = await Service.find(filter).sort({ sortOrder: 1, createdAt: -1 }).lean();

    return Response.json({
      success: true,
      data: services.map((s: any) => ({ ...s, id: s._id.toString() })),
    });
  } catch (error) {
    console.error('[ADMIN SERVICES LIST ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب الخدمات', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const body = await request.json();

    if (!body.nameAr || !body.nameEn || !body.basePrice) {
      return createErrorResponse('اسم الخدمة والسعر مطلوبان', 400, 'VALIDATION_ERROR');
    }

    const service = await Service.create(body);

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'create_service',
      entity: 'Service',
      entityId: service._id.toString(),
      details: `إنشاء خدمة جديدة: ${body.nameAr}`,
      request,
    });

    return Response.json({
      success: true,
      data: { ...service.toObject(), id: service._id.toString() },
      message: 'تم إنشاء الخدمة بنجاح',
    }, { status: 201 });
  } catch (error) {
    console.error('[ADMIN SERVICES CREATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إنشاء الخدمة', 500, 'INTERNAL_ERROR');
  }
}
