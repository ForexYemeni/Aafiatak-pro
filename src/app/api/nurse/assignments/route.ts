// GET /api/nurse/assignments - Get nurse assignments
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, EmergencyRequest, Nurse, Beneficiary, Service } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    // Check if nurse is verified
    const nurse = await Nurse.findById(user.userId).select('verificationStatus identityDocumentUrl licenseDocumentUrl').lean();
    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    const isVerified = nurse.verificationStatus === 'verified' && nurse.identityDocumentUrl && nurse.licenseDocumentUrl;

    if (!isVerified) {
      return Response.json({
        success: true,
        data: [],
        verificationRequired: true,
        message: 'يجب توثيق حسابك أولاً برفع الهوية الوطنية ومزاولة المهنة',
      });
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';

    const filter: any = { nurseId: user.userId };
    if (status === 'active') {
      filter.status = { $in: ['assigned', 'accepted', 'in_progress'] };
    } else if (status === 'pending') {
      // "pending" in the UI means assigned but not yet accepted by the nurse
      filter.status = 'assigned';
    } else if (status === 'completed') {
      filter.status = 'completed';
    } else if (status === 'all') {
      // No status filter
    } else {
      filter.status = status;
    }

    const assignments = await ServiceRequest.find(filter).sort({ createdAt: -1 }).limit(50).lean();

    // Populate service and beneficiary data
    const serviceIds = [...new Set(assignments.map((a: any) => a.serviceId?.toString()).filter(Boolean))];
    const beneficiaryIds = [...new Set(assignments.map((a: any) => a.beneficiaryId?.toString()).filter(Boolean))];

    const [services, beneficiaries] = await Promise.all([
      Service.find({ _id: { $in: serviceIds } }).lean(),
      Beneficiary.find({ _id: { $in: beneficiaryIds } }).select('name phone').lean(),
    ]);

    const serviceMap = new Map(services.map((s: any) => [s._id.toString(), s]));
    const beneficiaryMap = new Map(beneficiaries.map((b: any) => [b._id.toString(), b]));

    // Transform to the format expected by the nurse UI
    const populatedAssignments = assignments.map((a: any) => {
      const service = serviceMap.get(a.serviceId?.toString());
      const beneficiary = beneficiaryMap.get(a.beneficiaryId?.toString());

      return {
        id: a._id.toString(),
        requestId: a._id.toString(),
        nurseId: a.nurseId?.toString() || '',
        status: a.status,
        assignedAt: a.createdAt?.toISOString() || new Date().toISOString(),
        respondedAt: a.updatedAt?.toISOString() || null,
        estimatedArrivalMinutes: null,
        request: {
          id: a._id.toString(),
          status: a.status,
          scheduledAt: a.scheduledAt?.toISOString() || null,
          beneficiaryAddress: a.beneficiaryAddress || null,
          beneficiaryLat: a.beneficiaryLat || null,
          beneficiaryLng: a.beneficiaryLng || null,
          basePrice: a.basePrice || 0,
          nursePayout: a.nursePayout || 0,
          totalPrice: a.totalPrice || 0,
          isEmergency: a.isEmergency || false,
          service: service ? {
            id: service._id.toString(),
            nameAr: service.nameAr || 'خدمة',
            category: service.category || 'nursing',
            basePrice: service.basePrice || 0,
            duration: service.duration || 0,
          } : {
            id: '',
            nameAr: 'خدمة',
            category: 'nursing',
            basePrice: 0,
            duration: 0,
          },
          beneficiary: beneficiary ? {
            id: beneficiary._id.toString(),
            name: beneficiary.name || 'غير معروف',
            phone: beneficiary.phone || '',
            address: a.beneficiaryAddress || undefined,
          } : {
            id: '',
            name: 'غير معروف',
            phone: '',
          },
        },
      };
    });

    return Response.json({
      success: true,
      data: populatedAssignments,
    });
  } catch (error) {
    console.error('[NURSE ASSIGNMENTS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب التعيينات', 500, 'INTERNAL_ERROR');
  }
}
