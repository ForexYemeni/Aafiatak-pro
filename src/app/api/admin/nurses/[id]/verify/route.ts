// POST /api/admin/nurses/[id]/verify - Verify or reject a nurse
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse, Notification } from '@/models/mongoose';
import { requireSubadminPermission, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_nurses');
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    // Accept both 'status' and 'verificationStatus' field names
    const status = body.status || body.verificationStatus;
    const rejectedReason = body.rejectedReason;

    if (!status || !['verified', 'rejected'].includes(status)) {
      return createErrorResponse('حالة التوثيق غير صالحة. يجب أن تكون verified أو rejected', 400, 'VALIDATION_ERROR');
    }

    const update: any = { verificationStatus: status };
    if (status === 'rejected') {
      update.rejectedReason = rejectedReason || '';
    } else {
      // Clear rejection reason when verified
      update.rejectedReason = '';
    }

    // Exclude heavy document data from response for speed
    const nurse = await Nurse.findByIdAndUpdate(id, update, { new: true })
      .select('-password -identityDocumentData -licenseDocumentData')
      .lean();
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

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return POST(request, { params });
}
