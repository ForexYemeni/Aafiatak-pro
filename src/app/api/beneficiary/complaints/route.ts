// POST /api/beneficiary/complaints - File complaint

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireRole, successResponse, handleApiError, validateRequired, logActivity,
} from '@/lib/api/helpers';

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, 'beneficiary');

    const body = await request.json();
    const validationError = validateRequired(body, ['againstUserId', 'subject', 'description']);
    if (validationError) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: validationError }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const complaint = await db.complaint.create({
      data: {
        fromUserId: user.userId,
        fromUserRole: 'beneficiary',
        againstUserId: body.againstUserId,
        againstUserRole: body.againstUserRole ?? 'nurse',
        requestId: body.requestId ?? null,
        subject: body.subject,
        description: body.description,
        status: 'open',
        priority: body.priority ?? 'medium',
        attachments: JSON.stringify(body.attachments ?? []),
      },
    });

    await logActivity({
      userId: user.userId,
      userRole: 'beneficiary',
      action: 'file_complaint',
      entity: 'Complaint',
      entityId: complaint.id,
      details: `تم تقديم شكوى: ${body.subject}`,
      request,
    });

    return successResponse(complaint, 'تم تقديم الشكوى بنجاح', 201);
  } catch (error) {
    return handleApiError(error);
  }
}
