// GET/PATCH/DELETE /api/admin/subadmins/[id] - Get/update/delete sub-admin
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models/mongoose';
import { hashPassword, verifyPassword, createErrorResponse } from '@/lib/auth';
import { requireRole } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const { id } = await params;
    const subadmin = await User.findOne({ _id: id, role: 'subadmin' }).select('-password').lean();
    if (!subadmin) return createErrorResponse('المشرف غير موجود', 404, 'NOT_FOUND');

    return Response.json({ success: true, data: serializeDoc(subadmin) });
  } catch (error) {
    console.error('[ADMIN SUBADMIN DETAIL ERROR]', error);
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
    delete body.role; // Cannot change role

    // If password is being updated, hash it
    if (body.password) {
      body.password = await hashPassword(body.password);
    } else {
      delete body.password;
    }

    const subadmin = await User.findOneAndUpdate({ _id: id, role: 'subadmin' }, body, { new: true }).select('-password').lean();
    if (!subadmin) return createErrorResponse('المشرف غير موجود', 404, 'NOT_FOUND');

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'update_subadmin',
      entity: 'User',
      entityId: id,
      details: 'تحديث بيانات المشرف',
      request,
    });

    return Response.json({ success: true, data: serializeDoc(subadmin), message: 'تم تحديث بيانات المشرف بنجاح' });
  } catch (error) {
    console.error('[ADMIN SUBADMIN UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحديث', 500, 'INTERNAL_ERROR');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    // Verify admin password before allowing deletion
    const body = await request.json();
    const { adminPassword } = body;
    if (!adminPassword) {
      return createErrorResponse('يرجى إدخال كلمة مرور المدير', 400, 'MISSING_PASSWORD');
    }

    const adminUser = await User.findOne({ role: 'admin' }).select('+password').lean();
    if (!adminUser) {
      return createErrorResponse('لم يتم العثور على حساب المدير', 404, 'ADMIN_NOT_FOUND');
    }

    const isPasswordValid = await verifyPassword(adminPassword, adminUser.password);
    if (!isPasswordValid) {
      return createErrorResponse('كلمة مرور المدير غير صحيحة', 401, 'INVALID_PASSWORD');
    }

    const { id } = await params;
    const subadmin = await User.findOneAndDelete({ _id: id, role: 'subadmin' }).lean();
    if (!subadmin) return createErrorResponse('المشرف غير موجود', 404, 'NOT_FOUND');

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'delete_subadmin',
      entity: 'User',
      entityId: id,
      details: 'حذف المشرف',
      request,
    });

    return Response.json({ success: true, message: 'تم حذف المشرف بنجاح' });
  } catch (error) {
    console.error('[ADMIN SUBADMIN DELETE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء الحذف', 500, 'INTERNAL_ERROR');
  }
}
