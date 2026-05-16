// GET /api/admin/beneficiaries - List all beneficiaries with pagination/search
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Beneficiary } from '@/models/mongoose';
import { requireSubadminPermission, requireRole, createErrorResponse } from '@/lib/auth/middleware';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_beneficiaries');
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const governorate = searchParams.get('governorate');

    const filter: any = { role: 'beneficiary' };
    if (governorate) filter.governorate = governorate;
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search } },
      ];
    }

    const [beneficiaries, total] = await Promise.all([
      Beneficiary.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Beneficiary.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: {
        beneficiaries: beneficiaries.map((b: any) => (serializeDoc(b))),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[ADMIN BENEFICIARIES ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب بيانات المستفيدين', 500, 'INTERNAL_ERROR');
  }
}
