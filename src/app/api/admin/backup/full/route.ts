// POST /api/admin/backup/full
// COMPLETE platform backup — source code + database + env vars + restore scripts.
// Returns a self-contained ZIP that can be deployed anywhere from scratch.
// Requires admin role + password confirmation.

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { verifyPassword } from '@/lib/auth';

// ── BSON-safe serializer ──────────────────────────────────────────────────────
function serializeBSON(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(serializeBSON);
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    if (obj._bsontype === 'ObjectId' || (obj.id && obj._bsontype)) return String(value);
    if (obj.type === 'Buffer' && Array.isArray(obj.data))
      return Buffer.from(obj.data as number[]).toString('base64');
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
  'GITHUB_TOKEN',
];

// ── Collections ───────────────────────────────────────────────────────────────
const KNOWN_COLLECTIONS = [
  'users', 'adminsettings', 'services', 'servicerequests',
  'notifications', 'deployments', 'chats', 'chatmessages',
  'transactions', 'ratings', 'coupons', 'activitylogs',
  'fcmtokens', 'withdrawalrequests', 'loyaltytransactions',
  'referrals', 'emergencyrequests', 'serviceassignments',
  'emergencyassignments', 'appointments', 'paymentmethods',
  'whatsappqueues', 'complaints', 'subadmins',
];

// ── GitHub repo info (same repo the app is deployed from) ─────────────────────
const GITHUB_OWNER = 'mhmdlybdhshay-sudo';
const GITHUB_REPO = 'Aafiatak-v1.1';
const GITHUB_BRANCH = 'main';

// ── Restore script (Node.js, runs standalone) ─────────────────────────────────
const RESTORE_SCRIPT = `#!/usr/bin/env node
/**
 * Aafiatak — عافيتك  |  Database Restore Script
 * 
 * Usage:
 *   1. Install: npm install mongodb
 *   2. Set your MongoDB URI:
 *        export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/aafiatak"
 *   3. Run:
 *        node restore-db.js
 *
 *   Optional — skip a collection:
 *        node restore-db.js --skip=activitylogs,fcmtokens
 */

const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('ERROR: MONGODB_URI environment variable is not set.');
  console.error('  Example: export MONGODB_URI="mongodb+srv://..."');
  process.exit(1);
}

const skipArg = process.argv.find(a => a.startsWith('--skip='));
const skip = skipArg ? skipArg.replace('--skip=', '').split(',') : [];

async function restore() {
  const client = new MongoClient(uri);
  await client.connect();
  console.log('Connected to MongoDB.');

  const db = client.db();
  const dbDir = path.join(__dirname, 'database');
  const files = fs.readdirSync(dbDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));

  let totalDocs = 0;
  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(dbDir, file), 'utf8'));
    if (!raw.collection || !Array.isArray(raw.documents)) continue;
    if (skip.includes(raw.collection)) {
      console.log(\`SKIP  \${raw.collection}\`);
      continue;
    }
    if (raw.documents.length === 0) {
      console.log(\`EMPTY \${raw.collection}\`);
      continue;
    }
    await db.collection(raw.collection).deleteMany({});
    await db.collection(raw.collection).insertMany(raw.documents);
    totalDocs += raw.documents.length;
    console.log(\`OK    \${raw.collection}: \${raw.documents.length} documents\`);
  }

  await client.close();
  console.log(\`\\nDone. Restored \${totalDocs} total documents.\`);
}

restore().catch(err => {
  console.error('RESTORE FAILED:', err.message);
  process.exit(1);
});
`;

