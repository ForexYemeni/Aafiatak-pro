// GET /api/beneficiary/orders/[id] - Order details

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireRole, successResponse, handleApiError,
} from '@/lib/api/helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireRole(request, 'beneficiary');
    const { id } = await params;

    const order = await db.serviceRequest.findUnique({
      where: { id },
      include: {
        service: true,
        nurse: {
          select: { id: true, name: true, phone: true, rating: true, specialization: true, governorate: true, lat: true, lng: true, isOnline: true },
        },
        assignments: {
          include: { nurse: { select: { id: true, name: true, phone: true, rating: true } } },
        },
        transactions: true,
        rating: true,
      },
    });

    if (!order || order.beneficiaryId !== user.userId) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على الطلب' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    return successResponse(order);
  } catch (error) {
    return handleApiError(error);
  }
}
