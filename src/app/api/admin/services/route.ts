// GET /api/admin/services - List services
// POST /api/admin/services - Create service

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireRole, successResponse, paginatedResponse, handleApiError,
  parsePagination, paginate, logActivity, validateRequired, safeJsonParse,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, 'admin', 'subadmin');

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);
    const category = url.searchParams.get('category') ?? '';
    const isActive = url.searchParams.get('isActive');
    const search = url.searchParams.get('search') ?? '';

    const where: Record<string, unknown> = {};
    if (category) where.category = category;
    if (isActive !== null && isActive !== '') where.isActive = isActive === 'true';
    if (search) {
      where.OR = [
        { nameAr: { contains: search } },
        { nameEn: { contains: search } },
      ];
    }

    const [services, total] = await Promise.all([
      db.service.findMany({
        where,
        skip,
        take: limit,
        orderBy: { sortOrder: 'asc' },
      }),
      db.service.count({ where }),
    ]);

    const servicesParsed = services.map((s) => ({
      ...s,
      requirements: safeJsonParse<string[]>(s.requirements, []),
      includedItems: safeJsonParse<string[]>(s.includedItems, []),
    }));

    const pagination = paginate({ page, limit, total });
    return paginatedResponse(servicesParsed, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, 'admin');

    const body = await request.json();
    const validationError = validateRequired(body, ['nameAr', 'nameEn', 'basePrice', 'category']);
    if (validationError) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: validationError }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const service = await db.service.create({
      data: {
        nameAr: body.nameAr,
        nameEn: body.nameEn,
        descriptionAr: body.descriptionAr ?? null,
        descriptionEn: body.descriptionEn ?? null,
        basePrice: body.basePrice,
        category: body.category,
        duration: body.duration ?? 60,
        icon: body.icon ?? '',
        image: body.image ?? null,
        isActive: body.isActive ?? true,
        isEmergency: body.isEmergency ?? false,
        requirements: JSON.stringify(body.requirements ?? []),
        includedItems: JSON.stringify(body.includedItems ?? []),
        sortOrder: body.sortOrder ?? 0,
      },
    });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'create_service',
      entity: 'Service',
      entityId: service.id,
      details: `تم إنشاء خدمة جديدة: ${service.nameAr}`,
      request,
    });

    return successResponse({
      ...service,
      requirements: safeJsonParse<string[]>(service.requirements, []),
      includedItems: safeJsonParse<string[]>(service.includedItems, []),
    }, 'تم إنشاء الخدمة بنجاح', 201);
  } catch (error) {
    return handleApiError(error);
  }
}
