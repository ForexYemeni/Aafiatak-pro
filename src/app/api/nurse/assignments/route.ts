// GET /api/nurse/assignments - Get nurse assignments (service requests + emergency requests)
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, EmergencyRequest, Nurse, Beneficiary, Service } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
const emergencyTypeLabels: Record<string, string> = {
  medical: 'طبي عام', injury: 'إصابة', breathing: 'تنفسي',
  cardiac: 'قلبي', fall: 'سقوط', other: 'أخرى', general_medical: 'طبي عام',
};

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

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') || 'active';
    const countsOnly = searchParams.get('counts') === 'true';

    // If countsOnly, return counts for all tabs (zeros for unverified nurses)
    if (countsOnly) {
      if (!isVerified) {
        return Response.json({
          success: true,
          data: { new: 0, active: 0, completed: 0 },
          verificationRequired: true,
        });
      }

      // Count includes both service requests and emergency requests
      const [
        newServiceCount,
        activeServiceCount,
        completedServiceCount,
        newEmergencyCount,
        activeEmergencyCount,
        completedEmergencyCount,
      ] = await Promise.all([
        ServiceRequest.countDocuments({ nurseId: user.userId, status: 'assigned' }),
        ServiceRequest.countDocuments({ nurseId: user.userId, status: { $in: ['accepted', 'in_progress'] } }),
        ServiceRequest.countDocuments({ nurseId: user.userId, status: 'completed' }),
        EmergencyRequest.countDocuments({ nurseId: user.userId, status: 'dispatched' }),
        EmergencyRequest.countDocuments({ nurseId: user.userId, status: { $in: ['accepted', 'in_progress'] } }),
        EmergencyRequest.countDocuments({ nurseId: user.userId, status: { $in: ['resolved', 'cancelled'] } }),
      ]);

      return Response.json({
        success: true,
        data: {
          new: newServiceCount + newEmergencyCount,
          active: activeServiceCount + activeEmergencyCount,
          completed: completedServiceCount + completedEmergencyCount,
        },
      });
    }

    if (!isVerified) {
      return Response.json({
        success: true,
        data: [],
        verificationRequired: true,
        message: 'يجب توثيق حسابك أولاً برفع الهوية الوطنية ومزاولة المهنة',
      });
    }

    // ── Fetch Service Request assignments ──
    const serviceFilter: any = { nurseId: user.userId };
    if (status === 'active') {
      serviceFilter.status = { $in: ['assigned', 'accepted', 'in_progress'] };
    } else if (status === 'pending') {
      serviceFilter.status = 'assigned';
    } else if (status === 'completed') {
      serviceFilter.status = 'completed';
    } else if (status === 'all') {
      // No status filter
    } else {
      serviceFilter.status = status;
    }

    const serviceAssignments = await ServiceRequest.find(serviceFilter).sort({ createdAt: -1 }).limit(50).lean();

    // Populate service and beneficiary data for service requests
    const serviceIds = [...new Set(serviceAssignments.map((a: any) => a.serviceId?.toString()).filter(Boolean))];
    // Also collect service IDs from unified orders' services[] arrays
    for (const a of serviceAssignments) {
      if (Array.isArray((a as any).services)) {
        for (const s of (a as any).services) {
          const sid = s.serviceId?.toString();
          if (sid) serviceIds.push(sid);
        }
      }
    }
    const uniqueServiceIds = [...new Set(serviceIds)];
    const serviceBeneficiaryIds = [...new Set(serviceAssignments.map((a: any) => a.beneficiaryId?.toString()).filter(Boolean))];

    const [services, serviceBeneficiaries] = await Promise.all([
      Service.find({ _id: { $in: uniqueServiceIds } }).lean(),
      Beneficiary.find({ _id: { $in: serviceBeneficiaryIds } }).select('name phone').lean(),
    ]);

    const serviceMap = new Map(services.map((s: any) => [s._id.toString(), s]));
    const serviceBeneficiaryMap = new Map(serviceBeneficiaries.map((b: any) => [b._id.toString(), b]));

    // ── Payment gate helper ──
    // Beneficiary contact data (phone, address, location) is ONLY revealed when:
    //   - paymentStatus === 'completed'  (admin has confirmed the payment)
    // This applies to ALL payment methods including cash.
    // Emergency requests bypass the gate entirely (always reveal).
    const isContactRevealed = (a: any): boolean => {
      if (a.isEmergency) return true;
      return a.paymentStatus === 'completed';
    };

    // Transform service requests
    const populatedServiceAssignments = serviceAssignments.map((a: any) => {
      const service = serviceMap.get(a.serviceId?.toString());
      const beneficiary = serviceBeneficiaryMap.get(a.beneficiaryId?.toString());
      const reveal = isContactRevealed(a);
      const isUnified = Array.isArray(a.services) && a.services.length > 0;

      // For unified orders, build service info from the services[] snapshots
      // For legacy orders, use the single service lookup
      let serviceInfo: any;
      let serviceNameAr: string;
      if (isUnified) {
        serviceNameAr = a.services.map((s: any) => s.nameAr).filter(Boolean).join('، ') || 'خدمة';
        serviceInfo = {
          id: a.services[0]?.serviceId?.toString() || '',
          nameAr: serviceNameAr,
          category: service?.category || 'nursing',
          basePrice: a.basePrice || 0,
          duration: a.services.reduce((sum: number, s: any) => sum + (s.duration || 0), 0),
          // Include the full services list for detailed view
          servicesList: a.services.map((s: any) => ({
            id: s.serviceId?.toString() || '',
            nameAr: s.nameAr || 'خدمة',
            basePrice: s.basePrice || 0,
            quantity: s.quantity || 1,
            duration: s.duration || 0,
          })),
        };
      } else {
        serviceNameAr = service?.nameAr || 'خدمة';
        serviceInfo = service ? {
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
        };
      }

      return {
        id: a._id.toString(),
        requestId: a._id.toString(),
        nurseId: a.nurseId?.toString() || '',
        status: a.status,
        assignedAt: a.createdAt?.toISOString() || new Date().toISOString(),
        respondedAt: a.updatedAt?.toISOString() || null,
        estimatedArrivalMinutes: null,
        assignmentType: 'service' as const,
        isUnifiedOrder: isUnified || undefined,
        request: {
          id: a._id.toString(),
          status: a.status,
          scheduledAt: a.scheduledAt?.toISOString() || null,
          // Contact data: only revealed after payment confirmation
          beneficiaryAddress: reveal ? (a.beneficiaryAddress || null) : null,
          beneficiaryLat: reveal ? (a.beneficiaryLat || null) : null,
          beneficiaryLng: reveal ? (a.beneficiaryLng || null) : null,
          basePrice: a.basePrice || 0,
          nursePayout: a.nursePayout || 0,
          totalPrice: a.totalPrice || 0,
          isEmergency: a.isEmergency || false,
          paymentStatus: a.paymentStatus || 'pending',
          paymentMethod: a.paymentMethod || 'cash',
          service: serviceInfo,
          beneficiary: beneficiary ? {
            id: beneficiary._id.toString(),
            // Name is always shown (not sensitive)
            name: beneficiary.name || 'غير معروف',
            // Phone and address: only after payment confirmation
            phone: reveal ? (beneficiary.phone || '') : '',
            address: reveal ? (a.beneficiaryAddress || undefined) : undefined,
          } : {
            id: '',
            name: 'غير معروف',
            phone: '',
          },
        },
      };
    });

    // ── Fetch Emergency Request assignments ──
    const emergencyFilter: any = { nurseId: user.userId };
    if (status === 'active') {
      emergencyFilter.status = { $in: ['dispatched', 'accepted', 'in_progress'] };
    } else if (status === 'pending') {
      emergencyFilter.status = 'dispatched';
    } else if (status === 'completed') {
      emergencyFilter.status = { $in: ['resolved', 'cancelled'] };
    } else if (status === 'all') {
      // No status filter
    }

    const emergencyAssignments = await EmergencyRequest.find(emergencyFilter).sort({ createdAt: -1 }).limit(50).lean();

    // Populate beneficiary data for emergency requests
    const emergencyBeneficiaryIds = [...new Set(emergencyAssignments.map((e: any) => e.beneficiaryId?.toString()).filter(Boolean))];

    const emergencyBeneficiaries = await Beneficiary.find({ _id: { $in: emergencyBeneficiaryIds } }).select('name phone').lean();
    const emergencyBeneficiaryMap = new Map(emergencyBeneficiaries.map((b: any) => [b._id.toString(), b]));

    // Transform emergency requests
    const populatedEmergencyAssignments = emergencyAssignments.map((e: any) => {
      const beneficiary = emergencyBeneficiaryMap.get(e.beneficiaryId?.toString());
      const emergencyType = emergencyTypeLabels[e.type] || e.type || 'طوارئ';

      // Map emergency status to service-like status for nurse UI compatibility
      let mappedStatus = e.status;
      if (e.status === 'dispatched') mappedStatus = 'assigned'; // New/unaccepted
      else if (e.status === 'accepted') mappedStatus = 'accepted'; // Nurse accepted, on the way
      else if (e.status === 'in_progress') mappedStatus = 'in_progress';
      else if (e.status === 'resolved') mappedStatus = 'completed';
      else if (e.status === 'cancelled') mappedStatus = 'completed';

      const coordinates = e.location?.coordinates;

      return {
        id: e._id.toString(),
        requestId: e._id.toString(),
        nurseId: e.nurseId?.toString() || '',
        status: mappedStatus,
        assignedAt: e.dispatchedAt?.toISOString() || e.createdAt?.toISOString() || new Date().toISOString(),
        respondedAt: e.updatedAt?.toISOString() || null,
        estimatedArrivalMinutes: null,
        assignmentType: 'emergency' as const,
        outcome: e.outcome || null,
        resolvedNotes: e.resolvedNotes || null,
        request: {
          id: e._id.toString(),
          status: mappedStatus,
          scheduledAt: null,
          beneficiaryAddress: e.address || null,
          beneficiaryLat: coordinates?.[1] || null,
          beneficiaryLng: coordinates?.[0] || null,
          basePrice: e.emergencyFee || 0,
          nursePayout: 0,
          totalPrice: e.emergencyFee || 0,
          isEmergency: true,
          emergencyType: e.type,
          emergencyDescription: e.description,
          service: {
            id: '',
            nameAr: `طوارئ - ${emergencyType}`,
            category: 'emergency',
            basePrice: e.emergencyFee || 0,
            duration: 0,
          },
          beneficiary: beneficiary ? {
            id: beneficiary._id.toString(),
            name: beneficiary.name || 'غير معروف',
            phone: beneficiary.phone || '',
            address: e.address || undefined,
          } : {
            id: '',
            name: 'غير معروف',
            phone: '',
          },
        },
      };
    });

    // Merge and sort by assignedAt (most recent first)
    const allAssignments = [...populatedServiceAssignments, ...populatedEmergencyAssignments]
      .sort((a, b) => new Date(b.assignedAt).getTime() - new Date(a.assignedAt).getTime());

    return Response.json({
      success: true,
      data: allAssignments,
    });
  } catch (error) {
    console.error('[NURSE ASSIGNMENTS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب التعيينات', 500, 'INTERNAL_ERROR');
  }
}
