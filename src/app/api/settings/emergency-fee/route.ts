// GET /api/settings/emergency-fee - Public endpoint for emergency fee
// No authentication required - this is public info beneficiaries need

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { AdminSettings } from '@/models/mongoose';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const settings = await AdminSettings.findOne().lean();
    const emergencyFee = settings?.emergencyFee || 5000;

    return Response.json({
      success: true,
      data: { emergencyFee },
    });
  } catch (error) {
    console.error('[EMERGENCY FEE ERROR]', error);
    return Response.json({
      success: true,
      data: { emergencyFee: 5000 },
    });
  }
}
