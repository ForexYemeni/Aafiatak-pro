// GET /api/admin/nurses/[id] - Get nurse details
// PATCH /api/admin/nurses/[id] - Update nurse
// DELETE /api/admin/nurses/[id] - Delete (deactivate) nurse

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
    await requireRole(request, 'admin', 'subadmin');
    const { id } = await params;

    const nurse = await db.nurse.findUnique({
      where: { id },
      include: {
        serviceAssignments: { take: 10, orderBy: { assignedAt: 'desc' } },
        emergencyAssignments: { take: 10, orderBy: { assignedAt: 'desc' } },
        documents: true,
        nursePayouts: { take: 5, orderBy: { createdAt: 'desc' } },
      },
    });

    if (!nurse) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الممرض' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const { password: _, ...nurseData } = nurse;
    return successResponse({
      ...nurseData,
      specialization: safeJsonParse<string[]>(nurse.specialization, []),
      availableServices: safeJsonParse<string[]>(nurse.availableServices, []),
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
    const user = await requireRole(request, 'admin', 'subadmin');
    const { id } = await params;

    const nurse = await db.nurse.findUnique({ where: { id } });
    if (!nurse) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الممرض' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    const allowedFields = [
      'name', 'governorate', 'district', 'city', 'bio', 'nationalId',
      'experience', 'isActive', 'isAvailable', 'walletType', 'walletNumber',
      'bankAccount', 'verificationStatus', 'rejectedReason',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (body.specialization !== undefined) {
      updateData.specialization = JSON.stringify(body.specialization);
    }
    if (body.availableServices !== undefined) {
      updateData.availableServices = JSON.stringify(body.availableServices);
    }
    if (body.password) {
      updateData.password = await hashPassword(body.password);
    }
    if (body.licenseNumber !== undefined) {
      updateData.licenseNumber = body.licenseNumber;
    }

    const updatedNurse = await db.nurse.update({
      where: { id },
      data: updateData,
    });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'update_nurse',
      entity: 'Nurse',
      entityId: id,
      details: `تم تحديث بيانات الممرض: ${updatedNurse.name}`,
      request,
    });

    const { password: _, ...nurseData } = updatedNurse;
    return successResponse({ ...nurseData, specialization: safeJsonParse<string[]>(updatedNurse.specialization, []) }, 'تم تحديث بيانات الممرض بنجاح');
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

    const nurse = await db.nurse.findUnique({ where: { id } });
    if (!nurse) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الممرض' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    await db.nurse.update({ where: { id }, data: { isActive: false } });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'delete_nurse',
      entity: 'Nurse',
      entityId: id,
      details: `تم تعطيل الممرض: ${nurse.name}`,
      request,
    });

    return successResponse(null, 'تم تعطيل الممرض بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}
