// GET /api/beneficiary/profile - Get beneficiary profile
// PATCH /api/beneficiary/profile - Update beneficiary profile

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/auth';
import {
  requireRole, successResponse, handleApiError,
  logActivity, safeJsonParse,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(request, 'beneficiary');

    const beneficiary = await db.beneficiary.findUnique({
      where: { id: user.userId },
    });

    if (!beneficiary) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على المستفيد' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const { password: _, ...data } = beneficiary;
    return successResponse({
      ...data,
      medicalConditions: safeJsonParse<string[]>(beneficiary.medicalConditions, []),
      allergies: safeJsonParse<string[]>(beneficiary.allergies, []),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireRole(request, 'beneficiary');

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    const allowedFields = [
      'name', 'governorate', 'district', 'city', 'address',
      'emergencyContactName', 'emergencyContactPhone', 'emergencyContactRelation',
      'gender', 'bloodType',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    if (body.medicalConditions !== undefined) {
      updateData.medicalConditions = JSON.stringify(body.medicalConditions);
    }
    if (body.allergies !== undefined) {
      updateData.allergies = JSON.stringify(body.allergies);
    }
    if (body.dateOfBirth !== undefined) {
      updateData.dateOfBirth = new Date(body.dateOfBirth);
    }

    if (body.password && body.currentPassword) {
      const beneficiary = await db.beneficiary.findUnique({ where: { id: user.userId } });
      if (!beneficiary) {
        return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على المستفيد' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
      }
      const { verifyPassword } = await import('@/lib/auth');
      const isValid = await verifyPassword(body.currentPassword, beneficiary.password);
      if (!isValid) {
        return new Response(JSON.stringify({ success: false, error: 'INVALID_PASSWORD', message: 'كلمة المرور الحالية غير صحيحة' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      updateData.password = await hashPassword(body.password);
    }

    const updated = await db.beneficiary.update({
      where: { id: user.userId },
      data: updateData,
    });

    await logActivity({
      userId: user.userId,
      userRole: 'beneficiary',
      action: 'update_profile',
      entity: 'Beneficiary',
      entityId: user.userId,
      details: 'تم تحديث الملف الشخصي',
      request,
    });

    const { password: _, ...data } = updated;
    return successResponse({
      ...data,
      medicalConditions: safeJsonParse<string[]>(updated.medicalConditions, []),
      allergies: safeJsonParse<string[]>(updated.allergies, []),
    }, 'تم تحديث الملف الشخصي بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}
