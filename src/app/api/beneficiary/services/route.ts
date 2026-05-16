// GET /api/beneficiary/services - List available services
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Service } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');

    const filter: any = { isActive: true };
    if (category) filter.category = category;

    const services = await Service.find(filter).sort({ sortOrder: 1, nameAr: 1 }).lean();

    return Response.json({
      success: true,
      data: services.map((s: any) => (serializeDoc(s))),
    });
  } catch (error) {
    console.error('[BENEFICIARY SERVICES ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب الخدمات', 500, 'INTERNAL_ERROR');
  }
}
