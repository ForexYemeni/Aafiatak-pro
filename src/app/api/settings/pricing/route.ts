// GET /api/settings/pricing - Public endpoint for pricing settings
// No authentication required - beneficiaries need this for price calculation
// IMPORTANT: All fee values come from AdminSettings DB — NO hardcoded fallbacks

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { AdminSettings } from '@/models/mongoose';

// Default values ONLY used if DB has no settings document at all
const PRICING_DEFAULTS = {
  commissionRate: 15,
  emergencyFee: 5000,
  nightFeeEnabled: true,
  nightFeePercent: 20,
  nightStartHour: 22,
  nightEndHour: 6,
  fridayFeeEnabled: true,
  fridayFeePercent: 15,
  loyaltyPointsPerRial: 1,
  loyaltyRedemptionRate: 0,
  loyaltyRedemptionThreshold: 100,
};

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const settings = await AdminSettings.findOne().lean();

    // Build response from DB values, with cache-control to prevent stale data
    const data = {
      commissionRate: settings?.commissionRate ?? PRICING_DEFAULTS.commissionRate,
      emergencyFee: settings?.emergencyFee ?? PRICING_DEFAULTS.emergencyFee,
      nightFeeEnabled: settings?.nightFeeEnabled ?? PRICING_DEFAULTS.nightFeeEnabled,
      nightFeePercent: settings?.nightFeePercent ?? PRICING_DEFAULTS.nightFeePercent,
      nightStartHour: settings?.nightStartHour ?? PRICING_DEFAULTS.nightStartHour,
      nightEndHour: settings?.nightEndHour ?? PRICING_DEFAULTS.nightEndHour,
      fridayFeeEnabled: settings?.fridayFeeEnabled ?? PRICING_DEFAULTS.fridayFeeEnabled,
      fridayFeePercent: settings?.fridayFeePercent ?? PRICING_DEFAULTS.fridayFeePercent,
      loyaltyPointsPerRial: settings?.loyaltyPointsPerRial ?? PRICING_DEFAULTS.loyaltyPointsPerRial,
      loyaltyRedemptionRate: settings?.loyaltyRedemptionRate ?? PRICING_DEFAULTS.loyaltyRedemptionRate,
      loyaltyRedemptionThreshold: settings?.loyaltyRedemptionThreshold ?? PRICING_DEFAULTS.loyaltyRedemptionThreshold,
    };

    return Response.json({
      success: true,
      data,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('[PRICING SETTINGS ERROR]', error);
    // On error, still return defaults — never leave client without pricing data
    return Response.json({
      success: true,
      data: PRICING_DEFAULTS,
    });
  }
}
