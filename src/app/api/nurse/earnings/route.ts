// GET /api/nurse/earnings - Get nurse earnings
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse, Transaction } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'all'; // all, week, month

    // Get nurse earnings summary
    const nurse = await Nurse.findById(user.userId).select('totalEarnings availableBalance completedJobs').lean();
    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    // Get transaction history
    const dateFilter: any = { nurseId: user.userId, status: 'completed' };
    if (period === 'week') {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      dateFilter.createdAt = { $gte: weekAgo };
    } else if (period === 'month') {
      const monthAgo = new Date();
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      dateFilter.createdAt = { $gte: monthAgo };
    }

    const [transactions, periodAgg] = await Promise.all([
      Transaction.find(dateFilter)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Transaction.aggregate([
        { $match: dateFilter },
        { $group: { _id: null, totalEarnings: { $sum: '$netAmount' }, totalCommission: { $sum: '$commission' }, count: { $sum: 1 } } },
      ]),
    ]);

    return Response.json({
      success: true,
      data: {
        totalEarnings: nurse.totalEarnings,
        availableBalance: nurse.availableBalance,
        completedJobs: nurse.completedJobs,
        periodEarnings: periodAgg[0]?.totalEarnings || 0,
        periodCommission: periodAgg[0]?.totalCommission || 0,
        periodCount: periodAgg[0]?.count || 0,
        transactions: transactions.map((t: any) => ({ ...t, id: t._id.toString() })),
      },
    });
  } catch (error) {
    console.error('[NURSE EARNINGS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب الأرباح', 500, 'INTERNAL_ERROR');
  }
}
