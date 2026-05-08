// PATCH /api/admin/withdrawals/[id] - Approve/reject withdrawal request
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { WithdrawalRequest, Nurse } from '@/models/mongoose';
import { requireSubadminPermission, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_nurses');
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    const { status, adminNotes, rejectedReason } = body;

    if (!['approved', 'rejected', 'processed'].includes(status)) {
      return createErrorResponse('حالة غير صالحة', 400, 'VALIDATION_ERROR');
    }

    const withdrawal = await WithdrawalRequest.findById(id);
    if (!withdrawal) {
      return createErrorResponse('طلب السحب غير موجود', 404, 'NOT_FOUND');
    }

    if (withdrawal.status !== 'pending') {
      return createErrorResponse('تم معالجة هذا الطلب بالفعل', 400, 'ALREADY_PROCESSED');
    }

    // If rejected, return the amount to nurse's available balance
    if (status === 'rejected') {
      const nurse = await Nurse.findById(withdrawal.nurseId);
      if (nurse) {
        nurse.availableBalance += withdrawal.amount;
        await nurse.save();
      }
    }

    // Update withdrawal request
    withdrawal.status = status;
    withdrawal.processedBy = user!.userId;
    withdrawal.processedAt = new Date();
    if (adminNotes) withdrawal.adminNotes = adminNotes;
    if (status === 'rejected' && rejectedReason) {
      withdrawal.rejectedReason = rejectedReason;
    }
    await withdrawal.save();

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: status === 'rejected' ? 'reject_withdrawal' : 'approve_withdrawal',
      entity: 'WithdrawalRequest',
      entityId: id,
      details: `${status === 'rejected' ? 'رفض' : 'موافقة على'} طلب سحب ${withdrawal.amount} ريال للممرض ${withdrawal.nurseName}`,
      request,
    });

    return Response.json({
      success: true,
      data: {
        id: withdrawal._id.toString(),
        status: withdrawal.status,
        processedAt: withdrawal.processedAt.toISOString(),
      },
      message: status === 'rejected' ? 'تم رفض طلب السحب وإرجاع المبلغ للممرض' : 'تم الموافقة على طلب السحب بنجاح',
    });
  } catch (error) {
    console.error('[ADMIN WITHDRAWAL UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء معالجة طلب السحب', 500, 'INTERNAL_ERROR');
  }
}
