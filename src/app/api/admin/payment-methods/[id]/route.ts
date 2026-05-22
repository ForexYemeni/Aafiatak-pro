// GET/PATCH/DELETE /api/admin/payment-methods/[id] - Get/update/delete payment method
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import PaymentMethod from '@/models/PaymentMethod';
import { requireSubadminPermission, requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';
import { emitToAdmins } from '@/lib/notifications/socket-client';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_payments');
    if (error) return error;

    const { id } = await params;
    const pm = await PaymentMethod.findById(id).lean();
    if (!pm) return createErrorResponse('طريقة الدفع غير موجودة', 404, 'NOT_FOUND');

    return Response.json({ success: true, data: serializeDoc(pm) });
  } catch (error) {
    console.error('[ADMIN PAYMENT METHOD DETAIL ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const { id } = await params;
    const body = await request.json();
    delete body._id;

    // Clear irrelevant type fields
    if (body.type === 'wallet_deposit') {
      body.exchangeType = null;
    } else if (body.type === 'bank_transfer') {
      body.walletType = null;
    } else {
      body.walletType = null;
      body.exchangeType = null;
    }

    const pm = await PaymentMethod.findByIdAndUpdate(id, body, { new: true }).lean();
    if (!pm) return createErrorResponse('طريقة الدفع غير موجودة', 404, 'NOT_FOUND');

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'update_payment_method',
      entity: 'PaymentMethod',
      entityId: id,
      details: `تحديث طريقة دفع: ${pm.nameAr}`,
      request,
    });

    emitToAdmins('data_change', { entity: 'payment_method', entityId: id, action: 'updated', timestamp: new Date().toISOString() }).catch(() => {});

    return Response.json({ success: true, data: serializeDoc(pm), message: 'تم تحديث طريقة الدفع بنجاح' });
  } catch (error) {
    console.error('[ADMIN PAYMENT METHOD UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحديث', 500, 'INTERNAL_ERROR');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const { id } = await params;
    const pm = await PaymentMethod.findByIdAndDelete(id).lean();
    if (!pm) return createErrorResponse('طريقة الدفع غير موجودة', 404, 'NOT_FOUND');

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'delete_payment_method',
      entity: 'PaymentMethod',
      entityId: id,
      details: `حذف طريقة دفع: ${pm.nameAr}`,
      request,
    });

    emitToAdmins('data_change', { entity: 'payment_method', entityId: id, action: 'deleted', timestamp: new Date().toISOString() }).catch(() => {});

    return Response.json({ success: true, message: 'تم حذف طريقة الدفع بنجاح' });
  } catch (error) {
    console.error('[ADMIN PAYMENT METHOD DELETE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء الحذف', 500, 'INTERNAL_ERROR');
  }
}
