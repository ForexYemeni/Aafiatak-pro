// POST /api/beneficiary/emergency - Create emergency request

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireRole, successResponse, handleApiError, logActivity, validateRequired,
} from '@/lib/api/helpers';

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, 'beneficiary');

    const body = await request.json();
    const validationError = validateRequired(body, ['type', 'description', 'address', 'lat', 'lng']);
    if (validationError) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: validationError }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const validTypes = ['medical', 'injury', 'breathing', 'cardiac', 'fall', 'other'];
    if (!validTypes.includes(body.type)) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: 'نوع الطوارئ غير صالح' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const emergency = await db.emergencyRequest.create({
      data: {
        beneficiaryId: user.userId,
        type: body.type,
        description: body.description,
        lat: body.lat,
        lng: body.lng,
        address: body.address,
        status: 'pending',
        priority: body.priority ?? 'high',
        notes: body.notes ?? null,
      },
    });

    // Check if auto-dispatch is enabled
    const settings = await db.adminSettings.findFirst();
    if (settings?.emergencyAutoDispatch) {
      // Find nearest available verified nurse
      const nurses = await db.nurse.findMany({
        where: {
          isActive: true,
          isAvailable: true,
          verificationStatus: 'verified',
          lat: { not: null },
          lng: { not: null },
        },
        select: { id: true, lat: true, lng: true, name: true },
      });

      // Simple distance calculation (find closest nurse)
      let closestNurse: { id: string; distance: number } | null = null;
      for (const nurse of nurses) {
        if (nurse.lat !== null && nurse.lng !== null) {
          const distance = calculateDistance(body.lat, body.lng, nurse.lat, nurse.lng);
          if (!closestNurse || distance < closestNurse.distance) {
            closestNurse = { id: nurse.id, distance };
          }
        }
      }

      if (closestNurse && closestNurse.distance <= (settings.maxNurseAssignmentRadius ?? 20)) {
        const estimatedArrival = Math.round((closestNurse.distance / 30) * 60); // ~30km/h average

        await db.emergencyAssignment.create({
          data: {
            emergencyRequestId: emergency.id,
            nurseId: closestNurse.id,
            status: 'pending',
            distance: closestNurse.distance,
            estimatedArrivalMinutes: estimatedArrival,
          },
        });

        await db.emergencyRequest.update({
          where: { id: emergency.id },
          data: { nurseId: closestNurse.id, status: 'dispatched', dispatchedAt: new Date() },
        });
      }
    }

    await logActivity({
      userId: user.userId,
      userRole: 'beneficiary',
      action: 'create_emergency',
      entity: 'EmergencyRequest',
      entityId: emergency.id,
      details: `تم إنشاء طلب طوارئ من نوع ${body.type}`,
      request,
    });

    return successResponse(emergency, 'تم إرسال طلب الطوارئ بنجاح', 201);
  } catch (error) {
    return handleApiError(error);
  }
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth radius in km
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}
