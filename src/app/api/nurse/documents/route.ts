// POST /api/nurse/documents - Upload nurse documents (ID + License)
// Supports both JSON (with URL) and FormData (with file) uploads
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const contentType = request.headers.get('content-type') || '';
    let documentType = '';
    let documentUrl = '';

    if (contentType.includes('multipart/form-data')) {
      // Handle FormData upload
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      documentType = formData.get('type') as string || '';

      if (!file || !documentType) {
        return createErrorResponse('الملف ونوع المستند مطلوبان', 400, 'VALIDATION_ERROR');
      }

      // Validate file
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return createErrorResponse('حجم الملف يجب أن يكون أقل من 10 ميجابايت', 400, 'FILE_TOO_LARGE');
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
      if (!allowedTypes.includes(file.type)) {
        return createErrorResponse('نوع الملف غير مدعوم. يُسمح بصور وملفات PDF فقط', 400, 'INVALID_FILE_TYPE');
      }

      // Save file
      const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'nurse', user.userId);
      await mkdir(uploadDir, { recursive: true });

      const ext = path.extname(file.name) || '.jpg';
      const filename = `${documentType}-${Date.now()}${ext}`;
      const filepath = path.join(uploadDir, filename);

      const buffer = Buffer.from(await file.arrayBuffer());
      await writeFile(filepath, buffer);

      documentUrl = `/uploads/nurse/${user.userId}/${filename}`;
    } else {
      // Handle JSON upload (with URL)
      const body = await request.json();
      documentType = body.documentType || body.type;
      documentUrl = body.documentUrl;

      if (!documentType || !documentUrl) {
        return createErrorResponse('نوع المستند ورابط المستند مطلوبان', 400, 'VALIDATION_ERROR');
      }
    }

    const update: any = {};
    if (documentType === 'identity') {
      update.identityDocumentUrl = documentUrl;
    } else if (documentType === 'license') {
      update.licenseDocumentUrl = documentUrl;
    } else {
      return createErrorResponse('نوع المستند غير صالح. يجب أن يكون identity أو license', 400, 'VALIDATION_ERROR');
    }

    const nurse = await Nurse.findByIdAndUpdate(user.userId, update, { new: true })
      .select('identityDocumentUrl licenseDocumentUrl verificationStatus name')
      .lean();

    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    // Check if both documents are uploaded - if so, set verification to pending
    const bothUploaded = (nurse.identityDocumentUrl && nurse.licenseDocumentUrl);
    if (bothUploaded && nurse.verificationStatus !== 'verified') {
      await Nurse.findByIdAndUpdate(user.userId, { verificationStatus: 'pending' });
    }

    return Response.json({
      success: true,
      data: { ...nurse, id: nurse._id.toString(), bothUploaded },
      message: 'تم رفع المستند بنجاح',
    });
  } catch (error) {
    console.error('[NURSE DOCUMENTS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء رفع المستند', 500, 'INTERNAL_ERROR');
  }
}
