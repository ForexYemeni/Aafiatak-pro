// GET /api/settings/legal - Get legal documents content (public)
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
        termsAndConditionsAr: settings?.termsAndConditionsAr || '',
        privacyPolicyAr: settings?.privacyPolicyAr || '',
      },
    });
  } catch (error) {
    console.error('[LEGAL SETTINGS ERROR]', error);
    return Response.json({
      success: true,
      data: {
        termsAndConditionsAr: '',
        privacyPolicyAr: '',
      },
    });
  }
}
