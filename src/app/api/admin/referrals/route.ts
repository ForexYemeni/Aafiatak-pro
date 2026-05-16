// GET /api/admin/referrals - List beneficiaries with referral stats
// Returns: users with referralCode, referralCount, and their referred users
// MongoDB/Mongoose based
// CRITICAL: Always returns fresh data from DB (no caching)

import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { Beneficiary, Referral } from '@/models/mongoose';
import { requireSubadminPermission, createErrorResponse } from '@/lib/auth/middleware';
import { serializeDoc } from '@/lib/mongoose/serialize';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_beneficiaries');
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const search = searchParams.get('search');
    const withReferralsOnly = searchParams.get('withReferrals') === 'true';

    // Build filter
    const filter: any = { role: 'beneficiary' };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search } },
        { referralCode: { $regex: search, $options: 'i' } },
      ];
    }

    // Get referral counts per referrer from BOTH sources:
    // 1. Referral collection (tracking records)
    // 2. Direct referredBy field (fallback for missing Referral records)
    const [referralCounts, directReferredCounts] = await Promise.all([
      Referral.aggregate([
        { $group: { _id: '$referrerId', count: { $sum: 1 } } },
      ]),
      Beneficiary.aggregate([
        { $match: { referredBy: { $ne: null, $exists: true } } },
        { $group: { _id: '$referredBy', count: { $sum: 1 } } },
      ]),
    ]);

    // Merge both count sources - take the MAX for each referrer
    const countMap = new Map<string, number>();
    for (const r of referralCounts) {
      countMap.set(r._id.toString(), r.count);
    }
    for (const r of directReferredCounts) {
      const id = r._id.toString();
      const existing = countMap.get(id) || 0;
      countMap.set(id, Math.max(existing, r.count));
    }

    // If filtering to users with referrals only
    if (withReferralsOnly) {
      const referrerIds = [...countMap.keys()];
      filter._id = { $in: referrerIds.map(id => new mongoose.Types.ObjectId(id)) };
    }

    const [beneficiaries, total] = await Promise.all([
      Beneficiary.find(filter)
        .select('-password')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Beneficiary.countDocuments(filter),
    ]);

    // Enrich with referral count and referredBy name
    const referrerIds = [...new Set(beneficiaries.map((b: any) => b.referredBy?.toString()).filter(Boolean))];
    const referrers = referrerIds.length > 0
      ? await Beneficiary.find({ _id: { $in: referrerIds } }).select('name referralCode').lean()
      : [];
    const referrerMap = new Map(referrers.map((r: any) => [r._id.toString(), { name: r.name, referralCode: r.referralCode }]));

    const enrichedBeneficiaries = beneficiaries.map((b: any) => {
      const serialized = serializeDoc(b);
      const id = (b._id as any).toString();
      const referredBy = b.referredBy ? referrerMap.get(b.referredBy.toString()) || null : null;
      return {
        ...serialized,
        referralCount: countMap.get(id) || 0,
        referredByName: referredBy?.name || null,
        referredByCode: referredBy?.referralCode || null,
      };
    });

    return Response.json({
      success: true,
      data: {
        beneficiaries: enrichedBeneficiaries,
        total,
        page,
        pages: Math.ceil(total / limit),
        totalReferralCount: [...countMap.values()].reduce((sum, c) => sum + c, 0),
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('[ADMIN REFERRALS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب بيانات الإحالات', 500, 'INTERNAL_ERROR');
  }
}
