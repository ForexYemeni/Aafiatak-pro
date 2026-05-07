// GET /api/admin/settings - Get platform settings
// PATCH /api/admin/settings - Update platform settings

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireRole, successResponse, handleApiError, logActivity,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    await requireRole(request, 'admin', 'subadmin');

    let settings = await db.adminSettings.findFirst();
    if (!settings) {
      // Create default settings
      settings = await db.adminSettings.create({ data: {} });
    }

    return successResponse(settings);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireRole(request, 'admin');

    const body = await request.json();

    let settings = await db.adminSettings.findFirst();
    if (!settings) {
      settings = await db.adminSettings.create({ data: {} });
    }

    const allowedFields = [
      'commissionRate', 'emergencyFee', 'nightFeePercent', 'fridayFeePercent',
      'nightStartHour', 'nightEndHour', 'minOrderAmount', 'loyaltyPointsPerOrder',
      'loyaltyRedemptionThreshold', 'referralReward', 'maxNurseAssignmentRadius',
      'autoAssignEnabled', 'emergencyAutoDispatch', 'maintenanceMode',
      'maintenanceMessageAr', 'maintenanceMessageEn', 'supportPhone', 'supportWhatsApp',
      'termsAndConditionsAr', 'termsAndConditionsEn', 'privacyPolicyAr', 'privacyPolicyEn',
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    const updated = await db.adminSettings.update({
      where: { id: settings.id },
      data: updateData,
    });

    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'update_settings',
      entity: 'AdminSettings',
      entityId: settings.id,
      details: 'تم تحديث إعدادات المنصة',
      request,
    });

    return successResponse(updated, 'تم تحديث الإعدادات بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}
