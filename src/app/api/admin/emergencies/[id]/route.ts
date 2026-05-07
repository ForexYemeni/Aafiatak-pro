// GET /api/admin/emergencies/[id] - Get emergency details
// PATCH /api/admin/emergencies/[id] - Update emergency status

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireRole, successResponse, handleApiError, logActivity,
} from '@/lib/api/helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(request, 'admin', 'subadmin');
    const { id } = await params;

    const emergency = await db.emergencyRequest.findUnique({
      where: { id },
      include: {
        beneficiary: { select: { id: true, name: true, phone: true } },
        nurse: { select: { id: true, name: true, phone: true, rating: true } },
        assignments: {
          include: { nurse: { select: { id: true, name: true, phone: true } } },
        },
        transactions: true,
      },
    });

    if (!emergency) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الطلب الطارئ' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    return successResponse(emergency);
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

    const emergency = await db.emergencyRequest.findUnique({ where: { id } });
    if (!emergency) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الطلب الطارئ' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.status) {
      const validStatuses = ['pending', 'dispatched', 'in_progress', 'resolved', 'cancelled'];
      if (!validStatuses.includes(body.status)) {
        return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: 'حالة الطوارئ غير صالحة' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      updateData.status = body.status;

      if (body.status === 'dispatched') updateData.dispatchedAt = new Date();
      if (body.status === 'in_progress') updateData.arrivedAt = new Date();
      if (body.status === 'resolved') updateData.resolvedAt = new Date();
      if (body.status === 'cancelled') {
        updateData.cancelledAt = new Date();
        updateData.cancelReason = body.cancelReason ?? null;
      }
    }

    if (body.nurseId !== undefined) updateData.nurseId = body.nurseId;
    if (body.priority) updateData.priority = body.priority;
    if (body.notes !== undefined) updateData.notes = body.notes;
    if (body.feedbackRating !== undefined) updateData.feedbackRating = body.feedbackRating;

    const updated = await db.emergencyRequest.update({
      where: { id },
      data: updateData,
    });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'update_emergency',
      entity: 'EmergencyRequest',
      entityId: id,
      details: `تم تحديث حالة الطوارئ ${id} إلى ${body.status ?? emergency.status}`,
      request,
    });

    return successResponse(updated, 'تم تحديث حالة الطوارئ بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}
