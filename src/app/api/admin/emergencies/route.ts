// GET /api/admin/emergencies - List emergency requests with populated names
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { EmergencyRequest, Beneficiary, Nurse } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const priority = searchParams.get('priority');

    const filter: any = {};
    if (status) filter.status = status;
    if (priority) filter.priority = priority;

    const [emergencies, total] = await Promise.all([
      EmergencyRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      EmergencyRequest.countDocuments(filter),
    ]);

    // Populate names
    const beneficiaryIds = [...new Set(emergencies.map((e: any) => e.beneficiaryId?.toString()).filter(Boolean))];
    const nurseIds = [...new Set(emergencies.map((e: any) => e.nurseId?.toString()).filter(Boolean))];

    const [beneficiaries, nurses] = await Promise.all([
      Beneficiary.find({ _id: { $in: beneficiaryIds } }).select('name phone').lean(),
      Nurse.find({ _id: { $in: nurseIds } }).select('name phone').lean(),
    ]);

    const beneficiaryMap = new Map(beneficiaries.map((b: any) => [b._id.toString(), b]));
    const nurseMap = new Map(nurses.map((n: any) => [n._id.toString(), n]));

    const populatedEmergencies = emergencies.map((e: any) => ({
      ...e,
      id: e._id.toString(),
      beneficiaryName: beneficiaryMap.get(e.beneficiaryId?.toString())?.name || 'غير معروف',
      beneficiaryPhone: beneficiaryMap.get(e.beneficiaryId?.toString())?.phone || '',
      nurseName: e.nurseId ? (nurseMap.get(e.nurseId?.toString())?.name || 'غير معروف') : null,
    }));

    return Response.json({
      success: true,
      data: {
        emergencies: populatedEmergencies,
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[ADMIN EMERGENCIES ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب طلبات الطوارئ', 500, 'INTERNAL_ERROR');
  }
}
