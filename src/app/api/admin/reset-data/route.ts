// POST /api/admin/reset-data
// Full data reset — deletes ALL platform data except the main admin account and settings.
// Requires admin role + password confirmation.

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { verifyPassword } from '@/lib/auth';

export async function POST(request: NextRequest) {
  try {
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const body = await request.json();
    const { password, confirmText } = body;

    if (!password || typeof password !== 'string') {
      return createErrorResponse('كلمة المرور مطلوبة للتأكيد', 400, 'VALIDATION_ERROR');
    }

    if (confirmText !== 'احذف') {
      return createErrorResponse('نص التأكيد غير صحيح. اكتب "احذف" بالضبط', 400, 'VALIDATION_ERROR');
    }

    await connectDB();

    // ── Verify current admin password ──────────────────────────────────
    const { User } = await import('@/models/mongoose/User');
    const currentAdmin = await User.findOne({ role: 'admin', _id: user!.userId });

    if (!currentAdmin) {
      return createErrorResponse('حساب الإدارة غير موجود', 404, 'ADMIN_NOT_FOUND');
    }

    const isPasswordValid = await verifyPassword(password, currentAdmin.password);
    if (!isPasswordValid) {
      return createErrorResponse('كلمة المرور غير صحيحة', 401, 'INVALID_PASSWORD');
    }

    // ── Get the raw MongoDB db instance ───────────────────────────────
    const mongoose = await import('mongoose');
    const db = mongoose.default.connection.db;
    if (!db) {
      return createErrorResponse('لا يوجد اتصال بقاعدة البيانات', 500, 'DB_ERROR');
    }

    const deletedSummary: Record<string, number> = {};

    // ── Collections to delete entirely ────────────────────────────────
    const collectionsToEmpty = [
      'notifications',
      'servicerequests',
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
      'whatsappqueues',
      'complaints',
    ];

    for (const colName of collectionsToEmpty) {
      try {
        const result = await db.collection(colName).deleteMany({});
        if (result.deletedCount > 0) {
          deletedSummary[colName] = result.deletedCount;
        }
      } catch {
        // Collection might not exist — skip
      }
    }

    // ── Delete all users except the current admin ─────────────────────
    const usersResult = await db.collection('users').deleteMany({
      role: { $ne: 'admin' },
    });
    deletedSummary['users (nurses + beneficiaries)'] = usersResult.deletedCount;

    // ── Delete subadmins too ──────────────────────────────────────────
    const subadminResult = await db.collection('users').deleteMany({
      role: 'subadmin',
    });
    if (subadminResult.deletedCount > 0) {
      deletedSummary['users (subadmins)'] = subadminResult.deletedCount;
    }

    // ── Log the reset activity ────────────────────────────────────────
    try {
      const total = Object.values(deletedSummary).reduce((a, b) => a + b, 0);
      await db.collection('activitylogs').insertOne({
        userId: user!.userId,
        userRole: 'admin',
        action: 'full_data_reset',
        entity: 'Database',
        details: `تم حذف ${total} وثيقة من جميع المجموعات. تم الاحتفاظ فقط بحساب الإدارة الرئيسي والإعدادات.`,
        ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
        createdAt: new Date(),
        updatedAt: new Date(),
      });
    } catch {
      // Non-critical
    }

    const totalDeleted = Object.values(deletedSummary).reduce((a, b) => a + b, 0);

    return Response.json({
      success: true,
      data: {
        message: 'تم حذف جميع البيانات بنجاح',
        totalDeleted,
        summary: deletedSummary,
      },
    });

  } catch (err) {
    console.error('[RESET DATA ERROR]', err);
    return createErrorResponse('حدث خطأ أثناء حذف البيانات', 500, 'INTERNAL_ERROR');
  }
}
