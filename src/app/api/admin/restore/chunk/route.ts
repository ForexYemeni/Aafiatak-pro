// POST /api/admin/restore/chunk - Upload a backup file chunk
// ═══════════════════════════════════════════════════════════════════════
// Chunked upload for large backup files that exceed Vercel's 4.5MB limit.
// The client splits the backup file into 2MB chunks and uploads them one
// by one. After all chunks are uploaded, the client calls
// POST /api/admin/restore with { uploadId } to process the complete file.
// ═══════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const body = await request.json();
    const { uploadId, chunkIndex, totalChunks, chunkData, fileName, fileSize } = body;

    if (!uploadId || chunkIndex === undefined || !totalChunks || !chunkData) {
      return createErrorResponse('بيانات الجزء غير مكتملة', 400, 'VALIDATION_ERROR');
    }

    if (totalChunks > 100) {
      return createErrorResponse('عدد الأجزاء كبير جداً (الحد الأقصى 100)', 400, 'TOO_MANY_CHUNKS');
    }

    // Store chunk in MongoDB temp collection
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    if (!db) return createErrorResponse('لا يوجد اتصال بقاعدة البيانات', 500, 'DB_ERROR');

    const tempUploads = db.collection('_temp_uploads');

    // Create upload session on first chunk
    if (chunkIndex === 0) {
      await tempUploads.updateOne(
        { uploadId, userId: user!.userId },
        {
          $set: {
            uploadId,
            userId: user!.userId,
            fileName: fileName || 'backup.zip',
            fileSize: fileSize || 0,
            totalChunks,
            createdAt: new Date(),
          },
          $setOnInsert: {
            chunks: {},
          },
        },
        { upsert: true }
      );
    }

    // Store the chunk data (base64 encoded)
    await tempUploads.updateOne(
      { uploadId, userId: user!.userId },
      {
        $set: {
          [`chunks.${chunkIndex}`]: chunkData,
          updatedAt: new Date(),
        },
      }
    );

    // Check if all chunks are received
    const uploadDoc = await tempUploads.findOne({ uploadId, userId: user!.userId });
    if (!uploadDoc) {
      return createErrorResponse('فشل في حفظ الجزء', 500, 'CHUNK_SAVE_ERROR');
    }

    const receivedChunks = Object.keys(uploadDoc.chunks || {}).length;
    const allReceived = receivedChunks === totalChunks;

    return Response.json({
      success: true,
      message: `تم استلام الجزء ${chunkIndex + 1} من ${totalChunks}`,
      data: {
        uploadId,
        chunkIndex,
        receivedChunks,
        totalChunks,
        allReceived,
      },
    });
  } catch (err) {
    console.error('[RESTORE CHUNK ERROR]', err);
    return createErrorResponse('حدث خطأ أثناء رفع الجزء', 500, 'INTERNAL_ERROR');
  }
}

// DELETE /api/admin/restore/chunk - Clean up temp upload data
export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { uploadId } = await request.json();
    if (!uploadId) {
      return createErrorResponse('معرف الرفع مطلوب', 400, 'VALIDATION_ERROR');
    }

    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    if (!db) return createErrorResponse('لا يوجد اتصال بقاعدة البيانات', 500, 'DB_ERROR');

    await db.collection('_temp_uploads').deleteOne({
      uploadId,
      userId: user!.userId,
    });

    return Response.json({
      success: true,
      message: 'تم حذف البيانات المؤقتة',
    });
  } catch (err) {
    console.error('[RESTORE CHUNK DELETE ERROR]', err);
    return createErrorResponse('حدث خطأ أثناء حذف البيانات المؤقتة', 500, 'INTERNAL_ERROR');
  }
}
