// GET /api/nurse/special-requests
// قائمة طلبات الخدمات الخاصة المعينة للممرض

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SpecialServiceRequest, Beneficiary } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { serializeDoc } from '@/lib/mongoose/serialize';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const filter: any = { nurseId: user.userId };
    if (status && status !== 'all') {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }

    const requests = await SpecialServiceRequest.find(filter)
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .lean();

    // إضافة عداد غير المقروء لكل طلب
    const enriched = requests.map((r: any) => {
      const unreadCount = r.unreadCount instanceof Map
        ? (r.unreadCount as Map<string, number>).get(user.userId) || 0
        : (r.unreadCount as Record<string, number>)?.[user.userId] || 0;
      return {
        ...serializeDoc(r),
        unreadCount,
      };
    });

    return Response.json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    console.error('[NURSE SPECIAL REQUESTS LIST ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب الطلبات', 500, 'INTERNAL_ERROR');
  }
}
