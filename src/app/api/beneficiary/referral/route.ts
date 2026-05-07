// GET /api/beneficiary/referral - Referral info

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireRole, successResponse, handleApiError,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(request, 'beneficiary');

    const beneficiary = await db.beneficiary.findUnique({
      where: { id: user.userId },
      select: { referralCode: true, name: true },
    });

    if (!beneficiary) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على المستفيد' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const referrals = await db.referral.findMany({
      where: { referrerId: user.userId },
      orderBy: { createdAt: 'desc' },
    });

    const settings = await db.adminSettings.findFirst();

    return successResponse({
      code: beneficiary.referralCode,
      reward: settings?.referralReward ?? 50,
      totalReferrals: referrals.length,
      completedReferrals: referrals.filter((r) => r.status === 'completed' || r.status === 'rewarded').length,
      pendingReferrals: referrals.filter((r) => r.status === 'pending').length,
      referrals,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
