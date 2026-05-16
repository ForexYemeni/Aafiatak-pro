// GET/POST /api/admin/specializations — Admin manage specializations

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Specialization } from '@/models/mongoose/Specialization';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { DEFAULT_SPECIALIZATIONS } from '@/lib/constants';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    let specs = await Specialization.find()
      .sort({ order: 1, category: 1 })
      .lean();

    // Seed if empty
    if (!specs || specs.length === 0) {
      const ops = DEFAULT_SPECIALIZATIONS.map((s, i) => ({
        updateOne: {
          filter: { id: s.id },
          update: {
            $setOnInsert: {
              id: s.id, label: s.label, category: s.category,
              isActive: true, isDefault: true, order: i,
            },
          },
          upsert: true,
        },
      }));
      await Specialization.bulkWrite(ops);
      specs = await Specialization.find().sort({ order: 1, category: 1 }).lean();
    }

    return Response.json({ success: true, data: specs });
  } catch (error) {
    console.error('[ADMIN SPEC GET ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const body = await request.json();
    const { id, label, category } = body;

    if (!id || !label || !category) {
      return createErrorResponse('المعرف والاسم والفئة مطلوبة', 400, 'VALIDATION_ERROR');
    }

    // Check for duplicate id
    const existing = await Specialization.findOne({ id });
    if (existing) {
      return createErrorResponse('يوجد تخصص بهذا المعرف بالفعل', 409, 'DUPLICATE');
    }

    // Get max order
    const maxOrder = await Specialization.findOne().sort({ order: -1 }).lean();
    const order = maxOrder ? (maxOrder as any).order + 1 : 0;

    const spec = await Specialization.create({
      id, label, category, isActive: true, isDefault: false, order,
    });

    return Response.json({ success: true, data: spec }, { status: 201 });
  } catch (error) {
    console.error('[ADMIN SPEC POST ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}
