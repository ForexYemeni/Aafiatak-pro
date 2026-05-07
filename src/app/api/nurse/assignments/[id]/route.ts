// GET /api/nurse/assignments/[id] - Get assignment details
// PATCH /api/nurse/assignments/[id] - Accept/reject assignment

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
    const user = await requireRole(request, 'nurse');
    const { id } = await params;

    const assignment = await db.serviceAssignment.findUnique({
      where: { id },
      include: {
        request: {
          include: {
            service: true,
            beneficiary: { select: { id: true, name: true, phone: true, governorate: true, address: true } },
          },
        },
      },
    });

    if (!assignment || assignment.nurseId !== user.userId) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على المهمة' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    return successResponse(assignment);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'nurse');
    const { id } = await params;

    const assignment = await db.serviceAssignment.findUnique({
      where: { id },
      include: { request: true },
    });

    if (!assignment || assignment.nurseId !== user.userId) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على المهمة' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    if (assignment.status !== 'pending') {
      return new Response(JSON.stringify({ success: false, error: 'INVALID_STATUS', message: 'لا يمكن تعديل مهمة تم الرد عليها بالفعل' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    const newStatus = body.status as string; // 'accepted' or 'rejected'

    if (!['accepted', 'rejected'].includes(newStatus)) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: 'الحالة يجب أن تكون "accepted" أو "rejected"' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const updated = await db.$transaction(async (tx) => {
      const updatedAssignment = await tx.serviceAssignment.update({
        where: { id },
        data: {
          status: newStatus,
          respondedAt: new Date(),
          rejectedReason: newStatus === 'rejected' ? (body.rejectedReason ?? null) : null,
        },
      });

      if (newStatus === 'accepted') {
        await tx.serviceRequest.update({
          where: { id: assignment.requestId },
          data: { status: 'accepted' },
        });
      } else {
        // If rejected, make the order pending again for reassignment
        await tx.serviceRequest.update({
          where: { id: assignment.requestId },
          data: { nurseId: null, status: 'pending' },
        });
      }

      return updatedAssignment;
    });

    await logActivity({
      userId: user.userId,
      userRole: 'nurse',
      action: newStatus === 'accepted' ? 'accept_assignment' : 'reject_assignment',
      entity: 'ServiceAssignment',
      entityId: id,
      details: newStatus === 'accepted' ? 'تم قبول المهمة' : `تم رفض المهمة: ${body.rejectedReason ?? ''}`,
      request,
    });

    return successResponse(updated, newStatus === 'accepted' ? 'تم قبول المهمة بنجاح' : 'تم رفض المهمة');
  } catch (error) {
    return handleApiError(error);
  }
}
