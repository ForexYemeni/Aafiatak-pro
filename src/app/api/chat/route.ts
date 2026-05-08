// GET/POST /api/chat - List/Create chats
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Chat, ChatMessage, Nurse, Beneficiary } from '@/models/mongoose';
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

    // Populate participant info
    const populatedChats = await Promise.all(chats.map(async (chat: any) => {
      const otherParticipant = chat.participants.find(
        (p: any) => p.userId.toString() !== user.userId
      );

      let participantName = 'غير معروف';
      let participantPhone: string | null = null;
      let participantAvatar: string | null = null;

      if (otherParticipant) {
        const otherUserId = otherParticipant.userId;
        const otherRole = otherParticipant.role;

        if (otherRole === 'nurse') {
          const nurse = await Nurse.findById(otherUserId).select('name phone').lean();
          if (nurse) {
            participantName = nurse.name;
            participantPhone = nurse.phone || null;
          }
        } else if (otherRole === 'beneficiary') {
          const beneficiary = await Beneficiary.findById(otherUserId).select('name phone').lean();
          if (beneficiary) {
            participantName = beneficiary.name;
            participantPhone = beneficiary.phone || null;
          }
        } else {
          // Admin or other roles
          participantName = 'الإدارة';
        }
      }

      // Get unread count for current user
      const unreadCount = chat.unreadCount instanceof Map
        ? (chat.unreadCount as Map<string, number>).get(user.userId) || 0
        : (chat.unreadCount as Record<string, number>)?.[user.userId] || 0;

      return {
        id: chat._id.toString(),
        participantName,
        participantRole: otherParticipant?.role || 'unknown',
        participantPhone,
        participantAvatar,
        lastMessage: chat.lastMessageContent || '',
        lastMessageTime: chat.lastMessageAt?.toISOString() || chat.createdAt?.toISOString() || new Date().toISOString(),
        unreadCount,
        requestId: chat.requestId?.toString() || null,
      };
    }));

    return Response.json({
      success: true,
      data: populatedChats,
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

    // Get participant info for response
    let participantName = 'غير معروف';
    let participantPhone: string | null = null;

    if (participantRole === 'nurse' || !participantRole) {
      const nurse = await Nurse.findById(participantId).select('name phone').lean();
      if (nurse) {
        participantName = nurse.name;
        participantPhone = nurse.phone || null;
      }
    } else if (participantRole === 'beneficiary') {
      const beneficiary = await Beneficiary.findById(participantId).select('name phone').lean();
      if (beneficiary) {
        participantName = beneficiary.name;
        participantPhone = beneficiary.phone || null;
      }
    }

    return Response.json({
      success: true,
      data: {
        id: chat._id.toString(),
        participantName,
        participantRole: participantRole || 'nurse',
        participantPhone,
        participantAvatar: null,
        lastMessage: chat.lastMessageContent || '',
        lastMessageTime: chat.lastMessageAt?.toISOString() || new Date().toISOString(),
        unreadCount: 0,
        requestId: chat.requestId?.toString() || null,
      },
    }, { status: chat.isNew ? 201 : 200 });
  } catch (error) {
    console.error('[CHAT CREATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إنشاء المحادثة', 500, 'INTERNAL_ERROR');
  }
}
