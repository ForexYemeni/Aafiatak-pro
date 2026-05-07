// POST /api/upload - Upload image/file

import { NextRequest } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import path from 'path';
import {
  requireAuth, successResponse, handleApiError, errorResponse,
} from '@/lib/api/helpers';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return errorResponse('لم يتم اختيار ملف', 400, 'VALIDATION_ERROR');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024;
    if (file.size > maxSize) {
      return errorResponse('حجم الملف يتجاوز الحد المسموح (5 ميجابايت)', 400, 'FILE_TOO_LARGE');
    }

    // Validate file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!allowedTypes.includes(file.type)) {
      return errorResponse('نوع الملف غير مدعوم', 400, 'INVALID_FILE_TYPE');
    }

    // Generate unique filename
    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    const ext = path.extname(file.name) || '.' + file.type.split('/')[1];
    const filename = `${user.userId}-${Date.now()}${ext}`;

    // Ensure upload directory exists
    const uploadDir = path.join(process.cwd(), 'public', 'uploads');
    await mkdir(uploadDir, { recursive: true });

    const filePath = path.join(uploadDir, filename);
    await writeFile(filePath, buffer);

    const fileUrl = `/uploads/${filename}`;

    return successResponse({
      url: fileUrl,
      filename,
      size: file.size,
      type: file.type,
    }, 'تم رفع الملف بنجاح', 201);
  } catch (error) {
    return handleApiError(error);
  }
}
