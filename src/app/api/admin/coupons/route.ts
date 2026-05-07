// GET /api/admin/coupons - List coupons
// POST /api/admin/coupons - Create coupon

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireRole, successResponse, paginatedResponse, handleApiError,
  parsePagination, paginate, logActivity, validateRequired, safeJsonParse,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, 'admin', 'subadmin');

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);
    const isActive = url.searchParams.get('isActive');
    const search = url.searchParams.get('search') ?? '';

    const where: Record<string, unknown> = {};
    if (isActive !== null && isActive !== '') where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { code: { contains: search } },
      ];
    }

    const [coupons, total] = await Promise.all([
      db.coupon.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.coupon.count({ where }),
    ]);

    const parsed = coupons.map((c) => ({
      ...c,
      applicableCategories: safeJsonParse<string[]>(c.applicableCategories, []),
    }));

    const pagination = paginate({ page, limit, total });
    return paginatedResponse(parsed, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, 'admin');

    const body = await request.json();
    const validationError = validateRequired(body, ['code', 'discountPercent', 'expiresAt']);
    if (validationError) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: validationError }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const existing = await db.coupon.findUnique({ where: { code: body.code } });
    if (existing) {
      return new Response(JSON.stringify({ success: false, error: 'CONFLICT', message: 'كود الخصم مستخدم بالفعل' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    const coupon = await db.coupon.create({
      data: {
        code: body.code,
        discountPercent: body.discountPercent,
        maxUses: body.maxUses ?? 100,
        minOrderAmount: body.minOrderAmount ?? 0,
        maxDiscountAmount: body.maxDiscountAmount ?? null,
        expiresAt: new Date(body.expiresAt),
        isActive: body.isActive ?? true,
        createdById: user.userId,
        applicableCategories: JSON.stringify(body.applicableCategories ?? []),
      },
    });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'create_coupon',
      entity: 'Coupon',
      entityId: coupon.id,
      details: `تم إنشاء كوبون خصم: ${coupon.code}`,
      request,
    });

    return successResponse({
      ...coupon,
      applicableCategories: safeJsonParse<string[]>(coupon.applicableCategories, []),
    }, 'تم إنشاء كوبون الخصم بنجاح', 201);
  } catch (error) {
    return handleApiError(error);
  }
}
