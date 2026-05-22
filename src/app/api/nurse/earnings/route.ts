// GET /api/nurse/earnings - Get nurse earnings
// POST /api/nurse/earnings - Request withdrawal
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse, Transaction, WithdrawalRequest, AdminSettings, Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { sendPushToUser } from '@/lib/notifications/push-service';
import { emitRealtimeEvent } from '@/lib/notifications/emit-realtime-event';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
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
    const nurse = await Nurse.findById(user.userId).select('totalEarnings availableBalance completedJobs name phone walletType walletNumber').lean();
    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    // Get withdrawal fee from settings
    const settings = await AdminSettings.findOne().select('withdrawalFee enabledWalletTypes').lean();
    const withdrawalFee = settings?.withdrawalFee ?? 200;
    const enabledWalletTypes = settings?.enabledWalletTypes?.length ? settings.enabledWalletTypes : ['جيب', 'جوالي', 'فلوسك', 'حوالة بنكية'];

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

    const [transactions, periodAgg, withdrawalRequests] = await Promise.all([
      Transaction.find(dateFilter)
        .sort({ createdAt: -1 })
        .limit(50)
        .lean(),
      Transaction.aggregate([
        { $match: dateFilter },
        { $group: { _id: null, totalEarnings: { $sum: '$netAmount' }, totalCommission: { $sum: '$commission' }, count: { $sum: 1 } } },
      ]),
      WithdrawalRequest.find({ nurseId: user.userId })
        .sort({ createdAt: -1 })
        .limit(20)
        .lean(),
    ]);

    // Calculate this month earnings
    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const monthAgg = await Transaction.aggregate([
      { $match: { nurseId: user.userId, status: 'completed', createdAt: { $gte: monthStart } } },
      { $group: { _id: null, total: { $sum: '$netAmount' } } },
    ]);

    // Calculate daily earnings for last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);
    const dailyAgg = await Transaction.aggregate([
      { $match: { nurseId: user.userId, status: 'completed', createdAt: { $gte: sevenDaysAgo } } },
      { $group: { _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } }, earnings: { $sum: '$netAmount' } } },
      { $sort: { _id: 1 } },
    ]);

    return Response.json({
      success: true,
      data: {
        totalEarnings: nurse.totalEarnings,
        availableBalance: nurse.availableBalance,
        completedJobs: nurse.completedJobs,
        thisMonthEarnings: monthAgg[0]?.total || 0,
        periodEarnings: periodAgg[0]?.totalEarnings || 0,
        periodCommission: periodAgg[0]?.totalCommission || 0,
        periodCount: periodAgg[0]?.count || 0,
        nurseName: nurse.name,
        nursePhone: nurse.phone,
        nurseWalletType: nurse.walletType || '',
        nurseWalletNumber: nurse.walletNumber || '',
        withdrawalFee,
        enabledWalletTypes,
        recentPayouts: withdrawalRequests.map((w: any) => ({
          id: w._id.toString(),
          amount: w.amount,
          netAmount: w.netAmount,
          withdrawalFee: w.withdrawalFee,
          walletType: w.walletType,
          walletNumber: w.walletNumber,
          walletHolderName: w.walletHolderName,
          method: w.walletType,
          status: w.status,
          requestedAt: w.createdAt.toISOString(),
          processedAt: w.processedAt?.toISOString() || null,
          rejectedReason: w.rejectedReason || null,
        })),
        dailyEarnings: dailyAgg.map((d: any) => ({ date: d._id, earnings: d.earnings })),
        transactions: transactions.map((t: any) => (serializeDoc(t))),
      },
    });
  } catch (error) {
    console.error('[NURSE EARNINGS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب الأرباح', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    const { amount, walletType, walletNumber, walletHolderName } = body;

    if (!amount || amount <= 0) {
      return createErrorResponse('يرجى تحديد مبلغ صحيح للسحب', 400, 'VALIDATION_ERROR');
    }

    if (!walletType) {
      return createErrorResponse('يرجى اختيار نوع المحفظة', 400, 'VALIDATION_ERROR');
    }

    if (!walletNumber) {
      return createErrorResponse('يرجى إدخال رقم المحفظة', 400, 'VALIDATION_ERROR');
    }

    if (!walletHolderName) {
      return createErrorResponse('يرجى إدخال اسم صاحب المحفظة', 400, 'VALIDATION_ERROR');
    }

    // Get nurse data
    const nurse = await Nurse.findById(user.userId);
    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    // Check if nurse has enough balance
    if (nurse.availableBalance < amount) {
      return createErrorResponse('الرصيد المتاح غير كافي للسحب', 400, 'INSUFFICIENT_BALANCE');
    }

    // Check minimum withdrawal amount
    if (amount < 500) {
      return createErrorResponse('الحد الأدنى للسحب هو 500 ريال', 400, 'VALIDATION_ERROR');
    }

    // Check for existing pending withdrawal
    const existingPending = await WithdrawalRequest.findOne({
      nurseId: user.userId,
      status: 'pending',
    });
    if (existingPending) {
      return createErrorResponse('لديك طلب سحب معلق بالفعل، يرجى الانتظار حتى يتم معالجته', 400, 'PENDING_EXISTS');
    }

    // Get withdrawal fee from settings
    const settings = await AdminSettings.findOne().select('withdrawalFee').lean();
    const withdrawalFee = settings?.withdrawalFee ?? 200;
    const netAmount = amount - withdrawalFee;

    if (netAmount <= 0) {
      return createErrorResponse('المبلغ أقل من رسوم السحب', 400, 'VALIDATION_ERROR');
    }

    // Deduct from nurse balance immediately
    nurse.availableBalance -= amount;
    await nurse.save();

    // Create withdrawal request
    const withdrawalRequest = await WithdrawalRequest.create({
      nurseId: user.userId,
      nurseName: nurse.name,
      nursePhone: nurse.phone,
      amount,
      withdrawalFee,
      netAmount,
      walletType,
      walletNumber,
      walletHolderName,
      status: 'pending',
    });

    // ── Notify admins about new withdrawal request ──
    try {
      const { User } = await import('@/models/mongoose');
      const admins = await User.find({ role: { $in: ['admin', 'subadmin'] } }).select('_id role').lean();
      for (const admin of admins) {
        const adminRole = (admin as any).role || 'admin';
        await Notification.create({
          userId: admin._id,
          userRole: adminRole,
          titleAr: 'طلب سحب جديد',
          bodyAr: `طلب سحب ${amount} ر.ي من ${nurse.name}`,
          type: 'withdrawal',
          priority: 'high',
          data: { withdrawalId: withdrawalRequest._id.toString(), nurseId: user.userId, amount: String(amount) },
          actionUrl: '/admin/withdrawals',
          read: false,
        });

        sendPushToUser(admin._id.toString(), {
          title: 'طلب سحب جديد',
          body: `طلب سحب ${amount} ر.ي من ${nurse.name}`,
          type: 'withdrawal',
          priority: 'high',
          url: '/admin/withdrawals',
          userRole: adminRole,
          data: { withdrawalId: withdrawalRequest._id.toString(), nurseId: user.userId, amount: String(amount) },
        }).catch(() => {});
      }
    } catch {
      // Non-critical
    }

    // ═══ EMIT REAL-TIME EVENT ═══
    try {
      emitRealtimeEvent.withdrawalChanged(
        withdrawalRequest._id.toString(),
        user.userId,
        'pending',
        { changedBy: user.userId, changedByRole: 'nurse' }
      );
    } catch {
      // Non-critical — socket server may be down
    }

    return Response.json({
      success: true,
      data: {
        id: withdrawalRequest._id.toString(),
        amount: withdrawalRequest.amount,
        withdrawalFee: withdrawalRequest.withdrawalFee,
        netAmount: withdrawalRequest.netAmount,
        walletType: withdrawalRequest.walletType,
        walletNumber: withdrawalRequest.walletNumber,
        walletHolderName: withdrawalRequest.walletHolderName,
        status: withdrawalRequest.status,
      },
      message: 'تم إرسال طلب السحب بنجاح، سيتم مراجعته من قبل الإدارة',
    });
  } catch (error) {
    console.error('[NURSE WITHDRAWAL ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء طلب السحب', 500, 'INTERNAL_ERROR');
  }
}
