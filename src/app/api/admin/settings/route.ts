// GET/PATCH /api/admin/settings - Get/update platform settings
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { AdminSettings } from '@/models/mongoose';
import { requireSubadminPermission, requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';
import { emitToAdmins } from '@/lib/notifications/socket-client';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    // Only full admin can view platform settings (not subadmin)
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    let settings = await AdminSettings.findOne().lean();
    if (!settings) {
      // Create default settings if none exist
      settings = await AdminSettings.create({});
      settings = settings.toObject();
    }

    return Response.json({ success: true, data: serializeDoc(settings) });
  } catch (error) {
    console.error('[ADMIN SETTINGS GET ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب الإعدادات', 500, 'INTERNAL_ERROR');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const body = await request.json();
    delete body._id;

    let settings = await AdminSettings.findOne();
    if (!settings) {
      settings = await AdminSettings.create(body);
    } else {
      Object.assign(settings, body);
      await settings.save();
    }

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'update_settings',
      entity: 'AdminSettings',
      details: 'تحديث إعدادات المنصة',
      request,
    });

    const settingsObj = settings.toObject();

    emitToAdmins('data_change', { entity: 'settings', entityId: 'platform', action: 'updated', timestamp: new Date().toISOString() }).catch(() => {});

    return Response.json({
      success: true,
      data: serializeDoc(settingsObj),
      message: 'تم تحديث الإعدادات بنجاح',
    });
  } catch (error) {
    console.error('[ADMIN SETTINGS UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تحديث الإعدادات', 500, 'INTERNAL_ERROR');
  }
}
