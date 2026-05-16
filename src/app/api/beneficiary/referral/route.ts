// GET /api/beneficiary/referral - Get referral info for the authenticated beneficiary
// Returns: referralCode, referredBy info, totalReferrals, completedReferrals, totalRewards, referrals list
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// CRITICAL: Always returns fresh data from DB (no caching)
// CRITICAL: Uses native MongoDB queries to bypass Mongoose discriminator issues

import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { Beneficiary, Referral } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { serializeDoc } from '@/lib/mongoose/serialize';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const userId = user.userId;
    const userObjectId = new mongoose.Types.ObjectId(userId);

    // 1. Get the beneficiary's own data
    const beneficiary = await Beneficiary.findById(userId)
      .select('referralCode referredBy loyaltyPoints')
      .lean();

    if (!beneficiary) return createErrorResponse('المستفيد غير موجود', 404, 'NOT_FOUND');

    // 2. Use NATIVE MongoDB queries to bypass any Mongoose discriminator/casting issues
    // This is the critical fix - we query the database directly to ensure data consistency
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    const referralsCollection = db.collection('referrals');

    // 2a. Count referrals from BOTH sources with type-safe comparison
    // Try matching referredBy as BOTH ObjectId AND String (handles data type mismatch)
    const [referredByObjectId, referredByString] = await Promise.all([
      usersCollection.countDocuments({
        referredBy: userObjectId,
        role: 'beneficiary',
      }),
      usersCollection.countDocuments({
        referredBy: userId,
        role: 'beneficiary',
      }),
    ]);
    const directReferredCount = Math.max(referredByObjectId, referredByString);

    // 2b. Get Referral records - try both ObjectId and String matching
    const [referralRecordsObjectId, referralRecordsString] = await Promise.all([
      referralsCollection.find({ referrerId: userObjectId }).sort({ createdAt: -1 }).toArray(),
      referralsCollection.find({ referrerId: userId }).sort({ createdAt: -1 }).toArray(),
    ]);
    // Use whichever returned more results
    const referralRecords = referralRecordsObjectId.length >= referralRecordsString.length
      ? referralRecordsObjectId
      : referralRecordsString;

    // 2c. Get the actual referred user details
    const referredIds = referralRecords
      .map((r: any) => r.referredId)
      .filter(Boolean);

    // Also get direct referred users (those with referredBy = this user)
    const directReferredUsers = await usersCollection.find({
      $or: [
        { referredBy: userObjectId, role: 'beneficiary' },
        { referredBy: userId, role: 'beneficiary' },
      ],
    }).project({ name: 1, phone: 1, isActive: 1, createdAt: 1, loyaltyPoints: 1 }).sort({ createdAt: -1 }).toArray();

    // Build the referrals list by combining both sources
    const seenIds = new Set<string>();
    const allReferrals: any[] = [];

    // First, add from Referral collection (has reward/status info)
    for (const ref of referralRecords) {
      const referredIdStr = ref.referredId?.toString();
      if (referredIdStr && !seenIds.has(referredIdStr)) {
        seenIds.add(referredIdStr);
        // Find the referred user details from directReferredUsers
        const referredUser = directReferredUsers.find((u: any) => u._id.toString() === referredIdStr);
        allReferrals.push({
          id: ref._id?.toString(),
          referredId: referredIdStr,
          code: ref.code || beneficiary.referralCode,
          reward: typeof ref.reward === 'number' ? ref.reward : (ref.reward?.referrerPoints || 0),
          status: ref.status || 'completed',
          createdAt: ref.createdAt,
          referredName: referredUser?.name || 'مستخدم',
          referredPhone: referredUser?.phone || null,
        });
      }
    }

    // Then, add any direct referred users not yet in the list
    for (const u of directReferredUsers) {
      const uid = u._id.toString();
      if (!seenIds.has(uid)) {
        seenIds.add(uid);
        allReferrals.push({
          id: uid,
          referredId: uid,
          code: beneficiary.referralCode,
          reward: 0,
          status: 'completed',
          createdAt: u.createdAt,
          referredName: u.name || 'مستخدم',
          referredPhone: u.phone || null,
        });
      }
    }

    // 3. Compute stats
    const totalReferrals = allReferrals.length;
    const completedReferrals = allReferrals.filter((r: any) => ['completed', 'rewarded'].includes(r.status)).length;
    const pendingReferrals = allReferrals.filter((r: any) => r.status === 'pending').length;
    const totalRewards = allReferrals.reduce((sum: number, r: any) => sum + (r.status === 'rewarded' ? r.reward : 0), 0);

    // 4. Build referredBy info (who referred this user)
    let referredByInfo = null;
    if (beneficiary.referredBy) {
      try {
        const referrerData = await usersCollection.findOne(
          { _id: beneficiary.referredBy },
          { projection: { name: 1, referralCode: 1 } }
        );
        if (referrerData) {
          referredByInfo = {
            name: referrerData.name || null,
            referralCode: referrerData.referralCode || null,
          };
        }
      } catch {}
    }

    const responseData = {
      referralCode: beneficiary.referralCode || '',
      code: beneficiary.referralCode || '',
      referredBy: referredByInfo,
      loyaltyPoints: beneficiary.loyaltyPoints || 0,
      totalReferrals,
      completedReferrals,
      pendingReferrals,
      totalRewards,
      reward: totalRewards,
      referrals: allReferrals,
    };

    // Diagnostic log (can be removed after verification)
    console.log('[BENEFICIARY REFERRAL DEBUG]', {
      userId,
      referralCode: beneficiary.referralCode,
      directReferredCount,
      referralRecordsCount: referralRecords.length,
      totalReferrals,
      referredByAsObjectId: referredByObjectId,
      referredByAsString: referredByString,
    });

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
