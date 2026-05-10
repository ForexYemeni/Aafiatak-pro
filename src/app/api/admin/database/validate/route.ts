// POST /api/admin/database/test - Test MongoDB connection URI
// Admin-only: verifies that a new MongoDB URI is valid and reachable

import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    // Only admin can test database connections
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const body = await request.json();
    const { uri } = body;

    if (!uri || typeof uri !== 'string') {
      return createErrorResponse('رابط MongoDB مطلوب', 400, 'VALIDATION_ERROR');
    }

    // Validate URI format
    if (!uri.startsWith('mongodb://') && !uri.startsWith('mongodb+srv://')) {
      return createErrorResponse('رابط MongoDB غير صالح. يجب أن يبدأ بـ mongodb:// أو mongodb+srv://', 400, 'INVALID_URI');
    }

    // Attempt connection with a short timeout
    let testConn: typeof mongoose | null = null;
    try {
      testConn = await mongoose.createConnection(uri, {
        connectTimeoutMS: 10000,
        serverSelectionTimeoutMS: 10000,
        socketTimeoutMS: 10000,
      }).asPromise();

      // Get database info
      const adminDb = testConn.db?.admin();
      let dbInfo: Record<string, unknown> = {};

      try {
        const result = await adminDb?.command({ ping: 1 });
        dbInfo.ping = result?.ok === 1 ? 'success' : 'failed';
      } catch {
        dbInfo.ping = 'partial';
      }

      // List collections
      let collections: string[] = [];
      try {
        const cols = await testConn.db?.listCollections().toArray();
        collections = cols?.map(c => c.name) || [];
      } catch {
        // Might not have listCollections permission
      }

      // Extract database name from URI
      let dbName = 'unknown';
      try {
        const urlObj = new URL(uri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'https://'));
        dbName = urlObj.pathname.substring(1) || 'unknown';
        if (dbName.includes('?')) dbName = dbName.split('?')[0];
      } catch {}

      await testConn.close();

      return Response.json({
        success: true,
        data: {
          status: 'connected',
          databaseName: dbName,
          existingCollections: collections,
          collectionsCount: collections.length,
          isEmpty: collections.length === 0,
          message: 'تم الاتصال بقاعدة البيانات بنجاح',
        },
      });
    } catch (connError: unknown) {
      if (testConn) {
        try { await testConn.close(); } catch {}
      }
      const errorMessage = connError instanceof Error ? connError.message : 'خطأ غير معروف';
      return createErrorResponse(
        `فشل الاتصال بقاعدة البيانات: ${errorMessage}`,
        400,
        'CONNECTION_FAILED'
      );
    }
  } catch (error) {
    console.error('[DB TEST ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء اختبار الاتصال', 500, 'INTERNAL_ERROR');
  }
}
