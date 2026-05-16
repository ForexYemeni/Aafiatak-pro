// POST /api/admin/backup/full
// ═══════════════════════════════════════════════════════════════════════
// COMPLETE platform backup — source code + database + env vars +
// Vercel config + Push VAPID keys + Service Worker config +
// Admin settings + Sounds list + Restore scripts.
//
// This ZIP is 100% self-contained: when you send it to an AI agent,
// they can restore the entire platform from scratch, including:
//   - Database (all collections)
//   - Environment variables (process.env + Vercel decrypted)
//   - Source code (from GitHub API)
//   - Vercel project configuration
//   - Push notification VAPID keys
//   - Service Worker configuration
//   - Admin settings
//   - Sound files manifest
//   - Complete restore scripts (bash + node)
// ═══════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireEmergencyOrAdmin, createErrorResponse } from '@/lib/auth/middleware';
import { verifyPassword } from '@/lib/auth';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
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

// ── All env vars (comprehensive) ─────────────────────────────────────────────
const ENV_KEYS = [
  // Core
  'MONGODB_URI', 'JWT_SECRET', 'JWT_REFRESH_SECRET', 'JWT_EXPIRY', 'JWT_REFRESH_EXPIRY',
  'NEXTAUTH_URL', 'NEXTAUTH_SECRET', 'NEXT_PUBLIC_APP_URL', 'NEXT_PUBLIC_SOCKET_URL',
  'NODE_ENV', 'SESSION_SECRET',
  // Push / VAPID
  'VAPID_PUBLIC_KEY', 'VAPID_PRIVATE_KEY', 'VAPID_SUBJECT',
  'PUSH_SUBJECT', 'PUSH_PUBLIC_KEY', 'PUSH_PRIVATE_KEY',
  // Vercel
  'VERCEL_TOKEN', 'VERCEL_PROJECT_ID', 'VERCEL_URL',
  // Email / SMTP
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS', 'EMAIL_FROM',
  // WhatsApp / Twilio
  'WHATSAPP_API_URL', 'WHATSAPP_TOKEN',
  'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE',
  // Firebase
  'FIREBASE_PROJECT_ID', 'FIREBASE_PRIVATE_KEY', 'FIREBASE_CLIENT_EMAIL',
  // GitHub
  'GITHUB_TOKEN', 'GITHUB_PAT',
  // Redis / Rate Limiting
  'UPSTASH_REDIS_REST_URL', 'UPSTASH_REDIS_REST_TOKEN',
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

// ── GitHub repo info ─────────────────────────────────────────────────────────
const GITHUB_OWNER = 'ForexYemeni';
const GITHUB_REPO = 'Aafiatak-pro';
const GITHUB_BRANCH = 'main';

// ── Restore script: restore-db.js (enhanced with merge/replace modes) ────────
const RESTORE_DB_SCRIPT = `#!/usr/bin/env node
/**
 * ═══════════════════════════════════════════════════════════════
 * Aafiatak — عافيتك  |  Database Restore Script v2.0
 * ═══════════════════════════════════════════════════════════════
 *
 * الاستخدام:
 *   1. تثبيت: npm install mongodb
 *   2. تعيين رابط MongoDB:
 *        export MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/aafiatak"
 *   3. تشغيل:
 *        node restore-db.js
 *
 *   خيارات:
 *     --mode=replace    استبدال كامل (افتراضي) - يمسح ثم يُدخل
 *     --mode=merge      دمج - يحافظ على البيانات الموجودة ويضيف الجديدة
 *     --skip=col1,col2  تخطي مجموعات محددة
 *     --only=col1,col2  استعادة مجموعات محددة فقط
 *     --dry-run         عرض ما سيتم تنفيذه دون تنفيذ فعلي
 *     --verify          التحقق من عدد الوثائق بعد الاستعادة
 */

const { MongoClient, ObjectId } = require('mongodb');
const fs = require('fs');
const path = require('path');

// ── Parse arguments ───────────────────────────────────────────────
const args = process.argv.slice(2);
const getArg = (prefix) => {
  const a = args.find(a => a.startsWith(prefix));
  return a ? a.replace(prefix, '') : null;
};

const mode = getArg('--mode=') || 'replace';
const skipStr = getArg('--skip=');
const onlyStr = getArg('--only=');
const dryRun = args.includes('--dry-run');
const verify = args.includes('--verify');

const skip = skipStr ? skipStr.split(',') : [];
const only = onlyStr ? onlyStr.split(',') : null;

const uri = process.env.MONGODB_URI;
if (!uri) {
  console.error('❌ خطأ: متغير البيئة MONGODB_URI غير محدد.');
  console.error('   مثال: export MONGODB_URI="mongodb+srv://..."');
  process.exit(1);
}

if (!['replace', 'merge'].includes(mode)) {
  console.error('❌ خطأ: --mode يجب أن تكون replace أو merge');
  process.exit(1);
}

// ── Deserialize MongoDB extended JSON ─────────────────────────────
function deserializeDoc(doc) {
  if (doc === null || doc === undefined) return doc;
  if (Array.isArray(doc)) return doc.map(deserializeDoc);
  if (typeof doc === 'object') {
    const obj = doc;
    // Restore ObjectId
    if (obj.\$oid) return new ObjectId(obj.\$oid);
    // Restore Date
    if (obj.\$date) return new Date(obj.\$date);
    // Restore Binary/Base64
    if (obj.\$binary) return Buffer.from(obj.\$binary, 'base64');
    // Restore Int64
    if (obj.\$numberLong) return parseInt(obj.\$numberLong, 10);
    // Restore Double
    if (obj.\$numberDouble) return parseFloat(obj.\$numberDouble);
    // Recurse into regular objects
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      out[k] = deserializeDoc(v);
    }
    return out;
  }
  return doc;
}

async function restore() {
  console.log('');
  console.log('╔══════════════════════════════════════════╗');
  console.log('║   Aafiatak — عافيتك                     ║');
  console.log('║   Database Restore Script v2.0           ║');
  console.log('╚══════════════════════════════════════════╝');
  console.log('');
  console.log(\`📡 الاتصال بـ MongoDB...\`);
  console.log(\`📋 وضع الاستعادة: \${mode === 'replace' ? 'استبدال كامل' : 'دمج'}\`);
  if (dryRun) console.log('🔍 وضع المحاكاة (dry-run): لن يتم تنفيذ أي تغيير');
  console.log('');

  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  console.log('✅ تم الاتصال بنجاح');
  console.log(\`📂 قاعدة البيانات: \${db.databaseName}\`);
  console.log('');

  const dbDir = path.join(__dirname, '..', 'database');
  if (!fs.existsSync(dbDir)) {
    console.error(\`❌ مجلد database/ غير موجود في: \${dbDir}\`);
    await client.close();
    process.exit(1);
  }

  const files = fs.readdirSync(dbDir).filter(f => f.endsWith('.json') && !f.startsWith('_'));
  let totalRestored = 0;
  let totalSkipped = 0;
  let totalErrors = 0;
  const results = [];

  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(dbDir, file), 'utf8'));
    if (!raw.collection || !Array.isArray(raw.documents)) continue;

    const colName = raw.collection;

    // Check --only and --skip
    if (only && !only.includes(colName)) {
      console.log(\`⏭️  تخطي \${colName} (غير محدد في --only)\`);
      totalSkipped++;
      continue;
    }
    if (skip.includes(colName)) {
      console.log(\`⏭️  تخطي \${colName} (محدد في --skip)\`);
      totalSkipped++;
      continue;
    }

    const docCount = raw.documents.length;

    if (docCount === 0) {
      console.log(\`📭 \${colName}: فارغة\`);
      if (mode === 'replace' && !dryRun) {
        await db.collection(colName).deleteMany({});
      }
      results.push({ col: colName, count: 0, status: 'empty' });
      continue;
    }

    // Deserialize documents
    const docs = raw.documents.map(deserializeDoc);

    if (dryRun) {
      console.log(\`🔍 \${colName}: سيتم استعادة \${docCount} وثيقة (وضع: \${mode})\`);
      results.push({ col: colName, count: docCount, status: 'dry-run' });
      continue;
    }

    try {
      if (mode === 'replace') {
        // Full replace: delete all then insert
        await db.collection(colName).deleteMany({});
        // Insert in batches of 500
        const batchSize = 500;
        for (let i = 0; i < docs.length; i += batchSize) {
          const batch = docs.slice(i, i + batchSize);
          await db.collection(colName).insertMany(batch, { ordered: false });
        }
        console.log(\`✅ \${colName}: \${docCount} وثيقة (استبدال)\`);
      } else {
        // Merge mode: upsert by _id
        let inserted = 0;
        let updated = 0;
        for (const doc of docs) {
          if (doc._id) {
            const result = await db.collection(colName).replaceOne(
              { _id: doc._id },
              doc,
              { upsert: true }
            );
            if (result.upsertedCount > 0) inserted++;
            else if (result.modifiedCount > 0) updated++;
          } else {
            await db.collection(colName).insertOne(doc);
            inserted++;
          }
        }
        console.log(\`✅ \${colName}: \${inserted} جديدة + \${updated} محدّثة (دمج)\`);
      }
      totalRestored += docCount;
      results.push({ col: colName, count: docCount, status: 'ok' });
    } catch (err) {
      console.error(\`❌ \${colName}: فشل - \${err.message}\`);
      totalErrors++;
      results.push({ col: colName, count: docCount, status: 'error', error: err.message });
    }
  }

  // ── Verification ──────────────────────────────────────────────────
  if (verify && !dryRun) {
    console.log('');
    console.log('═══ التحقق من الاستعادة ═══');
    for (const r of results) {
      if (r.status === 'ok') {
        const actual = await db.collection(r.col).countDocuments();
        const match = actual === r.count ? '✅' : '⚠️';
        console.log(\`\${match} \${r.col}: متوقع \${r.count}, فعلي \${actual}\`);
      }
    }
  }

  // ── Ensure indexes ────────────────────────────────────────────────
  if (!dryRun) {
    console.log('');
    console.log('═══ إنشاء الفهارس ═══');
    try {
      // Users collection indexes
      await db.collection('users').createIndex({ phone: 1 }, { unique: true, sparse: true });
      await db.collection('users').createIndex({ role: 1 });
      console.log('✅ فهارس users');

      // Services
      await db.collection('services').createIndex({ category: 1 });
      await db.collection('services').createIndex({ isActive: 1 });
      console.log('✅ فهارس services');

      // Service requests
      await db.collection('servicerequests').createIndex({ beneficiaryId: 1 });
      await db.collection('servicerequests').createIndex({ nurseId: 1 });
      await db.collection('servicerequests').createIndex({ status: 1 });
      console.log('✅ فهارس servicerequests');

      // Notifications
      await db.collection('notifications').createIndex({ userId: 1, read: 1 });
      console.log('✅ فهارس notifications');

      // Chats
      await db.collection('chats').createIndex({ participants: 1 });
      await db.collection('chatmessages').createIndex({ chatId: 1, createdAt: 1 });
      console.log('✅ فهارس chats/chatmessages');

      // FCM tokens
      await db.collection('fcmtokens').createIndex({ userId: 1, isActive: 1 });
      console.log('✅ فهارس fcmtokens');

      // Transactions
      await db.collection('transactions').createIndex({ beneficiaryId: 1 });
      await db.collection('transactions').createIndex({ nurseId: 1 });
      console.log('✅ فهارس transactions');
    } catch (err) {
      console.warn(\`⚠️ تحذير فهرسة: \${err.message}\`);
    }
  }

  await client.close();

  console.log('');
  console.log('═══════════════════════════════════════');
  console.log(\`📊 الملخص:\`);
  console.log(\`   ✅ مستعادة: \${totalRestored} وثيقة\`);
  console.log(\`   ⏭️  متخطاة: \${totalSkipped} مجموعة\`);
  console.log(\`   ❌ أخطاء: \${totalErrors}\`);
  if (dryRun) console.log('   🔍 وضع المحاكاة — لم يتم تنفيذ أي تغيير');
  console.log('═══════════════════════════════════════');
  console.log('');
}

restore().catch(err => {
  console.error('❌ فشل الاستعادة:', err.message);
  process.exit(1);
});
`;

// ── Complete restore script: restore-all.sh ───────────────────────────────────
const RESTORE_ALL_SCRIPT = `#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
# Aafiatak — عافيتك  |  Complete Platform Restore Script v2.0
# ═══════════════════════════════════════════════════════════════════════
# هذا السكريبت يستعيد المنصة بالكامل من النسخة الاحتياطية:
#   1. استعادة قاعدة البيانات (MongoDB)
#   2. استعادة متغيرات البيئة
#   3. إعداد الكود المصدري
#   4. النشر على Vercel
#   5. التحقق من الإشعارات الصوتية والتنبيهات
#
# الاستخدام:
#   chmod +x restore-all.sh
#   ./restore-all.sh --db-uri="mongodb+srv://..." --vercel-token="..." --project-name="aafiatak"
# ═══════════════════════════════════════════════════════════════════════

set -e

# ── Colors ───────────────────────────────────────────────────────────
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
PURPLE='\\033[0;35m'
CYAN='\\033[0;36m'
NC='\\033[0m'

echo ""
echo -e "\${PURPLE}╔══════════════════════════════════════════╗\${NC}"
echo -e "\${PURPLE}║   Aafiatak — عافيتك                     ║\${NC}"
echo -e "\${PURPLE}║   Complete Platform Restore v2.0         ║\${NC}"
echo -e "\${PURPLE}╚══════════════════════════════════════════╝\${NC}"
echo ""

# ── Parse arguments ──────────────────────────────────────────────────
DB_URI=""
VERCEL_TOKEN=""
PROJECT_NAME="aafiatak"
MODE="replace"
SKIP_DB=false
SKIP_ENV=false
SKIP_VERCEL=false
SKIP_SOURCE=false
DRY_RUN=false

for arg in "$@"; do
  case \$arg in
    --db-uri=*)      DB_URI="\${arg#*=}" ;;
    --vercel-token=*) VERCEL_TOKEN="\${arg#*=}" ;;
    --project-name=*) PROJECT_NAME="\${arg#*=}" ;;
    --mode=*)        MODE="\${arg#*=}" ;;
    --skip-db)       SKIP_DB=true ;;
    --skip-env)      SKIP_ENV=true ;;
    --skip-vercel)   SKIP_VERCEL=true ;;
    --skip-source)   SKIP_SOURCE=true ;;
    --dry-run)       DRY_RUN=true ;;
    --help)
      echo "الاستخدام: ./restore-all.sh [خيارات]"
      echo ""
      echo "الخيارات:"
      echo "  --db-uri=URI        رابط MongoDB (مطلوب لاستعادة البيانات)"
      echo "  --vercel-token=TOK  رمز Vercel API (للنشر التلقائي)"
      echo "  --project-name=NAME اسم مشروع Vercel (افتراضي: aafiatak)"
      echo "  --mode=replace|merge وضع استاعدة قاعدة البيانات (افتراضي: replace)"
      echo "  --skip-db           تخطي استعادة قاعدة البيانات"
      echo "  --skip-env          تخطي استعادة متغيرات البيئة"
      echo "  --skip-vercel       تخطي النشر على Vercel"
      echo "  --skip-source       تخطي إعداد الكود المصدري"
      echo "  --dry-run           عرض الخطوات دون تنفيذ"
      echo "  --help              عرض هذه المساعدة"
      exit 0
    ;;
    *) echo -e "\${RED}خيار غير معروف: \$arg\${NC}"; exit 1 ;;
  esac
done

SCRIPT_DIR="\$(cd "\$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
BACKUP_ROOT="\$(dirname "\$SCRIPT_DIR")"

if [ "\$DRY_RUN" = true ]; then
  echo -e "\${YELLOW}🔍 وضع المحاكاة — لن يتم تنفيذ أي تغيير\${NC}"
  echo ""
fi

# ── Step 1: Restore Database ─────────────────────────────────────────
if [ "\$SKIP_DB" = false ]; then
  echo -e "\${BLUE}━━━ الخطوة 1/5: استعادة قاعدة البيانات ━━━\${NC}"

  if [ -z "\$DB_URI" ]; then
    # Try to read from environment file
    if [ -f "\$BACKUP_ROOT/environment/.env.local" ]; then
      DB_URI=\$(grep MONGODB_URI "\$BACKUP_ROOT/environment/.env.local" | cut -d'=' -f2-)
      echo -e "\${CYAN}   تم قراءة MONGODB_URI من .env.local\${NC}"
    fi
  fi

  if [ -z "\$DB_URI" ]; then
    echo -e "\${RED}   ❌ خطأ: يجب تحديد --db-uri أو التأكد من وجود MONGODB_URI في .env.local\${NC}"
    exit 1
  fi

  if [ "\$DRY_RUN" = false ]; then
    cd "\$SCRIPT_DIR"
    MONGODB_URI="\$DB_URI" node restore-db.js --mode=\$MODE --verify
  else
    echo -e "\${YELLOW}   🔍 سيتم تنفيذ: MONGODB_URI=*** node restore-db.js --mode=\$MODE --verify\${NC}"
  fi

  echo -e "\${GREEN}   ✅ تم استعادة قاعدة البيانات\${NC}"
  echo ""
else
  echo -e "\${YELLOW}⏭️  تخطي استعادة قاعدة البيانات\${NC}"
  echo ""
fi

# ── Step 2: Setup Environment Variables ──────────────────────────────
if [ "\$SKIP_ENV" = false ]; then
  echo -e "\${BLUE}━━━ الخطوة 2/5: استعادة متغيرات البيئة ━━━\${NC}"

  if [ -f "\$BACKUP_ROOT/environment/.env.local" ]; then
    if [ "\$DRY_RUN" = false ]; then
      # Update MONGODB_URI if provided
      if [ -n "\$DB_URI" ]; then
        # Replace MONGODB_URI in .env.local
        if [[ "\$OSTYPE" == "darwin"* ]]; then
          sed -i '' "s|MONGODB_URI=.*|MONGODB_URI=\$DB_URI|g" "\$BACKUP_ROOT/environment/.env.local"
        else
          sed -i "s|MONGODB_URI=.*|MONGODB_URI=\$DB_URI|g" "\$BACKUP_ROOT/environment/.env.local"
        fi
      fi
      echo -e "\${GREEN}   ✅ ملف .env.local جاهز في: \$BACKUP_ROOT/environment/.env.local\${NC}"
    else
      echo -e "\${YELLOW}   🔍 سيتم نسخ .env.local مع تحديث MONGODB_URI\${NC}"
    fi
  else
    echo -e "\${RED}   ❌ ملف .env.local غير موجود في النسخة الاحتياطية\${NC}"
  fi

  # Also show Vercel env vars info
  if [ -f "\$BACKUP_ROOT/environment/env-vars.json" ]; then
    ENV_COUNT=\$(grep -c '"' "\$BACKUP_ROOT/environment/env-vars.json" 2>/dev/null || echo "غير محدد")
    echo -e "\${CYAN}   📋 ملف env-vars.json يحتوي على جميع متغيرات البيئة\${NC}"
  fi

  echo ""
else
  echo -e "\${YELLOW}⏭️  تخطي استعادة متغيرات البيئة\${NC}"
  echo ""
fi

# ── Step 3: Setup Source Code ────────────────────────────────────────
if [ "\$SKIP_SOURCE" = false ]; then
  echo -e "\${BLUE}━━━ الخطوة 3/5: إعداد الكود المصدري ━━━\${NC}"

  DEPLOY_DIR="\$BACKUP_ROOT/deploy"
  mkdir -p "\$DEPLOY_DIR"

  if [ -f "\$BACKUP_ROOT/source-code.zip" ]; then
    if [ "\$DRY_RUN" = false ]; then
      echo -e "\${CYAN}   📦 فك ضغط الكود المصدري...\${NC}"
      cd "\$DEPLOY_DIR"
      unzip -o "\$BACKUP_ROOT/source-code.zip"

      # Copy .env.local to the source directory
      if [ -f "\$BACKUP_ROOT/environment/.env.local" ]; then
        cp "\$BACKUP_ROOT/environment/.env.local" .
        echo -e "\${GREEN}   ✅ تم نسخ .env.local إلى مجلد المشروع\${NC}"
      fi

      # Install dependencies
      echo -e "\${CYAN}   📦 تثبيت الحزم...\${NC}"
      npm install

      echo -e "\${GREEN}   ✅ الكود المصدري جاهز في: \$DEPLOY_DIR\${NC}"
    else
      echo -e "\${YELLOW}   🔍 سيتم فك ضغط source-code.zip وتثبيت الحزم\${NC}"
    fi
  else
    echo -e "\${YELLOW}   ⚠️  source-code.zip غير موجود\${NC}"
    echo -e "\${CYAN}   📋 للحصول على الكود: git clone من المستودع المذكور في meta.json\${NC}"

    if [ -f "\$BACKUP_ROOT/meta.json" ]; then
      GITHUB_REPO=\$(grep -o '"githubRepo"[^,]*' "\$BACKUP_ROOT/meta.json" | cut -d'"' -f4)
      if [ -n "\$GITHUB_REPO" ] && [ "\$DRY_RUN" = false ]; then
        echo -e "\${CYAN}   📋 git clone \$GITHUB_REPO\${NC}"
        cd "\$DEPLOY_DIR"
        git clone "\$GITHUB_REPO" .
        if [ -f "\$BACKUP_ROOT/environment/.env.local" ]; then
          cp "\$BACKUP_ROOT/environment/.env.local" .
        fi
        npm install
        echo -e "\${GREEN}   ✅ تم استنساخ الكود من GitHub\${NC}"
      fi
    fi
  fi

  echo ""
else
  echo -e "\${YELLOW}⏭️  تخطي إعداد الكود المصدري\${NC}"
  echo ""
fi

# ── Step 4: Deploy to Vercel ─────────────────────────────────────────
if [ "\$SKIP_VERCEL" = false ]; then
  echo -e "\${BLUE}━━━ الخطوة 4/5: النشر على Vercel ━━━\${NC}"

  if [ -n "\$VERCEL_TOKEN" ]; then
    if [ "\$DRY_RUN" = false ]; then
      cd "\$DEPLOY_DIR"

      # Set env vars on Vercel from env-vars.json
      if [ -f "\$BACKUP_ROOT/environment/env-vars.json" ]; then
        echo -e "\${CYAN}   🔧 إعداد متغيرات البيئة على Vercel...\${NC}"
        node "\$SCRIPT_DIR/apply-vercel-env.js" --token="\$VERCEL_TOKEN" --project="\$PROJECT_NAME" --env-file="\$BACKUP_ROOT/environment/env-vars.json" 2>/dev/null || \\
          echo -e "\${YELLOW}   ⚠️  تعذر إعداد متغيرات البيئة تلقائياً — أضفها يدوياً من لوحة Vercel\${NC}"
      fi

      # Deploy
      echo -e "\${CYAN}   🚀 النشر على Vercel...\${NC}"
      npx vercel --prod --token="\$VERCEL_TOKEN" --yes

      echo -e "\${GREEN}   ✅ تم النشر على Vercel\${NC}"
    else
      echo -e "\${YELLOW}   🔍 سيتم النشر على Vercel مع المتغيرات من env-vars.json\${NC}"
    fi
  else
    echo -e "\${YELLOW}   ⚠️  رمز Vercel غير محدد\${NC}"
    echo -e "\${CYAN}   📋 للنشر يدوياً:\${NC}"
    echo -e "\${CYAN}      1. ارفع الكود إلى GitHub\${NC}"
    echo -e "\${CYAN}      2. استورد المشروع من Vercel\${NC}"
    echo -e "\${CYAN}      3. أضف متغيرات البيئة من ملف env-vars.json\${NC}"
    echo -e "\${CYAN}      4. انشر المشروع\${NC}"
  fi

  echo ""
else
  echo -e "\${YELLOW}⏭️  تخطي النشر على Vercel\${NC}"
  echo ""
fi

# ── Step 5: Verify ───────────────────────────────────────────────────
echo -e "\${BLUE}━━━ الخطوة 5/5: التحقق ━━━\${NC}"

if [ -f "\$BACKUP_ROOT/meta.json" ]; then
  echo -e "\${CYAN}   📋 معلومات النسخة الاحتياطية:\${NC}"
  cat "\$BACKUP_ROOT/meta.json" | head -10
fi

echo ""
echo -e "\${GREEN}═══════════════════════════════════════\${NC}"
echo -e "\${GREEN}✅ اكتملت عملية الاستعادة!\${NC}"
echo -e "\${GREEN}═══════════════════════════════════════\${NC}"
echo ""
echo -e "\${CYAN}الخطوات التالية:\${NC}"
echo -e "\${CYAN}  1. تحقق من عمل الموقع\${NC}"
echo -e "\${CYAN}  2. اختبر تسجيل الدخول بحساب الإدارة\${NC}"
echo -e "\${CYAN}  3. اختبر الإشعارات الصوتية والتنبيهات\${NC}"
echo -e "\${CYAN}  4. اختبر نظام الطوارئ\${NC}"
echo -e "\${CYAN}  5. تحقق من إعدادات الدفع\${NC}"
echo ""
`;

// ── Vercel env apply script ──────────────────────────────────────────────────
const APPLY_VERCEL_ENV_SCRIPT = `#!/usr/bin/env node
/**
 * Apply environment variables to Vercel project from env-vars.json
 * Usage: node apply-vercel-env.js --token=TOKEN --project=NAME --env-file=path
 */
const fs = require('fs');

const args = process.argv.slice(2);
const getArg = (prefix) => {
  const a = args.find(a => a.startsWith(prefix));
  return a ? a.replace(prefix, '') : null;
};

const token = getArg('--token=') || process.env.VERCEL_TOKEN;
const project = getArg('--project=') || 'aafiatak';
const envFile = getArg('--env-file=');

if (!token || !envFile) {
  console.error('Usage: node apply-vercel-env.js --token=TOKEN --project=NAME --env-file=PATH');
  process.exit(1);
}

async function applyEnv() {
  const raw = JSON.parse(fs.readFileSync(envFile, 'utf8'));
  const vars = raw.vars || raw;

  // Get project ID
  const projectsRes = await fetch(
    'https://api.vercel.com/v9/projects',
    { headers: { Authorization: \`Bearer \${token}\` } }
  );
  const projectsData = await projectsRes.json();
  const proj = (projectsData.projects || []).find(p => p.name === project);
  if (!proj) {
    console.error(\`Project "\${project}" not found. Create it first.\`);
    process.exit(1);
  }

  const projectId = proj.id;
  console.log(\`Found project: \${project} (\${projectId})\`);

  let created = 0;
  let updated = 0;

  for (const [key, value] of Object.entries(vars)) {
    if (key.startsWith('_')) continue; // Skip metadata keys

    // Check if var exists
    const checkRes = await fetch(
      \`https://api.vercel.com/v9/projects/\${projectId}/env\`,
      { headers: { Authorization: \`Bearer \${token}\` } }
    );
    const checkData = await checkRes.json();
    const existing = (checkData.envs || []).find(e => e.key === key);

    if (existing) {
      // Update
      await fetch(\`https://api.vercel.com/v9/projects/\${projectId}/env/\${existing.id}\`, {
        method: 'PATCH',
        headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ value: String(value) }),
      });
      updated++;
    } else {
      // Create
      await fetch(\`https://api.vercel.com/v9/projects/\${projectId}/env\`, {
        method: 'POST',
        headers: { Authorization: \`Bearer \${token}\`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key,
          value: String(value),
          type: 'encrypted',
          target: ['production', 'preview', 'development'],
        }),
      });
      created++;
    }
  }

  console.log(\`Done. Created: \${created}, Updated: \${updated}\`);
}

applyEnv().catch(err => {
  console.error('Failed:', err.message);
  process.exit(1);
});
`;

// ── Deploy guide (comprehensive Arabic) ──────────────────────────────────────
function buildDeployGuide(date: string, admin: string, totalDocs: number, hasSource: boolean, collectionCount: number, envCount: number): string {
  return `# ═══════════════════════════════════════════════════════════════
# دليل الاستعادة والنشر الكامل — Aafiatak عافيتك v2.0
# نسخة احتياطية بتاريخ ${date} | أُنشئت بواسطة: ${admin}
# ═══════════════════════════════════════════════════════════════

---

## 📦 ما يحتويه هذا الملف

\`\`\`
aafiatak-full-backup-${date}.zip
├── DEPLOY_GUIDE.md              ← هذا الملف (دليل كامل)
├── meta.json                    ← معلومات النسخة والإحصائيات
├── source-code.zip              ← كامل كود المصدر ${hasSource ? '✅' : '❌ (يحتاج GITHUB_TOKEN)'}
├── environment/
│   ├── .env.local               ← جاهز للاستخدام مباشرة
│   └── env-vars.json            ← بصيغة JSON (للـ API)
├── database/
│   ├── _summary.json            ← إحصائيات (${totalDocs} وثيقة، ${collectionCount} مجموعة)
│   ├── users.json
│   ├── services.json
│   ├── adminsettings.json
│   └── ... (${collectionCount} ملف)
├── scripts/
│   ├── restore-db.js            ← سكريبت استعادة قاعدة البيانات (replace/merge)
│   ├── restore-all.sh           ← سكريبت استعادة شامل (الكل)
│   └── apply-vercel-env.js      ← سكريبت إعداد متغيرات Vercel
├── config/
│   ├── vercel.json              ← إعدادات Vercel
│   ├── next-config.ts           ← إعدادات Next.js
│   ├── vapid-keys.json          ← مفاتيح الإشعارات Push
│   ├── service-worker-config.json ← إعدادات Service Worker
│   └── admin-settings.json      ← إعدادات الإدارة الكاملة
└── sounds/
    └── sounds-manifest.json     ← قائمة الأصوات والملفات
\`\`\`

---

## ⚡ الاستعادة السريعة (للوكلاء الذكيين)

عند إرسال هذا الملف لوكيل ذكي (AI Agent)، هذه المعلومات الكافية:

1. **قاعدة البيانات**: مجلد \`database/\` يحتوي كل مجموعة كملف JSON منفصل
2. **البيئة**: ملف \`environment/.env.local\` يحتوي كل المتغيرات جاهزة
3. **الإعدادات**: ملف \`config/admin-settings.json\` يحتوي إعدادات المنصة
4. **الإشعارات**: ملف \`config/vapid-keys.json\` يحتوي مفاتيح VAPID
5. **الاستعادة**: شغّل \`scripts/restore-all.sh\` لاستعادة كل شيء

---

## 📋 خطوات الاستعادة الكاملة (يدوياً)

### المتطلبات
- Node.js 18+ (https://nodejs.org)
- حساب MongoDB Atlas (https://cloud.mongodb.com) — مجاني
- حساب Vercel (https://vercel.com) — مجاني لـ Next.js
- حساب GitHub (https://github.com)

---

### الخطوة 1 — إعداد الكود المصدري

**إذا كان source-code.zip موجوداً:**
\`\`\`bash
mkdir aafiatak && cd aafiatak
unzip source-code.zip
cp environment/.env.local .
npm install
\`\`\`

**إذا لم يكن موجوداً:**
\`\`\`bash
git clone https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}.git
cd ${GITHUB_REPO}
# انسخ .env.local من مجلد environment/ في النسخة الاحتياطية
\`\`\`

---

### الخطوة 2 — إعداد قاعدة البيانات

1. أنشئ مشروعاً جديداً في MongoDB Atlas
2. احصل على رابط الاتصال (connection string)
3. شغّل سكريبت الاستعادة:

\`\`\`bash
# وضع الاستبدال الكامل (افتراضي)
MONGODB_URI="mongodb+srv://user:password@cluster.mongodb.net/aafiatak" \\
  node scripts/restore-db.js --verify

# أو وضع الدمج (يحافظ على البيانات الموجودة)
MONGODB_URI="mongodb+srv://..." \\
  node scripts/restore-db.js --mode=merge --verify

# عرض ما سيتم تنفيذه بدون تعديل فعلي
MONGODB_URI="mongodb+srv://..." \\
  node scripts/restore-db.js --dry-run
\`\`\`

---

### الخطوة 3 — إعداد متغيرات البيئة

1. افتح \`environment/.env.local\`
2. عدّل القيم التالية حسب بيئتك الجديدة:
   - \`MONGODB_URI\` ← رابط MongoDB الجديد
   - \`NEXTAUTH_URL\` ← رابط الموقع الجديد
   - \`NEXT_PUBLIC_APP_URL\` ← رابط الموقع الجديد
3. انسخ الملف إلى جذر المشروع: \`cp environment/.env.local .\`

---

### الخطوة 4 — النشر على Vercel

**طريقة 1: تلقائي (يحتاج Vercel token)**
\`\`\`bash
# إعداد متغيرات البيئة على Vercel تلقائياً
node scripts/apply-vercel-env.js \\
  --token="vercel_token_here" \\
  --project="aafiatak" \\
  --env-file="environment/env-vars.json"

# النشر
npx vercel --prod
\`\`\`

**طريقة 2: يدوي عبر واجهة Vercel**
1. ارفع الكود إلى GitHub
2. استورد المشروع من Vercel
3. أضف متغيرات البيئة من ملف \`environment/env-vars.json\`
4. انشر المشروع

---

### الخطوة 5 — الاستعادة الشاملة بنقرة واحدة

\`\`\`bash
chmod +x scripts/restore-all.sh
./scripts/restore-all.sh \\
  --db-uri="mongodb+srv://user:pass@cluster.mongodb.net/aafiatak" \\
  --vercel-token="your_vercel_token" \\
  --project-name="aafiatak"
\`\`\`

---

### الخطوة 6 — التحقق من العمل

1. افتح رابط الموقع
2. سجّل دخول بحساب الإدارة (من ملف admin-settings.json)
3. تحقق من الإشعارات الصوتية
4. تحقق من نظام الطوارئ
5. تحقق من إعدادات الدفع

---

## ⚠️ ملاحظات مهمة

1. **مفاتيح VAPID**: إذا أنشأت مفاتيح جديدة، حدّثها في:
   - متغيرات البيئة (\`VAPID_PUBLIC_KEY\`, \`VAPID_PRIVATE_KEY\`)
   - ملف \`public/sw.js\` (السطر \`VAPID_PUBLIC_KEY\`)

2. **Service Worker**: بعد النشر، تأكد من تحديث SW عند المستخدمين:
   - غيّر \`CACHE_NAME\` في \`sw.js\` لإجبار التحديث

3. **الأصوات**: ملفات الأصوات موجودة في الكود المصدري (\`public/sounds/\`)

4. **الأمان**: هذا الملف يحتوي بيانات حساسة — احفظه في مكان آمن ولا تشاركه

---

© Aafiatak — عافيتك | جميع الحقوق محفوظة
`;
}

export async function POST(request: NextRequest) {
  try {
    const { user, error, isEmergency } = requireEmergencyOrAdmin(request, ['admin']);
    if (error) return error;

    const body = await request.json();
    const { password } = body;

    // ── Verify admin password (skip for emergency tokens) ───────────────
    await connectDB();
    const { User } = await import('@/models/mongoose/User');

    let adminName = 'admin';
    if (!isEmergency) {
      if (!password || typeof password !== 'string') {
        return createErrorResponse('كلمة المرور مطلوبة', 400, 'VALIDATION_ERROR');
      }

      const currentAdmin = await User.findOne({ role: 'admin', _id: user!.userId }).lean();
      if (!currentAdmin) return createErrorResponse('حساب الإدارة غير موجود', 404, 'ADMIN_NOT_FOUND');

      const isPasswordValid = await verifyPassword(password, (currentAdmin as any).password);
      if (!isPasswordValid) return createErrorResponse('كلمة المرور غير صحيحة', 401, 'INVALID_PASSWORD');
      adminName = (currentAdmin as any).name || 'admin';
    } else {
      // Emergency access — fetch admin name
      const adminUser = await User.findById(user!.userId).select('name').lean();
      if (adminUser) adminName = (adminUser as any).name || 'admin';
    }

    // ── Connect to MongoDB ─────────────────────────────────────────────
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    if (!db) return createErrorResponse('لا يوجد اتصال بقاعدة البيانات', 500, 'DB_ERROR');

    // ── Export all collections ─────────────────────────────────────────
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

    // ── Collect ALL env vars ───────────────────────────────────────────
    const envExport: Record<string, string> = {};
    for (const key of ENV_KEYS) {
      const val = process.env[key];
      if (val !== undefined) envExport[key] = val;
    }

    // ── Try Vercel env vars (decrypted) ────────────────────────────────
    let vercelEnvVars: Record<string, string> | null = null;
    let vercelProjectConfig: Record<string, unknown> | null = null;
    const vercelToken = process.env.VERCEL_TOKEN;
    const vercelProjectId = process.env.VERCEL_PROJECT_ID;
    if (vercelToken && vercelProjectId) {
      try {
        // Get decrypted env vars
        const vRes = await fetch(
          `https://api.vercel.com/v9/projects/${vercelProjectId}/env?decrypt=true`,
          { headers: { Authorization: `Bearer ${vercelToken}` } }
        );
        if (vRes.ok) {
          const vData = await vRes.json();
          vercelEnvVars = {};
          for (const item of (vData.envs || [])) {
            if (!(item.key in envExport)) envExport[item.key] = item.value ?? '(encrypted)';
            vercelEnvVars![item.key] = item.value ?? '(encrypted)';
          }
        }
      } catch {}

      try {
        // Get project config (domains, settings, etc.)
        const pRes = await fetch(
          `https://api.vercel.com/v9/projects/${vercelProjectId}`,
          { headers: { Authorization: `Bearer ${vercelToken}` } }
        );
        if (pRes.ok) {
          const pData = await pRes.json();
          vercelProjectConfig = {
            name: pData.name,
            id: pData.id,
            framework: pData.framework,
            regions: pData.regions,
            rootDirectory: pData.rootDirectory,
            buildCommand: pData.buildCommand,
            outputDirectory: pData.outputDirectory,
            installCommand: pData.installCommand,
            devCommand: pData.devCommand,
            domains: pData.targets?.production?.alias || [],
            git: pData.link ? {
              type: pData.link.type,
              repo: pData.link.repo,
              branch: pData.link.branch,
            } : null,
          };
        }
      } catch {}
    }

    // ── Get Admin Settings from DB ─────────────────────────────────────
    let adminSettingsFromDb: Record<string, unknown> | null = null;
    try {
      const settingsDoc = await db.collection('adminsettings').findOne({});
      if (settingsDoc) {
        adminSettingsFromDb = serializeBSON(settingsDoc) as Record<string, unknown>;
      }
    } catch {}

    // ── Build .env.local content ───────────────────────────────────────
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

    // ── Try to download source code from GitHub ────────────────────────
    let sourceZipBuffer: Buffer | null = null;
    let hasSource = false;
    const githubToken = process.env.GITHUB_TOKEN || process.env.GITHUB_PAT;
    try {
      const headers: Record<string, string> = { 'User-Agent': 'Aafiatak-Backup/2.0', 'Accept': 'application/vnd.github+json' };
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

    // ── Build the master ZIP ───────────────────────────────────────────
    const JSZip = (await import('jszip')).default;
    const zip = new JSZip();

    // DEPLOY_GUIDE.md
    zip.file('DEPLOY_GUIDE.md', buildDeployGuide(
      dateStr,
      adminName,
      totalDocuments,
      hasSource,
      Object.keys(dbExport).length,
      Object.keys(envExport).length,
    ));

    // meta.json (comprehensive)
    zip.file('meta.json', JSON.stringify({
      platform: 'Aafiatak — عافيتك',
      version: '2.0',
      backupType: 'complete-platform',
      exportedAt: now.toISOString(),
      exportedBy: adminName,
      totalDocuments,
      collectionCount: Object.keys(dbExport).length,
      envVarCount: Object.keys(envExport).length,
      includesSourceCode: hasSource,
      includesVercelConfig: vercelProjectConfig !== null,
      includesAdminSettings: adminSettingsFromDb !== null,
      includesVapidKeys: Boolean(envExport.VAPID_PUBLIC_KEY && envExport.VAPID_PRIVATE_KEY),
      githubRepo: `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}`,
      collections: Object.fromEntries(Object.entries(dbExport).map(([k, v]) => [k, (v as unknown[]).length])),
      restoreGuide: {
        quickStart: '1. Unzip → 2. node scripts/restore-db.js → 3. cp environment/.env.local . → 4. npm install → 5. vercel --prod',
        fullGuide: 'See DEPLOY_GUIDE.md',
      },
    }, null, 2));

    // Source code ZIP
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

    // ── Environment folder ─────────────────────────────────────────────
    const envFolder = zip.folder('environment')!;
    envFolder.file('.env.local', envLocalContent);
    envFolder.file('env-vars.json', JSON.stringify({ _note: 'انسخ هذه القيم إلى Vercel أو .env.local', vars: envExport }, null, 2));
    if (vercelEnvVars) {
      envFolder.file('vercel-env-vars.json', JSON.stringify({
        _note: 'متغيرات Vercel المفكوكة التشفير',
        _source: `Vercel Project: ${vercelProjectId}`,
        vars: vercelEnvVars,
      }, null, 2));
    }

    // ── Database folder ────────────────────────────────────────────────
    const dbFolder = zip.folder('database')!;
    dbFolder.file('_summary.json', JSON.stringify({
      exportedAt: now.toISOString(),
      totalDocuments,
      collectionCount: Object.keys(dbExport).length,
      collections: Object.fromEntries(Object.entries(dbExport).map(([k, v]) => [k, (v as unknown[]).length])),
      restoreCommand: 'MONGODB_URI="mongodb+srv://..." node scripts/restore-db.js --verify',
      mergeCommand: 'MONGODB_URI="mongodb+srv://..." node scripts/restore-db.js --mode=merge --verify',
    }, null, 2));
    for (const [colName, docs] of Object.entries(dbExport)) {
      dbFolder.file(`${colName}.json`, JSON.stringify({
        collection: colName,
        count: (docs as unknown[]).length,
        exportedAt: now.toISOString(),
        documents: docs,
      }, null, 2));
    }

    // ── Scripts folder ─────────────────────────────────────────────────
    const scriptsFolder = zip.folder('scripts')!;
    scriptsFolder.file('restore-db.js', RESTORE_DB_SCRIPT);
    scriptsFolder.file('restore-all.sh', RESTORE_ALL_SCRIPT);
    scriptsFolder.file('apply-vercel-env.js', APPLY_VERCEL_ENV_SCRIPT);

    // ── Config folder (NEW: complete platform configuration) ───────────
    const configFolder = zip.folder('config')!;

    // Vercel project config
    if (vercelProjectConfig) {
      configFolder.file('vercel-project.json', JSON.stringify({
        _note: 'إعدادات مشروع Vercel الكاملة — للاستعادة',
        config: vercelProjectConfig,
      }, null, 2));
    }

    // VAPID keys (critical for push notifications)
    configFolder.file('vapid-keys.json', JSON.stringify({
      _note: 'مفاتيح VAPID للإشعارات — يجب تحديثها في .env.local و sw.js',
      VAPID_PUBLIC_KEY: envExport.VAPID_PUBLIC_KEY || '(غير محدد)',
      VAPID_PRIVATE_KEY: envExport.VAPID_PRIVATE_KEY || '(غير محدد)',
      VAPID_SUBJECT: envExport.VAPID_SUBJECT || '(غير محدد)',
      _serviceWorkerUpdate: 'يجب تحديث VAPID_PUBLIC_KEY في ملف public/sw.js أيضاً',
      _generateNewKeys: 'npx web-push generate-vapid-keys',
    }, null, 2));

    // Service Worker config
    configFolder.file('service-worker-config.json', JSON.stringify({
      _note: 'إعدادات Service Worker — للاستعادة والتحديث',
      cacheName: 'aafiatak-v7',
      staticCache: 'aafiatak-static-v7',
      apiCacheName: 'aafiatak-api-v7',
      vapidPublicKey: envExport.VAPID_PUBLIC_KEY || '(يجب تحديثه)',
      preCacheUrls: [
        '/', '/offline.html',
        '/icons/icon-192x192.png', '/icons/icon-512x512.png',
        '/manifest.json',
        '/sounds/notification.mp3', '/sounds/emergency.mp3',
        '/sounds/chat.mp3', '/sounds/success.mp3', '/sounds/error.mp3',
      ],
      _updateInstruction: 'عند تغيير VAPID_PUBLIC_KEY، حدّث القيمة في public/sw.js أيضاً',
    }, null, 2));

    // Admin settings (full document)
    if (adminSettingsFromDb) {
      configFolder.file('admin-settings.json', JSON.stringify({
        _note: 'إعدادات الإدارة الكاملة — من مجموعة adminsettings',
        _restoreMethod: 'يتم استعادتها تلقائياً مع restore-db.js',
        settings: adminSettingsFromDb,
      }, null, 2));
    }

    // Next.js config reference
    configFolder.file('next-config-reference.json', JSON.stringify({
      _note: 'مرجع إعدادات Next.js — موجود في الكود المصدري',
      keySettings: {
        typescript: { ignoreBuildErrors: true },
        eslint: { ignoreDuringBuilds: true },
        securityHeaders: true,
        imageFormats: ['image/avif', 'image/webp'],
        serverExternalPackages: ['mongoose', 'bcryptjs', 'jsonwebtoken', 'nodemailer', 'socket.io', 'web-push'],
      },
    }, null, 2));

    // ── Sounds folder (manifest only — actual files in source code) ────
    const soundsFolder = zip.folder('sounds')!;
    soundsFolder.file('sounds-manifest.json', JSON.stringify({
      _note: 'قائمة ملفات الأصوات — الملفات الفعلية موجودة في public/sounds/ داخل الكود المصدري',
      sounds: [
        { file: 'notification.mp3', purpose: 'إشعار عام', fallbackHz: 880 },
        { file: 'emergency.mp3', purpose: 'تنبيه طوارئ', fallbackHz: 660, waveType: 'square' },
        { file: 'chat.mp3', purpose: 'رسالة محادثة', fallbackHz: 1047 },
        { file: 'success.mp3', purpose: 'نجاح', fallbackHz: 784 },
        { file: 'error.mp3', purpose: 'خطأ', fallbackHz: 220, waveType: 'sawtooth' },
      ],
      _soundManagerPath: 'src/lib/notifications/sound-manager.ts',
      _voiceManagerPath: 'src/lib/notifications/voice-manager.ts',
      _webAudioFallback: 'إذا لم تعمل ملفات MP3، يتم استخدام Web Audio API لتوليد نغمات بديلة',
    }, null, 2));

    // ── Generate ZIP ───────────────────────────────────────────────────
    const zipBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 6 },
    });

    // ── Log activity ───────────────────────────────────────────────────
    try {
      await db.collection('activitylogs').insertOne({
        userId: user!.userId,
        userRole: 'admin',
        action: 'full_backup_v2',
        entity: 'FullBackup',
        details: `نسخة احتياطية شاملة v2.0 — ${totalDocuments} وثيقة، ${Object.keys(dbExport).length} مجموعة، ${Object.keys(envExport).length} متغير بيئة، كود المصدر: ${hasSource ? 'مُضمَّن' : 'غير متوفر'}، إعدادات Vercel: ${vercelProjectConfig ? 'مُضمَّنة' : 'غير متوفرة'}، حجم ${(zipBuffer.length / 1024 / 1024).toFixed(1)} MB`,
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
        'X-Backup-Env-Vars': String(Object.keys(envExport).length),
        'X-Backup-Has-Source': String(hasSource),
        'X-Backup-Has-Vercel-Config': String(vercelProjectConfig !== null),
        'X-Backup-Has-Admin-Settings': String(adminSettingsFromDb !== null),
        'X-Backup-Has-Vapid-Keys': String(Boolean(envExport.VAPID_PUBLIC_KEY)),
        'X-Backup-Size-KB': String((zipBuffer.length / 1024).toFixed(1)),
        'X-Backup-Version': '2.0',
      },
    });

  } catch (err) {
    console.error('[FULL BACKUP ERROR]', err);
    return createErrorResponse('حدث خطأ أثناء إنشاء النسخة الاحتياطية الشاملة', 500, 'INTERNAL_ERROR');
  }
}
