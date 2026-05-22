// GET/POST /api/admin/coupons - List/Create coupons
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Coupon } from '@/models/mongoose';
import { requireSubadminPermission, requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';
import { emitToAdmins } from '@/lib/notifications/socket-client';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_payments');
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const activeOnly = searchParams.get('active') === 'true';
    const search = searchParams.get('search');

    const filter: any = {};
    if (activeOnly) filter.isActive = true;
    if (search) {
      filter.code = { $regex: search, $options: 'i' };
    }

    const [coupons, total] = await Promise.all([
      Coupon.find(filter).sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      Coupon.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: {
        coupons: coupons.map((c: any) => (serializeDoc(c))),
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

    // Only pick fields that exist in the schema
    const couponData: any = {
      code: body.code.toUpperCase(),
      discountPercent: Number(body.discountPercent),
      maxUses: Number(body.maxUses) || 100,
      minOrderAmount: Number(body.minOrderAmount) || 0,
      maxDiscountAmount: body.maxDiscountAmount ? Number(body.maxDiscountAmount) : undefined,
      expiresAt: new Date(body.expiresAt),
      isActive: body.isActive !== false,
      createdById: user!.userId,
    };

    const coupon = await Coupon.create(couponData);

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'create_coupon',
      entity: 'Coupon',
      entityId: coupon._id.toString(),
      details: `إنشاء كوبون: ${coupon.code}`,
      request,
    });

    emitToAdmins('data_change', { entity: 'coupon', entityId: coupon._id.toString(), action: 'created', timestamp: new Date().toISOString() }).catch(() => {});

    return Response.json({
      success: true,
      data: serializeDoc(coupon.toObject()),
      message: 'تم إنشاء الكوبون بنجاح',
    }, { status: 201 });
  } catch (error) {
    console.error('[ADMIN COUPONS CREATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إنشاء الكوبون', 500, 'INTERNAL_ERROR');
  }
}
