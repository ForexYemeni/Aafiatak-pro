// POST /api/admin/nurses/[id]/verify - Verify or reject a nurse
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse, Notification } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const { id } = await params;
    const { status, rejectedReason } = await request.json();

    if (!['verified', 'rejected'].includes(status)) {
      return createErrorResponse('حالة التوثيق غير صالحة', 400, 'VALIDATION_ERROR');
    }

    const update: any = { verificationStatus: status };
    if (status === 'rejected' && rejectedReason) update.rejectedReason = rejectedReason;

    const nurse = await Nurse.findByIdAndUpdate(id, update, { new: true }).select('-password').lean();
    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    // Create notification for the nurse
    try {
      await Notification.create({
        userId: id,
        userRole: 'nurse',
        titleAr: status === 'verified' ? 'تم توثيق حسابك' : 'تم رفض التوثيق',
        bodyAr: status === 'verified'
          ? 'تهانينا! تم توثيق حسابك بنجاح. يمكنك الآن استقبال الطلبات'
          : `تم رفض توثيق حسابك. السبب: ${rejectedReason || 'لم يتم تحديد سبب'}`,
        type: 'system',
        priority: status === 'verified' ? 'medium' : 'high',
        data: { verificationStatus: status },
        voiceEnabled: true,
      });
    } catch {
      // Notification creation should not block the main operation
    }

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: status === 'verified' ? 'verify_nurse' : 'reject_nurse',
      entity: 'Nurse',
      entityId: id,
      details: status === 'verified' ? `توثيق الممرض: ${nurse.name}` : `رفض توثيق الممرض: ${nurse.name}`,
      request,
    });

    return Response.json({
      success: true,
      data: { ...nurse, id: nurse._id.toString() },
      message: status === 'verified' ? 'تم توثيق الممرض بنجاح' : 'تم رفض التوثيق',
    });
  } catch (error) {
    console.error('[ADMIN VERIFY NURSE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء توثيق الممرض', 500, 'INTERNAL_ERROR');
  }
}
