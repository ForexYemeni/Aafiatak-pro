import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models/mongoose';
import { requireSubadminPermission, requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { hashPassword } from '@/lib/auth';
import { logActivity } from '@/lib/api/helpers';
import type { SubAdminPermission } from '@/types';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();

    // First, authenticate the user (basic auth check)
    const authResult = requireAuth(request);
    if (authResult.error) return authResult.error;

    const { id } = await params;

    // Find the target user first to determine the required permission
    const targetUser = await User.findById(id);
    if (!targetUser) {
      return createErrorResponse('المستخدم غير موجود', 404, 'NOT_FOUND');
    }

    // Determine the required permission based on the target user's role
    let requiredPermission: SubAdminPermission;
    if (targetUser.role === 'nurse') {
      requiredPermission = 'manage_nurses';
    } else if (targetUser.role === 'beneficiary') {
      requiredPermission = 'manage_beneficiaries';
    } else {
      // For other roles (admin, subadmin), only admin can change password
      if (authResult.user.role !== 'admin') {
        return createErrorResponse('ليس لديك صلاحية لتغيير كلمة مرور هذا المستخدم', 403, 'INSUFFICIENT_PERMISSIONS');
      }
      // Admin can proceed — skip subadmin permission check
      const { newPassword } = await request.json();
      if (!newPassword || newPassword.length < 6) {
        return createErrorResponse('كلمة المرور يجب أن تكون ٦ أحرف على الأقل', 400, 'INVALID_PASSWORD');
      }
      if (newPassword.length > 128) {
        return createErrorResponse('كلمة المرور طويلة جداً', 400, 'PASSWORD_TOO_LONG');
      }

      const hashedPassword = await hashPassword(newPassword);
      targetUser.password = hashedPassword;
      await targetUser.save();

      await logActivity({
        userId: authResult.user.userId,
        userRole: authResult.user.role,
        action: 'change_user_password',
        entity: 'User',
        entityId: id,
        details: `تغيير كلمة مرور المستخدم: ${targetUser.name} (${targetUser.role})`,
        request,
      });

      return Response.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
    }

    // Check subadmin permission based on target user's role
    const permResult = await requireSubadminPermission(request, requiredPermission);
    if (permResult.error) return permResult.error;

    const { newPassword } = await request.json();
    if (!newPassword || newPassword.length < 6) {
      return createErrorResponse('كلمة المرور يجب أن تكون ٦ أحرف على الأقل', 400, 'INVALID_PASSWORD');
    }

    if (newPassword.length > 128) {
      return createErrorResponse('كلمة المرور طويلة جداً', 400, 'PASSWORD_TOO_LONG');
    }

    const hashedPassword = await hashPassword(newPassword);
    targetUser.password = hashedPassword;
    await targetUser.save();

    await logActivity({
      userId: permResult.user.userId,
      userRole: permResult.user.role,
      action: 'change_user_password',
      entity: 'User',
      entityId: id,
      details: `تغيير كلمة مرور المستخدم: ${targetUser.name} (${targetUser.role})`,
      request,
    });

    return Response.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' });
  } catch (error) {
    console.error('[CHANGE PASSWORD ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تغيير كلمة المرور', 500, 'INTERNAL_ERROR');
  }
}
