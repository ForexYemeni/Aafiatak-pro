// GET /api/admin/transactions - List transactions

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
    const status = url.searchParams.get('status') ?? '';
    const paymentMethod = url.searchParams.get('paymentMethod') ?? '';
    const beneficiaryId = url.searchParams.get('beneficiaryId') ?? '';
    const nurseId = url.searchParams.get('nurseId') ?? '';
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (paymentMethod) where.paymentMethod = paymentMethod;
    if (beneficiaryId) where.beneficiaryId = beneficiaryId;
    if (nurseId) where.nurseId = nurseId;
    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) createdAt.lte = new Date(dateTo);
      where.createdAt = createdAt;
    }

    const [transactions, total] = await Promise.all([
      db.transaction.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          beneficiary: { select: { id: true, name: true, phone: true } },
          serviceRequest: { select: { id: true, status: true } },
          emergencyRequest: { select: { id: true, status: true } },
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
