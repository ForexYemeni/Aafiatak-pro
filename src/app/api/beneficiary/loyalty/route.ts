// GET /api/beneficiary/loyalty - Get loyalty points
// POST /api/beneficiary/loyalty - Redeem loyalty points

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireRole, successResponse, handleApiError, logActivity,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(request, 'beneficiary');

    const beneficiary = await db.beneficiary.findUnique({
      where: { id: user.userId },
      select: { loyaltyPoints: true, loyaltyTier: true, totalSpent: true, orderCount: true },
    });

    if (!beneficiary) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على المستفيد' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Get recent loyalty transactions
    const recentTransactions = await db.loyaltyTransaction.findMany({
      where: { beneficiaryId: user.userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Get settings
    const settings = await db.adminSettings.findFirst();

    return successResponse({
      points: beneficiary.loyaltyPoints,
      tier: beneficiary.loyaltyTier,
      totalSpent: beneficiary.totalSpent,
      orderCount: beneficiary.orderCount,
      redemptionThreshold: settings?.loyaltyRedemptionThreshold ?? 100,
      pointsPerOrder: settings?.loyaltyPointsPerOrder ?? 10,
      recentTransactions,
    });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, 'beneficiary');

    const body = await request.json();
    if (!body.points || body.points <= 0) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: 'عدد النقاط مطلوب ويجب أن يكون أكبر من صفر' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const settings = await db.adminSettings.findFirst();
    const threshold = settings?.loyaltyRedemptionThreshold ?? 100;

    if (body.points < threshold) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: `الحد الأدنى لاستبدال النقاط هو ${threshold} نقطة` }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const beneficiary = await db.beneficiary.findUnique({
      where: { id: user.userId },
      select: { loyaltyPoints: true },
    });

    if (!beneficiary) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على المستفيد' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    if (beneficiary.loyaltyPoints < body.points) {
      return new Response(JSON.stringify({ success: false, error: 'INSUFFICIENT_POINTS', message: 'رصيد النقاط غير كافٍ' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    await db.$transaction(async (tx) => {
      await tx.beneficiary.update({
        where: { id: user.userId },
        data: { loyaltyPoints: { decrement: body.points } },
      });

      await tx.loyaltyTransaction.create({
        data: {
          beneficiaryId: user.userId,
          points: body.points,
          type: 'redeem',
          description: `استبدال ${body.points} نقطة`,
        },
      });
    });

    await logActivity({
      userId: user.userId,
      userRole: 'beneficiary',
      action: 'redeem_loyalty',
      entity: 'Beneficiary',
      entityId: user.userId,
      details: `تم استبدال ${body.points} نقطة ولاء`,
      request,
    });

    return successResponse({ redeemed: body.points }, 'تم استبدال النقاط بنجاح');
  } catch (error) {
    return handleApiError(error);
  }
}
