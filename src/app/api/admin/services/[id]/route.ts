// GET /api/admin/services/[id] - Get service
// PATCH /api/admin/services/[id] - Update service
// DELETE /api/admin/services/[id] - Delete service

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireRole, successResponse, handleApiError,
  logActivity, safeJsonParse,
} from '@/lib/api/helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(request, 'admin', 'subadmin');
    const { id } = await params;

    const service = await db.service.findUnique({ where: { id } });
    if (!service) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الخدمة' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    return successResponse({
      ...service,
      requirements: safeJsonParse<string[]>(service.requirements, []),
      includedItems: safeJsonParse<string[]>(service.includedItems, []),
    });
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

    const service = await db.service.findUnique({ where: { id } });
    if (!service) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الخدمة' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    const allowedFields = [
      'nameAr', 'nameEn', 'descriptionAr', 'descriptionEn', 'basePrice',
      'category', 'duration', 'icon', 'image', 'isActive', 'isEmergency', 'sortOrder',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (body.requirements !== undefined) {
      updateData.requirements = JSON.stringify(body.requirements);
    }
    if (body.includedItems !== undefined) {
      updateData.includedItems = JSON.stringify(body.includedItems);
    }

    const updated = await db.service.update({ where: { id }, data: updateData });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'update_service',
      entity: 'Service',
      entityId: id,
      details: `تم تحديث الخدمة: ${updated.nameAr}`,
      request,
    });

    return successResponse({
      ...updated,
      requirements: safeJsonParse<string[]>(updated.requirements, []),
      includedItems: safeJsonParse<string[]>(updated.includedItems, []),
    }, 'تم تحديث الخدمة بنجاح');
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

    const service = await db.service.findUnique({ where: { id } });
    if (!service) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الخدمة' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    await db.service.update({ where: { id }, data: { isActive: false } });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'delete_service',
      entity: 'Service',
      entityId: id,
      details: `تم تعطيل الخدمة: ${service.nameAr}`,
      request,
    });

    return successResponse(null, 'تم تعطيل الخدمة بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}
