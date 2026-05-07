// GET /api/nurse/ratings - Received ratings

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireRole, paginatedResponse, handleApiError,
  parsePagination, paginate, safeJsonParse,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(request, 'nurse');

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);

    const [ratings, total] = await Promise.all([
      db.rating.findMany({
        where: { toUserId: user.userId, toRole: 'nurse' },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          serviceRequest: {
            select: { id: true, status: true, service: { select: { nameAr: true, nameEn: true } } },
          },
        },
      }),
      db.rating.count({ where: { toUserId: user.userId, toRole: 'nurse' } }),
    ]);

    const parsed = ratings.map((r) => ({
      ...r,
      tags: safeJsonParse<string[]>(r.tags, []),
    }));

    const pagination = paginate({ page, limit, total });
    return paginatedResponse(parsed, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}
