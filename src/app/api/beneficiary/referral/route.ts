// GET /api/beneficiary/referral - Get referral info for the authenticated beneficiary
// Returns: referralCode, referredBy info, totalReferrals, completedReferrals, totalRewards, referrals list
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
      Beneficiary.findById(user.userId)
        .select('referralCode referredBy loyaltyPoints')
        .populate('referredBy', 'name referralCode')
        .lean(),
      Referral.find({ referrerId: user.userId })
        .populate('referredId', 'name phone')
        .sort({ createdAt: -1 })
        .lean(),
    ]);

    if (!beneficiary) return createErrorResponse('المستفيد غير موجود', 404, 'NOT_FOUND');

    const totalReferrals = referrals.length;
    const completedReferrals = referrals.filter((r: any) => ['completed', 'rewarded'].includes(r.status)).length;
    const totalRewards = referrals.reduce((sum: number, r: any) => sum + (r.status === 'rewarded' ? r.reward : 0), 0);

    // Build referredBy info
    let referredByInfo = null;
    if (beneficiary.referredBy) {
      const ref = beneficiary.referredBy as any;
      referredByInfo = {
        name: ref.name || null,
        referralCode: ref.referralCode || null,
      };
    }

    return Response.json({
      success: true,
      data: {
        // Frontend compatibility: return both `referralCode` and `code`
        referralCode: beneficiary.referralCode,
        code: beneficiary.referralCode,
        referredBy: referredByInfo,
        loyaltyPoints: beneficiary.loyaltyPoints || 0,
        totalReferrals,
        completedReferrals,
        // Frontend compatibility: return both `totalRewards` and `reward`
        totalRewards,
        reward: totalRewards,
        referrals: referrals.map((r: any) => {
          const serialized = serializeDoc(r);
          // Add referred user name for display
          const referred = r.referredId as any;
          return {
            ...serialized,
            referredName: referred?.name || 'مستخدم',
            referredPhone: referred?.phone || null,
          };
        }),
      },
    });
  } catch (error) {
    console.error('[BENEFICIARY REFERRAL ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب معلومات الإحالة', 500, 'INTERNAL_ERROR');
  }
}
