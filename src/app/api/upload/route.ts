// POST /api/upload - Upload files
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return createErrorResponse('الملف مطلوب', 400, 'VALIDATION_ERROR');
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024;
    if (file.size > maxSize) {
      return createErrorResponse('حجم الملف يجب أن يكون أقل من 10 ميجابايت', 400, 'FILE_TOO_LARGE');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return createErrorResponse('نوع الملف غير مدعوم. يُسمح بصور وملفات PDF فقط', 400, 'INVALID_FILE_TYPE');
    }

    // Create upload directory
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', user.role, user.userId);
    await mkdir(uploadDir, { recursive: true });

    // Generate unique filename
    const ext = path.extname(file.name) || '.jpg';
    const filename = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}${ext}`;
    const filepath = path.join(uploadDir, filename);

    // Write file
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    // Return public URL
    const publicUrl = `/uploads/${user.role}/${user.userId}/${filename}`;

    return Response.json({
      success: true,
      data: {
        url: publicUrl,
        filename,
        size: file.size,
        type: file.type,
      },
      message: 'تم رفع الملف بنجاح',
    }, { status: 201 });
  } catch (error) {
    console.error('[UPLOAD ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء رفع الملف', 500, 'INTERNAL_ERROR');
  }
}
