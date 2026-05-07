// GET /api/admin/orders/[id] - Get order details
// PATCH /api/admin/orders/[id] - Update order status

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

    const order = await db.serviceRequest.findUnique({
      where: { id },
      include: {
        service: true,
        beneficiary: { select: { id: true, name: true, phone: true, governorate: true } },
        nurse: { select: { id: true, name: true, phone: true, rating: true } },
        assignments: {
          include: { nurse: { select: { id: true, name: true, phone: true } } },
          orderBy: { assignedAt: 'desc' },
        },
        transactions: true,
        rating: true,
      },
    });

    if (!order) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الطلب' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    return successResponse(order);
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

    const order = await db.serviceRequest.findUnique({ where: { id } });
    if (!order) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الطلب' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.status) {
      const validStatuses = ['pending', 'assigned', 'accepted', 'in_progress', 'completed', 'cancelled', 'rejected'];
      if (!validStatuses.includes(body.status)) {
        return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: 'حالة الطلب غير صالحة' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      updateData.status = body.status;

      if (body.status === 'in_progress' && !order.startedAt) {
        updateData.startedAt = new Date();
      }
      if (body.status === 'completed') {
        updateData.completedAt = new Date();
      }
      if (body.status === 'cancelled') {
        updateData.cancelledAt = new Date();
        updateData.cancelReason = body.cancelReason ?? null;
        updateData.cancelledBy = user.userId;
      }
    }

    if (body.paymentStatus) {
      updateData.paymentStatus = body.paymentStatus;
    }
    if (body.notes !== undefined) {
      updateData.notes = body.notes;
    }

    const updated = await db.serviceRequest.update({
      where: { id },
      data: updateData,
    });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'update_order',
      entity: 'ServiceRequest',
      entityId: id,
      details: `تم تحديث حالة الطلب ${id} إلى ${body.status ?? order.status}`,
      request,
    });

    return successResponse(updated, 'تم تحديث الطلب بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}
