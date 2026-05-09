// GET /api/nurse/ratings - Get nurse ratings with service & emergency info
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Rating, Nurse, ServiceRequest, Service, EmergencyRequest, Beneficiary } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

const emergencyTypeLabels: Record<string, string> = {
  medical: 'طبية عامة',
  injury: 'إصابة',
  breathing: 'صعوبة تنفس',
  cardiac: 'أزمة قلبية',
  fall: 'سقوط',
  other: 'أخرى',
};

const outcomeLabels: Record<string, string> = {
  treated_on_site: 'تم العلاج في الموقع',
  transferred_to_hospital: 'تم النقل للمستشفى',
  refused_treatment: 'رفض المريض العلاج',
  other: 'أخرى',
};

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const [nurse, ratings, total] = await Promise.all([
      Nurse.findById(user.userId).select('rating reviewCount completedJobs').lean(),
      Rating.find({ toUserId: user.userId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Rating.countDocuments({ toUserId: user.userId }),
    ]);

    // Separate ratings by type
    const serviceRatingIds = ratings
      .filter((r: any) => r.ratingType !== 'emergency')
      .map((r: any) => r.requestId?.toString())
      .filter(Boolean);
    const emergencyRatingIds = ratings
      .filter((r: any) => r.ratingType === 'emergency')
      .map((r: any) => r.requestId?.toString())
      .filter(Boolean);
    const fromUserIds = [...new Set(ratings.map((r: any) => r.fromUserId?.toString()).filter(Boolean))];

    // Batch fetch all related data
    const [serviceRequests, emergencyRequests, beneficiaries] = await Promise.all([
      serviceRatingIds.length > 0
        ? ServiceRequest.find({ _id: { $in: serviceRatingIds } }).select('serviceId').lean()
        : [],
      emergencyRatingIds.length > 0
        ? EmergencyRequest.find({ _id: { $in: emergencyRatingIds } }).select('type description outcome resolvedNotes').lean()
        : [],
      fromUserIds.length > 0
        ? Beneficiary.find({ _id: { $in: fromUserIds } }).select('name').lean()
        : [],
    ]);

    const serviceIds = [...new Set(serviceRequests.map((sr: any) => sr.serviceId?.toString()).filter(Boolean))];
    const services = serviceIds.length > 0 ? await Service.find({ _id: { $in: serviceIds } }).select('nameAr category').lean() : [];

    const serviceRequestMap = new Map(serviceRequests.map((sr: any) => [sr._id.toString(), sr]));
    const serviceMap = new Map(services.map((s: any) => [s._id.toString(), s]));
    const emergencyMap = new Map(emergencyRequests.map((e: any) => [e._id.toString(), e]));
    const beneficiaryMap = new Map(beneficiaries.map((b: any) => [b._id.toString(), b]));

    const enrichedRatings = ratings.map((r: any) => {
      const beneficiary = beneficiaryMap.get(r.fromUserId?.toString());
      const isEmergency = r.ratingType === 'emergency';

      let serviceRequestInfo = null;
      let emergencyInfo = null;

      if (isEmergency) {
        const emergency = emergencyMap.get(r.requestId?.toString());
        if (emergency) {
          emergencyInfo = {
            type: emergency.type,
            typeLabel: emergencyTypeLabels[emergency.type] || emergency.type,
            description: emergency.description,
            outcome: emergency.outcome,
            outcomeLabel: outcomeLabels[emergency.outcome] || emergency.outcome,
            resolvedNotes: emergency.resolvedNotes,
          };
        }
      } else {
        const sr = serviceRequestMap.get(r.requestId?.toString());
        const service = sr ? serviceMap.get(sr.serviceId?.toString()) : null;
        if (sr) {
          serviceRequestInfo = {
            id: sr._id.toString(),
            status: sr.status,
            service: service ? {
              nameAr: service.nameAr || 'خدمة',
              category: service.category || '',
            } : { nameAr: 'خدمة', category: '' },
          };
        }
      }

      return {
        ...r,
        id: r._id.toString(),
        ratingType: r.ratingType || 'service',
        fromUserName: beneficiary?.name || (r.isAnonymous ? 'مجهول' : 'مستفيد'),
        serviceRequest: serviceRequestInfo,
        emergencyInfo,
      };
    });

    return Response.json({
      success: true,
      data: {
        summary: {
          averageRating: nurse?.rating || 0,
          reviewCount: nurse?.reviewCount || 0,
          completedJobs: nurse?.completedJobs || 0,
        },
        ratings: enrichedRatings,
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[NURSE RATINGS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب التقييمات', 500, 'INTERNAL_ERROR');
  }
}
