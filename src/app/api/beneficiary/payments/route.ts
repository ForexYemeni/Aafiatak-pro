// GET /api/beneficiary/payments - Payment history

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireRole, paginatedResponse, handleApiError,
  parsePagination, paginate,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(request, 'beneficiary');

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);
    const status = url.searchParams.get('status') ?? '';
    const paymentMethod = url.searchParams.get('paymentMethod') ?? '';

    const where: Record<string, unknown> = { beneficiaryId: user.userId };
    if (status) where.status = status;
    if (paymentMethod) where.paymentMethod = paymentMethod;

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          serviceRequest: { select: { id: true, status: true, service: { select: { nameAr: true, nameEn: true } } } },
          emergencyRequest: { select: { id: true, status: true, type: true } },
        },
      }),
      db.transaction.count({ where }),
    ]);

    const pagination = paginate({ page, limit, total });
    return paginatedResponse(transactions, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}
