// GET /api/admin/nurses/[id]/documents - Get nurse documents (identity + license)
// Separate endpoint to avoid loading heavy base64 data in main nurse detail
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { id } = await params;
    const nurse = await Nurse.findById(id)
      .select('identityDocumentData licenseDocumentData identityDocumentUrl licenseDocumentUrl verificationStatus name')
      .lean();

    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    return Response.json({
      success: true,
      data: {
        identityDocumentData: nurse.identityDocumentData || null,
        licenseDocumentData: nurse.licenseDocumentData || null,
        identityDocumentUrl: nurse.identityDocumentUrl || null,
        licenseDocumentUrl: nurse.licenseDocumentUrl || null,
        verificationStatus: nurse.verificationStatus,
      },
    });
  } catch (error) {
    console.error('[ADMIN NURSE DOCUMENTS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب المستندات', 500, 'INTERNAL_ERROR');
  }
}
