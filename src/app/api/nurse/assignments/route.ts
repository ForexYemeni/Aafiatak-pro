// GET /api/nurse/assignments - List assigned tasks

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireRole, paginatedResponse, handleApiError,
  parsePagination, paginate,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(request, 'nurse');

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);
    const status = url.searchParams.get('status') ?? '';

    const where: Record<string, unknown> = { nurseId: user.userId };
    if (status) where.status = status;

    const [assignments, total] = await Promise.all([
      db.serviceAssignment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { assignedAt: 'desc' },
        include: {
          request: {
            include: {
              service: { select: { id: true, nameAr: true, nameEn: true, category: true, basePrice: true, duration: true } },
              beneficiary: { select: { id: true, name: true, phone: true } },
            },
          },
        },
      }),
      db.serviceAssignment.count({ where }),
    ]);

    const pagination = paginate({ page, limit, total });
    return paginatedResponse(assignments, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}
