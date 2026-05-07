// POST /api/admin/orders/[id]/assign - Assign nurse to order

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireRole, successResponse, handleApiError, logActivity,
} from '@/lib/api/helpers';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'admin', 'subadmin');
    const { id } = await params;

    const order = await db.serviceRequest.findUnique({ where: { id } });
    if (!order) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الطلب' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    if (!body.nurseId) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: 'معرف الممرض مطلوب' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const nurse = await db.nurse.findUnique({ where: { id: body.nurseId } });
    if (!nurse) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الممرض' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    if (!nurse.isActive || nurse.verificationStatus !== 'verified') {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: 'الممرض غير متاح للتعيين' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    // Create assignment and update order in transaction
    const assignment = await db.$transaction(async (tx) => {
      const newAssignment = await tx.serviceAssignment.create({
        data: {
          requestId: id,
          nurseId: body.nurseId,
          status: 'pending',
          assignedBy: user.userId,
          assignedByRole: user.role,
          estimatedArrivalMinutes: body.estimatedArrivalMinutes ?? null,
        },
      });

      await tx.serviceRequest.update({
        where: { id },
        data: {
          nurseId: body.nurseId,
          status: 'assigned',
        },
      });

      return newAssignment;
    });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'assign_nurse_to_order',
      entity: 'ServiceRequest',
      entityId: id,
      details: `تم تعيين الممرض ${nurse.name} للطلب ${id}`,
      request,
    });

    return successResponse(assignment, 'تم تعيين الممرض بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}
