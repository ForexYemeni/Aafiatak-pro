// GET /api/admin/nurses - List nurses with pagination & filters
// POST /api/admin/nurses - Create nurse

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import {
  requireRole, successResponse, paginatedResponse, handleApiError,
  parsePagination, paginate, logActivity, validateRequired, safeJsonParse,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, 'admin', 'subadmin');

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);
    const search = url.searchParams.get('search') ?? '';
    const status = url.searchParams.get('status') ?? '';
    const verificationStatus = url.searchParams.get('verificationStatus') ?? '';
    const governorate = url.searchParams.get('governorate') ?? '';
    const sortBy = url.searchParams.get('sortBy') ?? 'createdAt';
    const sortOrder = url.searchParams.get('sortOrder') === 'asc' ? 'asc' : 'desc';

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
        { licenseNumber: { contains: search } },
      ];
    }
    if (status === 'active') where.isActive = true;
    if (status === 'inactive') where.isActive = false;
    if (verificationStatus) where.verificationStatus = verificationStatus;
    if (governorate) where.governorate = governorate;

    const [nurses, total] = await Promise.all([
      db.nurse.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true, name: true, phone: true, specialization: true,
          licenseNumber: true, verificationStatus: true, isAvailable: true,
          isOnline: true, governorate: true, district: true, city: true,
          rating: true, reviewCount: true, completedJobs: true, cancelledJobs: true,
          totalEarnings: true, isActive: true, createdAt: true, updatedAt: true,
          bio: true, experience: true, nationalId: true,
        },
      }),
      db.nurse.count({ where }),
    ]);

    const nursesWithParsed = nurses.map((n) => ({
      ...n,
      specialization: safeJsonParse<string[]>(n.specialization, []),
    }));

    const pagination = paginate({ page, limit, total });
    return paginatedResponse(nursesWithParsed, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, 'admin');

    const body = await request.json();
    const validationError = validateRequired(body, ['name', 'phone', 'password']);
    if (validationError) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: validationError }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Check phone uniqueness across all user tables
    const existingPhone = await db.nurse.findUnique({ where: { phone: body.phone } })
      ?? await db.beneficiary.findUnique({ where: { phone: body.phone } })
      ?? await db.admin.findUnique({ where: { phone: body.phone } })
      ?? await db.subAdmin.findUnique({ where: { phone: body.phone } });

    if (existingPhone) {
      return new Response(JSON.stringify({ success: false, error: 'CONFLICT', message: 'رقم الهاتف مستخدم بالفعل' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    const hashedPassword = await hashPassword(body.password);

    const nurse = await db.nurse.create({
      data: {
        name: body.name,
        phone: body.phone,
        password: hashedPassword,
        specialization: JSON.stringify(body.specialization ?? []),
        licenseNumber: body.licenseNumber ?? null,
        governorate: body.governorate ?? null,
        district: body.district ?? null,
        city: body.city ?? null,
        bio: body.bio ?? null,
        nationalId: body.nationalId ?? null,
        experience: body.experience ?? 0,
        verificationStatus: body.verificationStatus ?? 'pending',
      },
    });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'create_nurse',
      entity: 'Nurse',
      entityId: nurse.id,
      details: `تم إنشاء ممرض جديد: ${nurse.name}`,
      request,
    });

    const { password: _, ...nurseWithoutPassword } = nurse;
    return successResponse({ ...nurseWithoutPassword, specialization: safeJsonParse<string[]>(nurse.specialization, []) }, 'تم إنشاء الممرض بنجاح', 201);
  } catch (error) {
    return handleApiError(error);
  }
}
