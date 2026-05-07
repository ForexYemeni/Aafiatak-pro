// GET /api/nurse/schedule - Weekly schedule

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireRole, successResponse, handleApiError,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireRole(request, 'nurse');

    const url = new URL(request.url);
    const weekStart = url.searchParams.get('weekStart');

    const now = new Date();
    const startOfWeek = weekStart ? new Date(weekStart) : new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(endOfWeek.getDate() + 7);

    // Get accepted and in-progress assignments for this week
    const assignments = await db.serviceAssignment.findMany({
      where: {
        nurseId: user.userId,
        status: { in: ['accepted', 'pending'] },
        request: {
          scheduledAt: {
            gte: startOfWeek,
            lt: endOfWeek,
          },
        },
      },
      include: {
        request: {
          include: {
            service: { select: { id: true, nameAr: true, nameEn: true, duration: true } },
            beneficiary: { select: { id: true, name: true, phone: true, address: true } },
          },
        },
      },
      orderBy: { assignedAt: 'asc' },
    });

    // Get emergency assignments for this week
    const emergencyAssignments = await db.emergencyAssignment.findMany({
      where: {
        nurseId: user.userId,
        status: { in: ['pending', 'accepted'] },
        assignedAt: {
          gte: startOfWeek,
          lt: endOfWeek,
        },
      },
      include: {
        emergencyRequest: {
          include: {
            beneficiary: { select: { id: true, name: true, phone: true, address: true } },
          },
        },
      },
      orderBy: { assignedAt: 'asc' },
    });

    return successResponse({
      weekStart: startOfWeek.toISOString(),
      weekEnd: endOfWeek.toISOString(),
      assignments,
      emergencyAssignments,
    });
  } catch (error) {
    return handleApiError(error);
  }
}
