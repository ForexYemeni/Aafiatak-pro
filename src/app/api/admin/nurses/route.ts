// GET /api/admin/nurses - List all nurses with pagination/search
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse } from '@/models/mongoose';
import { requireSubadminPermission, requireRole, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_nurses');
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const search = searchParams.get('search');
    const governorate = searchParams.get('governorate');

    const filter: any = { role: 'nurse' };
    if (status) filter.verificationStatus = status;
    if (governorate) filter.governorate = governorate;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search } },
      ];
    }

    const [nurses, total] = await Promise.all([
      Nurse.find(filter)
        .select('-password -identityDocumentData -licenseDocumentData')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Nurse.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: {
        nurses: nurses.map((n: any) => ({ ...n, id: n._id.toString() })),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[ADMIN NURSES ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب بيانات الممرضين', 500, 'INTERNAL_ERROR');
  }
}
