// GET /api/settings/services-status
// حالة تفعيل/تعطيل خدمة "طلب الخدمة الخاصة"
// مسار عام (لا يتطلب مصادقة) - يستخدم للواجهات العامة لمعرفة إن كانت الخدمة متاحة

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { AdminSettings } from '@/models/mongoose';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    await connectDB();

    const settings = await AdminSettings.findOne()
      .lean()
      .select('specialServicesEnabled');

    // افتراضي: مفعّل إذا لم تكن هناك إعدادات
    const servicesEnabled = settings?.specialServicesEnabled !== false;

    return Response.json({
      success: true,
      data: {
        servicesEnabled,
        specialServicesEnabled: servicesEnabled,
      },
    });
  } catch (error) {
    console.error('[SERVICES STATUS ERROR]', error);
    // في حالة الخطأ، نُرجع true حتى لا نمنع المستخدمين بدون سبب
    return Response.json({
      success: true,
      data: {
        servicesEnabled: true,
        specialServicesEnabled: true,
      },
    });
  }
}
