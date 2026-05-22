// GET/PATCH /api/beneficiary/profile - Get/update beneficiary profile
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Beneficiary } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { serializeDoc } from '@/lib/mongoose/serialize';
import { emitToAdmins, emitToUser } from '@/lib/notifications/socket-client';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const beneficiary = await Beneficiary.findById(user.userId).select('-password').lean();
    if (!beneficiary) return createErrorResponse('المستفيد غير موجود', 404, 'NOT_FOUND');

    // CRITICAL: Use serializeDoc to prevent React Error #300
    // Raw Mongoose docs contain ObjectId, Date objects that crash React
    return Response.json({ success: true, data: serializeDoc(beneficiary) });
  } catch (error) {
    console.error('[BENEFICIARY PROFILE GET ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}

export async function PATCH(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    delete body.password;
    delete body._id;
    delete body.role;
    delete body.phone;
    delete body.referralCode;
    delete body.loyaltyPoints;
    delete body.loyaltyTier;
    delete body.totalSpent;
    delete body.orderCount;

    const beneficiary = await Beneficiary.findByIdAndUpdate(user.userId, body, { new: true }).select('-password').lean();
    if (!beneficiary) return createErrorResponse('المستفيد غير موجود', 404, 'NOT_FOUND');

    emitToAdmins('data_change', { entity: 'user', entityId: user.userId, action: 'updated', timestamp: new Date().toISOString() }).catch(() => {});
    emitToUser(user.userId, 'data_change', { entity: 'user', entityId: user.userId, action: 'updated', timestamp: new Date().toISOString() }).catch(() => {});

    return Response.json({
      success: true,
      data: serializeDoc(beneficiary),
      message: 'تم تحديث الملف الشخصي بنجاح',
    });
  } catch (error) {
    console.error('[BENEFICIARY PROFILE UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحديث', 500, 'INTERNAL_ERROR');
  }
}
