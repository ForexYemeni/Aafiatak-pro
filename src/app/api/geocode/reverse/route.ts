import { NextRequest, NextResponse } from 'next/server';

/**
 * POST /api/geocode/reverse
 * Server-side proxy for OpenStreetMap Nominatim reverse geocoding.
 * Avoids CORS issues, browser network restrictions, and adds proper timeout.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { lat, lng } = body;

    // Validate coordinates
    if (
      typeof lat !== 'number' || typeof lng !== 'number' ||
      lat < -90 || lat > 90 || lng < -180 || lng > 180
    ) {
      return NextResponse.json(
        { success: false, message: 'إحداثيات غير صالحة' },
        { status: 400 }
      );
    }

    // Call Nominatim from server side (no CORS issues)
    const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&accept-language=ar&addressdetails=1&zoom=18`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8s timeout

    let nominatimData: any = null;

    // Try up to 2 times
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const response = await fetch(url, {
          headers: {
            'User-Agent': 'Aafiatak-Healthcare-Platform/1.0',
          },
          signal: controller.signal,
        });

        if (response.ok) {
          const data = await response.json();
          if (data && data.display_name) {
            nominatimData = data;
            break;
          }
        }

        // Wait before retry (respect Nominatim rate limit)
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 1100)); // 1.1s between requests
        }
      } catch (fetchErr: any) {
        if (fetchErr?.name === 'AbortError') break;
        if (attempt === 0) {
          await new Promise(r => setTimeout(r, 1100));
        }
      }
    }

    clearTimeout(timeoutId);

    if (!nominatimData) {
      return NextResponse.json({
        success: false,
        message: 'فشل في تحويل الإحداثيات إلى عنوان',
      });
    }

    // Extract and format the address components
    const addr = nominatimData.address || {};

    return NextResponse.json({
      success: true,
      data: {
        display_name: nominatimData.display_name,
        road: addr.road || '',
        neighbourhood: addr.neighbourhood || '',
        suburb: addr.suburb || '',
        city: addr.city || addr.town || addr.village || '',
        district: addr.district || addr.city_district || '',
        state: addr.state || addr.region || '',
        county: addr.county || '',
        country: addr.country || '',
        country_code: addr.country_code || '',
      },
    });
  } catch (error) {
    console.error('[Geocode Reverse API] Error:', error);
    return NextResponse.json(
      { success: false, message: 'حدث خطأ في تحديد العنوان' },
      { status: 500 }
    );
  }
}
