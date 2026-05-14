// POST /api/admin/backup
// Full platform backup — all MongoDB collections + env vars.
// Returns a downloadable ZIP file containing one JSON per collection + meta.
// Requires admin role + password confirmation.

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { verifyPassword } from '@/lib/auth';

// ── BSON-safe JSON serializer ─────────────────────────────────────────────────
function serializeBSON(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serializeBSON);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj._bsontype === 'ObjectId' || (obj.id && obj._bsontype)) return String(value);
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return Buffer.from(obj.data as number[]).toString('base64');
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) out[k] = serializeBSON(v);
    return out;
  }
  return value;
}

// ── Env vars to export ────────────────────────────────────────────────────────
const ENV_KEYS = [
  'MONGODB_URI', 'JWT_SECRET', 'NEXTAUTH_URL', 'NEXTAUTH_SECRET',
  'NEXT_PUBLIC_APP_URL', 'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY',
  'VERCEL_TOKEN', 'VERCEL_PROJECT_ID', 'VERCEL_URL', 'NODE_ENV',
  'SESSION_SECRET', 'PUSH_SUBJECT', 'PUSH_PUBLIC_KEY', 'PUSH_PRIVATE_KEY',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM',
  'WHATSAPP_API_URL', 'WHATSAPP_TOKEN',
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE',
  'FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL',
];

// ── Collections to export ──────────────────────────────────────────────────────
const KNOWN_COLLECTIONS = [
  'users', 'adminsettings', 'services', 'servicerequests',
  'notifications', 'deployments', 'chats', 'chatmessages',
  'transactions', 'ratings', 'coupons', 'activitylogs',
  'fcmtokens', 'withdrawalrequests', 'loyaltytransactions',
  'referrals', 'emergencyrequests', 'serviceassignments',
  'emergencyassignments', 'appointments', 'paymentmethods',
  'whatsappqueues', 'complaints', 'subadmins',
];

