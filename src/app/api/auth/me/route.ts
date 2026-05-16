// GET /api/auth/me - Get current authenticated user
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// CRITICAL: Always returns fresh data from DB (no caching)

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User, Nurse, Beneficiary, Referral } from '@/models/mongoose';
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

      // Compute referral count from BOTH sources for accuracy
      if (userData) {
        const [referralCollectionCount, directReferredCount] = await Promise.all([
          Referral.countDocuments({ referrerId: user.userId }),
          Beneficiary.countDocuments({ referredBy: user.userId }),
        ]);
        referralCount = Math.max(referralCollectionCount, directReferredCount);
      }
    } else {
      userData = await User.findById(user.userId).select('-password').lean();
    }

    if (!userData) {
      return createErrorResponse('المستخدم غير موجود', 404, 'USER_NOT_FOUND');
    }

    // CRITICAL: Use serializeDoc to prevent React Error #300
    // Raw Mongoose docs contain ObjectId, Date objects, and nested sub-documents
    // that crash React when rendered in JSX
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
