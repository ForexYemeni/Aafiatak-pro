// GET/PATCH /api/subadmin/profile - Sub-admin own profile management
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { logActivity } from '@/lib/api/helpers';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    // Only subadmins and admins can use this endpoint
    if (user.role !== 'subadmin' && user.role !== 'admin') {
      return createErrorResponse('هذا المسار مخصص للمديرين فقط', 403, 'FORBIDDEN');
    }

    const dbUser = await User.findById(user.userId).select('-password').lean();
    if (!dbUser) return createErrorResponse('المستخدم غير موجود', 404, 'NOT_FOUND');

    return Response.json({
      success: true,
      data: serializeDoc(dbUser),
    });
  } catch (error) {
    console.error('[SUBADMIN PROFILE GET ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب البيانات', 500, 'INTERNAL_ERROR');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    // Only subadmins and admins can use this endpoint
    if (user.role !== 'subadmin' && user.role !== 'admin') {
      return createErrorResponse('هذا المسار مخصص للمديرين فقط', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    const { email, phone, currentPassword, newPassword, lat, lng, governorate, district, address } = body;

    const updateData: any = {};

    // Update email
    if (email !== undefined) {
      // Check if email is already taken by another user
      const existingEmail = await User.findOne({ email, _id: { $ne: user.userId } });
      if (existingEmail) {
        return createErrorResponse('البريد الإلكتروني مستخدم بالفعل', 409, 'DUPLICATE_EMAIL');
      }
      updateData.email = email;
    }

    // Update phone
    if (phone !== undefined) {
      // Check if phone is already taken by another user
      const existingPhone = await User.findOne({ phone, _id: { $ne: user.userId } });
      if (existingPhone) {
        return createErrorResponse('رقم الهاتف مستخدم بالفعل', 409, 'DUPLICATE_PHONE');
      }
      updateData.phone = phone;
    }

    // Update password
    if (currentPassword && newPassword) {
      // Verify current password
      const dbUser = await User.findById(user.userId).select('password').lean();
      if (!dbUser) return createErrorResponse('المستخدم غير موجود', 404, 'NOT_FOUND');

      const isPasswordValid = await verifyPassword(currentPassword, dbUser.password);
      if (!isPasswordValid) {
        return createErrorResponse('كلمة المرور الحالية غير صحيحة', 400, 'INVALID_PASSWORD');
      }

      if (newPassword.length < 6) {
        return createErrorResponse('كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل', 400, 'VALIDATION_ERROR');
      }

      updateData.password = await hashPassword(newPassword);
    }

    // Update location
    if (lat !== undefined && lng !== undefined) {
      updateData.lat = lat;
      updateData.lng = lng;
    }
    if (governorate !== undefined) updateData.governorate = governorate;
    if (district !== undefined) updateData.district = district;
    if (address !== undefined) updateData.address = address;

    if (Object.keys(updateData).length === 0) {
      return createErrorResponse('لم يتم توفير بيانات للتحديث', 400, 'NO_DATA');
    }

    const updated = await User.findByIdAndUpdate(user.userId, updateData, { new: true })
      .select('-password')
      .lean();

    if (!updated) return createErrorResponse('المستخدم غير موجود', 404, 'NOT_FOUND');

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'update_own_profile',
      entity: 'User',
      entityId: user.userId,
      details: 'تحديث بيانات الملف الشخصي',
      request,
    });

    return Response.json({
      success: true,
      data: serializeDoc(updated),
      message: 'تم تحديث البيانات بنجاح',
    });
  } catch (error) {
    console.error('[SUBADMIN PROFILE UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحديث', 500, 'INTERNAL_ERROR');
  }
}
