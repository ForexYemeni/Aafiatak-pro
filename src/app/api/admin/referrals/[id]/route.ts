// GET /api/admin/referrals/[id] - Get referred users for a specific beneficiary
// Returns: the referrer's info + list of all users they referred
// MongoDB/Mongoose based

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Beneficiary, Referral } from '@/models/mongoose';
import { requireSubadminPermission, createErrorResponse } from '@/lib/auth/middleware';
import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_beneficiaries');
    if (error) return error;

    const { id } = await params;

    // Get the referrer's info
    const referrer = await Beneficiary.findById(id).select('-password').lean();
    if (!referrer) {
      return createErrorResponse('المستفيد غير موجود', 404, 'NOT_FOUND');
    }

    // Get all referrals made by this user
    const referrals = await Referral.find({ referrerId: id })
      .populate('referredId', 'name phone isActive createdAt loyaltyPoints')
      .sort({ createdAt: -1 })
      .lean();

    // Get users who registered directly with this referrer's code (via referredBy field)
    const directReferrals = await Beneficiary.find({ referredBy: id })
      .select('name phone isActive createdAt loyaltyPoints referralCode')
      .sort({ createdAt: -1 })
      .lean();

    // Combine and deduplicate
    const referredIds = new Set(referrals.map((r: any) => (r.referredId as any)?._id?.toString()));
    const extraDirectReferrals = directReferrals.filter((d: any) => !referredIds.has(d._id.toString()));

    const allReferredUsers = [
      ...referrals.map((r: any) => {
        const referred = r.referredId as any;
        return {
          id: referred?._id?.toString() || r._id.toString(),
          name: referred?.name || 'مستخدم',
          phone: referred?.phone || null,
          isActive: referred?.isActive ?? true,
          joinedAt: referred?.createdAt || r.createdAt,
          loyaltyPoints: referred?.loyaltyPoints || 0,
          referralStatus: r.status,
          reward: r.reward || 0,
          referralCreatedAt: r.createdAt,
        };
      }),
      ...extraDirectReferrals.map((d: any) => ({
        id: d._id.toString(),
        name: d.name,
        phone: d.phone,
        isActive: d.isActive,
        joinedAt: d.createdAt,
        loyaltyPoints: d.loyaltyPoints || 0,
        referralCode: d.referralCode,
        referralStatus: 'completed',
        reward: 0,
        referralCreatedAt: d.createdAt,
      })),
    ];

    return Response.json({
      success: true,
      data: {
        referrer: serializeDoc(referrer),
        referralCode: referrer.referralCode,
        totalReferred: allReferredUsers.length,
        referredUsers: allReferredUsers,
      },
    });
  } catch (error) {
    console.error('[ADMIN REFERRAL DETAIL ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب تفاصيل الإحالات', 500, 'INTERNAL_ERROR');
  }
}
