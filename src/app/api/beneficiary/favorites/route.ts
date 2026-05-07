// GET /api/beneficiary/favorites - List favorite nurses
// POST /api/beneficiary/favorites - Add favorite nurse
// DELETE /api/beneficiary/favorites - Remove favorite nurse

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireRole, successResponse, handleApiError, validateRequired,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(request, 'beneficiary');

    const favorites = await db.favoriteNurse.findMany({
      where: { beneficiaryId: user.userId },
      include: {
        nurse: {
          select: {
            id: true, name: true, phone: true, rating: true, reviewCount: true,
            specialization: true, governorate: true, isAvailable: true, isOnline: true,
            completedJobs: true, experience: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return successResponse(favorites);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, 'beneficiary');

    const body = await request.json();
    const validationError = validateRequired(body, ['nurseId']);
    if (validationError) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: validationError }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const nurse = await db.nurse.findUnique({ where: { id: body.nurseId } });
    if (!nurse) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الممرض' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Check if already favorited
    const existing = await db.favoriteNurse.findUnique({
      where: {
        beneficiaryId_nurseId: { beneficiaryId: user.userId, nurseId: body.nurseId },
      },
    });

    if (existing) {
      return new Response(JSON.stringify({ success: false, error: 'ALREADY_EXISTS', message: 'الممرض مضاف بالفعل للمفضلة' }), { status: 409, headers: { 'Content-Type': 'application/json' } });
    }

    const favorite = await db.favoriteNurse.create({
      data: {
        beneficiaryId: user.userId,
        nurseId: body.nurseId,
      },
    });

    return successResponse(favorite, 'تم إضافة الممرض للمفضلة', 201);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireRole(request, 'beneficiary');

    const url = new URL(request.url);
    const nurseId = url.searchParams.get('nurseId');

    if (!nurseId) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: 'معرف الممرض مطلوب' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const favorite = await db.favoriteNurse.findUnique({
      where: {
        beneficiaryId_nurseId: { beneficiaryId: user.userId, nurseId },
      },
    });

    if (!favorite) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'الممرض غير موجود في المفضلة' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    await db.favoriteNurse.delete({
      where: { id: favorite.id },
    });

    return successResponse(null, 'تم إزالة الممرض من المفضلة');
  } catch (error) {
    return handleApiError(error);
  }
}
