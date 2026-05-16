// GET /api/admin/referrals/[id] - Get referred users for a specific beneficiary
// Returns: the referrer's info + list of all users they referred
// MongoDB/Mongoose based
// CRITICAL: Always returns fresh data from DB (no caching)
// CRITICAL: Uses native MongoDB queries to bypass Mongoose discriminator/casting issues

import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { Beneficiary, Referral } from '@/models/mongoose';
import { requireSubadminPermission, createErrorResponse } from '@/lib/auth/middleware';
import { serializeDoc } from '@/lib/mongoose/serialize';

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

    const referrerObjectId = new mongoose.Types.ObjectId(id);
    const db = mongoose.connection.db;
    const usersCollection = db.collection('users');
    const referralsCollection = db.collection('referrals');

    // Get all referrals made by this user - try BOTH ObjectId and String matching
    const [referralsByObjectId, referralsByString] = await Promise.all([
      referralsCollection.find({ referrerId: referrerObjectId }).sort({ createdAt: -1 }).toArray(),
      referralsCollection.find({ referrerId: id }).sort({ createdAt: -1 }).toArray(),
    ]);
    const referralRecords = referralsByObjectId.length >= referralsByString.length
      ? referralsByObjectId
      : referralsByString;

    // Get users who registered directly with this referrer's code (via referredBy field)
    // Try BOTH ObjectId and String matching
    const [directByObjectId, directByString] = await Promise.all([
      usersCollection.find({
        referredBy: referrerObjectId,
        role: 'beneficiary',
      }).project({ name: 1, phone: 1, isActive: 1, createdAt: 1, loyaltyPoints: 1, referralCode: 1 }).sort({ createdAt: -1 }).toArray(),
      usersCollection.find({
        referredBy: id,
        role: 'beneficiary',
      }).project({ name: 1, phone: 1, isActive: 1, createdAt: 1, loyaltyPoints: 1, referralCode: 1 }).sort({ createdAt: -1 }).toArray(),
    ]);
    const directReferrals = directByObjectId.length >= directByString.length
      ? directByObjectId
      : directByString;

    // Combine and deduplicate
    const seenIds = new Set<string>();
    const allReferredUsers: any[] = [];

    // First, add from Referral collection
    for (const r of referralRecords) {
      const referredIdStr = r.referredId?.toString();
      if (referredIdStr && !seenIds.has(referredIdStr)) {
        seenIds.add(referredIdStr);
        // Find matching direct referral for user details
        const directUser = directReferrals.find((d: any) => d._id.toString() === referredIdStr);
        allReferredUsers.push({
          id: referredIdStr,
          name: directUser?.name || 'مستخدم',
          phone: directUser?.phone || null,
          isActive: directUser?.isActive ?? true,
          joinedAt: directUser?.createdAt || r.createdAt,
          loyaltyPoints: directUser?.loyaltyPoints || 0,
          referralStatus: r.status || 'completed',
          reward: typeof r.reward === 'number' ? r.reward : (r.reward?.referrerPoints || 0),
          referralCreatedAt: r.createdAt,
        });
      }
    }

    // Then, add any direct referrals not yet in the list
    for (const d of directReferrals) {
      const did = d._id.toString();
      if (!seenIds.has(did)) {
        seenIds.add(did);
        allReferredUsers.push({
          id: did,
          name: d.name || 'مستخدم',
          phone: d.phone || null,
          isActive: d.isActive ?? true,
          joinedAt: d.createdAt,
          loyaltyPoints: d.loyaltyPoints || 0,
          referralCode: d.referralCode,
          referralStatus: 'completed',
          reward: 0,
          referralCreatedAt: d.createdAt,
        });
      }
    }

    return Response.json({
      success: true,
      data: {
        referrer: serializeDoc(referrer),
        referralCode: referrer.referralCode,
        totalReferred: allReferredUsers.length,
        referredUsers: allReferredUsers,
      },
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('[ADMIN REFERRAL DETAIL ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب تفاصيل الإحالات', 500, 'INTERNAL_ERROR');
  }
}
