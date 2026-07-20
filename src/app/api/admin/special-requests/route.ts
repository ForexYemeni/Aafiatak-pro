// GET /api/admin/special-requests
// قائمة جميع طلبات الخدمات الخاصة للإدارة

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SpecialServiceRequest, Nurse } from '@/models/mongoose';
import { requireSubadminPermission, createErrorResponse } from '@/lib/auth/middleware';
import { serializeDoc } from '@/lib/mongoose/serialize';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_orders');
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const filter: any = {};
    if (status && status !== 'all') {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }

    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      filter.$or = [
        { beneficiaryName: { $regex: escapedSearch, $options: 'i' } },
        { beneficiaryPhone: { $regex: escapedSearch, $options: 'i' } },
        { serviceName: { $regex: escapedSearch, $options: 'i' } },
      ];
    }

    const [requests, total] = await Promise.all([
      SpecialServiceRequest.find(filter)
        .sort({ lastMessageAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      SpecialServiceRequest.countDocuments(filter),
    ]);

    // جلب أسماء الممرضين المعينين
    const nurseIds = [...new Set(requests.map((r: any) => r.nurseId?.toString()).filter(Boolean))];
    const nurses = nurseIds.length > 0
      ? await Nurse.find({ _id: { $in: nurseIds } }).select('name phone rating').lean()
      : [];
    const nurseMap = new Map(nurses.map((n: any) => [n._id.toString(), n]));

    const enriched = requests.map((r: any) => {
      const nurse = r.nurseId ? nurseMap.get(r.nurseId.toString()) : null;
      // حساب عداد غير المقروء للمستخدم الحالي
      const unreadCount = r.unreadCount instanceof Map
        ? (r.unreadCount as Map<string, number>).get(user.userId) || 0
        : (r.unreadCount as Record<string, number>)?.[user.userId] || 0;
      return {
        ...serializeDoc(r),
        nurseName: nurse?.name || null,
        nursePhone: nurse?.phone || null,
        nurseRating: nurse?.rating || 0,
        unreadCount,
      };
    });

    return Response.json({
      success: true,
      data: {
        requests: enriched,
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[ADMIN SPECIAL REQUESTS LIST ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب الطلبات', 500, 'INTERNAL_ERROR');
  }
}
