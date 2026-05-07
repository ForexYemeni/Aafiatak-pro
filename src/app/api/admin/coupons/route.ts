// GET/POST /api/admin/coupons - List/Create coupons
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Coupon } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const activeOnly = searchParams.get('active') === 'true';

    const filter: any = {};
    if (activeOnly) filter.isActive = true;

    const [coupons, total] = await Promise.all([
      Coupon.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Coupon.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: {
        coupons: coupons.map((c: any) => ({ ...c, id: c._id.toString() })),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[ADMIN COUPONS LIST ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب الكوبونات', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const body = await request.json();

    if (!body.code || !body.discountPercent || !body.expiresAt) {
      return createErrorResponse('رمز الكوبون ونسبة الخصم وتاريخ الانتهاء مطلوبون', 400, 'VALIDATION_ERROR');
    }

    // Check if code already exists
    const existing = await Coupon.findOne({ code: body.code.toUpperCase() });
    if (existing) {
      return createErrorResponse('رمز الكوبون موجود بالفعل', 409, 'CODE_EXISTS');
    }

    const coupon = await Coupon.create({
      ...body,
      code: body.code.toUpperCase(),
      createdById: user!.userId,
    });

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'create_coupon',
      entity: 'Coupon',
      entityId: coupon._id.toString(),
      details: `إنشاء كوبون: ${coupon.code}`,
      request,
    });

    return Response.json({
      success: true,
      data: { ...coupon.toObject(), id: coupon._id.toString() },
      message: 'تم إنشاء الكوبون بنجاح',
    }, { status: 201 });
  } catch (error) {
    console.error('[ADMIN COUPONS CREATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إنشاء الكوبون', 500, 'INTERNAL_ERROR');
  }
}
