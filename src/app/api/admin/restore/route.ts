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
import { requireEmergencyOrAdmin, createErrorResponse } from '@/lib/auth/middleware';
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
    const { user, error, isEmergency } = requireEmergencyOrAdmin(request, ['admin']);
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

    // ── Verify admin password (skip for emergency tokens) ───────────────
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
    console.log(`${logPrefix} Starting restore — mode: ${mode}, emergency: ${isEmergency}`);

    if (!['replace', 'merge'].includes(mode)) {
      return createErrorResponse('وضع الاستعادة يجب أن يكون replace أو merge', 400, 'VALIDATION_ERROR');
    }

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
    console.log(`${logPrefix} Recreating indexes...`);
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
      console.log(`${logPrefix} Indexes recreated successfully`);
    } catch (err) {
      console.warn(`${logPrefix} Index creation warning:`, err);
    }

    // ── Restore environment variables (if env-vars.json exists) ────────
    let envRestoreStatus: { applied: number; failed: number; note: string } = { applied: 0, failed: 0, note: '' };
    const envVarsEntry = zip.file('environment/env-vars.json');
    if (envVarsEntry) {
      console.log(`${logPrefix} Found environment/env-vars.json in backup`);
      try {
        const envVarsContent = JSON.parse(await envVarsEntry.async('string'));
        const envVars = envVarsContent.vars || envVarsContent;
        const envKeys = Object.keys(envVars).filter(k => !k.startsWith('_'));
        console.log(`${logPrefix} Found ${envKeys.length} environment variables in backup`);

        // Try to apply to Vercel if VERCEL_TOKEN is available
        const vercelToken = process.env.VERCEL_TOKEN;
        const vercelProjectId = process.env.VERCEL_PROJECT_ID;
        if (vercelToken && vercelProjectId) {
          console.log(`${logPrefix} Attempting to apply env vars to Vercel...`);
          try {
            // Get existing env vars
            const vRes = await fetch(
              `https://api.vercel.com/v9/projects/${vercelProjectId}/env`,
              { headers: { Authorization: `Bearer ${vercelToken}` } }
            );
            if (vRes.ok) {
              const vData = await vRes.json();
              const existingEnvs: { id: string; key: string }[] = vData.envs || [];

              for (const key of envKeys) {
                const value = String(envVars[key]);
                const existing = existingEnvs.find(e => e.key === key);

                try {
                  if (existing) {
                    await fetch(`https://api.vercel.com/v9/projects/${vercelProjectId}/env/${existing.id}`, {
                      method: 'PATCH',
                      headers: { Authorization: `Bearer ${vercelToken}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({ value }),
                    });
                  } else {
                    await fetch(`https://api.vercel.com/v9/projects/${vercelProjectId}/env`, {
                      method: 'POST',
                      headers: { Authorization: `Bearer ${vercelToken}`, 'Content-Type': 'application/json' },
                      body: JSON.stringify({
                        key,
                        value,
                        type: 'encrypted',
                        target: ['production', 'preview', 'development'],
                      }),
                    });
                  }
                  envRestoreStatus.applied++;
                } catch {
                  envRestoreStatus.failed++;
                }
              }
              envRestoreStatus.note = `تم تطبيق ${envRestoreStatus.applied} متغير على Vercel`;
              console.log(`${logPrefix} Applied ${envRestoreStatus.applied} env vars to Vercel`);
            } else {
              envRestoreStatus.note = `لم يتم تطبيق متغيرات البيئة — تعذر الوصول لـ Vercel`;
            }
          } catch (err) {
            envRestoreStatus.note = 'خطأ في تطبيق متغيرات البيئة على Vercel';
            console.warn(`${logPrefix} Vercel env apply error:`, err);
          }
        } else {
          envRestoreStatus.note = `تم العثور على ${envKeys.length} متغير بيئة — يتطلب VERCEL_TOKEN للتطبيق`;
          console.log(`${logPrefix} No VERCEL_TOKEN available, skipping env var application`);
        }
      } catch (err) {
        envRestoreStatus.note = 'خطأ في قراءة ملف متغيرات البيئة';
        console.warn(`${logPrefix} env-vars.json parse error:`, err);
      }
    } else {
      envRestoreStatus.note = 'لا يوجد ملف متغيرات بيئة في النسخة الاحتياطية';
    }

    // ── Restore admin settings (if admin-settings.json exists) ─────────
    let adminSettingsStatus: { restored: boolean; note: string } = { restored: false, note: '' };
    const adminSettingsEntry = zip.file('config/admin-settings.json');
    if (adminSettingsEntry) {
      console.log(`${logPrefix} Found config/admin-settings.json in backup`);
      try {
        const settingsContent = JSON.parse(await adminSettingsEntry.async('string'));
        const settingsDocs = Array.isArray(settingsContent) ? settingsContent : [settingsContent];

        for (const setting of settingsDocs) {
          const deserialized = deserializeDoc(setting) as Record<string, unknown>;
          if (deserialized._id) {
            await db.collection('adminsettings').replaceOne(
              { _id: deserialized._id },
              deserialized,
              { upsert: true }
            );
          } else {
            await db.collection('adminsettings').replaceOne(
              {},
              deserialized,
              { upsert: true }
            );
          }
        }
        adminSettingsStatus = { restored: true, note: 'تم استعادة إعدادات الإدارة بنجاح' };
        console.log(`${logPrefix} Admin settings restored successfully`);
      } catch (err) {
        adminSettingsStatus = { restored: false, note: 'خطأ في استعادة إعدادات الإدارة' };
        console.warn(`${logPrefix} Admin settings restore error:`, err);
      }
    } else {
      adminSettingsStatus.note = 'لا يوجد ملف إعدادات إدارة في النسخة الاحتياطية';
    }

    // ── Note VAPID keys (if vapid-keys.json exists) ────────────────────
    let vapidKeysNote = '';
    const vapidKeysEntry = zip.file('config/vapid-keys.json');
    if (vapidKeysEntry) {
      console.log(`${logPrefix} Found config/vapid-keys.json in backup`);
      try {
        const vapidContent = JSON.parse(await vapidKeysEntry.async('string'));
        vapidKeysNote = `تم العثور على مفاتيح VAPID — المفتاح العام: ${vapidContent.publicKey ? vapidContent.publicKey.substring(0, 20) + '...' : 'غير موجود'}`;
        console.log(`${logPrefix} VAPID keys found in backup — noted for reference`);
      } catch {
        vapidKeysNote = 'خطأ في قراءة مفاتيح VAPID';
      }
    }

    // ── Verification: compare document counts ──────────────────────────
    console.log(`${logPrefix} Running verification...`);
    const verification: { collection: string; expected: number; actual: number; match: boolean }[] = [];
    for (const result of results) {
      if (result.status === 'ok' && result.count > 0) {
        try {
          const actualCount = await db.collection(result.collection).countDocuments();
          verification.push({
            collection: result.collection,
            expected: result.count,
            actual: actualCount,
            match: actualCount === result.count,
          });
        } catch {}
      }
    }
    const verificationPass = verification.filter(v => v.match).length;
    const verificationFail = verification.filter(v => !v.match).length;
    console.log(`${logPrefix} Verification: ${verificationPass} pass, ${verificationFail} fail`);

    // ── Log activity ────────────────────────────────────────────────────
    const now = new Date();
    const authType = isEmergency ? 'وصول طارئ' : 'إدارة';
    try {
      await db.collection('activitylogs').insertOne({
        userId: user!.userId,
        userRole: 'admin',
        action: isEmergency ? 'emergency_restore_backup' : 'restore_backup',
        entity: 'Database',
        details: `استعادة من نسخة احتياطية (${authType}) — ${totalRestored} وثيقة، ${results.filter(r => r.status === 'ok').length} مجموعة، وضع: ${mode === 'replace' ? 'استبدال' : 'دمج'}، أخطاء: ${totalErrors}${envRestoreStatus.applied > 0 ? `، متغيرات بيئة: ${envRestoreStatus.applied}` : ''}${adminSettingsStatus.restored ? '، إعدادات إدارة: مستعادة' : ''}${verificationFail > 0 ? `، تحقق: ${verificationFail} عدم تطابق` : ''}${backupMeta ? `، تاريخ النسخة: ${backupMeta.exportedAt || 'غير محدد'}` : ''}`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        createdAt: now,
        updatedAt: now,
      });
    } catch {}

    // ── Return enhanced result ──────────────────────────────────────────
    return Response.json({
      success: true,
      message: `تمت الاستعادة بنجاح — ${totalRestored} وثيقة في ${results.filter(r => r.status === 'ok').length} مجموعة${verificationFail > 0 ? ` (${verificationFail} عدم تطابق في التحقق)` : ''}`,
      data: {
        mode,
        totalRestored,
        totalErrors,
        backupDate: backupMeta?.exportedAt || null,
        backupVersion: backupMeta?.version || null,
        results,
        envRestore: envRestoreStatus,
        adminSettingsRestore: adminSettingsStatus,
        vapidKeysNote: vapidKeysNote || undefined,
        verification: {
          totalChecked: verification.length,
          passed: verificationPass,
          failed: verificationFail,
          details: verification,
        },
        isEmergencyAccess: isEmergency,
      },
    });

  } catch (err) {
    console.error('[RESTORE ERROR]', err);
    return createErrorResponse('حدث خطأ أثناء استعادة النسخة الاحتياطية', 500, 'INTERNAL_ERROR');
  }
}
