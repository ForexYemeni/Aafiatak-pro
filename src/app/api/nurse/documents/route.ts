// POST /api/nurse/documents - Upload verification documents

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireRole, successResponse, handleApiError, validateRequired, logActivity,
} from '@/lib/api/helpers';

export async function POST(request: NextRequest) {
  try {
    const user = await requireRole(request, 'nurse');

    const body = await request.json();
    const validationError = validateRequired(body, ['type', 'url']);
    if (validationError) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: validationError }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const validTypes = ['identity', 'license', 'certificate', 'other'];
    if (!validTypes.includes(body.type)) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: 'نوع المستند غير صالح' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const document = await db.nurseDocument.create({
      data: {
        nurseId: user.userId,
        type: body.type,
        url: body.url,
        status: 'pending',
      },
    });

    // Update nurse's document URLs if applicable
    if (body.type === 'identity') {
      await db.nurse.update({
        where: { id: user.userId },
        data: { identityDocumentUrl: body.url },
      });
    } else if (body.type === 'license') {
      await db.nurse.update({
        where: { id: user.userId },
        data: { licenseDocumentUrl: body.url },
      });
    }

    await logActivity({
      userId: user.userId,
      userRole: 'nurse',
      action: 'upload_document',
      entity: 'NurseDocument',
      entityId: document.id,
      details: `تم رفع مستند ${body.type}`,
      request,
    });

    return successResponse(document, 'تم رفع المستند بنجاح', 201);
  } catch (error) {
    return handleApiError(error);
  }
}
