// GET /api/admin/subadmins/[id] - Get sub-admin
// PATCH /api/admin/subadmins/[id] - Update sub-admin
// DELETE /api/admin/subadmins/[id] - Delete sub-admin

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth';
import {
  requireRole, successResponse, handleApiError,
  logActivity, safeJsonParse,
} from '@/lib/api/helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(request, 'admin');
    const { id } = await params;

    const subAdmin = await db.subAdmin.findUnique({
      where: { id },
      select: {
        id: true, name: true, phone: true, email: true, permissions: true,
        isActive: true, adminId: true, lastLoginAt: true, createdAt: true, updatedAt: true,
      },
    });

    if (!subAdmin) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على المشرف الفرعي' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    return successResponse({ ...subAdmin, permissions: safeJsonParse<string[]>(subAdmin.permissions, []) });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id } = await params;

    const subAdmin = await db.subAdmin.findUnique({ where: { id } });
    if (!subAdmin) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على المشرف الفرعي' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.name !== undefined) updateData.name = body.name;
    if (body.email !== undefined) updateData.email = body.email;
    if (body.isActive !== undefined) updateData.isActive = body.isActive;
    if (body.permissions !== undefined) updateData.permissions = JSON.stringify(body.permissions);
    if (body.password) updateData.password = await hashPassword(body.password);

    const updated = await db.subAdmin.update({
      where: { id },
      data: updateData,
    });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'update_subadmin',
      entity: 'SubAdmin',
      entityId: id,
      details: `تم تحديث المشرف الفرعي: ${updated.name}`,
      request,
    });

    const { password: _, ...data } = updated;
    return successResponse({ ...data, permissions: safeJsonParse<string[]>(updated.permissions, []) }, 'تم تحديث المشرف الفرعي بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id } = await params;

    const subAdmin = await db.subAdmin.findUnique({ where: { id } });
    if (!subAdmin) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على المشرف الفرعي' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    await db.subAdmin.update({ where: { id }, data: { isActive: false } });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'delete_subadmin',
      entity: 'SubAdmin',
      entityId: id,
      details: `تم تعطيل المشرف الفرعي: ${subAdmin.name}`,
      request,
    });

    return successResponse(null, 'تم تعطيل المشرف الفرعي بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}
