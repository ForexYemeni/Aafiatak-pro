// GET /api/admin/debug-referrals - Diagnostic endpoint for referral data
// Shows raw database state for debugging referral count issues
// Admin-only endpoint

import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { requireRole, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const targetUserId = searchParams.get('userId');

    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    const referralsCollection = db.collection('referrals');

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
    };

    if (targetUserId) {
      // Debug specific user
      const userObjectId = new mongoose.Types.ObjectId(targetUserId);

      // 1. Get the user's raw data
      const rawUser = await usersCollection.findOne({ _id: userObjectId });
      diagnostics.user = rawUser ? {
        _id: rawUser._id?.toString(),
        _id_type: typeof rawUser._id,
        name: rawUser.name,
        phone: rawUser.phone,
        role: rawUser.role,
        referralCode: rawUser.referralCode,
        referredBy: rawUser.referredBy?.toString(),
        referredBy_type: typeof rawUser.referredBy,
        loyaltyPoints: rawUser.loyaltyPoints,
      } : 'NOT FOUND';

      // 2. Check referral records as ObjectId
      const refsByObjectId = await referralsCollection.find({ referrerId: userObjectId }).toArray();
      diagnostics.referrals_byObjectId = refsByObjectId.map((r: any) => ({
        _id: r._id?.toString(),
        referrerId: r.referrerId?.toString(),
        referrerId_type: typeof r.referrerId,
        referredId: r.referredId?.toString(),
        referredId_type: typeof r.referredId,
        code: r.code,
        reward: r.reward,
        status: r.status,
      }));

      // 3. Check referral records as String
      const refsByString = await referralsCollection.find({ referrerId: targetUserId }).toArray();
      diagnostics.referrals_byString = refsByString.map((r: any) => ({
        _id: r._id?.toString(),
        referrerId: r.referrerId?.toString(),
        referrerId_type: typeof r.referrerId,
        referredId: r.referredId?.toString(),
        status: r.status,
      }));

      // 4. Check direct referredBy as ObjectId
      const directByObjectId = await usersCollection.find({
        referredBy: userObjectId,
        role: 'beneficiary',
      }).project({ name: 1, phone: 1, referredBy: 1 }).toArray();
      diagnostics.directReferred_byObjectId = directByObjectId.map((u: any) => ({
        _id: u._id?.toString(),
        name: u.name,
        referredBy: u.referredBy?.toString(),
        referredBy_type: typeof u.referredBy,
      }));

      // 5. Check direct referredBy as String
      const directByString = await usersCollection.find({
        referredBy: targetUserId,
        role: 'beneficiary',
      }).project({ name: 1, phone: 1, referredBy: 1 }).toArray();
      diagnostics.directReferred_byString = directByString.map((u: any) => ({
        _id: u._id?.toString(),
        name: u.name,
        referredBy: u.referredBy?.toString(),
        referredBy_type: typeof u.referredBy,
      }));

      // 6. Counts summary
      diagnostics.counts = {
        referralsByObjectId: refsByObjectId.length,
        referralsByString: refsByString.length,
        directByObjectId: directByObjectId.length,
        directByString: directByString.length,
        effectiveTotal: Math.max(refsByObjectId.length, refsByString.length, directByObjectId.length, directByString.length),
      };
    } else {
      // General overview
      const [totalReferrals, totalBeneficiariesWithReferredBy, sampleReferrals, sampleReferredUsers] = await Promise.all([
        referralsCollection.countDocuments({}),
        usersCollection.countDocuments({ referredBy: { $exists: true, $ne: null }, role: 'beneficiary' }),
        referralsCollection.find({}).limit(5).toArray(),
        usersCollection.find({ referredBy: { $exists: true, $ne: null }, role: 'beneficiary' }).limit(5).project({ name: 1, phone: 1, referredBy: 1, referralCode: 1 }).toArray(),
      ]);

      diagnostics.overview = {
        totalReferralRecords: totalReferrals,
        totalBeneficiariesWithReferredBy: totalBeneficiariesWithReferredBy,
      };

      diagnostics.sampleReferrals = sampleReferrals.map((r: any) => ({
        referrerId: r.referrerId?.toString(),
        referrerId_type: typeof r.referrerId,
        referredId: r.referredId?.toString(),
        referredId_type: typeof r.referredId,
        code: r.code,
        status: r.status,
        reward: r.reward,
      }));

      diagnostics.sampleReferredUsers = sampleReferredUsers.map((u: any) => ({
        _id: u._id?.toString(),
        name: u.name,
        referralCode: u.referralCode,
        referredBy: u.referredBy?.toString(),
        referredBy_type: typeof u.referredBy,
      }));
    }

    return Response.json({ success: true, data: diagnostics });
  } catch (error) {
    console.error('[DEBUG REFERRALS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء تشخيص بيانات الإحالات', 500, 'INTERNAL_ERROR');
  }
}
