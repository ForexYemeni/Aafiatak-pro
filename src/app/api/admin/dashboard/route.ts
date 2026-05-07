// GET /api/admin/dashboard - Dashboard statistics

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireRole, successResponse, handleApiError } from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(request, 'admin', 'subadmin');

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Total counts
    const [totalNurses, totalBeneficiaries, totalServiceRequests, totalEmergencyRequests] = await Promise.all([
      db.nurse.count(),
      db.beneficiary.count(),
      db.serviceRequest.count(),
      db.emergencyRequest.count(),
    ]);

    // Nurse status breakdown
    const [totalActiveNurses, totalPendingNurses, totalVerifiedNurses] = await Promise.all([
      db.nurse.count({ where: { isActive: true, verificationStatus: 'verified' } }),
      db.nurse.count({ where: { verificationStatus: 'pending' } }),
      db.nurse.count({ where: { verificationStatus: 'verified' } }),
    ]);

    // Order status breakdown
    const [totalCompletedRequests, totalCancelledRequests, pendingOrders, activeOrders] = await Promise.all([
      db.serviceRequest.count({ where: { status: 'completed' } }),
      db.serviceRequest.count({ where: { status: 'cancelled' } }),
      db.serviceRequest.count({ where: { status: 'pending' } }),
      db.serviceRequest.count({ where: { status: { in: ['assigned', 'accepted', 'in_progress'] } } }),
    ]);

    // Revenue - sum of completed transactions
    const completedTransactions = await db.transaction.findMany({
      where: { status: 'completed' },
      select: { amount: true, commission: true, netAmount: true },
    });

    const totalRevenue = completedTransactions.reduce((sum, t) => sum + t.amount, 0);
    const totalCommission = completedTransactions.reduce((sum, t) => sum + t.commission, 0);
    const totalNursePayouts = completedTransactions.reduce((sum, t) => sum + t.netAmount, 0);

    // Today's stats
    const [todayOrders, todayNewBeneficiaries, todayNewNurses] = await Promise.all([
      db.serviceRequest.count({ where: { createdAt: { gte: todayStart } } }),
      db.beneficiary.count({ where: { createdAt: { gte: todayStart } } }),
      db.nurse.count({ where: { createdAt: { gte: todayStart } } }),
    ]);

    const todayTransactions = await db.transaction.findMany({
      where: { status: 'completed', processedAt: { gte: todayStart } },
      select: { amount: true },
    });
    const todayRevenue = todayTransactions.reduce((sum, t) => sum + t.amount, 0);

    // Growth calculations - compare this week vs last week
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const [newBeneficiariesThisWeek, newBeneficiariesLastWeek, newNursesThisWeek, newNursesLastWeek, ordersThisWeek, ordersLastWeek] = await Promise.all([
      db.beneficiary.count({ where: { createdAt: { gte: weekStart } } }),
      db.beneficiary.count({ where: { createdAt: { gte: lastWeekStart, lt: weekStart } } }),
      db.nurse.count({ where: { createdAt: { gte: weekStart } } }),
      db.nurse.count({ where: { createdAt: { gte: lastWeekStart, lt: weekStart } } }),
      db.serviceRequest.count({ where: { createdAt: { gte: weekStart } } }),
      db.serviceRequest.count({ where: { createdAt: { gte: lastWeekStart, lt: weekStart } } }),
    ]);

    const beneficiaryGrowthRate = newBeneficiariesLastWeek > 0 ? ((newBeneficiariesThisWeek - newBeneficiariesLastWeek) / newBeneficiariesLastWeek) * 100 : 0;
    const nurseGrowthRate = newNursesLastWeek > 0 ? ((newNursesThisWeek - newNursesLastWeek) / newNursesLastWeek) * 100 : 0;
    const orderGrowthRate = ordersLastWeek > 0 ? ((ordersThisWeek - ordersLastWeek) / ordersLastWeek) * 100 : 0;

    // Active emergencies
    const activeEmergencies = await db.emergencyRequest.count({
      where: { status: { in: ['pending', 'dispatched', 'in_progress'] } },
    });

    // Average rating
    const nursesWithRatings = await db.nurse.findMany({
      where: { reviewCount: { gt: 0 } },
      select: { rating: true, reviewCount: true },
    });
    const totalReviews = nursesWithRatings.reduce((sum, n) => sum + n.reviewCount, 0);
    const averageRating = totalReviews > 0 ? nursesWithRatings.reduce((sum, n) => sum + n.rating * n.reviewCount, 0) / totalReviews : 0;

    // Referrals
    const totalReferrals = await db.referral.count();

    // Revenue chart data (last 7 days)
    const revenueChartData = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(todayStart);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayTransactions = await db.transaction.findMany({
        where: { status: 'completed', processedAt: { gte: dayStart, lt: dayEnd } },
        select: { amount: true },
      });
      const dayRevenue = dayTransactions.reduce((sum, t) => sum + t.amount, 0);
      revenueChartData.push({
        date: dayStart.toISOString().split('T')[0],
        revenue: dayRevenue,
      });
    }

    // Orders chart data (last 7 days)
    const ordersChartData = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(todayStart);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const dayOrders = await db.serviceRequest.count({
        where: { createdAt: { gte: dayStart, lt: dayEnd } },
      });
      ordersChartData.push({
        date: dayStart.toISOString().split('T')[0],
        orders: dayOrders,
      });
    }

    const dashboardData = {
      totalBeneficiaries,
      totalNurses,
      totalActiveNurses,
      totalPendingNurses,
      totalVerifiedNurses,
      totalServiceRequests,
      totalCompletedRequests,
      totalCancelledRequests,
      totalEmergencyRequests,
      totalRevenue: Math.round(totalRevenue),
      totalCommission: Math.round(totalCommission),
      totalNursePayouts: Math.round(totalNursePayouts),
      totalReferrals,
      averageRating: Math.round(averageRating * 10) / 10,
      beneficiaryGrowthRate: Math.round(beneficiaryGrowthRate * 10) / 10,
      nurseGrowthRate: Math.round(nurseGrowthRate * 10) / 10,
      revenueGrowthRate: 0,
      orderGrowthRate: Math.round(orderGrowthRate * 10) / 10,
      pendingVerifications: totalPendingNurses,
      activeEmergencies,
      todayRevenue: Math.round(todayRevenue),
      todayOrders,
      todayNewBeneficiaries,
      todayNewNurses,
      pendingOrders,
      activeOrders,
      revenueChartData,
      ordersChartData,
    };

    return successResponse(dashboardData);
  } catch (error) {
    return handleApiError(error);
  }
}
