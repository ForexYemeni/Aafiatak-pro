// GET /api/nurse/assignments - Get nurse assignments
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, EmergencyRequest, Nurse } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    // Check if nurse is verified
    const nurse = await Nurse.findById(user.userId).select('verificationStatus identityDocumentUrl licenseDocumentUrl').lean();
    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    const isVerified = nurse.verificationStatus === 'verified' && nurse.identityDocumentUrl && nurse.licenseDocumentUrl;

    if (!isVerified) {
      return Response.json({
        success: true,
        data: [],
        verificationRequired: true,
        message: 'يجب توثيق حسابك أولاً برفع الهوية الوطنية ومزاولة المهنة',
      });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';

    const filter: any = { nurseId: user.userId };
    if (status === 'active') {
      filter.status = { $in: ['assigned', 'accepted', 'in_progress'] };
    } else if (status === 'completed') {
      filter.status = 'completed';
    } else if (status === 'all') {
      // No status filter
    } else {
      filter.status = status;
    }

    const assignments = await ServiceRequest.find(filter).sort({ createdAt: -1 }).limit(50).lean();

    return Response.json({
      success: true,
      data: assignments.map((a: any) => ({ ...a, id: a._id.toString() })),
    });
  } catch (error) {
    console.error('[NURSE ASSIGNMENTS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب التعيينات', 500, 'INTERNAL_ERROR');
  }
}
