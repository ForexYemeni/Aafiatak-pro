// GET /api/admin/transactions - List transactions with populated names
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Transaction, Beneficiary, Nurse } from '@/models/mongoose';
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
    const paymentMethod = searchParams.get('paymentMethod');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const filter: any = {};
    if (status) filter.status = status;
    if (paymentMethod) filter.paymentMethod = paymentMethod;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // If search term provided, find matching beneficiaries/nurses
    if (search) {
      const matchedBeneficiaries = await Beneficiary.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search } },
        ]
      }).select('_id').lean();
      const matchedNurses = await Nurse.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search } },
        ]
      }).select('_id').lean();

      const beneficiaryIds = matchedBeneficiaries.map((b: any) => b._id);
      const nurseIds = matchedNurses.map((n: any) => n._id);

      filter.$or = [
        { beneficiaryId: { $in: beneficiaryIds } },
        { nurseId: { $in: nurseIds } },
      ];
    }

    const [transactions, total] = await Promise.all([
      Transaction.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Transaction.countDocuments(filter),
    ]);

    // Populate names
    const beneficiaryIds = [...new Set(transactions.map((t: any) => t.beneficiaryId?.toString()).filter(Boolean))];
    const nurseIds = [...new Set(transactions.map((t: any) => t.nurseId?.toString()).filter(Boolean))];

    const [beneficiaries, nurses] = await Promise.all([
      Beneficiary.find({ _id: { $in: beneficiaryIds } }).select('name').lean(),
      Nurse.find({ _id: { $in: nurseIds } }).select('name').lean(),
    ]);

    const beneficiaryMap = new Map(beneficiaries.map((b: any) => [b._id.toString(), b.name]));
    const nurseMap = new Map(nurses.map((n: any) => [n._id.toString(), n.name]));

    const populatedTransactions = transactions.map((t: any) => ({
      ...t,
      id: t._id.toString(),
      beneficiaryName: beneficiaryMap.get(t.beneficiaryId?.toString()) || 'غير معروف',
      nurseName: t.nurseId ? (nurseMap.get(t.nurseId?.toString()) || null) : null,
    }));

    return Response.json({
      success: true,
      data: {
        transactions: populatedTransactions,
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[ADMIN TRANSACTIONS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب المعاملات', 500, 'INTERNAL_ERROR');
  }
}
