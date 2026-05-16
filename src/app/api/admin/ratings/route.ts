// GET /api/admin/ratings - Get all ratings for admin dashboard
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// Supports both ServiceRequest and EmergencyRequest ratings

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Rating, ServiceRequest, Service, EmergencyRequest, Nurse, Beneficiary } from '@/models/mongoose';
import { requireSubadminPermission, createErrorResponse } from '@/lib/auth/middleware';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
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
    const { user, error } = await requireSubadminPermission(request, 'manage_orders');
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const scoreFilter = searchParams.get('score');
    const nurseId = searchParams.get('nurseId');
    const ratingTypeFilter = searchParams.get('ratingType');

    // Build filter
    const filter: any = {};
    if (scoreFilter) filter.score = parseInt(scoreFilter);
    if (nurseId) filter.toUserId = nurseId;
    if (ratingTypeFilter) filter.ratingType = ratingTypeFilter;

    const [ratings, total] = await Promise.all([
      Rating.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Rating.countDocuments(filter),
    ]);

    // Separate by type for enrichment
    const serviceRatingIds = ratings
      .filter((r: any) => r.ratingType !== 'emergency')
      .map((r: any) => r.requestId?.toString())
      .filter(Boolean);
    const emergencyRatingIds = ratings
      .filter((r: any) => r.ratingType === 'emergency')
      .map((r: any) => r.requestId?.toString())
      .filter(Boolean);

    // Enrich with user and service data
    const fromUserIds = [...new Set(ratings.map((r: any) => r.fromUserId?.toString()).filter(Boolean))];
    const toUserIds = [...new Set(ratings.map((r: any) => r.toUserId?.toString()).filter(Boolean))];

    const [beneficiaries, nurses, serviceRequests, emergencyRequests] = await Promise.all([
      fromUserIds.length > 0 ? Beneficiary.find({ _id: { $in: fromUserIds } }).select('name').lean() : [],
      toUserIds.length > 0 ? Nurse.find({ _id: { $in: toUserIds } }).select('name specialization rating').lean() : [],
      serviceRatingIds.length > 0 ? ServiceRequest.find({ _id: { $in: serviceRatingIds } }).select('serviceId').lean() : [],
      emergencyRatingIds.length > 0 ? EmergencyRequest.find({ _id: { $in: emergencyRatingIds } }).select('type description outcome').lean() : [],
    ]);

    const serviceIds = [...new Set(serviceRequests.map((sr: any) => sr.serviceId?.toString()).filter(Boolean))];
    const services = serviceIds.length > 0 ? await Service.find({ _id: { $in: serviceIds } }).select('nameAr category').lean() : [];

    const beneficiaryMap = new Map(beneficiaries.map((b: any) => [b._id.toString(), b]));
    const nurseMap = new Map(nurses.map((n: any) => [n._id.toString(), n]));
    const serviceRequestMap = new Map(serviceRequests.map((sr: any) => [sr._id.toString(), sr]));
    const serviceMap = new Map(services.map((s: any) => [s._id.toString(), s]));
    const emergencyMap = new Map(emergencyRequests.map((e: any) => [e._id.toString(), e]));

    const enrichedRatings = ratings.map((r: any) => {
      const beneficiary = beneficiaryMap.get(r.fromUserId?.toString());
      const nurse = nurseMap.get(r.toUserId?.toString());
      const isEmergency = r.ratingType === 'emergency';

      let serviceName: string | null = null;
      let emergencyType: string | null = null;
      let emergencyOutcome: string | null = null;

      if (isEmergency) {
        const emergency = emergencyMap.get(r.requestId?.toString());
        if (emergency) {
          emergencyType = emergencyTypeLabels[emergency.type] || emergency.type;
          emergencyOutcome = outcomeLabels[emergency.outcome] || emergency.outcome;
          serviceName = `طوارئ - ${emergencyType}`;
        } else {
          serviceName = 'طوارئ';
        }
      } else {
        const sr = serviceRequestMap.get(r.requestId?.toString());
        const service = sr ? serviceMap.get(sr.serviceId?.toString()) : null;
        serviceName = service?.nameAr || null;
      }

      return {
        id: r._id.toString(),
        fromUserName: r.isAnonymous ? 'مجهول' : (beneficiary?.name || 'غير معروف'),
        toUserName: nurse?.name || 'غير معروف',
        toUserSpecialization: nurse?.specialization || '',
        fromRole: r.fromRole,
        toRole: r.toRole,
        ratingType: r.ratingType || 'service',
        score: r.score,
        comment: r.comment || null,
        tags: r.tags || [],
        isAnonymous: r.isAnonymous || false,
        serviceName,
        emergencyType,
        emergencyOutcome,
        nurseRating: nurse?.rating || 0,
        createdAt: r.createdAt?.toISOString() || r.createdAt,
      };
    });

    // Calculate overall average
    const avgResult = await Rating.aggregate([
      { $group: { _id: null, avgScore: { $avg: '$score' }, totalCount: { $sum: 1 } } },
    ]);
    const avgRating = avgResult.length > 0 ? Math.round(avgResult[0].avgScore * 10) / 10 : 0;
    const totalCount = avgResult.length > 0 ? avgResult[0].totalCount : 0;

    // Calculate type-specific averages
    const typeAvgResult = await Rating.aggregate([
      { $group: { _id: '$ratingType', avgScore: { $avg: '$score' }, count: { $sum: 1 } } },
    ]);
    const serviceAvg = typeAvgResult.find((r: any) => r._id === 'service' || !r._id);
    const emergencyAvg = typeAvgResult.find((r: any) => r._id === 'emergency');

    return Response.json({
      success: true,
      data: {
        ratings: enrichedRatings,
        total,
        page,
        pages: Math.ceil(total / limit),
        summary: {
          averageRating: avgRating,
          totalCount,
          serviceAvg: serviceAvg ? Math.round(serviceAvg.avgScore * 10) / 10 : 0,
          serviceCount: serviceAvg?.count || 0,
          emergencyAvg: emergencyAvg ? Math.round(emergencyAvg.avgScore * 10) / 10 : 0,
          emergencyCount: emergencyAvg?.count || 0,
        },
      },
    });
  } catch (error) {
    console.error('[ADMIN RATINGS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب التقييمات', 500, 'INTERNAL_ERROR');
  }
}
