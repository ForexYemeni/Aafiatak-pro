// GET /api/chat - List chats for current user

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireAuth, paginatedResponse, handleApiError,
  parsePagination, paginate, safeJsonParse,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    const url = new URL(request.url);
    const { page, limit, skip } = parsePagination(url);

    // Find chats where user is a participant
    const allChats = await db.chat.findMany({
      where: { isActive: true },
      orderBy: { lastMessageAt: 'desc' },
    });

    // Filter chats where user is a participant (JSON field)
    const userChats = allChats.filter((chat) => {
      const participants = safeJsonParse<Array<{ userId: string; role: string }>>(chat.participants, []);
      return participants.some((p) => p.userId === user.userId);
    });

    // Apply pagination
    const total = userChats.length;
    const paginatedChats = userChats.slice(skip, skip + limit);

    const chatsWithParsed = paginatedChats.map((chat) => ({
      ...chat,
      participants: safeJsonParse<Array<{ userId: string; role: string; joinedAt: string }>>(chat.participants, []),
      unreadCount: safeJsonParse<Record<string, number>>(chat.unreadCount, {}),
    }));

    const pagination = paginate({ page, limit, total });
    return paginatedResponse(chatsWithParsed, pagination);
  } catch (error) {
    return handleApiError(error);
  }
}
