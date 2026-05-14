// POST /api/admin/backup
// Full platform backup: all MongoDB collections + environment variables + settings.
// Returns a downloadable JSON file.
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
    // Handle MongoDB ObjectId
    if (obj._bsontype === 'ObjectId' || (obj.id && obj._bsontype)) {
      return String(value);
    }
    // Handle Buffer (binary data)
    if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
      return Buffer.from(obj.data as number[]).toString('base64');
    }
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = serializeBSON(v);
    }
    return out;
  }
  return value;
}

// ── Env vars to include ────────────────────────────────────────────────────────
const ENV_KEYS = [
  'MONGODB_URI',
  'JWT_SECRET',
  'NEXTAUTH_URL',
  'NEXTAUTH_SECRET',
  'NEXT_PUBLIC_APP_URL',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VERCEL_TOKEN',
  'VERCEL_PROJECT_ID',
  'VERCEL_URL',
  'NODE_ENV',
  'SESSION_SECRET',
  'PUSH_SUBJECT',
  'PUSH_PUBLIC_KEY',
  'PUSH_PRIVATE_KEY',
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASS',
  'EMAIL_FROM',
  'WHATSAPP_API_URL',
  'WHATSAPP_TOKEN',
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE',
  'FIREBASE_PROJECT_ID',
  'FIREBASE_PRIVATE_KEY',
  'FIREBASE_CLIENT_EMAIL',
];

// ── Collections to export ──────────────────────────────────────────────────────
const COLLECTIONS = [
  'users',
  'adminsettings',
  'services',
  'servicerequests',
  'notifications',
  'deployments',
  'chats',
  'chatmessages',
  'transactions',
  'ratings',
  'coupons',
  'activitylogs',
  'fcmtokens',
  'withdrawalrequests',
  'loyaltytransactions',
  'referrals',
  'emergencyrequests',
  'serviceassignments',
  'emergencyassignments',
  'appointments',
  'paymentmethods',
  'whatsappqueues',
  'complaints',
  'subadmins',
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

    if (!currentAdmin) {
      return createErrorResponse('حساب الإدارة غير موجود', 404, 'ADMIN_NOT_FOUND');
    }

    const isPasswordValid = await verifyPassword(password, (currentAdmin as any).password);
    if (!isPasswordValid) {
      return createErrorResponse('كلمة المرور غير صحيحة', 401, 'INVALID_PASSWORD');
    }

    // ── Get raw MongoDB connection ─────────────────────────────────────────
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    if (!db) {
      return createErrorResponse('لا يوجد اتصال بقاعدة البيانات', 500, 'DB_ERROR');
    }

    // ── Export all collections ─────────────────────────────────────────────
    const dbExport: Record<string, unknown[]> = {};
    let totalDocuments = 0;

    for (const colName of COLLECTIONS) {
      try {
        const docs = await db.collection(colName).find({}).toArray();
        dbExport[colName] = docs.map((d) => serializeBSON(d)) as unknown[];
        totalDocuments += docs.length;
      } catch {
        dbExport[colName] = [];
      }
    }

    // Also capture any other collections that exist but aren't in the list
    try {
      const allCols = await db.listCollections().toArray();
      for (const col of allCols) {
        if (!COLLECTIONS.includes(col.name)) {
          try {
            const docs = await db.collection(col.name).find({}).toArray();
            dbExport[col.name] = docs.map((d) => serializeBSON(d)) as unknown[];
            totalDocuments += docs.length;
          } catch {
            dbExport[col.name] = [];
          }
        }
      }
    } catch {
      // If listing collections fails, use the predefined list
    }

    // ── Collect environment variables ──────────────────────────────────────
    const envExport: Record<string, string> = {};
    for (const key of ENV_KEYS) {
      const val = process.env[key];
      if (val !== undefined) {
        envExport[key] = val;
      }
    }

    // ── Try to fetch Vercel env vars (includes ones not in process.env) ────
    let vercelEnvVars: Record<string, string> | null = null;
    const vercelToken = process.env.VERCEL_TOKEN;
    const vercelProjectId = process.env.VERCEL_PROJECT_ID;

    if (vercelToken && vercelProjectId) {
      try {
        const vercelRes = await fetch(
          `https://api.vercel.com/v9/projects/${vercelProjectId}/env?decrypt=true`,
          {
            headers: {
              Authorization: `Bearer ${vercelToken}`,
              'Content-Type': 'application/json',
            },
          }
        );
        if (vercelRes.ok) {
          const vercelData = await vercelRes.json();
          vercelEnvVars = {};
          for (const envItem of (vercelData.envs || [])) {
            vercelEnvVars[envItem.key] = envItem.value ?? '(encrypted)';
          }
        }
      } catch {
        // Non-critical — proceed without Vercel vars
      }
    }

    // ── Build the backup payload ───────────────────────────────────────────
    const now = new Date();
    const backup = {
      _meta: {
        platform: 'Aafiatak — عافيتك',
        version: '1.0',
        exportedAt: now.toISOString(),
        exportedBy: (currentAdmin as any).name || 'admin',
        totalDocuments,
        collections: Object.keys(dbExport).length,
        note: 'ملف النسخة الاحتياطية الكاملة — يحتوي على بيانات حساسة، احفظه في مكان آمن.',
      },
      environment: {
        _note: 'متغيرات البيئة الحالية المستخدمة في التطبيق',
        current: envExport,
        vercel: vercelEnvVars ?? { _note: 'VERCEL_TOKEN أو VERCEL_PROJECT_ID غير مُعيَّنَين' },
      },
      database: {
        _note: 'جميع مجموعات قاعدة البيانات',
        ...dbExport,
      },
    };

    // ── Log activity ───────────────────────────────────────────────────────
    try {
      await db.collection('activitylogs').insertOne({
        userId: user!.userId,
        userRole: 'admin',
        action: 'full_backup',
        entity: 'Database',
        details: `تم إنشاء نسخة احتياطية كاملة — ${totalDocuments} وثيقة من ${Object.keys(dbExport).length} مجموعة`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        createdAt: now,
        updatedAt: now,
      });
    } catch {
      // Non-critical
    }

    // ── Return as downloadable JSON file ───────────────────────────────────
    const dateStr = now.toISOString().split('T')[0];
    const filename = `aafiatak-backup-${dateStr}.json`;

    return new Response(JSON.stringify(backup, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'X-Backup-Documents': String(totalDocuments),
        'X-Backup-Collections': String(Object.keys(dbExport).length),
      },
    });

  } catch (err) {
    console.error('[BACKUP ERROR]', err);
    return createErrorResponse('حدث خطأ أثناء إنشاء النسخة الاحتياطية', 500, 'INTERNAL_ERROR');
  }
}
