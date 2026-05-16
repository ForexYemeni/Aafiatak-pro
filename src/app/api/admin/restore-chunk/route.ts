// POST /api/admin/restore-chunk
// ═══════════════════════════════════════════════════════════════════════
// Chunked backup restore — receives backup ZIP in base64 chunks,
// reassembles on the server, then processes the restore.
// This bypasses Vercel's 4.5 MB body size limit.
// ═══════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireEmergencyOrAdmin, createErrorResponse } from '@/lib/auth/middleware';
import { verifyPassword } from '@/lib/auth';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
// ── Deserialize MongoDB extended JSON ─────────────────────────────────────
function deserializeDoc(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(deserializeDoc);
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = deserializeDoc(v);
    }
    return out;
  }
  return value;
}

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

// ── In-memory chunk storage (per Vercel serverless instance) ──────────
const chunkStore = new Map<string, { chunks: string[]; totalChunks: number; receivedAt: number }>();

// Clean up old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of chunkStore) {
    if (now - entry.receivedAt > 5 * 60 * 1000) {
      chunkStore.delete(key);
    }
  }
}, 60 * 1000);

export async function POST(request: NextRequest) {
  try {
    const { user, error, isEmergency } = requireEmergencyOrAdmin(request, ['admin']);
    if (error) return error;

    const body = await request.json();
    const { action, uploadId, chunkIndex, totalChunks, data, password, mode: rawMode } = body;

    // ── ACTION 1: Upload a chunk ─────────────────────────────────────
    if (action === 'upload-chunk') {
      if (!uploadId || chunkIndex === undefined || !totalChunks || !data) {
        return createErrorResponse('بيانات الجزء غير مكتملة', 400, 'VALIDATION_ERROR');
      }

      if (!chunkStore.has(uploadId)) {
        chunkStore.set(uploadId, { chunks: [], totalChunks, receivedAt: Date.now() });
      }

      const entry = chunkStore.get(uploadId)!;
      entry.chunks[chunkIndex] = data;

      return Response.json({
        success: true,
        message: `تم استلام الجزء ${chunkIndex + 1} من ${totalChunks}`,
        data: { chunkIndex, received: entry.chunks.filter(Boolean).length, total: totalChunks },
      });
    }

    // ── ACTION 2: Complete the restore ────────────────────────────────
    if (action === 'complete-restore') {
      if (!uploadId) {
        return createErrorResponse('معرف الرفع مطلوب', 400, 'VALIDATION_ERROR');
      }

      const mode = rawMode || 'replace';
      if (!['replace', 'merge'].includes(mode)) {
        return createErrorResponse('وضع الاستعادة يجب أن يكون replace أو merge', 400, 'VALIDATION_ERROR');
      }

      const entry = chunkStore.get(uploadId);
      if (!entry) {
        return createErrorResponse('لم يتم العثور على بيانات الرفع — انتهت الجلسة', 400, 'UPLOAD_EXPIRED');
      }

      const missingChunks = entry.chunks.filter(c => !c).length;
      if (missingChunks > 0) {
        return createErrorResponse(`يوجد ${missingChunks} أجزاء مفقودة — أعد رفع الملف`, 400, 'CHUNKS_MISSING');
      }

      // ── Verify admin password ────────────────────────────────────
      await connectDB();
      const { User } = await import('@/models/mongoose/User');

      if (!isEmergency) {
        if (!password) {
          return createErrorResponse('كلمة المرور مطلوبة للتأكيد', 400, 'VALIDATION_ERROR');
        }
        const currentAdmin = await User.findOne({ role: 'admin', _id: user!.userId }).lean();
        if (!currentAdmin) return createErrorResponse('حساب الإدارة غير موجود', 404, 'ADMIN_NOT_FOUND');
        const isPasswordValid = await verifyPassword(password, (currentAdmin as any).password);
        if (!isPasswordValid) return createErrorResponse('كلمة المرور غير صحيحة', 401, 'INVALID_PASSWORD');
      }

      const logPrefix = isEmergency ? '[EMERGENCY RESTORE]' : '[RESTORE]';
      console.log(`${logPrefix} Reassembling ${entry.chunks.length} chunks...`);

      // ── Reassemble base64 chunks into buffer ────────────────────
      let buffer: Buffer;
      try {
        const fullBase64 = entry.chunks.join('');
        buffer = Buffer.from(fullBase64, 'base64');
        console.log(`${logPrefix} Reassembled buffer: ${(buffer.length / 1024 / 1024).toFixed(2)} MB`);
      } catch (err) {
        console.error(`${logPrefix} Failed to reassemble chunks:`, err);
        return createErrorResponse('فشل في تجميع أجزاء الملف', 400, 'ASSEMBLY_ERROR');
      }

      // Clean up chunk store
      chunkStore.delete(uploadId);

      // ── Parse ZIP ────────────────────────────────────────────────
      let zip: import('jszip');
      try {
        const JSZip = (await import('jszip')).default;
        zip = await JSZip.loadAsync(buffer);
        console.log(`${logPrefix} ZIP parsed — ${Object.keys(zip.files).length} entries`);
      } catch (zipErr) {
        console.error(`${logPrefix} ZIP parse error:`, zipErr);
        return createErrorResponse('فشل في فك ضغط الملف — تأكد أنه ملف نسخة احتياطية صالح', 400, 'INVALID_ZIP');
      }

      // ── Find database files ──────────────────────────────────────
      const dbFiles: string[] = [];
      zip.forEach((relativePath, zipEntry) => {
        if (!zipEntry.dir && relativePath.includes('/database/') && relativePath.endsWith('.json') && !relativePath.includes('_summary')) {
          dbFiles.push(relativePath);
        }
      });

      if (dbFiles.length === 0) {
        return createErrorResponse('لم يتم العثور على ملفات قاعدة البيانات في النسخة الاحتياطية', 400, 'INVALID_BACKUP');
      }

      // ── Read meta.json ───────────────────────────────────────────
      let backupMeta: Record<string, unknown> | null = null;
      const metaEntry = zip.file('meta.json');
      if (metaEntry) {
        try { backupMeta = JSON.parse(await metaEntry.async('string')); } catch {}
      }

      // ── Connect to MongoDB ───────────────────────────────────────
      const mongoose = await import('mongoose');
      const db = mongoose.default.connection.db;
      if (!db) return createErrorResponse('لا يوجد اتصال بقاعدة البيانات', 500, 'DB_ERROR');

      // ── Restore collections ──────────────────────────────────────
      let totalRestored = 0;
      let totalErrors = 0;
      const results: { collection: string; count: number; status: string; error?: string }[] = [];

      for (const filePath of dbFiles) {
        const entry = zip.file(filePath);
        if (!entry) continue;

        try {
          const content = await entry.async('string');
          const fileData = JSON.parse(content);

          if (!fileData.collection || !Array.isArray(fileData.documents)) continue;

          const colName = fileData.collection as string;
          const docCount = (fileData.documents as unknown[]).length;
          const docs = fileData.documents.map(deserializeDoc);

          if (mode === 'replace') {
            await db.collection(colName).deleteMany({});
          }

          if (docs.length > 0) {
            if (mode === 'merge') {
              for (const doc of docs) {
                const d = doc as Record<string, unknown>;
                if (d._id) {
                  await db.collection(colName).replaceOne({ _id: d._id }, d, { upsert: true });
                } else {
                  await db.collection(colName).insertOne(d);
                }
              }
            } else {
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

      // ── Recreate indexes ────────────────────────────────────────
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
      } catch (err) {
        console.warn(`${logPrefix} Index creation warning:`, err);
      }

      // ── Restore admin settings ──────────────────────────────────
      let adminSettingsStatus = { restored: false, note: 'لا يوجد ملف إعدادات إدارة' };
      const adminSettingsEntry = zip.file('config/admin-settings.json');
      if (adminSettingsEntry) {
        try {
          const settingsContent = JSON.parse(await adminSettingsEntry.async('string'));
          const settingsDocs = Array.isArray(settingsContent) ? settingsContent : [settingsContent];
          for (const setting of settingsDocs) {
            const deserialized = deserializeDoc(setting) as Record<string, unknown>;
            if (deserialized._id) {
              await db.collection('adminsettings').replaceOne({ _id: deserialized._id }, deserialized, { upsert: true });
            } else {
              await db.collection('adminsettings').replaceOne({}, deserialized, { upsert: true });
            }
          }
          adminSettingsStatus = { restored: true, note: 'تم استعادة إعدادات الإدارة بنجاح' };
        } catch { adminSettingsStatus.note = 'خطأ في استعادة إعدادات الإدارة'; }
      }

      // ── Verification ─────────────────────────────────────────────
      const verification: { collection: string; expected: number; actual: number; match: boolean }[] = [];
      for (const result of results) {
        if (result.status === 'ok' && result.count > 0) {
          try {
            const actualCount = await db.collection(result.collection).countDocuments();
            verification.push({ collection: result.collection, expected: result.count, actual: actualCount, match: actualCount === result.count });
          } catch {}
        }
      }
      const verificationPass = verification.filter(v => v.match).length;
      const verificationFail = verification.filter(v => !v.match).length;

      // ── Log activity ─────────────────────────────────────────────
      const now = new Date();
      const authType = isEmergency ? 'وصول طارئ' : 'إدارة';
      try {
        await db.collection('activitylogs').insertOne({
          userId: user!.userId, userRole: 'admin',
          action: isEmergency ? 'emergency_restore_backup' : 'restore_backup',
          entity: 'Database',
          details: `استعادة من نسخة احتياطية (${authType}) — ${totalRestored} وثيقة، وضع: ${mode === 'replace' ? 'استبدال' : 'دمج'}، أخطاء: ${totalErrors}${adminSettingsStatus.restored ? '، إعدادات: مستعادة' : ''}`,
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          createdAt: now, updatedAt: now,
        });
      } catch {}

      return Response.json({
        success: true,
        message: `تمت الاستعادة بنجاح — ${totalRestored} وثيقة في ${results.filter(r => r.status === 'ok').length} مجموعة${verificationFail > 0 ? ` (${verificationFail} عدم تطابق)` : ''}`,
        data: {
          mode, totalRestored, totalErrors,
          backupDate: backupMeta?.exportedAt || null,
          results,
          adminSettingsRestore: adminSettingsStatus,
          verification: { totalChecked: verification.length, passed: verificationPass, failed: verificationFail, details: verification },
          isEmergencyAccess: isEmergency,
        },
      });
    }

    return createErrorResponse('إجراء غير معروف — استخدم upload-chunk أو complete-restore', 400, 'INVALID_ACTION');

  } catch (err) {
    console.error('[RESTORE-CHUNK ERROR]', err);
    const errMsg = err instanceof Error ? err.message : 'حدث خطأ غير معروف';
    return createErrorResponse(`حدث خطأ أثناء استعادة النسخة الاحتياطية: ${errMsg}`, 500, 'INTERNAL_ERROR');
  }
}
