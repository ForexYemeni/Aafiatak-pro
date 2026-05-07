// PATCH /api/admin/nurses/[id]/verify - Verify or reject nurse

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, successResponse, handleApiError, logActivity } from '@/lib/api/helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id } = await params;

    const nurse = await db.nurse.findUnique({ where: { id } });
    if (!nurse) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الممرض' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    const status = body.status as string; // 'verified' or 'rejected'

    if (!['verified', 'rejected'].includes(status)) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: 'الحالة يجب أن تكون "verified" أو "rejected"' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const updateData: Record<string, unknown> = {
      verificationStatus: status,
    };

    if (status === 'rejected' && body.rejectedReason) {
      updateData.rejectedReason = body.rejectedReason;
    }

    const updatedNurse = await db.nurse.update({
      where: { id },
      data: updateData,
    });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: status === 'verified' ? 'verify_nurse' : 'reject_nurse',
      entity: 'Nurse',
      entityId: id,
      details: status === 'verified'
        ? `تم التحقق من الممرض: ${updatedNurse.name}`
        : `تم رفض الممرض: ${updatedNurse.name}. السبب: ${body.rejectedReason ?? 'غير محدد'}`,
      request,
    });

    return successResponse(
      { id: updatedNurse.id, verificationStatus: updatedNurse.verificationStatus, rejectedReason: updatedNurse.rejectedReason },
      status === 'verified' ? 'تم التحقق من الممرض بنجاح' : 'تم رفض الممرض'
    );
  } catch (error) {
    return handleApiError(error);
  }
}
