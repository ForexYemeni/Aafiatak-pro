// GET /api/beneficiary/referral - Get referral info
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Beneficiary, Referral } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const [beneficiary, referrals] = await Promise.all([
      Beneficiary.findById(user.userId).select('referralCode referredBy').lean(),
      Referral.find({ referrerId: user.userId }).sort({ createdAt: -1 }).lean(),
    ]);

    if (!beneficiary) return createErrorResponse('المستفيد غير موجود', 404, 'NOT_FOUND');

    const totalReferrals = referrals.length;
    const completedReferrals = referrals.filter((r: any) => ['completed', 'rewarded'].includes(r.status)).length;
    const totalRewards = referrals.reduce((sum: number, r: any) => sum + (r.status === 'rewarded' ? r.reward : 0), 0);

    return Response.json({
      success: true,
      data: {
        referralCode: beneficiary.referralCode,
        referredBy: beneficiary.referredBy,
        totalReferrals,
        completedReferrals,
        totalRewards,
        referrals: referrals.map((r: any) => (serializeDoc(r))),
      },
    });
  } catch (error) {
    console.error('[BENEFICIARY REFERRAL ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب معلومات الإحالة', 500, 'INTERNAL_ERROR');
  }
}
