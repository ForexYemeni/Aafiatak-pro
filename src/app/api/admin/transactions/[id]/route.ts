// GET/PATCH /api/admin/transactions/[id] - Get/update transaction
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Transaction, Beneficiary, Nurse } from '@/models/mongoose';
import { requireSubadminPermission, requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_payments');
    if (error) return error;

    const { id } = await params;
    const transaction = await Transaction.findById(id).lean();
    if (!transaction) return createErrorResponse('المعاملة غير موجودة', 404, 'NOT_FOUND');

    // Populate names
    const [beneficiary, nurse] = await Promise.all([
      Beneficiary.findById(transaction.beneficiaryId).select('name').lean(),
      transaction.nurseId ? Nurse.findById(transaction.nurseId).select('name').lean() : null,
    ]);

    return Response.json({
      success: true,
      data: {
        ...transaction,
        id: transaction._id.toString(),
        beneficiaryName: beneficiary?.name || 'غير معروف',
        nurseName: nurse?.name || null,
      },
    });
  } catch (error) {
    console.error('[ADMIN TRANSACTION DETAIL ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_payments');
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    delete body._id;
    delete body.beneficiaryId;
    delete body.nurseId;

    const updateData: any = { ...body };
    if (body.status === 'completed') updateData.processedAt = new Date();

    const transaction = await Transaction.findByIdAndUpdate(id, updateData, { new: true }).lean();
    if (!transaction) return createErrorResponse('المعاملة غير موجودة', 404, 'NOT_FOUND');

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'update_transaction',
      entity: 'Transaction',
      entityId: id,
      details: `تحديث حالة المعاملة إلى: ${body.status || 'محدث'}`,
      request,
    });

    return Response.json({ success: true, data: { ...transaction, id: transaction._id.toString() }, message: 'تم تحديث المعاملة بنجاح' });
  } catch (error) {
    console.error('[ADMIN TRANSACTION UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحديث', 500, 'INTERNAL_ERROR');
  }
}
