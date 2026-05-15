// GET /api/nurse/[id]/profile - Public nurse profile (no auth required)
// Returns CV data WITHOUT any contact/sensitive info
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse } from '@/models/mongoose';
import { createErrorResponse } from '@/lib/auth/middleware';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await connectDB();
    const { id } = await params;

    const nurse = await Nurse.findById(id)
      .select(
        'name avatar professionalTitle specialization experience governorate district bio ' +
        'skills experiences certificates languages ' +
        'rating reviewCount completedJobs emergencyCases responseRate complianceRate ' +
        'verificationStatus isAvailable isOnline'
      )
      .lean();

    if (!nurse) {
      return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');
    }

    // Only return verified nurses
    if (nurse.verificationStatus !== 'verified') {
      return createErrorResponse('ملف الممرض غير متاح', 404, 'NOT_AVAILABLE');
    }

    // For public view: show first name only
    const firstName = nurse.name?.split(' ')[0] || 'ممرض';

    const publicProfile = {
      id: nurse._id.toString(),
      name: firstName,
      avatar: nurse.avatar || null,
      professionalTitle: nurse.professionalTitle || '',
      specialization: nurse.specialization || [],
      experience: nurse.experience || 0,
      governorate: nurse.governorate || '',
      district: nurse.district || '',
      bio: nurse.bio || '',
      skills: nurse.skills || [],
      experiences: nurse.experiences || [],
      certificates: nurse.certificates || [],
      languages: nurse.languages || [],
      rating: nurse.rating || 0,
      reviewCount: nurse.reviewCount || 0,
      completedJobs: nurse.completedJobs || 0,
      emergencyCases: nurse.emergencyCases || 0,
      responseRate: nurse.responseRate || 0,
      complianceRate: nurse.complianceRate || 0,
      verificationStatus: nurse.verificationStatus,
      isAvailable: nurse.isAvailable || false,
      isOnline: nurse.isOnline || false,
    };

    return Response.json({ success: true, data: publicProfile });
  } catch (error) {
    console.error('[NURSE PUBLIC PROFILE ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}
