// GET /api/beneficiary/loyalty - Get loyalty points
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Beneficiary, LoyaltyTransaction } from '@/models/mongoose';
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

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const [beneficiary, transactions, total] = await Promise.all([
      Beneficiary.findById(user.userId).select('loyaltyPoints loyaltyTier').lean(),
      LoyaltyTransaction.find({ beneficiaryId: user.userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      LoyaltyTransaction.countDocuments({ beneficiaryId: user.userId }),
    ]);

    if (!beneficiary) return createErrorResponse('المستفيد غير موجود', 404, 'NOT_FOUND');

    // Tier thresholds
    const tierInfo: Record<string, { name: string; minPoints: number; nextTier: string | null; pointsNeeded: number }> = {
      bronze: { name: 'برونزي', minPoints: 0, nextTier: 'silver', pointsNeeded: 500 },
      silver: { name: 'فضي', minPoints: 500, nextTier: 'gold', pointsNeeded: 1500 },
      gold: { name: 'ذهبي', minPoints: 1500, nextTier: 'platinum', pointsNeeded: 3000 },
      platinum: { name: 'بلاتيني', minPoints: 3000, nextTier: null, pointsNeeded: 0 },
    };

    const currentTier = tierInfo[beneficiary.loyaltyTier] || tierInfo.bronze;

    return Response.json({
      success: true,
      data: {
        loyaltyPoints: beneficiary.loyaltyPoints,
        loyaltyTier: beneficiary.loyaltyTier,
        tierName: currentTier.name,
        nextTier: currentTier.nextTier,
        pointsToNextTier: currentTier.nextTier
          ? (tierInfo[currentTier.nextTier]?.minPoints || 0) - beneficiary.loyaltyPoints
          : 0,
        transactions: transactions.map((t: any) => (serializeDoc(t))),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[BENEFICIARY LOYALTY ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب نقاط الولاء', 500, 'INTERNAL_ERROR');
  }
}
