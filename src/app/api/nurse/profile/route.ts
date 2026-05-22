// GET/PATCH /api/nurse/profile - Get/update nurse profile
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { emitRealtimeEvent } from '@/lib/notifications/emit-realtime-event';
import { serializeDoc } from '@/lib/mongoose/serialize';
import bcrypt from 'bcryptjs';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    // Include document data for profile display (needed to show uploaded images)
    const nurse = await Nurse.findById(user.userId)
      .select('-password')
      .lean();

    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    // CRITICAL: Use serializeDoc to prevent React Error #300
    // Raw Mongoose docs contain ObjectId, Date objects, and nested sub-documents
    // that crash React when rendered in JSX
    return Response.json({ success: true, data: serializeDoc(nurse) });
  } catch (error) {
    console.error('[NURSE PROFILE GET ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const body = await request.json();

    // Handle password change separately
    if (body.currentPassword && body.password) {
      const nurse = await Nurse.findById(user.userId);
      if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

      const isValid = await bcrypt.compare(body.currentPassword, nurse.password);
      if (!isValid) {
        return createErrorResponse('كلمة المرور الحالية غير صحيحة', 400, 'INVALID_PASSWORD');
      }

      const hashedPassword = await bcrypt.hash(body.password, 12);
      await Nurse.findByIdAndUpdate(user.userId, { password: hashedPassword });

      return Response.json({
        success: true,
        message: 'تم تغيير كلمة المرور بنجاح',
      });
    }

    // Regular profile update - strip protected fields
    delete body.password;
    delete body.currentPassword;
    delete body._id;
    delete body.role;
    delete body.verificationStatus;
    delete body.phone;
    delete body.identityDocumentData;
    delete body.licenseDocumentData;

    const nurse = await Nurse.findByIdAndUpdate(user.userId, body, { new: true })
      .select('-password -identityDocumentData -licenseDocumentData')
      .lean();

    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    // ═══ EMIT REAL-TIME EVENT (profile update path) ═══
    try {
      await emitRealtimeEvent.userChanged(
        { userId: user.userId, role: 'nurse', action: 'updated' },
        { changedBy: user.userId, changedByRole: 'nurse' }
      );
    } catch {
      // Non-critical — socket server may be down
    }

    return Response.json({
      success: true,
      data: serializeDoc(nurse),
      message: 'تم تحديث الملف الشخصي بنجاح',
    });
  } catch (error) {
    console.error('[NURSE PROFILE UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحديث', 500, 'INTERNAL_ERROR');
  }
}
