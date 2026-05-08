// GET /api/admin/emergencies/nearby-nurses - Find nurses near an emergency location
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { EmergencyRequest, Nurse } from '@/models/mongoose';
import { requireSubadminPermission, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_emergencies');
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const emergencyId = searchParams.get('emergencyId');
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const maxDistance = parseInt(searchParams.get('maxDistance') || '50'); // km
    const limit = parseInt(searchParams.get('limit') || '20');

    let searchLat = lat;
    let searchLng = lng;

    // If emergency ID is provided, get location from the emergency
    if (emergencyId) {
      const emergency = await EmergencyRequest.findById(emergencyId).lean();
      if (emergency) {
        searchLat = emergency.lat || lat;
        searchLng = emergency.lng || lng;
      }
    }

    if (!searchLat || !searchLng) {
      return createErrorResponse('الموقع غير متاح', 400, 'VALIDATION_ERROR');
    }

    // Find all verified nurses with location data
    const nurses = await Nurse.find({
      verificationStatus: 'verified',
      lat: { $ne: null, $exists: true },
      lng: { $ne: null, $exists: true },
    })
      .select('name phone specialization rating isAvailable isOnline lat lng governorate')
      .lean();

    // Calculate distance using Haversine formula and filter
    const R = 6371; // Earth radius in km
    const nursesWithDistance = nurses
      .map((nurse: any) => {
        const nLat = nurse.lat || 0;
        const nLng = nurse.lng || 0;
        const dLat = (nLat - searchLat) * Math.PI / 180;
        const dLon = (nLng - searchLng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(searchLat * Math.PI / 180) * Math.cos(nLat * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        const distance = Math.round(R * c * 10) / 10;

        return {
          id: nurse._id.toString(),
          name: nurse.name,
          phone: nurse.phone,
          specialization: Array.isArray(nurse.specialization) ? nurse.specialization.join(', ') : (nurse.specialization || 'تمريض عام'),
          rating: nurse.rating || 0,
          isAvailable: nurse.isAvailable !== false,
          isOnline: nurse.isOnline || false,
          distance,
          governorate: nurse.governorate || '',
        };
      })
      .filter(n => n.distance <= maxDistance)
      .sort((a, b) => {
        // Sort: online & available first, then by distance
        if (a.isOnline && a.isAvailable && (!b.isOnline || !b.isAvailable)) return -1;
        if (b.isOnline && b.isAvailable && (!a.isOnline || !a.isAvailable)) return 1;
        return a.distance - b.distance;
      })
      .slice(0, limit);

    return Response.json({
      success: true,
      data: {
        nurses: nursesWithDistance,
        searchLocation: { lat: searchLat, lng: searchLng },
        totalFound: nursesWithDistance.length,
      },
    });
  } catch (error) {
    console.error('[NEARBY NURSES ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء البحث عن الممرضين القريبين', 500, 'INTERNAL_ERROR');
  }
}
