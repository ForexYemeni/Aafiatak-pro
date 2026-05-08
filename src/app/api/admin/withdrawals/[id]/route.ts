// PATCH /api/admin/withdrawals/[id] - Approve/reject withdrawal request
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { WithdrawalRequest, Nurse } from '@/models/mongoose';
import { requireSubadminPermission, createErrorResponse } from '@/lib/auth/middleware';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const authResult = await requireSubadminPermission(request, 'manage_nurses');
    if (authResult.error) return authResult.error;
    const user = authResult.user;

    const { id } = await params;

    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return createErrorResponse('معرف طلب السحب غير صالح', 400, 'INVALID_ID');
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return createErrorResponse('بيانات الطلب غير صالحة', 400, 'INVALID_BODY');
    }

    const { status, adminNotes, rejectedReason } = body;

    if (!status || !['approved', 'rejected', 'processed'].includes(status)) {
      return createErrorResponse('حالة غير صالحة. يجب أن تكون: approved أو rejected أو processed', 400, 'VALIDATION_ERROR');
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
      try {
        const nurse = await Nurse.findById(withdrawal.nurseId);
        if (nurse) {
          nurse.availableBalance = (nurse.availableBalance || 0) + (withdrawal.amount || 0);
          await nurse.save();
        }
      } catch (nurseError) {
        console.error('[WITHDRAWAL REJECT - NURSE UPDATE ERROR]', nurseError);
        // Continue with the rejection even if nurse update fails
      }
    }

    // Update withdrawal request
    try {
      withdrawal.status = status;
      withdrawal.processedBy = new mongoose.Types.ObjectId(user.userId);
      withdrawal.processedAt = new Date();
      if (adminNotes) withdrawal.adminNotes = adminNotes;
      if (status === 'rejected' && rejectedReason) {
        withdrawal.rejectedReason = rejectedReason;
      }
      await withdrawal.save();
    } catch (saveError) {
      console.error('[WITHDRAWAL SAVE ERROR]', saveError);
      return createErrorResponse('حدث خطأ أثناء حفظ تحديث طلب السحب', 500, 'SAVE_ERROR');
    }

    return Response.json({
      success: true,
      data: {
        id: withdrawal._id.toString(),
        status: withdrawal.status,
        processedAt: withdrawal.processedAt.toISOString(),
      },
      message: status === 'rejected'
        ? 'تم رفض طلب السحب وإرجاع المبلغ للممرض'
        : 'تم الموافقة على طلب السحب وتحويل الأموال بنجاح',
    });
  } catch (error) {
    console.error('[ADMIN WITHDRAWAL UPDATE ERROR]', error);
    return createErrorResponse(
      `حدث خطأ أثناء معالجة طلب السحب: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`,
      500,
      'INTERNAL_ERROR'
    );
  }
}
