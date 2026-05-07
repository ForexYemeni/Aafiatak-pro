// POST /api/nurse/documents - Upload nurse documents
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    const { documentType, documentUrl } = body;

    if (!documentType || !documentUrl) {
      return createErrorResponse('نوع المستند ورابط المستند مطلوبان', 400, 'VALIDATION_ERROR');
    }

    const update: any = {};
    if (documentType === 'identity') {
      update.identityDocumentUrl = documentUrl;
    } else if (documentType === 'license') {
      update.licenseDocumentUrl = documentUrl;
    } else {
      return createErrorResponse('نوع المستند غير صالح', 400, 'VALIDATION_ERROR');
    }

    const nurse = await Nurse.findByIdAndUpdate(user.userId, update, { new: true })
      .select('identityDocumentUrl licenseDocumentUrl verificationStatus')
      .lean();

    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    return Response.json({
      success: true,
      data: { ...nurse, id: nurse._id.toString() },
      message: 'تم رفع المستند بنجاح',
    });
  } catch (error) {
    console.error('[NURSE DOCUMENTS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء رفع المستند', 500, 'INTERNAL_ERROR');
  }
}
