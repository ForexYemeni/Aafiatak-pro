// GET /api/admin/orders - List all service requests with filters

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
    const beneficiaryId = url.searchParams.get('beneficiaryId') ?? '';
    const nurseId = url.searchParams.get('nurseId') ?? '';
    const serviceId = url.searchParams.get('serviceId') ?? '';
    const isEmergency = url.searchParams.get('isEmergency');
    const paymentStatus = url.searchParams.get('paymentStatus') ?? '';
    const dateFrom = url.searchParams.get('dateFrom');
    const dateTo = url.searchParams.get('dateTo');
    const sortBy = url.searchParams.get('sortBy') ?? 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const where: Record<string, unknown> = {};
    if (status) where.status = status;
    if (beneficiaryId) where.beneficiaryId = beneficiaryId;
    if (nurseId) where.nurseId = nurseId;
    if (serviceId) where.serviceId = serviceId;
    if (isEmergency !== null && isEmergency !== '') where.isEmergency = isEmergency === 'true';
    if (paymentStatus) where.paymentStatus = paymentStatus;

    if (dateFrom || dateTo) {
      const createdAt: Record<string, Date> = {};
      if (dateFrom) createdAt.gte = new Date(dateFrom);
      if (dateTo) createdAt.lte = new Date(dateTo);
      where.createdAt = createdAt;
    }

    const [orders, total] = await Promise.all([
      db.serviceRequest.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        include: {
          service: { select: { id: true, nameAr: true, nameEn: true, category: true } },
          beneficiary: { select: { id: true, name: true, phone: true } },
          nurse: { select: { id: true, name: true, phone: true } },
          assignments: { take: 5, orderBy: { assignedAt: 'desc' } },
        },
      }),
      db.serviceRequest.count({ where }),
    ]);

    const pagination = paginate({ page, limit, total });
    return paginatedResponse(orders, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}