// ── Deploy guide ──────────────────────────────────────────────────────────────
function buildDeployGuide(date: string, admin: string, totalDocs: number, hasSource: boolean): string {
  return `# دليل الاستعادة والنشر الكامل — Aafiatak عافيتك
## نسخة احتياطية بتاريخ ${date} | أُنشئت بواسطة: ${admin}

---

## ما يحتوي عليه هذا الملف

\`\`\`
aafiatak-full-backup-${date}.zip
├── DEPLOY_GUIDE.md              ← هذا الملف
├── meta.json                    ← معلومات النسخة
├── source-code.zip              ← كامل كود المصدر${hasSource ? ' ✅' : ' ❌ (يحتاج GITHUB_TOKEN)'}
├── environment/
│   ├── .env.local               ← جاهز للاستخدام مباشرة
│   └── env-vars.json            ← بصيغة JSON
├── database/
│   ├── _summary.json            ← إحصائيات (${totalDocs} وثيقة)
│   ├── users.json
│   ├── servicerequests.json
│   └── ...
└── scripts/
    └── restore-db.js            ← سكريبت استعادة قاعدة البيانات
\`\`\`

---

## خطوات الاستعادة الكاملة

### المتطلبات
- Node.js 18+ (https://nodejs.org)
- حساب MongoDB Atlas (https://cloud.mongodb.com) — مجاني
- حساب Vercel (https://vercel.com) — مجاني لـ Next.js
- حساب GitHub (https://github.com)

---

### الخطوة 1 — رفع الكود إلى GitHub

**إذا كان source-code.zip موجوداً:**
\`\`\`bash
# فك ضغط source-code.zip
# ارفع الملفات إلى مستودع GitHub جديد
git init
git add .
git commit -m "Initial commit — Aafiatak"
git remote add origin https://github.com/YOUR_USERNAME/aafiatak.git
git push -u origin main
\`\`\`

**إذا لم يكن موجوداً:**
\`\`\`
git clone https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git
cd ${GITHUB_REPO}
\`\`\`

---

### الخطوة 2 — إعداد قاعدة البيانات

1. أنشئ مشروعاً جديداً في MongoDB Atlas
2. احصل على رابط الاتصال (connection string)
3. شغّل سكريبت الاستعادة:

\`\`\`bash
# نسخ مجلد database/ وملف scripts/restore-db.js إلى نفس المجلد
npm install mongodb
export MONGODB_URI="mongodb+srv://user:password@cluster.mongodb.net/aafiatak"
node restore-db.js
\`\`\`

---

### الخطوة 3 — إعداد متغيرات البيئة

انسخ ملف \`environment/.env.local\` إلى جذر المشروع، وعدّل القيم:
- \`MONGODB_URI\` ← رابط MongoDB الجديد
- \`NEXTAUTH_URL\` ← رابط الموقع الجديد
- \`NEXT_PUBLIC_APP_URL\` ← رابط الموقع الجديد

---

### الخطوة 4 — النشر على Vercel

\`\`\`bash
npm install -g vercel
vercel --prod
\`\`\`

أو ارفع المشروع من واجهة Vercel وأضف متغيرات البيئة يدوياً.

---

### إرسال النسخة إلى الذكاء الاصطناعي

يمكنك فك ضغط هذا الملف وإرسال:
- \`DEPLOY_GUIDE.md\` — للتعليمات
- \`source-code.zip\` — للكود
- \`environment/env-vars.json\` — للإعدادات (احذف القيم الحساسة أولاً)

---

© Aafiatak — عافيتك | جميع الحقوق محفوظة
`;
}

