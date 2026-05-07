// GET/POST /api/chat/[id]/messages - Get/Send messages in a chat
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Chat, ChatMessage } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { id } = await params;

    // Verify user is a participant in this chat
    const chat = await Chat.findOne({
      _id: id,
      'participants.userId': user.userId,
    }).lean();

    if (!chat) return createErrorResponse('المحادثة غير موجودة', 404, 'NOT_FOUND');

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '50');

    const [messages, total] = await Promise.all([
      ChatMessage.find({ chatId: id, isDeleted: false })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ChatMessage.countDocuments({ chatId: id, isDeleted: false }),
    ]);

    // Mark messages as read
    await ChatMessage.updateMany(
      { chatId: id, senderId: { $ne: user.userId }, readBy: { $ne: user.userId } },
      { $addToSet: { readBy: user.userId } }
    );

    return Response.json({
      success: true,
      data: {
        messages: messages.map((m: any) => ({ ...m, id: m._id.toString() })).reverse(),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[CHAT MESSAGES GET ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب الرسائل', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { id } = await params;

    // Verify user is a participant
    const chat = await Chat.findOne({
      _id: id,
      'participants.userId': user.userId,
      isActive: true,
    });

    if (!chat) return createErrorResponse('المحادثة غير موجودة', 404, 'NOT_FOUND');

    const body = await request.json();
    const { content, type, imageUrl } = body;

    if (!content && !imageUrl) {
      return createErrorResponse('محتوى الرسالة مطلوب', 400, 'VALIDATION_ERROR');
    }

    // Create message
    const message = await ChatMessage.create({
      chatId: id,
      senderId: user.userId,
      senderRole: user.role,
      content: content || '',
      type: type || (imageUrl ? 'image' : 'text'),
      imageUrl,
      readBy: [user.userId],
      isDeleted: false,
    });

    // Update chat's last message
    chat.lastMessageContent = content || '[صورة]';
    chat.lastMessageSender = user.userId;
    chat.lastMessageAt = new Date();

    // Increment unread count for other participants
    for (const participant of chat.participants) {
      if (participant.userId.toString() !== user.userId) {
        const currentCount = (chat.unreadCount as Map<string, number>)?.get(participant.userId.toString()) || 0;
        if (!chat.unreadCount) chat.unreadCount = new Map();
        chat.unreadCount.set(participant.userId.toString(), currentCount + 1);
      }
    }

    await chat.save();

    return Response.json({
      success: true,
      data: { ...message.toObject(), id: message._id.toString() },
    }, { status: 201 });
  } catch (error) {
    console.error('[CHAT MESSAGE SEND ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إرسال الرسالة', 500, 'INTERNAL_ERROR');
  }
}
