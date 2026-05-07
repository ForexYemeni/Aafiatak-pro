// GET/POST /api/chat - List/Create chats
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Chat, ChatMessage } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    // Find chats where user is a participant
    const chats = await Chat.find({
      'participants.userId': user.userId,
      isActive: true,
    })
      .sort({ lastMessageAt: -1 })
      .lean();

    return Response.json({
      success: true,
      data: chats.map((c: any) => ({ ...c, id: c._id.toString() })),
    });
  } catch (error) {
    console.error('[CHAT LIST ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب المحادثات', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const body = await request.json();
    const { participantId, participantRole, requestId } = body;

    if (!participantId) {
      return createErrorResponse('معرف المشارك مطلوب', 400, 'VALIDATION_ERROR');
    }

    // Check if chat already exists between these users
    let chat = await Chat.findOne({
      'participants.userId': { $all: [user.userId, participantId] },
      isActive: true,
    }).lean();

    if (!chat) {
      // Create new chat
      chat = await Chat.create({
        participants: [
          { userId: user.userId, role: user.role, joinedAt: new Date() },
          { userId: participantId, role: participantRole || 'nurse', joinedAt: new Date() },
        ],
        requestId: requestId || undefined,
        unreadCount: {},
        isActive: true,
      });
    }

    return Response.json({
      success: true,
      data: { ...chat.toObject(), id: chat._id.toString() },
    }, { status: 201 });
  } catch (error) {
    console.error('[CHAT CREATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إنشاء المحادثة', 500, 'INTERNAL_ERROR');
  }
}