export async function POST(request: NextRequest) {
  try {
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return createErrorResponse('كلمة المرور مطلوبة', 400, 'VALIDATION_ERROR');
    }

    await connectDB();

    // ── Verify admin ───────────────────────────────────────────────────────
    const { User } = await import('@/models/mongoose/User');
    const currentAdmin = await User.findOne({ role: 'admin', _id: user!.userId }).lean();
    if (!currentAdmin) return createErrorResponse('حساب الإدارة غير موجود', 404, 'ADMIN_NOT_FOUND');

    const isPasswordValid = await verifyPassword(password, (currentAdmin as any).password);
    if (!isPasswordValid) return createErrorResponse('كلمة المرور غير صحيحة', 401, 'INVALID_PASSWORD');

    // ── Connect to MongoDB ─────────────────────────────────────────────────
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    if (!db) return createErrorResponse('لا يوجد اتصال بقاعدة البيانات', 500, 'DB_ERROR');

    // ── Export all collections ─────────────────────────────────────────────
    const dbExport: Record<string, unknown[]> = {};
    let totalDocuments = 0;
    const collectionNames = new Set(KNOWN_COLLECTIONS);
    try { const all = await db.listCollections().toArray(); for (const c of all) collectionNames.add(c.name); } catch {}
    for (const colName of collectionNames) {
      try {
        const docs = await db.collection(colName).find({}).toArray();
        dbExport[colName] = docs.map((d) => serializeBSON(d)) as unknown[];
        totalDocuments += docs.length;
      } catch { dbExport[colName] = []; }
    }

    // ── Collect env vars ───────────────────────────────────────────────────
    const envExport: Record<string, string> = {};
    for (const key of ENV_KEYS) {
      const val = process.env[key];
      if (val !== undefined) envExport[key] = val;
    }

    // ── Try Vercel env vars ────────────────────────────────────────────────
    const vercelToken = process.env.VERCEL_TOKEN;
    const vercelProjectId = process.env.VERCEL_PROJECT_ID;
    if (vercelToken && vercelProjectId) {
      try {
        const vRes = await fetch(
          `https://api.vercel.com/v9/projects/${vercelProjectId}/env?decrypt=true`,
          { headers: { Authorization: `Bearer ${vercelToken}` } }
        );
        if (vRes.ok) {
          const vData = await vRes.json();
          for (const item of (vData.envs || [])) {
            if (!(item.key in envExport)) envExport[item.key] = item.value ?? '(encrypted)';
          }
        }
      } catch {}
    }

    // ── Build .env.local content ───────────────────────────────────────────
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const envLocalLines = [
      `# Aafiatak — عافيتك  |  Environment Variables`,
      `# Generated: ${now.toISOString()}`,
      `# ⚠ هذا الملف يحتوي على بيانات حساسة — لا تشاركه`,
      '',
      ...Object.entries(envExport).map(([k, v]) => `${k}=${v}`),
    ];
    const envLocalContent = envLocalLines.join('\n');

    // ── Try to download source code from GitHub ────────────────────────────
    let sourceZipBuffer: Buffer | null = null;
    let hasSource = false;
    const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
    try {
      const headers: Record<string, string> = { 'User-Agent': 'Aafiatak-Backup/1.0', 'Accept': 'application/vnd.github+json' };
      if (githubToken) headers['Authorization'] = `Bearer ${githubToken}`;
      const ghRes = await fetch(
        `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/zipball/${GITHUB_BRANCH}`,
        { headers, redirect: 'follow' }
      );
      if (ghRes.ok) {
        sourceZipBuffer = Buffer.from(await ghRes.arrayBuffer());
        hasSource = true;
      }
    } catch {}

    // ── Build the master ZIP ───────────────────────────────────────────────
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    // DEPLOY_GUIDE.md
    zip.file('DEPLOY_GUIDE.md', buildDeployGuide(dateStr, (currentAdmin as any).name || 'admin', totalDocuments, hasSource));

    // meta.json
    zip.file('meta.json', JSON.stringify({
      platform: 'Aafiatak — عافيتك',
      version: '1.0',
      exportedAt: now.toISOString(),
      exportedBy: (currentAdmin as any).name || 'admin',
      totalDocuments,
      collections: Object.keys(dbExport).length,
      includesSourceCode: hasSource,
      githubRepo: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`,
    }, null, 2));

    // Source code ZIP (if downloaded)
    if (sourceZipBuffer) {
      zip.file('source-code.zip', sourceZipBuffer);
    } else {
      zip.file('source-code-NOT-INCLUDED.txt', [
        'الكود المصدري غير متوفر في هذه النسخة.',
        '',
        'السبب: متغير البيئة GITHUB_TOKEN غير مُعيَّن.',
        '',
        'للحصول على الكود المصدري:',
        `  git clone https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git`,
        '',
        'أو أضف GITHUB_TOKEN إلى متغيرات بيئة Vercel وأعد إنشاء النسخة.',
      ].join('\n'));
    }

    // Environment folder
    const envFolder = zip.folder('environment')!;
    envFolder.file('.env.local', envLocalContent);
    envFolder.file('env-vars.json', JSON.stringify({ _note: 'انسخ هذه القيم إلى Vercel أو .env.local', vars: envExport }, null, 2));

    // Database folder — one JSON per collection
    const dbFolder = zip.folder('database')!;
    dbFolder.file('_summary.json', JSON.stringify({
      exportedAt: now.toISOString(),
      totalDocuments,
      collections: Object.fromEntries(Object.entries(dbExport).map(([k, v]) => [k, (v as unknown[]).length])),
    }, null, 2));
    for (const [colName, docs] of Object.entries(dbExport)) {
      dbFolder.file(`${colName}.json`, JSON.stringify({
        collection: colName,
        count: (docs as unknown[]).length,
        exportedAt: now.toISOString(),
        documents: docs,
      }, null, 2));
    }

    // Scripts folder — restore script
    const scriptsFolder = zip.folder('scripts')!;
    scriptsFolder.file('restore-db.js', RESTORE_SCRIPT);

    // ── Generate ZIP ───────────────────────────────────────────────────────
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
        entity: 'FullBackup',
        details: `نسخة احتياطية شاملة — ${totalDocuments} وثيقة، كود المصدر: ${hasSource ? 'مُضمَّن' : 'غير متوفر'}، ${(zipBuffer.length / 1024 / 1024).toFixed(1)} MB`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        createdAt: now,
        updatedAt: now,
      });
    } catch {}

    const filename = `aafiatak-full-backup-${dateStr}.zip`;
    return new Response(zipBuffer, {
      status: 200,
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zipBuffer.length),
        'X-Backup-Documents': String(totalDocuments),
        'X-Backup-Collections': String(Object.keys(dbExport).length),
        'X-Backup-Has-Source': String(hasSource),
        'X-Backup-Size-KB': String((zipBuffer.length / 1024).toFixed(1)),
      },
    });

  } catch (err) {
    console.error('[FULL BACKUP ERROR]', err);
    return createErrorResponse('حدث خطأ أثناء إنشاء النسخة الاحتياطية الشاملة', 500, 'INTERNAL_ERROR');
  }
}
