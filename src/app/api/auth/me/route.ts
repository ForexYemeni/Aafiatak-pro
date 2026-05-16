// GET /api/auth/me - Get current authenticated user
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User, Nurse, Beneficiary } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    let userData: any = null;

    if (user.role === 'nurse') {
      userData = await Nurse.findById(user.userId).select('-password').lean();
    } else if (user.role === 'beneficiary') {
      userData = await Beneficiary.findById(user.userId).select('-password').lean();
    } else {
      userData = await User.findById(user.userId).select('-password').lean();
    }

    if (!userData) {
      return createErrorResponse('المستخدم غير موجود', 404, 'USER_NOT_FOUND');
    }

    // CRITICAL: Build a CLEAN user object with only serializable fields.
    // NEVER spread the raw MongoDB document — it contains ObjectId objects,
    // Date objects, and nested sub-documents that cause React error #300
    // ("Objects are not valid as a React child") when rendered in JSX.
    const cleanUser: Record<string, any> = {
      id: userData._id.toString(),
      name: userData.name || '',
      phone: userData.phone || '',
      role: userData.role || 'beneficiary',
      isActive: userData.isActive ?? true,
      createdAt: userData.createdAt ? new Date(userData.createdAt).toISOString() : null,
      updatedAt: userData.updatedAt ? new Date(userData.updatedAt).toISOString() : null,
    };

    // Add role-specific fields (only serializable primitives/arrays)
    if (userData.role === 'nurse') {
      cleanUser.specialization = userData.specialization || [];
      cleanUser.licenseNumber = userData.licenseNumber || '';
      cleanUser.verificationStatus = userData.verificationStatus || 'unverified';
      cleanUser.isAvailable = userData.isAvailable ?? false;
      cleanUser.isOnline = userData.isOnline ?? false;
      cleanUser.rating = userData.rating || 0;
      cleanUser.reviewCount = userData.reviewCount || 0;
      cleanUser.completedJobs = userData.completedJobs || 0;
      cleanUser.governorate = userData.governorate || '';
      cleanUser.address = userData.address || '';
      cleanUser.bio = userData.bio || '';
      cleanUser.professionalTitle = userData.professionalTitle || '';
      cleanUser.avatar = userData.avatar || '';
    } else if (userData.role === 'beneficiary') {
      cleanUser.governorate = userData.governorate || '';
      cleanUser.address = userData.address || '';
      cleanUser.loyaltyPoints = userData.loyaltyPoints || 0;
      cleanUser.loyaltyTier = userData.loyaltyTier || 'bronze';
      cleanUser.referralCode = userData.referralCode || '';
    } else if (userData.role === 'admin' || userData.role === 'subadmin') {
      cleanUser.permissions = userData.permissions || [];
      cleanUser.email = userData.email || '';
    }

    return Response.json({
      success: true,
      data: cleanUser,
    });
  } catch (error) {
    console.error('[AUTH ME ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}
