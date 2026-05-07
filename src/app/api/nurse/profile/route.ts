// GET /api/nurse/profile - Get nurse profile
// PATCH /api/nurse/profile - Update nurse profile

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import {
  requireRole, successResponse, handleApiError,
  logActivity, safeJsonParse,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(request, 'nurse');

    const nurse = await db.nurse.findUnique({
      where: { id: user.userId },
      include: {
        documents: true,
      },
    });

    if (!nurse) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الممرض' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const { password: _, ...data } = nurse;
    return successResponse({
      ...data,
      specialization: safeJsonParse<string[]>(nurse.specialization, []),
      availableServices: safeJsonParse<string[]>(nurse.availableServices, []),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireRole(request, 'nurse');

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    const allowedFields = [
      'name', 'governorate', 'district', 'city', 'bio', 'address',
      'walletType', 'walletNumber', 'bankAccount',
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
    if (body.password && body.currentPassword) {
      const nurse = await db.nurse.findUnique({ where: { id: user.userId } });
      if (!nurse) {
        return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الممرض' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      const { verifyPassword } = await import('@/lib/auth');
      const isValid = await verifyPassword(body.currentPassword, nurse.password);
      if (!isValid) {
        return new Response(JSON.stringify({ success: false, error: 'INVALID_PASSWORD', message: 'كلمة المرور الحالية غير صحيحة' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      updateData.password = await hashPassword(body.password);
    }

    const updated = await db.nurse.update({
      where: { id: user.userId },
      data: updateData,
    });

    await logActivity({
      userId: user.userId,
      userRole: 'nurse',
      action: 'update_profile',
      entity: 'Nurse',
      entityId: user.userId,
      details: 'تم تحديث الملف الشخصي',
      request,
    });

    const { password: _, ...data } = updated;
    return successResponse({
      ...data,
      specialization: safeJsonParse<string[]>(updated.specialization, []),
      availableServices: safeJsonParse<string[]>(updated.availableServices, []),
    }, 'تم تحديث الملف الشخصي بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}
