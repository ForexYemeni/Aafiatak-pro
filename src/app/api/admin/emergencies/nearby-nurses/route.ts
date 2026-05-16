// GET /api/admin/emergencies/nearby-nurses - Find nurses near an emergency location
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// Supports both location-based search AND name/phone search

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { EmergencyRequest, Nurse } from '@/models/mongoose';
import { requireSubadminPermission, createErrorResponse } from '@/lib/auth/middleware';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_emergencies');
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const emergencyId = searchParams.get('emergencyId');
    const lat = parseFloat(searchParams.get('lat') || '0');
    const lng = parseFloat(searchParams.get('lng') || '0');
    const maxDistance = parseInt(searchParams.get('maxDistance') || '100'); // km - increased default
    const limit = parseInt(searchParams.get('limit') || '50');
    const search = searchParams.get('search') || ''; // Name/phone search

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

    // Build nurse filter - always include verified nurses
    const nurseFilter: any = {
      verificationStatus: 'verified',
      isActive: { $ne: false },
    };

    // If search term provided, filter by name or phone
    if (search) {
      nurseFilter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { specialization: { $regex: search, $options: 'i' } },
      ];
    }

    const hasLocation = searchLat && searchLng && (searchLat !== 0 || searchLng !== 0);

    // Find nurses - with or without location
    if (hasLocation) {
      // Prefer nurses with location data for distance calculation
      nurseFilter.lat = { $ne: null, $exists: true };
      nurseFilter.lng = { $ne: null, $exists: true };
    }

    const nurses = await Nurse.find(nurseFilter)
      .select('name phone specialization rating isAvailable isOnline lat lng governorate completedJobs experience')
      .limit(limit * 2) // Get more for distance filtering
      .lean();

    // Calculate distance using Haversine formula if location available
    const R = 6371; // Earth radius in km
    let nursesWithDistance = nurses.map((nurse: any) => {
      let distance = null;

      if (hasLocation && nurse.lat && nurse.lng) {
        const nLat = nurse.lat;
        const nLng = nurse.lng;
        const dLat = (nLat - searchLat) * Math.PI / 180;
        const dLon = (nLng - searchLng) * Math.PI / 180;
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(searchLat * Math.PI / 180) * Math.cos(nLat * Math.PI / 180) *
                  Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        distance = Math.round(R * c * 10) / 10;
      }

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
        completedJobs: nurse.completedJobs || 0,
        experience: nurse.experience || 0,
      };
    });

    // Filter by distance only if we have a location
    if (hasLocation) {
      // First: nurses within range (with distance)
      const inRange = nursesWithDistance.filter(n => n.distance !== null && n.distance <= maxDistance);
      // Also get nurses without distance data (no location) as fallback
      const nursesWithoutLocation = await Nurse.find({
        verificationStatus: 'verified',
        isActive: { $ne: false },
        $or: [
          { lat: null },
          { lat: { $exists: false } },
          { lng: null },
          { lng: { $exists: false } },
        ],
        ...(search ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { phone: { $regex: search, $options: 'i' } },
          ],
        } : {}),
      })
        .select('name phone specialization rating isAvailable isOnline governorate completedJobs experience')
        .limit(limit)
        .lean();

      const withoutDistance = nursesWithoutLocation.map((nurse: any) => ({
        id: nurse._id.toString(),
        name: nurse.name,
        phone: nurse.phone,
        specialization: Array.isArray(nurse.specialization) ? nurse.specialization.join(', ') : (nurse.specialization || 'تمريض عام'),
        rating: nurse.rating || 0,
        isAvailable: nurse.isAvailable !== false,
        isOnline: nurse.isOnline || false,
        distance: null as number | null,
        governorate: nurse.governorate || '',
        completedJobs: nurse.completedJobs || 0,
        experience: nurse.experience || 0,
      }));

      nursesWithDistance = [...inRange, ...withoutDistance];
    }

    // Sort: online & available first, then by distance (nulls last)
    nursesWithDistance.sort((a, b) => {
      const aScore = (a.isOnline && a.isAvailable) ? 2 : (a.isAvailable ? 1 : 0);
      const bScore = (b.isOnline && b.isAvailable) ? 2 : (b.isAvailable ? 1 : 0);
      if (aScore !== bScore) return bScore - aScore;
      if (a.distance !== null && b.distance !== null) return a.distance - b.distance;
      if (a.distance !== null) return -1;
      if (b.distance !== null) return 1;
      return 0;
    });

    return Response.json({
      success: true,
      data: {
        nurses: nursesWithDistance.slice(0, limit),
        searchLocation: hasLocation ? { lat: searchLat, lng: searchLng } : null,
        totalFound: nursesWithDistance.length,
        hasLocation,
      },
    });
  } catch (error) {
    console.error('[NEARBY NURSES ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء البحث عن الممرضين القريبين', 500, 'INTERNAL_ERROR');
  }
}
