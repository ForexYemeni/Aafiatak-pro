// GET /api/notifications - List notifications
// PATCH /api/notifications - Mark all as read

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireAuth, successResponse, paginatedResponse, handleApiError,
  parsePagination, paginate, safeJsonParse,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);
    const unreadOnly = url.searchParams.get('unreadOnly') === 'true';
    const type = url.searchParams.get('type') ?? '';

    const where: Record<string, unknown> = { userId: user.userId };
    if (unreadOnly) where.read = false;
    if (type) where.type = type;

    const [notifications, total] = await Promise.all([
      db.notification.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.notification.count({ where }),
    ]);

    const parsed = notifications.map((n) => ({
      ...n,
      data: safeJsonParse<Record<string, string>>(n.data, {}),
    }));

    const unreadCount = await db.notification.count({
      where: { userId: user.userId, read: false },
    });

    const pagination = paginate({ page, limit, total });
    return paginatedResponse(parsed, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    await db.notification.updateMany({
      where: { userId: user.userId, read: false },
      data: { read: true },
    });

    return successResponse(null, 'تم تحديد جميع الإشعارات كمقروءة');
  } catch (error) {
    return handleApiError(error);
  }
}
