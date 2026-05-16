// GET /api/settings/support - Get support contact info (public)
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
        supportPhone: settings?.supportPhone || '',
        supportEmail: settings?.supportEmail || '',
        supportWhatsApp: settings?.supportWhatsApp || '',
        supportPhones: settings?.supportPhones || [],
        supportWhatsAppNumbers: settings?.supportWhatsAppNumbers || [],
      },
    });
  } catch (error) {
    console.error('[SUPPORT SETTINGS ERROR]', error);
    return Response.json({
      success: true,
      data: {
        supportPhone: '',
        supportEmail: '',
        supportWhatsApp: '',
        supportPhones: [],
        supportWhatsAppNumbers: [],
      },
    });
  }
}
