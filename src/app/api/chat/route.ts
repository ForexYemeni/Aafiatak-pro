// GET/POST /api/chat - List/Create chats
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Chat, ChatMessage, Nurse, Beneficiary, User } from '@/models/mongoose';
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
        } else if (otherRole === 'admin' || otherRole === 'subadmin') {
          const adminUser = await User.findById(otherUserId).select('name phone role').lean();
          if (adminUser) {
            participantName = adminUser.name;
            participantPhone = adminUser.phone || null;
          } else {
            participantName = 'الإدارة';
          }
        } else {
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

    // Auto-ensure admin/support chat exists for nurses and beneficiaries
    if (user.role === 'nurse' || user.role === 'beneficiary') {
      const hasAdminChat = chats.some((chat: any) => {
        return chat.participants.some((p: any) =>
          (p.role === 'admin' || p.role === 'subadmin') &&
          p.userId.toString() !== user.userId
        );
      });

      if (!hasAdminChat) {
        // Find an admin or subadmin to create a support chat with
        const adminUser = await User.findOne({
          role: { $in: ['admin', 'subadmin'] },
          isActive: { $ne: false },
        }).select('name phone role').sort({ role: 1 }).lean(); // Prefer admin over subadmin

        if (adminUser) {
          const supportChat = await Chat.create({
            participants: [
              { userId: user.userId, role: user.role, joinedAt: new Date() },
              { userId: adminUser._id, role: adminUser.role, joinedAt: new Date() },
            ],
            unreadCount: {},
            isActive: true,
            lastMessageContent: 'مرحباً بك في الدعم الفني - كيف يمكننا مساعدتك؟',
            lastMessageSender: adminUser._id.toString(),
            lastMessageAt: new Date(),
          });

          // Create welcome message
          await ChatMessage.create({
            chatId: supportChat._id,
            senderId: adminUser._id,
            senderRole: adminUser.role,
            content: 'مرحباً بك في الدعم الفني - كيف يمكننا مساعدتك؟',
            type: 'system',
            readBy: [adminUser._id],
            isDeleted: false,
          });

          populatedChats.unshift({
            id: supportChat._id.toString(),
            participantName: 'الدعم الفني',
            participantRole: adminUser.role,
            participantPhone: adminUser.phone || null,
            participantAvatar: null,
            lastMessage: 'مرحباً بك في الدعم الفني - كيف يمكننا مساعدتك؟',
            lastMessageTime: new Date().toISOString(),
            unreadCount: 1,
            requestId: null,
          });
        }
      }
    }

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

    if (participantRole === 'nurse' || (!participantRole && await Nurse.findById(participantId))) {
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
    } else if (participantRole === 'admin' || participantRole === 'subadmin') {
      const adminUser = await User.findById(participantId).select('name phone role').lean();
      if (adminUser) {
        participantName = adminUser.role === 'admin' ? 'مدير النظام' : adminUser.name;
        participantPhone = adminUser.phone || null;
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
