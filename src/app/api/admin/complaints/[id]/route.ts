// PATCH /api/admin/complaints/[id] - Resolve complaint

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireRole, successResponse, handleApiError, logActivity,
} from '@/lib/api/helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'admin', 'subadmin');
    const { id } = await params;

    const complaint = await db.complaint.findUnique({ where: { id } });
    if (!complaint) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الشكوى' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    if (body.status) {
      const validStatuses = ['open', 'under_review', 'resolved', 'dismissed'];
      if (!validStatuses.includes(body.status)) {
        return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: 'حالة الشكوى غير صالحة' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
      }
      updateData.status = body.status;
    }

    if (body.priority) updateData.priority = body.priority;
    if (body.resolution) {
      updateData.resolution = body.resolution;
      updateData.resolvedBy = user.userId;
      updateData.resolvedAt = new Date();
    }

    const updated = await db.complaint.update({
      where: { id },
      data: updateData,
    });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'resolve_complaint',
      entity: 'Complaint',
      entityId: id,
      details: `تم تحديث الشكوى ${id} إلى ${body.status ?? complaint.status}`,
      request,
    });

    return successResponse(updated, 'تم تحديث الشكوى بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}
