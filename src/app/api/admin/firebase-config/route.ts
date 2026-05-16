// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Firebase Config API
// ============================================================================
// GET    /api/admin/firebase-config  — Returns current Firebase config (masked)
// POST   /api/admin/firebase-config  — Saves/updates Firebase config
// DELETE /api/admin/firebase-config  — Deactivates the current config
// ============================================================================
// All endpoints require admin authentication.
// The private key is always masked in GET responses for security.
// ============================================================================

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { FirebaseConfig } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { reinitializeFirebaseAdmin } from '@/lib/notifications/firebase-admin-sdk';
import { logActivity } from '@/lib/api/helpers';

// ── GET: Retrieve current Firebase config (private key masked) ──────

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const config = await FirebaseConfig.findOne({ isActive: true }).lean();

    if (!config) {
      return Response.json({
        success: true,
        data: null,
        message: 'لم يتم العثور على إعدادات Firebase',
      });
    }

    // Mask the private key for security — show only last 10 characters
    const maskedPrivateKey = config.privateKey.length > 10
      ? '••••••••' + config.privateKey.slice(-10)
      : '••••••••';

    return Response.json({
      success: true,
      data: {
        id: config._id.toString(),
        projectId: config.projectId,
        clientEmail: config.clientEmail,
        privateKey: maskedPrivateKey,
        storageBucket: config.storageBucket || '',
        isActive: config.isActive,
        createdAt: config.createdAt,
        updatedAt: config.updatedAt,
      },
    });
  } catch (error) {
    console.error('[FIREBASE-CONFIG GET ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب إعدادات Firebase', 500, 'INTERNAL_ERROR');
  }
}

// ── POST: Save/update Firebase config ───────────────────────────────

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const body = await request.json();
    const { projectId, clientEmail, privateKey, storageBucket } = body;

    // Validate required fields
    if (!projectId || !clientEmail || !privateKey) {
      return createErrorResponse(
        'حقول مطلوبة: معرف المشروع، البريد الإلكتروني، المفتاح الخاص',
        400,
        'VALIDATION_ERROR'
      );
    }

    // Validate private key format (should contain BEGIN PRIVATE KEY)
    const processedKey = privateKey.replace(/\\n/g, '\n');
    if (!processedKey.includes('-----BEGIN PRIVATE KEY-----')) {
      // Try base64 decode
      try {
        const decoded = Buffer.from(privateKey, 'base64').toString('utf-8');
        if (!decoded.includes('-----BEGIN PRIVATE KEY-----')) {
          return createErrorResponse(
            'صيغة المفتاح الخاص غير صالحة. يجب أن يكون بتنسيق PEM أو Base64',
            400,
            'INVALID_KEY_FORMAT'
          );
        }
      } catch {
        return createErrorResponse(
          'صيغة المفتاح الخاص غير صالحة. يجب أن يكون بتنسيق PEM أو Base64',
          400,
          'INVALID_KEY_FORMAT'
        );
      }
    }

    // Validate client email format
    if (!clientEmail.includes('@')) {
      return createErrorResponse(
        'البريد الإلكتروني للعميل غير صالح',
        400,
        'INVALID_EMAIL'
      );
    }

    // Deactivate any existing active configs (only keep one active)
    await FirebaseConfig.updateMany(
      { isActive: true },
      { isActive: false }
    );

    // Create new config
    const config = await FirebaseConfig.create({
      projectId: projectId.trim(),
      clientEmail: clientEmail.trim(),
      privateKey: privateKey, // Store as-is (already encrypted in transit)
      storageBucket: storageBucket?.trim() || '',
      isActive: true,
    });

    // Re-initialize Firebase Admin SDK with new credentials
    try {
      await reinitializeFirebaseAdmin();
      console.log('[FIREBASE-CONFIG] Firebase Admin SDK re-initialized with new credentials');
    } catch (reinitError) {
      console.warn('[FIREBASE-CONFIG] Failed to re-initialize Firebase Admin SDK:', reinitError);
      // Don't fail the request — config is saved, SDK can be re-initialized later
    }

    // Log the activity
    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'update_firebase_config',
      entity: 'FirebaseConfig',
      details: 'تحديث إعدادات Firebase Admin SDK',
      request,
    });

    const configObj = config.toObject();

    // Mask private key in response
    const maskedPrivateKey = configObj.privateKey.length > 10
      ? '••••••••' + configObj.privateKey.slice(-10)
      : '••••••••';

    return Response.json({
      success: true,
      data: {
        id: configObj._id.toString(),
        projectId: configObj.projectId,
        clientEmail: configObj.clientEmail,
        privateKey: maskedPrivateKey,
        storageBucket: configObj.storageBucket || '',
        isActive: configObj.isActive,
        createdAt: configObj.createdAt,
        updatedAt: configObj.updatedAt,
      },
      message: 'تم حفظ إعدادات Firebase بنجاح',
    });
  } catch (error) {
    console.error('[FIREBASE-CONFIG POST ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء حفظ إعدادات Firebase', 500, 'INTERNAL_ERROR');
  }
}

// ── DELETE: Deactivate current Firebase config ──────────────────────

export async function DELETE(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const config = await FirebaseConfig.findOne({ isActive: true });

    if (!config) {
      return createErrorResponse(
        'لا توجد إعدادات Firebase نشطة للحذف',
        404,
        'NOT_FOUND'
      );
    }

    config.isActive = false;
    await config.save();

    // Log the activity
    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'delete_firebase_config',
      entity: 'FirebaseConfig',
      details: 'تعطيل إعدادات Firebase Admin SDK',
      request,
    });

    return Response.json({
      success: true,
      message: 'تم تعطيل إعدادات Firebase بنجاح',
    });
  } catch (error) {
    console.error('[FIREBASE-CONFIG DELETE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تعطيل إعدادات Firebase', 500, 'INTERNAL_ERROR');
  }
}
