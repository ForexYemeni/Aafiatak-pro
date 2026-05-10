// POST /api/admin/database/switch - Switch to a new MongoDB database
// Admin-only: validates current password, seeds new DB, updates Vercel env, triggers redeploy

import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { hashPassword, verifyPassword } from '@/lib/auth';
import { connectDB } from '@/lib/mongodb';

// Vercel API configuration
const VERCEL_TOKEN = process.env.VERCEL_TOKEN || '';
const VERCEL_PROJECT_ID = process.env.VERCEL_PROJECT_ID || '';

export async function POST(request: NextRequest) {
  try {
    // Only admin can switch databases
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const body = await request.json();
    const {
      newUri,          // New MongoDB connection URI
      adminPhone,      // New admin phone number (written by admin)
      adminPassword,   // New admin password (written by admin)
      currentPassword, // Current admin password for confirmation
    } = body;

    // ── Validation ──────────────────────────────────────────────────
    if (!newUri || typeof newUri !== 'string') {
      return createErrorResponse('رابط MongoDB الجديد مطلوب', 400, 'VALIDATION_ERROR');
    }

    if (!newUri.startsWith('mongodb://') && !newUri.startsWith('mongodb+srv://')) {
      return createErrorResponse('رابط MongoDB غير صالح', 400, 'INVALID_URI');
    }

    if (!adminPhone || typeof adminPhone !== 'string') {
      return createErrorResponse('رقم هاتف الإدارة الجديد مطلوب', 400, 'VALIDATION_ERROR');
    }

    // Validate Yemeni phone format (9 digits starting with 7)
    const phoneRegex = /^7\d{8}$/;
    if (!phoneRegex.test(adminPhone)) {
      return createErrorResponse('رقم الهاتف غير صالح. يجب أن يبدأ بـ 7 ويتكون من 9 أرقام', 400, 'INVALID_PHONE');
    }

    if (!adminPassword || typeof adminPassword !== 'string') {
      return createErrorResponse('كلمة مرور الإدارة الجديدة مطلوبة', 400, 'VALIDATION_ERROR');
    }

    if (adminPassword.length < 6) {
      return createErrorResponse('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 400, 'WEAK_PASSWORD');
    }

    if (!currentPassword || typeof currentPassword !== 'string') {
      return createErrorResponse('كلمة مرور الإدارة الحالية مطلوبة للتأكيد', 400, 'VALIDATION_ERROR');
    }

    // ── Verify current admin password ───────────────────────────────
    await connectDB();
    const { User } = await import('@/models/mongoose/User');
    const currentAdmin = await User.findOne({ role: 'admin', _id: user!.userId });

    if (!currentAdmin) {
      return createErrorResponse('حساب الإدارة غير موجود', 404, 'ADMIN_NOT_FOUND');
    }

    const isCurrentPasswordValid = await verifyPassword(currentPassword, currentAdmin.password);
    if (!isCurrentPasswordValid) {
      return createErrorResponse('كلمة المرور الحالية غير صحيحة', 401, 'INVALID_CURRENT_PASSWORD');
    }

    // ── Step 1: Connect to new database and verify ──────────────────
    let newConn: mongoose.Connection;
    try {
      const newMongoose = await mongoose.createConnection(newUri, {
        connectTimeoutMS: 15000,
        serverSelectionTimeoutMS: 15000,
      }).asPromise();
      newConn = newMongoose;
    } catch (connError: unknown) {
      const errorMessage = connError instanceof Error ? connError.message : 'خطأ غير معروف';
      return createErrorResponse(
        `فشل الاتصال بقاعدة البيانات الجديدة: ${errorMessage}`,
        400,
        'NEW_DB_CONNECTION_FAILED'
      );
    }

    // ── Step 2: Create collections and seed admin in new DB ──────────
    try {
      const newDb = newConn.db!;

      // Create users collection with admin document
      const hashedPassword = await hashPassword(adminPassword);

      // Check if admin already exists in new DB
      const existingAdmin = await newDb.collection('users').findOne({ role: 'admin' });

      if (existingAdmin) {
        // Update existing admin
        await newDb.collection('users').updateOne(
          { role: 'admin' },
          {
            $set: {
              name: 'مدير النظام',
              phone: adminPhone,
              password: hashedPassword,
              role: 'admin',
              isActive: true,
              updatedAt: new Date(),
            },
          }
        );
      } else {
        // Create new admin
        await newDb.collection('users').insertOne({
          name: 'مدير النظام',
          phone: adminPhone,
          password: hashedPassword,
          role: 'admin',
          isActive: true,
          isBlocked: false,
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

      // Create essential collections (empty) to ensure schema exists
      const essentialCollections = [
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
      ];

      for (const colName of essentialCollections) {
        try {
          // Create collection only if it doesn't exist
          const cols = await newDb.listCollections({ name: colName }).toArray();
          if (cols.length === 0) {
            await newDb.createCollection(colName);
          }
        } catch {
          // Skip if already exists or not possible
        }
      }

      // Create indexes for users collection
      await newDb.collection('users').createIndex({ phone: 1 }, { unique: true });
      await newDb.collection('users').createIndex({ role: 1 });

      // Create default admin settings
      const existingSettings = await newDb.collection('adminsettings').findOne();
      if (!existingSettings) {
        await newDb.collection('adminsettings').insertOne({
          commissionRate: 15,
          emergencyFee: 5000,
          deploymentServiceFee: 500,
          deploymentCreatorFee: 500,
          deploymentApplicantFee: 500,
          deploymentBankAccountInfo: '',
          bankAccountInfo: '',
          nightFeePercent: 30,
          fridayFeePercent: 20,
          nightStartHour: 22,
          nightEndHour: 6,
          minOrderAmount: 2000,
          loyaltyPointsPerOrder: 10,
          loyaltyRedemptionThreshold: 100,
          referralReward: 50,
          maxNurseAssignmentRadius: 20,
          autoAssignEnabled: false,
          emergencyAutoDispatch: true,
          maintenanceMode: false,
          maintenanceMessageAr: '',
          supportPhone: '',
          supportEmail: '',
          supportWhatsApp: '',
          supportPhones: [],
          supportWhatsAppNumbers: [],
          termsAndConditionsAr: '',
          privacyPolicyAr: '',
          withdrawalFee: 200,
          enabledWalletTypes: ['جيب', 'جوالي', 'فلوسك', 'حوالة بنكية'],
          createdAt: new Date(),
          updatedAt: new Date(),
        });
      }

    } catch (seedError: unknown) {
      try { await newConn.close(); } catch {}
      const errorMessage = seedError instanceof Error ? seedError.message : 'خطأ غير معروف';
      console.error('[DB SWITCH SEED ERROR]', seedError);
      return createErrorResponse(
        `فشل تهيئة قاعدة البيانات الجديدة: ${errorMessage}`,
        500,
        'SEED_FAILED'
      );
    }

    // Close the new connection
    try { await newConn.close(); } catch {}

    // ── Step 3: Update Vercel environment variable ──────────────────
    if (!VERCEL_TOKEN || !VERCEL_PROJECT_ID) {
      console.warn('[DB SWITCH] Missing VERCEL_TOKEN or VERCEL_PROJECT_ID - skipping Vercel update');
      return createErrorResponse(
        'متغيرات Vercel غير مُعدة (VERCEL_TOKEN, VERCEL_PROJECT_ID). لا يمكن تحديث النشر تلقائياً.',
        500,
        'VERCEL_CONFIG_MISSING'
      );
    }

    try {
      // Step 3a: Update MONGODB_URI environment variable in Vercel
      const envUpdateResponse = await fetch(
        `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env?upsert=true`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${VERCEL_TOKEN}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            key: 'MONGODB_URI',
            value: newUri,
            type: 'encrypted',
            target: ['production', 'preview', 'development'],
          }),
        }
      );

      if (!envUpdateResponse.ok) {
        const errText = await envUpdateResponse.text();
        console.error('[DB SWITCH] Vercel env update failed:', errText);
        return createErrorResponse(
          'فشل تحديث متغيرات البيئة في Vercel. يرجى تحديث MONGODB_URI يدوياً.',
          500,
          'VERCEL_ENV_UPDATE_FAILED'
        );
      }

      // Step 3b: Also update NEXTAUTH_URL to ensure it's correct
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXTAUTH_URL || '';
      if (appUrl) {
        try {
          await fetch(
            `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env?upsert=true`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${VERCEL_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                key: 'NEXTAUTH_URL',
                value: appUrl,
                type: 'plain',
                target: ['production', 'preview', 'development'],
              }),
            }
          );
        } catch {
          // Non-critical
        }
      }

      // Step 3c: Generate and set a new NEXTAUTH_SECRET for security
      const crypto = await import('crypto');
      const newSecret = crypto.randomBytes(32).toString('hex');
      try {
        await fetch(
          `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env?upsert=true`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${VERCEL_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              key: 'NEXTAUTH_SECRET',
              value: newSecret,
              type: 'encrypted',
              target: ['production', 'preview', 'development'],
            }),
          }
        );
      } catch {
        // Non-critical - keep existing secret
      }

      // Step 3d: Generate and set a new JWT_SECRET
      const newJwtSecret = crypto.randomBytes(32).toString('hex');
      try {
        await fetch(
          `https://api.vercel.com/v10/projects/${VERCEL_PROJECT_ID}/env?upsert=true`,
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${VERCEL_TOKEN}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              key: 'JWT_SECRET',
              value: newJwtSecret,
              type: 'encrypted',
              target: ['production', 'preview', 'development'],
            }),
          }
        );
      } catch {
        // Non-critical
      }

    } catch (vercelError) {
      console.error('[DB SWITCH] Vercel API error:', vercelError);
      return createErrorResponse(
        'فشل الاتصال بخدمة Vercel. يرجى المحاولة لاحقاً.',
        500,
        'VERCEL_API_ERROR'
      );
    }

    // ── Step 4: Trigger Vercel Redeploy ─────────────────────────────
    let deploymentId = '';
    let deployUrl = '';
    try {
      // Get latest deployment
      const deploymentsResponse = await fetch(
        `https://api.vercel.com/v13/deployments?projectId=${VERCEL_PROJECT_ID}&limit=1`,
        {
          headers: { Authorization: `Bearer ${VERCEL_TOKEN}` },
        }
      );

      if (deploymentsResponse.ok) {
        const deploymentsData = await deploymentsResponse.json();
        const latestDeployment = deploymentsData.deployments?.[0];

        if (latestDeployment) {
          deploymentId = latestDeployment.uid;
          deployUrl = latestDeployment.url || '';

          // Redeploy
          const redeployResponse = await fetch(
            `https://api.vercel.com/v13/deployments`,
            {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${VERCEL_TOKEN}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                name: latestDeployment.name,
                project: VERCEL_PROJECT_ID,
                source: 'api',
                ref: latestDeployment.gitSource?.ref || 'main',
                target: 'production',
              }),
            }
          );

          if (redeployResponse.ok) {
            const redeployData = await redeployResponse.json();
            deployUrl = redeployData.url ? `https://${redeployData.url}` : deployUrl;
          }
        }
      }
    } catch (redeployError) {
      console.error('[DB SWITCH] Redeploy error:', redeployError);
      // The env vars are updated, redeploy can be triggered manually
    }

    // ── Step 5: Log activity ────────────────────────────────────────
    try {
      const { logActivity } = await import('@/lib/api/helpers');
      await logActivity({
        userId: user!.userId,
        userRole: user!.role,
        action: 'database_switch',
        entity: 'Database',
        details: `تم تبديل قاعدة البيانات إلى قاعدة جديدة. رقم الإدارة الجديد: ${adminPhone}`,
        request,
      });
    } catch {
      // Non-critical
    }

    // ── Return success with new credentials ─────────────────────────
    return Response.json({
      success: true,
      data: {
        message: 'تم تبديل قاعدة البيانات بنجاح',
        newAdminPhone: adminPhone,
        newDatabase: (() => {
          try {
            const urlObj = new URL(newUri.replace('mongodb+srv://', 'https://').replace('mongodb://', 'https://'));
            const name = urlObj.pathname.substring(1) || 'unknown';
            return name.includes('?') ? name.split('?')[0] : name;
          } catch { return 'unknown'; }
        })(),
        deploymentTriggered: !!deploymentId,
        deployUrl: deployUrl || undefined,
        nextStep: 'سيتم إعادة نشر التطبيق تلقائياً. سجل الدخول بالبيانات الجديدة بعد دقيقة.',
      },
    });

  } catch (error) {
    console.error('[DB SWITCH ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تبديل قاعدة البيانات', 500, 'INTERNAL_ERROR');
  }
}
