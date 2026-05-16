// GET /api/beneficiary/referral - Get referral info for the authenticated beneficiary
// Returns: referralCode, referredBy info, totalReferrals, completedReferrals, totalRewards, referrals list
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// CRITICAL: Always returns fresh data from DB (no caching)

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

    const [beneficiary, referrals, referredByMeCount] = await Promise.all([
      Beneficiary.findById(user.userId)
        .select('referralCode referredBy loyaltyPoints')
        .populate('referredBy', 'name referralCode')
        .lean(),
      Referral.find({ referrerId: user.userId })
        .populate('referredId', 'name phone')
        .sort({ createdAt: -1 })
        .lean(),
      // Fallback: count users whose referredBy = this user (direct relationship)
      Beneficiary.countDocuments({ referredBy: user.userId }),
    ]);

    if (!beneficiary) return createErrorResponse('المستفيد غير موجود', 404, 'NOT_FOUND');

    // Use the LARGER count between Referral collection and direct referredBy field
    // This ensures accuracy even if Referral records are missing
    const referralCollectionCount = referrals.length;
    const totalReferrals = Math.max(referralCollectionCount, referredByMeCount);

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

    // If Referral collection has fewer records than the direct referredBy count,
    // fetch the missing referred users directly
    let finalReferrals = referrals;
    if (referredByMeCount > referralCollectionCount) {
      // Some users were referred but don't have a Referral record
      const existingReferredIds = new Set(
        referrals.map((r: any) => (r.referredId as any)?._id?.toString()).filter(Boolean)
      );
      const directReferrals = await Beneficiary.find({
        referredBy: user.userId,
        _id: { $nin: [...existingReferredIds] },
      })
        .select('name phone isActive createdAt')
        .sort({ createdAt: -1 })
        .lean();

      // Add missing referrals as completed entries
      const missingReferrals = directReferrals.map((d: any) => ({
        _id: d._id,
        referrerId: user.userId,
        referredId: d._id,
        code: beneficiary.referralCode,
        reward: 0,
        status: 'completed',
        createdAt: d.createdAt,
        referredName: d.name || 'مستخدم',
        referredPhone: d.phone || null,
      }));

      finalReferrals = [...referrals, ...missingReferrals];
    }

    const responseData = {
      // Frontend compatibility: return both `referralCode` and `code`
      referralCode: beneficiary.referralCode || '',
      code: beneficiary.referralCode || '',
      referredBy: referredByInfo,
      loyaltyPoints: beneficiary.loyaltyPoints || 0,
      totalReferrals,
      completedReferrals: Math.max(completedReferrals, referredByMeCount),
      // Frontend compatibility: return both `totalRewards` and `reward`
      totalRewards,
      reward: totalRewards,
      referrals: finalReferrals.map((r: any) => {
        const serialized = serializeDoc(r);
        // Add referred user name for display
        const referred = r.referredId as any;
        return {
          ...serialized,
          referredName: r.referredName || referred?.name || 'مستخدم',
          referredPhone: r.referredPhone || referred?.phone || null,
        };
      }),
    };

    return Response.json({
      success: true,
      data: responseData,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('[BENEFICIARY REFERRAL ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب معلومات الإحالة', 500, 'INTERNAL_ERROR');
  }
}
