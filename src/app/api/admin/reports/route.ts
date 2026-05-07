// GET /api/admin/reports - Generate reports
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, Transaction, Nurse, Beneficiary, EmergencyRequest } from '@/models/mongoose';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type') || 'operational';
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const dateFilter: any = {};
    if (dateFrom || dateTo) {
      dateFilter.createdAt = {};
      if (dateFrom) dateFilter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) dateFilter.createdAt.$lte = new Date(dateTo);
    }

    let reportData: any = {};

    switch (type) {
      case 'financial': {
        const [revenueAgg, byMethod] = await Promise.all([
          Transaction.aggregate([
            { $match: { status: 'completed', ...dateFilter } },
            { $group: { _id: null, totalRevenue: { $sum: '$amount' }, totalCommission: { $sum: '$commission' }, totalPayouts: { $sum: '$netAmount' }, count: { $sum: 1 } } },
          ]),
          Transaction.aggregate([
            { $match: { status: 'completed', ...dateFilter } },
            { $group: { _id: '$paymentMethod', total: { $sum: '$amount' }, count: { $sum: 1 } } },
          ]),
        ]);
        reportData = {
          totalRevenue: revenueAgg[0]?.totalRevenue || 0,
          totalCommission: revenueAgg[0]?.totalCommission || 0,
          totalPayouts: revenueAgg[0]?.totalPayouts || 0,
          transactionCount: revenueAgg[0]?.count || 0,
          byPaymentMethod: byMethod.map((m: any) => ({ method: m._id, total: m.total, count: m.count })),
        };
        break;
      }

      case 'nurse_performance': {
        const nurses = await Nurse.find({ role: 'nurse', verificationStatus: 'verified' })
          .select('name completedJobs rating reviewCount totalEarnings availableBalance')
          .sort({ completedJobs: -1 })
          .limit(50)
          .lean();
        reportData = {
          nurses: nurses.map((n: any) => ({ ...n, id: n._id.toString() })),
        };
        break;
      }

      case 'beneficiary_activity': {
        const [totalBeneficiaries, newBeneficiaries, topSpenders] = await Promise.all([
          Beneficiary.countDocuments({ role: 'beneficiary' }),
          Beneficiary.countDocuments({ role: 'beneficiary', ...dateFilter }),
          Beneficiary.find({ role: 'beneficiary' })
            .select('name phone totalSpent orderCount loyaltyPoints loyaltyTier')
            .sort({ totalSpent: -1 })
            .limit(20)
            .lean(),
        ]);
        reportData = {
          totalBeneficiaries,
          newBeneficiaries,
          topSpenders: topSpenders.map((b: any) => ({ ...b, id: b._id.toString() })),
        };
        break;
      }

      default: {
        // Operational report
        const [ordersByStatus, emergenciesByStatus, orderCount, emergencyCount] = await Promise.all([
          ServiceRequest.aggregate([{ $match: dateFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
          EmergencyRequest.aggregate([{ $match: dateFilter }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
          ServiceRequest.countDocuments(dateFilter),
          EmergencyRequest.countDocuments(dateFilter),
        ]);
        reportData = {
          totalOrders: orderCount,
          totalEmergencies: emergencyCount,
          ordersByStatus: ordersByStatus.map((s: any) => ({ status: s._id, count: s.count })),
          emergenciesByStatus: emergenciesByStatus.map((s: any) => ({ status: s._id, count: s.count })),
        };
        break;
      }
    }

    return Response.json({ success: true, data: reportData });
  } catch (error) {
    console.error('[ADMIN REPORTS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إنشاء التقرير', 500, 'INTERNAL_ERROR');
  }
}
