// GET /api/admin/beneficiaries - List beneficiaries with pagination & filters

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireRole, paginatedResponse, handleApiError,
  parsePagination, paginate, safeJsonParse,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, 'admin', 'subadmin');

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);
    const search = url.searchParams.get('search') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const governorate = url.searchParams.get('governorate') ?? '';
    const loyaltyTier = url.searchParams.get('loyaltyTier') ?? '';
    const sortBy = url.searchParams.get('sortBy') ?? 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { referralCode: { contains: search } },
      ];
    }
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (governorate) where.governorate = governorate;
    if (loyaltyTier) where.loyaltyTier = loyaltyTier;

    const [beneficiaries, total] = await Promise.all([
      db.beneficiary.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true, name: true, phone: true, referralCode: true,
          governorate: true, district: true, city: true, address: true,
          loyaltyPoints: true, loyaltyTier: true, totalSpent: true,
          orderCount: true, gender: true, dateOfBirth: true, isActive: true,
          createdAt: true, updatedAt: true,
        },
      }),
      db.beneficiary.count({ where }),
    ]);

    const beneficiariesParsed = beneficiaries.map((b) => ({
      ...b,
      medicalConditions: safeJsonParse<string[]>(b.medicalConditions, []),
      allergies: safeJsonParse<string[]>(b.allergies, []),
    }));

    const pagination = paginate({ page, limit, total });
    return paginatedResponse(beneficiariesParsed, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}
