// GET /api/admin/emergencies - List emergency requests

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireRole, paginatedResponse, handleApiError,
  parsePagination, paginate,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, 'admin', 'subadmin');

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);
    const status = url.searchParams.get('status') ?? '';
    const type = url.searchParams.get('type') ?? '';
    const priority = url.searchParams.get('priority') ?? '';
    const sortBy = url.searchParams.get('sortBy') ?? 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (type) where.type = type;
    if (priority) where.priority = priority;

    const [emergencies, total] = await Promise.all([
      db.emergencyRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          beneficiary: { select: { id: true, name: true, phone: true } },
          nurse: { select: { id: true, name: true, phone: true } },
          assignments: {
            include: { nurse: { select: { id: true, name: true, phone: true } } },
          },
        },
      }),
      db.emergencyRequest.count({ where }),
    ]);

    const pagination = paginate({ page, limit, total });
    return paginatedResponse(emergencies, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}
