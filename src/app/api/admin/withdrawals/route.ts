// GET /api/admin/withdrawals - List all withdrawal requests
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { WithdrawalRequest } from '@/models/mongoose';
import { requireSubadminPermission, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_nurses');
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const search = searchParams.get('search');

    const filter: any = {};
    if (status && status !== 'all') filter.status = status;
    if (search) {
      filter.$or = [
        { nurseName: { $regex: search, $options: 'i' } },
        { nursePhone: { $regex: search } },
        { walletNumber: { $regex: search } },
        { walletHolderName: { $regex: search, $options: 'i' } },
      ];
    }

    const [withdrawals, total] = await Promise.all([
      WithdrawalRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      WithdrawalRequest.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: {
        withdrawals: withdrawals.map((w: any) => ({
          id: w._id.toString(),
          nurseId: w.nurseId.toString(),
          nurseName: w.nurseName,
          nursePhone: w.nursePhone,
          amount: w.amount,
          withdrawalFee: w.withdrawalFee,
          netAmount: w.netAmount,
          walletType: w.walletType,
          walletNumber: w.walletNumber,
          walletHolderName: w.walletHolderName,
          status: w.status,
          adminNotes: w.adminNotes || '',
          processedBy: w.processedBy?.toString() || null,
          processedAt: w.processedAt?.toISOString() || null,
          rejectedReason: w.rejectedReason || null,
          createdAt: w.createdAt.toISOString(),
          updatedAt: w.updatedAt.toISOString(),
        })),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[ADMIN WITHDRAWALS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب طلبات السحب', 500, 'INTERNAL_ERROR');
  }
}
