// POST /api/admin/restore
// ═══════════════════════════════════════════════════════════════════════
// Restore platform from a backup ZIP file.
// Accepts multipart/form-data with:
//   - file: the backup ZIP file
//   - password: admin password for confirmation
//   - mode: 'replace' (default) or 'merge'
//   - skipCollections: comma-separated list of collections to skip
// ═══════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { verifyPassword } from '@/lib/auth';

// ── Deserialize MongoDB extended JSON ─────────────────────────────────────
function deserializeDoc(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(deserializeDoc);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    // Recurse into regular objects
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = deserializeDoc(v);
    }
    return out;
  }
  return value;
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    // ── Parse multipart form data ───────────────────────────────────────
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const password = formData.get('password') as string | null;
    const mode = (formData.get('mode') as string) || 'replace';
    const skipCollectionsStr = (formData.get('skipCollections') as string) || '';
    const skipCollections = skipCollectionsStr ? skipCollectionsStr.split(',').map(s => s.trim()) : [];

    if (!file) {
      return createErrorResponse('ملف النسخة الاحتياطية مطلوب', 400, 'VALIDATION_ERROR');
    }

    if (!password) {
      return createErrorResponse('كلمة المرور مطلوبة للتأكيد', 400, 'VALIDATION_ERROR');
    }

    if (!['replace', 'merge'].includes(mode)) {
      return createErrorResponse('وضع الاستعادة يجب أن يكون replace أو merge', 400, 'VALIDATION_ERROR');
    }

    // ── Verify admin password ───────────────────────────────────────────
    await connectDB();
    const { User } = await import('@/models/mongoose/User');
    const currentAdmin = await User.findOne({ role: 'admin', _id: user!.userId }).lean();
    if (!currentAdmin) return createErrorResponse('حساب الإدارة غير موجود', 404, 'ADMIN_NOT_FOUND');

    const isPasswordValid = await verifyPassword(password, (currentAdmin as any).password);
    if (!isPasswordValid) return createErrorResponse('كلمة المرور غير صحيحة', 401, 'INVALID_PASSWORD');

    // ── Parse ZIP file ──────────────────────────────────────────────────
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(buffer);

    // ── Find database files in ZIP ──────────────────────────────────────
    const dbFiles: string[] = [];
    zip.forEach((relativePath, zipEntry) => {
      if (!zipEntry.dir && relativePath.includes('/database/') && relativePath.endsWith('.json') && !relativePath.includes('_summary')) {
        dbFiles.push(relativePath);
      }
    });

    if (dbFiles.length === 0) {
      return createErrorResponse('لم يتم العثور على ملفات قاعدة البيانات في النسخة الاحتياطية', 400, 'INVALID_BACKUP');
    }

    // ── Read meta.json if available ─────────────────────────────────────
    let backupMeta: Record<string, unknown> | null = null;
    const metaEntry = zip.file('meta.json');
    if (metaEntry) {
      try {
        backupMeta = JSON.parse(await metaEntry.async('string'));
      } catch {}
    }

    // ── Connect to MongoDB ──────────────────────────────────────────────
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    if (!db) return createErrorResponse('لا يوجد اتصال بقاعدة البيانات', 500, 'DB_ERROR');

    // ── Restore collections ─────────────────────────────────────────────
    let totalRestored = 0;
    let totalErrors = 0;
    const results: { collection: string; count: number; status: string; error?: string }[] = [];

    for (const filePath of dbFiles) {
      const entry = zip.file(filePath);
      if (!entry) continue;

      try {
        const content = await entry.async('string');
        const data = JSON.parse(content);

        if (!data.collection || !Array.isArray(data.documents)) continue;

        const colName = data.collection as string;
        const docCount = (data.documents as unknown[]).length;

        // Skip if in skip list
        if (skipCollections.includes(colName)) {
          results.push({ collection: colName, count: docCount, status: 'skipped' });
          continue;
        }

        // Deserialize documents
        const docs = data.documents.map(deserializeDoc);

        if (mode === 'replace') {
          // Delete all then insert
          await db.collection(colName).deleteMany({});
        }

        if (docs.length > 0) {
          if (mode === 'merge') {
            // Upsert by _id
            for (const doc of docs) {
              const d = doc as Record<string, unknown>;
              if (d._id) {
                await db.collection(colName).replaceOne(
                  { _id: d._id },
                  d,
                  { upsert: true }
                );
              } else {
                await db.collection(colName).insertOne(d);
              }
            }
          } else {
            // Insert in batches
            const batchSize = 500;
            for (let i = 0; i < docs.length; i += batchSize) {
              const batch = docs.slice(i, i + batchSize);
              await db.collection(colName).insertMany(batch, { ordered: false });
            }
          }
        }

        totalRestored += docCount;
        results.push({ collection: colName, count: docCount, status: 'ok' });
      } catch (err) {
        totalErrors++;
        const errMsg = err instanceof Error ? err.message : 'Unknown error';
        results.push({ collection: filePath, count: 0, status: 'error', error: errMsg });
      }
    }

    // ── Recreate indexes ────────────────────────────────────────────────
    try {
      await db.collection('users').createIndex({ phone: 1 }, { unique: true, sparse: true });
      await db.collection('users').createIndex({ role: 1 });
      await db.collection('services').createIndex({ category: 1 });
      await db.collection('services').createIndex({ isActive: 1 });
      await db.collection('servicerequests').createIndex({ beneficiaryId: 1 });
      await db.collection('servicerequests').createIndex({ nurseId: 1 });
      await db.collection('servicerequests').createIndex({ status: 1 });
      await db.collection('notifications').createIndex({ userId: 1, read: 1 });
      await db.collection('chats').createIndex({ participants: 1 });
      await db.collection('chatmessages').createIndex({ chatId: 1, createdAt: 1 });
      await db.collection('fcmtokens').createIndex({ userId: 1, isActive: 1 });
      await db.collection('transactions').createIndex({ beneficiaryId: 1 });
      await db.collection('transactions').createIndex({ nurseId: 1 });
    } catch {}

    // ── Log activity ────────────────────────────────────────────────────
    const now = new Date();
    try {
      await db.collection('activitylogs').insertOne({
        userId: user!.userId,
        userRole: 'admin',
        action: 'restore_backup',
        entity: 'Database',
        details: `استعادة من نسخة احتياطية — ${totalRestored} وثيقة، ${results.length} مجموعة، وضع: ${mode === 'replace' ? 'استبدال' : 'دمج'}، أخطاء: ${totalErrors}${backupMeta ? `، تاريخ النسخة: ${backupMeta.exportedAt || 'غير محدد'}` : ''}`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        createdAt: now,
        updatedAt: now,
      });
    } catch {}

    // ── Return result ───────────────────────────────────────────────────
    return Response.json({
      success: true,
      message: `تمت الاستعادة بنجاح — ${totalRestored} وثيقة في ${results.filter(r => r.status === 'ok').length} مجموعة`,
      data: {
        mode,
        totalRestored,
        totalErrors,
        backupDate: backupMeta?.exportedAt || null,
        backupVersion: backupMeta?.version || null,
        results,
      },
    });

  } catch (err) {
    console.error('[RESTORE ERROR]', err);
    return createErrorResponse('حدث خطأ أثناء استعادة النسخة الاحتياطية', 500, 'INTERNAL_ERROR');
  }
}
