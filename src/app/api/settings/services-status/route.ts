// GET /api/settings/services-status
// حالة تفعيل/تعطيل الخدمات (عامة + خاصة)
// مسار عام (لا يتطلب مصادقة) - يستخدم للواجهات العامة لمعرفة إن كانت الخدمات متاحة

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { AdminSettings } from '@/models/mongoose';

export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest) {
  try {
    await connectDB();

    const settings = await AdminSettings.findOne()
      .lean()
      .select('specialServicesEnabled generalServicesEnabled');

    // افتراضي: مفعّل إذا لم تكن هناك إعدادات
    const specialServicesEnabled = settings?.specialServicesEnabled !== false;
    const generalServicesEnabled = settings?.generalServicesEnabled !== false;

    return Response.json({
      success: true,
      data: {
        // للخدمات الخاصة (متخلف مع الواجهة الأمامية القديمة)
        servicesEnabled: specialServicesEnabled,
        specialServicesEnabled,
        // للخدمات العامة (طلبات عادية + طوارئ + تكليفات)
        generalServicesEnabled,
        allServicesEnabled: generalServicesEnabled,
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
        generalServicesEnabled: true,
        allServicesEnabled: true,
      },
    });
  }
}
