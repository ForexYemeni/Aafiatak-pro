// GET /api/beneficiary/services - List available services

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireRole, paginatedResponse, handleApiError,
  parsePagination, paginate, safeJsonParse,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, 'beneficiary');

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);
    const category = url.searchParams.get('category') ?? '';
    const search = url.searchParams.get('search') ?? '';
    const isEmergency = url.searchParams.get('isEmergency');

    const where: Record<string, unknown> = { isActive: true };
    if (category) where.category = category;
    if (isEmergency !== null && isEmergency !== '') where.isEmergency = isEmergency === 'true';
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

    const parsed = services.map((s) => ({
      ...s,
      requirements: safeJsonParse<string[]>(s.requirements, []),
      includedItems: safeJsonParse<string[]>(s.includedItems, []),
    }));

    const pagination = paginate({ page, limit, total });
    return paginatedResponse(parsed, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}
