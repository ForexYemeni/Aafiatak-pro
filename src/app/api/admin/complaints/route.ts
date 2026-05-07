// GET /api/admin/complaints - List complaints

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireRole, paginatedResponse, handleApiError,
  parsePagination, paginate, safeJsonParse,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, 'admin', 'subadmin');

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);
    const status = url.searchParams.get('status') ?? '';
    const priority = url.searchParams.get('priority') ?? '';
    const fromUserId = url.searchParams.get('fromUserId') ?? '';
    const againstUserId = url.searchParams.get('againstUserId') ?? '';

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (fromUserId) where.fromUserId = fromUserId;
    if (againstUserId) where.againstUserId = againstUserId;

    const [complaints, total] = await Promise.all([
      db.complaint.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.complaint.count({ where }),
    ]);

    const parsed = complaints.map((c) => ({
      ...c,
      attachments: safeJsonParse<string[]>(c.attachments, []),
    }));

    const pagination = paginate({ page, limit, total });
    return paginatedResponse(parsed, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}
