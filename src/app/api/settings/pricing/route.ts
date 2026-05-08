// GET /api/settings/pricing - Public endpoint for pricing settings
// No authentication required - beneficiaries need this for price calculation

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { AdminSettings } from '@/models/mongoose';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const settings = await AdminSettings.findOne().lean();

    return Response.json({
      success: true,
      data: {
        commissionRate: settings?.commissionRate || 15,
        emergencyFee: settings?.emergencyFee || 5000,
        nightFeeEnabled: settings?.nightFeeEnabled ?? false,
        nightFeePercent: settings?.nightFeePercent || 0,
        nightStartHour: settings?.nightStartHour || 22,
        nightEndHour: settings?.nightEndHour || 6,
        fridayFeeEnabled: settings?.fridayFeeEnabled ?? false,
        fridayFeePercent: settings?.fridayFeePercent || 0,
        loyaltyPointsPerRial: settings?.loyaltyPointsPerRial || 1,
        loyaltyRedemptionRate: settings?.loyaltyRedemptionRate || 0,
        loyaltyRedemptionThreshold: settings?.loyaltyRedemptionThreshold || 100,
      },
    });
  } catch (error) {
    console.error('[PRICING SETTINGS ERROR]', error);
    return Response.json({
      success: true,
      data: {
        commissionRate: 15,
        emergencyFee: 5000,
        nightFeeEnabled: false,
        nightFeePercent: 0,
        nightStartHour: 22,
        nightEndHour: 6,
        fridayFeeEnabled: false,
        fridayFeePercent: 0,
        loyaltyPointsPerRial: 1,
        loyaltyRedemptionRate: 0,
        loyaltyRedemptionThreshold: 100,
      },
    });
  }
}
