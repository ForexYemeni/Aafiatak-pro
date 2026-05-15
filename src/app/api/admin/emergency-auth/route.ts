// POST /api/admin/emergency-auth
// ═══════════════════════════════════════════════════════════════════════
// Emergency admin authentication — generates a temporary 15-minute JWT
// for backup/restore operations without requiring full admin login.
// ═══════════════════════════════════════════════════════════════════════

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { verifyPassword, createErrorResponse } from '@/lib/auth';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET!;
const EMERGENCY_TOKEN_EXPIRY = 15 * 60; // 15 minutes in seconds

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { password } = body;

    if (!password || typeof password !== 'string') {
      return createErrorResponse('كلمة المرور مطلوبة', 400, 'VALIDATION_ERROR');
    }

    // ── Connect to DB ─────────────────────────────────────────────────
    await connectDB();

    // ── Find admin user by role ───────────────────────────────────────
    const { User } = await import('@/models/mongoose/User');
    const admin = await User.findOne({ role: 'admin' }).lean();

    if (!admin) {
      return createErrorResponse('لا يوجد حساب إدارة في النظام', 404, 'ADMIN_NOT_FOUND');
    }

    // ── Verify password ───────────────────────────────────────────────
    const isPasswordValid = await verifyPassword(password, (admin as any).password);
    if (!isPasswordValid) {
      return createErrorResponse('كلمة المرور غير صحيحة', 401, 'INVALID_PASSWORD');
    }

    // ── Generate emergency token ──────────────────────────────────────
    const payload = {
      type: 'emergency',
      userId: String(admin._id),
      role: 'admin',
    };

    const token = jwt.sign(payload, JWT_SECRET, { expiresIn: EMERGENCY_TOKEN_EXPIRY });

    // ── Log activity ──────────────────────────────────────────────────
    try {
      const mongoose = await import('mongoose');
      const db = mongoose.default.connection.db;
      if (db) {
        const now = new Date();
        await db.collection('activitylogs').insertOne({
          userId: String(admin._id),
          userRole: 'admin',
          action: 'emergency_auth',
          entity: 'Auth',
          details: 'تم الوصول الطارئ للنسخ الاحتياطي',
          ip: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
          createdAt: now,
          updatedAt: now,
        });
      }
    } catch {}

    // ── Return emergency token ────────────────────────────────────────
    return Response.json({
      success: true,
      token,
      expiresIn: EMERGENCY_TOKEN_EXPIRY,
      admin: {
        name: admin.name,
      },
    });

  } catch (err) {
    console.error('[EMERGENCY AUTH ERROR]', err);
    return createErrorResponse('حدث خطأ في المصادقة الطارئة', 500, 'INTERNAL_ERROR');
  }
}