export async function POST(request: NextRequest) {
  try {
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return createErrorResponse('كلمة المرور مطلوبة للتأكيد', 400, 'VALIDATION_ERROR');
    }

    await connectDB();

    // ── Verify admin password ──────────────────────────────────────────────
    const { User } = await import('@/models/mongoose/User');
    const currentAdmin = await User.findOne({ role: 'admin', _id: user!.userId }).lean();
    if (!currentAdmin) return createErrorResponse('حساب الإدارة غير موجود', 404, 'ADMIN_NOT_FOUND');

    const isPasswordValid = await verifyPassword(password, (currentAdmin as any).password);
    if (!isPasswordValid) return createErrorResponse('كلمة المرور غير صحيحة', 401, 'INVALID_PASSWORD');

    // ── Get MongoDB connection ─────────────────────────────────────────────
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    if (!db) return createErrorResponse('لا يوجد اتصال بقاعدة البيانات', 500, 'DB_ERROR');

    // ── Export all collections ─────────────────────────────────────────────
    const dbExport: Record<string, unknown[]> = {};
    let totalDocuments = 0;

    // Collect all collection names (known + any extras in the DB)
    const collectionNames = new Set(KNOWN_COLLECTIONS);
    try {
      const allCols = await db.listCollections().toArray();
      for (const col of allCols) collectionNames.add(col.name);
    } catch {}

    for (const colName of collectionNames) {
      try {
        const docs = await db.collection(colName).find({}).toArray();
        dbExport[colName] = docs.map((d) => serializeBSON(d)) as unknown[];
        totalDocuments += docs.length;
      } catch {
        dbExport[colName] = [];
      }
    }

    // ── Collect env vars ───────────────────────────────────────────────────
    const envExport: Record<string, string> = {};
    for (const key of ENV_KEYS) {
      const val = process.env[key];
      if (val !== undefined) envExport[key] = val;
    }

    // ── Try Vercel env vars ────────────────────────────────────────────────
    let vercelEnvVars: Record<string, string> | null = null;
    const vercelToken = process.env.VERCEL_TOKEN;
    const vercelProjectId = process.env.VERCEL_PROJECT_ID;
    if (vercelToken && vercelProjectId) {
      try {
        const vRes = await fetch(
          `https://api.vercel.com/v9/projects/${vercelProjectId}/env?decrypt=true`,
          { headers: { Authorization: `Bearer ${vercelToken}`, 'Content-Type': 'application/json' } }
        );
        if (vRes.ok) {
          const vData = await vRes.json();
          vercelEnvVars = {};
          for (const item of (vData.envs || [])) vercelEnvVars![item.key] = item.value ?? '(encrypted)';
        }
      } catch {}
    }

    // ── Build meta ─────────────────────────────────────────────────────────
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const meta = {
      platform: 'Aafiatak — عافيتك',
      version: '1.0',
      exportedAt: now.toISOString(),
      exportedBy: (currentAdmin as any).name || 'admin',
      totalDocuments,
      collections: Object.keys(dbExport),
      note: 'ملف النسخة الاحتياطية الكاملة — يحتوي على بيانات حساسة، احفظه في مكان آمن.',
    };

    // ── Build ZIP ──────────────────────────────────────────────────────────
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    // README
    const readme = [
      '╔══════════════════════════════════════════╗',
      '║      Aafiatak — عافيتك                  ║',
      '║      Full Platform Backup                ║',
      `║      Date: ${dateStr}               ║`,
      '╚══════════════════════════════════════════╝',
      '',
      `Exported At : ${now.toISOString()}`,
      `Exported By : ${meta.exportedBy}`,
      `Total Docs  : ${totalDocuments.toLocaleString()}`,
      `Collections : ${meta.collections.length}`,
      '',
      'FILES IN THIS ARCHIVE',
      '─────────────────────',
      '  README.txt              — this file',
      '  meta.json               — backup metadata',
      '  environment.json        — env vars (current process + Vercel)',
      '  collections/            — one JSON file per MongoDB collection',
      '',
      'RESTORE',
      '───────',
      'Use each .json file in collections/ to re-import into MongoDB.',
      'Use mongoimport or a custom restore script with the admin API.',
      '',
      '⚠  This archive contains sensitive credentials.',
      '   Keep it encrypted and store it securely.',
    ].join('\n');

    zip.file('README.txt', readme);

    // Meta
    zip.file('meta.json', JSON.stringify(meta, null, 2));

    // Environment
    zip.file('environment.json', JSON.stringify({
      _note: 'Current process.env variables + Vercel project env vars',
      current: envExport,
      vercel: vercelEnvVars ?? { _note: 'VERCEL_TOKEN or VERCEL_PROJECT_ID not configured' },
    }, null, 2));

    // One file per collection
    const colFolder = zip.folder('collections')!;
    for (const [colName, docs] of Object.entries(dbExport)) {
      colFolder.file(
        `${colName}.json`,
        JSON.stringify({ collection: colName, count: docs.length, exportedAt: now.toISOString(), documents: docs }, null, 2)
      );
    }

    // ── Generate ZIP buffer ────────────────────────────────────────────────
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // ── Log activity ───────────────────────────────────────────────────────
    try {
      await db.collection('activitylogs').insertOne({
        userId: user!.userId,
        userRole: 'admin',
        action: 'full_backup',
        entity: 'Database',
        details: `نسخة احتياطية ZIP — ${totalDocuments} وثيقة، ${Object.keys(dbExport).length} مجموعة، حجم ${(zipBuffer.length / 1024).toFixed(1)} KB`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        createdAt: now,
        updatedAt: now,
      });
    } catch {}

    // ── Return ZIP as download ─────────────────────────────────────────────
    const filename = `aafiatak-backup-${dateStr}.zip`;

    return new Response(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zipBuffer.length),
        'X-Backup-Documents': String(totalDocuments),
        'X-Backup-Collections': String(Object.keys(dbExport).length),
        'X-Backup-Size-KB': String((zipBuffer.length / 1024).toFixed(1)),
      },
    });

  } catch (err) {
    console.error('[BACKUP ERROR]', err);
    return createErrorResponse('حدث خطأ أثناء إنشاء النسخة الاحتياطية', 500, 'INTERNAL_ERROR');
  }
}
