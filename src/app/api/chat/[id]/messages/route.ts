// GET /api/chat/[id]/messages - Get chat messages
// POST /api/chat/[id]/messages - Send message

import { NextRequest } from 'next/server';
import { db } from '@/lib/prisma';
import {
  requireAuth, successResponse, paginatedResponse, handleApiError,
  parsePagination, paginate, safeJsonParse, validateRequired, logActivity,
} from '@/lib/api/helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const chat = await db.chat.findUnique({ where: { id } });
    if (!chat) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على المحادثة' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    // Verify user is a participant
    const participants = safeJsonParse<Array<{ userId: string }>>(chat.participants, []);
    if (!participants.some((p) => p.userId === user.userId)) {
      return new Response(JSON.stringify({ success: false, error: 'FORBIDDEN', message: 'ليس لديك صلاحية للوصول لهذه المحادثة' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);

    const [messages, total] = await Promise.all([
      db.chatMessage.findMany({
        where: { chatId: id, isDeleted: false },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      db.chatMessage.count({ where: { chatId: id, isDeleted: false } }),
    ]);

    const parsed = messages.map((m) => ({
      ...m,
      readBy: safeJsonParse<string[]>(m.readBy, []),
      deliveredTo: safeJsonParse<string[]>(m.deliveredTo, []),
      quickReplies: m.quickReplies ? safeJsonParse<Array<{ id: string; labelAr: string; labelEn: string; value: string }>>(m.quickReplies, null) : null,
    }));

    const pagination = paginate({ page, limit, total });
    return paginatedResponse(parsed, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const chat = await db.chat.findUnique({ where: { id } });
    if (!chat) {
      return new Response(JSON.stringify({ success: false, error: 'NOT_FOUND', message: 'لم يتم العثور على المحادثة' }), { status: 404, headers: { 'Content-Type': 'application/json' } });
    }

    const participants = safeJsonParse<Array<{ userId: string }>>(chat.participants, []);
    if (!participants.some((p) => p.userId === user.userId)) {
      return new Response(JSON.stringify({ success: false, error: 'FORBIDDEN', message: 'ليس لديك صلاحية للكتابة في هذه المحادثة' }), { status: 403, headers: { 'Content-Type': 'application/json' } });
    }

    const body = await request.json();
    const validationError = validateRequired(body, ['content']);
    if (validationError) {
      return new Response(JSON.stringify({ success: false, error: 'VALIDATION_ERROR', message: validationError }), { status: 400, headers: { 'Content-Type': 'application/json' } });
    }

    const message = await db.chatMessage.create({
      data: {
        chatId: id,
        senderId: user.userId,
        senderRole: user.role,
        content: body.content,
        type: body.type ?? 'text',
        imageUrl: body.imageUrl ?? null,
        replyTo: body.replyTo ?? null,
        quickReplies: body.quickReplies ? JSON.stringify(body.quickReplies) : null,
        readBy: JSON.stringify([user.userId]),
        deliveredTo: JSON.stringify([user.userId]),
      },
    });

    // Update chat's last message
    await db.chat.update({
      where: { id },
      data: {
        lastMessageContent: body.content,
        lastMessageSender: user.userId,
        lastMessageAt: new Date(),
      },
    });

    return successResponse({
      ...message,
      readBy: [user.userId],
      deliveredTo: [user.userId],
      quickReplies: body.quickReplies ?? null,
    }, 'تم إرسال الرسالة بنجاح', 201);
  } catch (error) {
    return handleApiError(error);
  }
}
