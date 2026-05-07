// GET /api/admin/beneficiaries/[id] - Get beneficiary details
// PATCH /api/admin/beneficiaries/[id] - Update beneficiary

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

    const beneficiary = await db.beneficiary.findUnique({
      where: { id },
      include: {
        serviceRequests: { take: 10, orderBy: { createdAt: 'desc' } },
        emergencyRequests: { take: 5, orderBy: { createdAt: 'desc' } },
        transactions: { take: 10, orderBy: { createdAt: 'desc' } },
        loyaltyTransactions: { take: 10, orderBy: { createdAt: 'desc' } },
        favorites: { include: { nurse: { select: { id: true, name: true, rating: true } } } },
      },
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

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'admin', 'subadmin');
    const { id } = await params;

    const beneficiary = await db.beneficiary.findUnique({ where: { id } });
    if (!beneficiary) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على المستفيد' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    const allowedFields = [
      'name', 'governorate', 'district', 'city', 'address', 'isActive',
      'loyaltyTier', 'emergencyContactName', 'emergencyContactPhone',
      'emergencyContactRelation', 'gender', 'bloodType',
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

    const updated = await db.beneficiary.update({
      where: { id },
      data: updateData,
    });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'update_beneficiary',
      entity: 'Beneficiary',
      entityId: id,
      details: `تم تحديث بيانات المستفيد: ${updated.name}`,
      request,
    });

    const { password: _, ...data } = updated;
    return successResponse(data, 'تم تحديث بيانات المستفيد بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}
