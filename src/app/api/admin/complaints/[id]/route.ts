// PATCH /api/admin/complaints/[id] - Update complaint (respond, change status)
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Complaint } from '@/models/mongoose';
import { requireSubadminPermission, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';
import { emitRealtimeEvent } from '@/lib/notifications/emit-realtime-event';
import { serializeDoc } from '@/lib/mongoose/serialize';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_chat');
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    const updateData: any = {};

    // Update status
    if (body.status) {
      updateData.status = body.status;
      if (body.status === 'resolved' || body.status === 'dismissed') {
        updateData.resolvedBy = user!.userId;
        updateData.resolvedAt = new Date();
      }
    }

    // Update resolution
    if (body.resolution !== undefined) {
      updateData.resolution = body.resolution;
    }

    // Update admin notes
    if (body.adminNotes !== undefined) {
      updateData.adminNotes = body.adminNotes;
    }

    // Update priority
    if (body.priority) {
      updateData.priority = body.priority;
    }

    const complaint = await Complaint.findByIdAndUpdate(
      id,
      updateData,
      { new: true }
    ).lean();

    if (!complaint) return createErrorResponse('الشكوى غير موجودة', 404, 'NOT_FOUND');

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'update_complaint',
      entity: 'Complaint',
      entityId: id,
      details: `تحديث الشكوى: ${body.status ? `الحالة=${body.status}` : ''} ${body.resolution ? `الحل=${body.resolution}` : ''}`,
      request,
    });

    // ═══ EMIT REAL-TIME EVENT ═══
    try {
      const beneficiaryId = (complaint as any).fromUserId?.toString() || '';
      await emitRealtimeEvent.complaintChanged(
        id,
        beneficiaryId,
        body.status || 'updated',
        { changedBy: user!.userId, changedByRole: user!.role }
      );
    } catch {
      // Non-critical — socket server may be down
    }

    return Response.json({
      success: true,
      data: serializeDoc(complaint),
      message: 'تم تحديث الشكوى بنجاح',
    });
  } catch (error) {
    console.error('[ADMIN COMPLAINT UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تحديث الشكوى', 500, 'INTERNAL_ERROR');
  }
}
