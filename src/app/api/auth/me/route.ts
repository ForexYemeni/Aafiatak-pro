// GET /api/auth/me - Get current authenticated user
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// CRITICAL: Always returns fresh data from DB (no caching)
// CRITICAL: Uses native MongoDB queries for referral counts to bypass discriminator issues

import { NextRequest } from 'next/server';
import mongoose from 'mongoose';
import { connectDB } from '@/lib/mongodb';
import { User, Nurse, Beneficiary } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { serializeDoc } from '@/lib/mongoose/serialize';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    let userData: any = null;
    let referralCount = 0;

    if (user.role === 'nurse') {
      userData = await Nurse.findById(user.userId).select('-password').lean();
    } else if (user.role === 'beneficiary') {
      userData = await Beneficiary.findById(user.userId).select('-password').lean();

      // Compute referral count using NATIVE MongoDB queries
      // This bypasses any Mongoose discriminator/casting issues
      if (userData) {
        try {
          const db = mongoose.connection.db;
          const usersCollection = db.collection('users');
          const referralsCollection = db.collection('referrals');
          const userObjectId = new mongoose.Types.ObjectId(user.userId);

          // Count from BOTH sources, trying both ObjectId and String matching
          const [refCountByObjectId, refCountByString, directCountByObjectId, directCountByString] = await Promise.all([
            referralsCollection.countDocuments({ referrerId: userObjectId }),
            referralsCollection.countDocuments({ referrerId: user.userId }),
            usersCollection.countDocuments({ referredBy: userObjectId, role: 'beneficiary' }),
            usersCollection.countDocuments({ referredBy: user.userId, role: 'beneficiary' }),
          ]);

          referralCount = Math.max(refCountByObjectId, refCountByString, directCountByObjectId, directCountByString);
        } catch (countError) {
          console.error('[AUTH ME REFERRAL COUNT ERROR]', countError);
          referralCount = 0;
        }
      }
    } else {
      userData = await User.findById(user.userId).select('-password').lean();
    }

    if (!userData) {
      return createErrorResponse('المستخدم غير موجود', 404, 'USER_NOT_FOUND');
    }

    // CRITICAL: Use serializeDoc to prevent React Error #300
    const serialized = serializeDoc(userData);

    // Add referralCount for beneficiaries
    if (user.role === 'beneficiary') {
      serialized.referralCount = referralCount;
    }

    return Response.json({
      success: true,
      data: serialized,
    }, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    });
  } catch (error) {
    console.error('[AUTH ME ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}
