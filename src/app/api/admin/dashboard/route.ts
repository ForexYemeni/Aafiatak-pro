// GET /api/admin/dashboard - Dashboard statistics
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User, Nurse, Beneficiary, ServiceRequest, EmergencyRequest, Transaction, Referral } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    // Allow all admins and subadmins to view the dashboard (no specific permission needed)
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const lastWeekStart = new Date(weekStart);
    lastWeekStart.setDate(lastWeekStart.getDate() - 7);

    const [
      totalNurses,
      totalVerifiedNurses,
      totalPendingNurses,
      totalBeneficiaries,
      totalServiceRequests,
      totalCompletedRequests,
      totalCancelledRequests,
      pendingOrders,
      activeOrders,
      totalEmergencyRequests,
      activeEmergencies,
      totalReferrals,
      todayOrders,
      todayNewBeneficiaries,
      todayNewNurses,
      newBeneficiariesThisWeek,
      newBeneficiariesLastWeek,
      newNursesThisWeek,
      newNursesLastWeek,
      ordersThisWeek,
      ordersLastWeek,
      revenueAgg,
      todayRevenueAgg,
      nursesWithRatings,
    ] = await Promise.all([
      Nurse.countDocuments({ role: 'nurse' }),
      Nurse.countDocuments({ role: 'nurse', verificationStatus: 'verified' }),
      Nurse.countDocuments({ role: 'nurse', verificationStatus: 'pending' }),
      Beneficiary.countDocuments({ role: 'beneficiary' }),
      ServiceRequest.countDocuments(),
      ServiceRequest.countDocuments({ status: 'completed' }),
      ServiceRequest.countDocuments({ status: 'cancelled' }),
      ServiceRequest.countDocuments({ status: 'pending' }),
      ServiceRequest.countDocuments({ status: { $in: ['assigned', 'accepted', 'in_progress'] } }),
      EmergencyRequest.countDocuments(),
      EmergencyRequest.countDocuments({ status: { $in: ['pending', 'dispatched', 'in_progress'] } }),
      Referral.countDocuments(),
      ServiceRequest.countDocuments({ createdAt: { $gte: todayStart } }),
      Beneficiary.countDocuments({ role: 'beneficiary', createdAt: { $gte: todayStart } }),
      Nurse.countDocuments({ role: 'nurse', createdAt: { $gte: todayStart } }),
      Beneficiary.countDocuments({ role: 'beneficiary', createdAt: { $gte: weekStart } }),
      Beneficiary.countDocuments({ role: 'beneficiary', createdAt: { $gte: lastWeekStart, $lt: weekStart } }),
      Nurse.countDocuments({ role: 'nurse', createdAt: { $gte: weekStart } }),
      Nurse.countDocuments({ role: 'nurse', createdAt: { $gte: lastWeekStart, $lt: weekStart } }),
      ServiceRequest.countDocuments({ createdAt: { $gte: weekStart } }),
      ServiceRequest.countDocuments({ createdAt: { $gte: lastWeekStart, $lt: weekStart } }),
      Transaction.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, totalRevenue: { $sum: '$amount' }, totalCommission: { $sum: '$commission' }, totalNursePayouts: { $sum: '$netAmount' } } },
      ]),
      Transaction.aggregate([
        { $match: { status: 'completed', processedAt: { $gte: todayStart } } },
        { $group: { _id: null, total: { $sum: '$amount' } } },
      ]),
      Nurse.find({ reviewCount: { $gt: 0 } }).select('rating reviewCount').lean(),
    ]);

    const totalRevenue = revenueAgg[0]?.totalRevenue || 0;
    const totalCommission = revenueAgg[0]?.totalCommission || 0;
    const totalNursePayouts = revenueAgg[0]?.totalNursePayouts || 0;
    const todayRevenue = todayRevenueAgg[0]?.total || 0;

    const totalReviews = nursesWithRatings.reduce((sum: number, n: any) => sum + n.reviewCount, 0);
    const averageRating = totalReviews > 0 ? nursesWithRatings.reduce((sum: number, n: any) => sum + n.rating * n.reviewCount, 0) / totalReviews : 0;

    const beneficiaryGrowthRate = newBeneficiariesLastWeek > 0 ? ((newBeneficiariesThisWeek - newBeneficiariesLastWeek) / newBeneficiariesLastWeek) * 100 : 0;
    const nurseGrowthRate = newNursesLastWeek > 0 ? ((newNursesThisWeek - newNursesLastWeek) / newNursesLastWeek) * 100 : 0;
    const orderGrowthRate = ordersLastWeek > 0 ? ((ordersThisWeek - ordersLastWeek) / ordersLastWeek) * 100 : 0;

    // Revenue chart data (last 7 days)
    const revenueChartData = [];
    const ordersChartData = [];
    for (let i = 6; i >= 0; i--) {
      const dayStart = new Date(todayStart);
      dayStart.setDate(dayStart.getDate() - i);
      const dayEnd = new Date(dayStart);
      dayEnd.setDate(dayEnd.getDate() + 1);

      const [dayRevAgg, dayOrders] = await Promise.all([
        Transaction.aggregate([
          { $match: { status: 'completed', processedAt: { $gte: dayStart, $lt: dayEnd } } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ]),
        ServiceRequest.countDocuments({ createdAt: { $gte: dayStart, $lt: dayEnd } }),
      ]);

      revenueChartData.push({ date: dayStart.toISOString().split('T')[0], revenue: dayRevAgg[0]?.total || 0 });
      ordersChartData.push({ date: dayStart.toISOString().split('T')[0], orders: dayOrders });
    }

    return Response.json({
      success: true,
      data: {
        totalBeneficiaries,
        totalNurses,
        totalActiveNurses: totalVerifiedNurses,
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
      },
    });
  } catch (error) {
    console.error('[ADMIN DASHBOARD ERROR]', error);
    return createErrorResponse('حدث خطأ في لوحة التحكم', 500, 'INTERNAL_ERROR');
  }
}
