// GET /api/admin/activity-log - List activity logs

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireRole, paginatedResponse, handleApiError,
  parsePagination, paginate,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, 'admin', 'subadmin');

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);
    const action = url.searchParams.get('action') ?? '';
    const userId = url.searchParams.get('userId') ?? '';
    const userRole = url.searchParams.get('userRole') ?? '';
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');

    const where: Record<string, unknown> = {};
    if (action) where.action = { contains: action };
    if (userId) where.userId = userId;
    if (userRole) where.userRole = userRole;
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) createdAt.lte = new Date(dateTo);
      where.createdAt = createdAt;
    }

    const [logs, total] = await Promise.all([
      db.activityLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.activityLog.count({ where }),
    ]);

    const pagination = paginate({ page, limit, total });
    return paginatedResponse(logs, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}
