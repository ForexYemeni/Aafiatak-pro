// GET /api/admin/subadmins - List sub-admins
// POST /api/admin/subadmins - Create sub-admin

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import {
  requireRole, successResponse, paginatedResponse, handleApiError,
  parsePagination, paginate, logActivity, validateRequired, safeJsonParse,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, 'admin');

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);
    const search = url.searchParams.get('search') ?? '';

    const where: Record<string, unknown> = {};
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { phone: { contains: search } },
      ];
    }

    const [subAdmins, total] = await Promise.all([
      db.subAdmin.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true, name: true, phone: true, email: true, permissions: true,
          isActive: true, adminId: true, lastLoginAt: true, createdAt: true, updatedAt: true,
        },
      }),
      db.subAdmin.count({ where }),
    ]);

    const parsed = subAdmins.map((sa) => ({
      ...sa,
      permissions: safeJsonParse<string[]>(sa.permissions, []),
    }));

    const pagination = paginate({ page, limit, total });
    return paginatedResponse(parsed, pagination);
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

    const existingPhone = await db.subAdmin.findUnique({ where: { phone: body.phone } })
      ?? await db.admin.findUnique({ where: { phone: body.phone } })
      ?? await db.nurse.findUnique({ where: { phone: body.phone } })
      ?? await db.beneficiary.findUnique({ where: { phone: body.phone } });

    if (existingPhone) {
      return new Response(JSON.stringify({ success: false, error: 'CONFLICT', message: 'رقم الهاتف مستخدم بالفعل' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    const hashedPassword = await hashPassword(body.password);

    const subAdmin = await db.subAdmin.create({
      data: {
        name: body.name,
        phone: body.phone,
        password: hashedPassword,
        email: body.email ?? null,
        permissions: JSON.stringify(body.permissions ?? []),
        adminId: user.userId,
        isActive: true,
      },
    });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'create_subadmin',
      entity: 'SubAdmin',
      entityId: subAdmin.id,
      details: `تم إنشاء مشرف فرعي جديد: ${subAdmin.name}`,
      request,
    });

    const { password: _, ...data } = subAdmin;
    return successResponse({ ...data, permissions: safeJsonParse<string[]>(subAdmin.permissions, []) }, 'تم إنشاء المشرف الفرعي بنجاح', 201);
  } catch (error) {
    return handleApiError(error);
  }
}
