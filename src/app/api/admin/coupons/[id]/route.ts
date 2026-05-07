// GET/PATCH/DELETE /api/admin/coupons/[id] - Get/update/delete coupon
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Coupon } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { id } = await params;
    const coupon = await Coupon.findById(id).lean();
    if (!coupon) return createErrorResponse('الكوبون غير موجود', 404, 'NOT_FOUND');

    return Response.json({ success: true, data: { ...coupon, id: coupon._id.toString() } });
  } catch (error) {
    console.error('[ADMIN COUPON DETAIL ERROR]', error);
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

    const coupon = await Coupon.findByIdAndUpdate(id, body, { new: true }).lean();
    if (!coupon) return createErrorResponse('الكوبون غير موجود', 404, 'NOT_FOUND');

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'update_coupon',
      entity: 'Coupon',
      entityId: id,
      details: 'تحديث بيانات الكوبون',
      request,
    });

    return Response.json({ success: true, data: { ...coupon, id: coupon._id.toString() }, message: 'تم تحديث الكوبون بنجاح' });
  } catch (error) {
    console.error('[ADMIN COUPON UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحديث', 500, 'INTERNAL_ERROR');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const { id } = await params;
    const coupon = await Coupon.findByIdAndDelete(id).lean();
    if (!coupon) return createErrorResponse('الكوبون غير موجود', 404, 'NOT_FOUND');

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'delete_coupon',
      entity: 'Coupon',
      entityId: id,
      details: 'حذف الكوبون',
      request,
    });

    return Response.json({ success: true, message: 'تم حذف الكوبون بنجاح' });
  } catch (error) {
    console.error('[ADMIN COUPON DELETE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء الحذف', 500, 'INTERNAL_ERROR');
  }
}
