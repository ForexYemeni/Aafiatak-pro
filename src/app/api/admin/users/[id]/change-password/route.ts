import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models/mongoose';
import { requireSubadminPermission, createErrorResponse } from '@/lib/auth/middleware';
import { hashPassword } from '@/lib/auth';
import { logActivity } from '@/lib/api/helpers';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { user, error: authError } = requireSubadminPermission(request, 'manage_nurses');
    if (authError) return authError;

    const { id } = await params;
    const { newPassword } = await request.json();

    if (!newPassword || newPassword.length < 6) {
      return createErrorResponse('كلمة المرور يجب أن تكون ٦ أحرف على الأقل', 400, 'INVALID_PASSWORD');
    }

    if (newPassword.length > 128) {
      return createErrorResponse('كلمة المرور طويلة جداً', 400, 'PASSWORD_TOO_LONG');
    }

    const targetUser = await User.findById(id);
    if (!targetUser) {
      return createErrorResponse('المستخدم غير موجود', 404, 'NOT_FOUND');
    }

    const hashedPassword = await hashPassword(newPassword);
    targetUser.password = hashedPassword;
    await targetUser.save();

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
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
