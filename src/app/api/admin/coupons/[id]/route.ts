// GET /api/admin/coupons/[id] - Get coupon
// PATCH /api/admin/coupons/[id] - Update coupon
// DELETE /api/admin/coupons/[id] - Delete coupon

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireRole, successResponse, handleApiError,
  logActivity, safeJsonParse,
} from '@/lib/api/helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireRole(request, 'admin', 'subadmin');
    const { id } = await params;

    const coupon = await db.coupon.findUnique({ where: { id } });
    if (!coupon) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على كوبون الخصم' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    return successResponse({
      ...coupon,
      applicableCategories: safeJsonParse<string[]>(coupon.applicableCategories, []),
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id } = await params;

    const coupon = await db.coupon.findUnique({ where: { id } });
    if (!coupon) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على كوبون الخصم' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    const updateData: Record<string, unknown> = {};

    const allowedFields = [
      'discountPercent', 'maxUses', 'minOrderAmount', 'maxDiscountAmount',
      'isActive',
    ];
    for (const field of allowedFields) {
      if (body[field] !== undefined) updateData[field] = body[field];
    }
    if (body.expiresAt) updateData.expiresAt = new Date(body.expiresAt);
    if (body.applicableCategories !== undefined) {
      updateData.applicableCategories = JSON.stringify(body.applicableCategories);
    }

    const updated = await db.coupon.update({ where: { id }, data: updateData });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'update_coupon',
      entity: 'Coupon',
      entityId: id,
      details: `تم تحديث كوبون الخصم: ${updated.code}`,
      request,
    });

    return successResponse({
      ...updated,
      applicableCategories: safeJsonParse<string[]>(updated.applicableCategories, []),
    }, 'تم تحديث كوبون الخصم بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'admin');
    const { id } = await params;

    const coupon = await db.coupon.findUnique({ where: { id } });
    if (!coupon) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على كوبون الخصم' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    await db.coupon.update({ where: { id }, data: { isActive: false } });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'delete_coupon',
      entity: 'Coupon',
      entityId: id,
      details: `تم تعطيل كوبون الخصم: ${coupon.code}`,
      request,
    });

    return successResponse(null, 'تم تعطيل كوبون الخصم بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}
