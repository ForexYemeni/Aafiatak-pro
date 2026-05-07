// GET /api/beneficiary/tracking/[nurseId] - Track nurse location

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireRole, successResponse, handleApiError,
} from '@/lib/api/helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ nurseId: string }> }
) {
  try {
    const user = await requireRole(request, 'beneficiary');
    const { nurseId } = await params;

    // Verify the beneficiary has an active order with this nurse
    const activeOrder = await db.serviceRequest.findFirst({
      where: {
        beneficiaryId: user.userId,
        nurseId,
        status: { in: ['assigned', 'accepted', 'in_progress'] },
      },
    });

    if (!activeOrder) {
      // Also check emergency requests
      const activeEmergency = await db.emergencyRequest.findFirst({
        where: {
          beneficiaryId: user.userId,
          nurseId,
          status: { in: ['dispatched', 'in_progress'] },
        },
      });

      if (!activeEmergency) {
        return new Response(JSON.stringify({ success: false, error: 'FORBIDDEN', message: 'لا يمكنك تتبع هذا الممرض - لا يوجد طلب نشط معه' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
      }
    }

    const nurse = await db.nurse.findUnique({
      where: { id: nurseId },
      select: {
        id: true, name: true, phone: true, isOnline: true, isAvailable: true,
        lat: true, lng: true, locationUpdatedAt: true, rating: true,
      },
    });

    if (!nurse) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الممرض' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    return successResponse({
      nurseId: nurse.id,
      name: nurse.name,
      isOnline: nurse.isOnline,
      location: nurse.lat !== null && nurse.lng !== null
        ? { lat: nurse.lat, lng: nurse.lng, updatedAt: nurse.locationUpdatedAt }
        : null,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
