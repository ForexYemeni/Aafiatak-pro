// GET /api/specializations — Fetch all active specializations (public/authenticated)

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Specialization } from '@/models/mongoose/Specialization';
import { DEFAULT_SPECIALIZATIONS } from '@/lib/constants';

export async function GET(_request: NextRequest) {
  try {
    await connectDB();

    let specs = await Specialization.find({ isActive: true })
      .sort({ order: 1, category: 1 })
      .lean();

    // If no specs in DB yet, seed defaults and return them
    if (!specs || specs.length === 0) {
      await seedDefaults();
      specs = await Specialization.find({ isActive: true })
        .sort({ order: 1, category: 1 })
        .lean();
    }

    return Response.json({
      success: true,
      data: specs.map((s: any) => ({
        id: s.id,
        label: s.label,
        category: s.category,
        isActive: s.isActive,
      })),
    });
  } catch (error) {
    // Fallback to hardcoded defaults if DB fails
    return Response.json({
      success: true,
      data: DEFAULT_SPECIALIZATIONS,
    });
  }
}

async function seedDefaults() {
  const ops = DEFAULT_SPECIALIZATIONS.map((s, i) => ({
    updateOne: {
      filter: { id: s.id },
      update: {
        $setOnInsert: {
          id: s.id,
          label: s.label,
          category: s.category,
          isActive: true,
          isDefault: true,
          order: i,
        },
      },
      upsert: true,
    },
  }));
  await Specialization.bulkWrite(ops);
}
