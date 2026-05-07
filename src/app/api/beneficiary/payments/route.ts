// GET /api/beneficiary/payments - Get payment history
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Transaction, Beneficiary } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const [transactions, total, beneficiary] = await Promise.all([
      Transaction.find({ beneficiaryId: user.userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Transaction.countDocuments({ beneficiaryId: user.userId }),
      Beneficiary.findById(user.userId).select('totalSpent orderCount').lean(),
    ]);

    return Response.json({
      success: true,
      data: {
        totalSpent: beneficiary?.totalSpent || 0,
        orderCount: beneficiary?.orderCount || 0,
        transactions: transactions.map((t: any) => ({ ...t, id: t._id.toString() })),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[BENEFICIARY PAYMENTS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب سجل المدفوعات', 500, 'INTERNAL_ERROR');
  }
}
