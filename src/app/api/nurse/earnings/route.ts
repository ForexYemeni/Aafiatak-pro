// GET /api/nurse/earnings - Earnings summary

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireRole, successResponse, handleApiError,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(request, 'nurse');

    const nurse = await db.nurse.findUnique({
      where: { id: user.userId },
      select: {
        totalEarnings: true,
        availableBalance: true,
        completedJobs: true,
      },
    });

    if (!nurse) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الممرض' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Get recent payouts
    const recentPayouts = await db.nursePayout.findMany({
      where: { nurseId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    // Get this month's earnings
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    const monthTransactions = await db.transaction.findMany({
      where: {
        nurseId: user.userId,
        status: 'completed',
        processedAt: { gte: monthStart },
      },
      select: { netAmount: true },
    });

    const thisMonthEarnings = monthTransactions.reduce((sum, t) => sum + t.netAmount, 0);

    // Get last 7 days earnings for chart
    const dailyEarnings = [];
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(todayStart);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayTransactions = await db.transaction.findMany({
        where: {
          nurseId: user.userId,
          status: 'completed',
          processedAt: { gte: dayStart, lt: dayEnd },
        },
        select: { netAmount: true },
      });

      dailyEarnings.push({
        date: dayStart.toISOString().split('T')[0],
        earnings: dayTransactions.reduce((sum, t) => sum + t.netAmount, 0),
      });
    }

    return successResponse({
      totalEarnings: nurse.totalEarnings,
      availableBalance: nurse.availableBalance,
      completedJobs: nurse.completedJobs,
      thisMonthEarnings: Math.round(thisMonthEarnings),
      recentPayouts,
      dailyEarnings,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
