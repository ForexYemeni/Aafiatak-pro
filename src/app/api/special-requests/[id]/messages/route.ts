// GET/POST /api/special-requests/[id]/messages
// إرسال واستقبال الرسائل داخل محادثة الطلب الخاص

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SpecialServiceRequest, Notification, User } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { emitToUser, emitToAdmins } from '@/lib/notifications/socket-client';
import { sendPushToUser } from '@/lib/notifications/push-service';
import { serializeDoc } from '@/lib/mongoose/serialize';

export const dynamic = 'force-dynamic';

// ── GET: جلب جميع رسائل المحادثة ──
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { id } = await params;
    const specialRequest = await SpecialServiceRequest.findById(id).lean();

    if (!specialRequest) {
      return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');
    }

    // ── التحقق من الصلاحيات ──
    const isAdmin = user.role === 'admin' || user.role === 'subadmin';
    const isBeneficiary = user.role === 'beneficiary' && specialRequest.beneficiaryId.toString() === user.userId;
    const isNurse = user.role === 'nurse' && specialRequest.nurseId?.toString() === user.userId;

    if (!isAdmin && !isBeneficiary && !isNurse) {
      return createErrorResponse('ليس لديك صلاحية للوصول إلى هذه المحادثة', 403, 'FORBIDDEN');
    }

    // ── تحديث عداد غير المقروء للمستخدم الحالي ──
    if (isAdmin || isBeneficiary || isNurse) {
      await SpecialServiceRequest.updateOne(
        { _id: id },
        { $set: { [`unreadCount.${user.userId}`]: 0 } }
      );
    }

    return Response.json({
      success: true,
      data: {
        messages: serializeDoc(specialRequest.messages || []),
        requestStatus: specialRequest.status,
        beneficiaryId: specialRequest.beneficiaryId?.toString(),
        nurseId: specialRequest.nurseId?.toString(),
      },
    });
  } catch (error) {
    console.error('[SPECIAL REQUEST MESSAGES GET ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب الرسائل', 500, 'INTERNAL_ERROR');
  }
}

// ── POST: إرسال رسالة جديدة ──
export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { id } = await params;
    const specialRequest = await SpecialServiceRequest.findById(id);

    if (!specialRequest) {
      return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');
    }

    // ── التحقق من الصلاحيات ──
    const isAdmin = user.role === 'admin' || user.role === 'subadmin';
    const isBeneficiary = user.role === 'beneficiary' && specialRequest.beneficiaryId.toString() === user.userId;
    const isNurse = user.role === 'nurse' && specialRequest.nurseId?.toString() === user.userId;

    if (!isAdmin && !isBeneficiary && !isNurse) {
      return createErrorResponse('ليس لديك صلاحية في هذه المحادثة', 403, 'FORBIDDEN');
    }

    // ── التحقق من أن المحادثة ما زالت مفتوحة ──
    if (['cancelled', 'rejected', 'completed'].includes(specialRequest.status)) {
      return createErrorResponse('لا يمكن إرسال رسائل في طلب مكتمل أو ملغي', 400, 'CONVERSATION_CLOSED');
    }

    const body = await request.json();
    const { content, type, imageUrl, fileUrl, fileName, fileSize } = body;

    if (!content && !imageUrl && !fileUrl) {
      return createErrorResponse('محتوى الرسالة مطلوب', 400, 'VALIDATION_ERROR');
    }

    // ── إنشاء الرسالة ──
    const newMessage = {
      senderId: user.userId,
      senderRole: user.role,
      type: type || (imageUrl ? 'image' : fileUrl ? 'file' : 'text'),
      content: content || '',
      imageUrl: imageUrl || undefined,
      fileUrl: fileUrl || undefined,
      fileName: fileName || undefined,
      fileSize: fileSize || undefined,
      readBy: [user.userId],
      createdAt: new Date(),
    };

    specialRequest.messages.push(newMessage);
    specialRequest.lastMessageAt = new Date();
    specialRequest.lastMessageContent = content || (imageUrl ? '[صورة]' : fileUrl ? '[ملف]' : '');
    specialRequest.lastMessageSender = user.role;

    // ── تحديث عدادات غير المقروء ──
    if (!specialRequest.unreadCount) {
      (specialRequest as any).unreadCount = new Map();
    }
    // زيادة عداد غير المقروء للمستفيد إذا لم يكن هو المرسل
    if (!isBeneficiary) {
      const beneficiaryIdStr = specialRequest.beneficiaryId.toString();
      const current = (specialRequest.unreadCount as Map<string, number>).get(beneficiaryIdStr) || 0;
      (specialRequest.unreadCount as Map<string, number>).set(beneficiaryIdStr, current + 1);
    }
    // زيادة عداد الممرض إذا كان معيناً ولم يكن هو المرسل
    if (specialRequest.nurseId && !isNurse) {
      const nurseIdStr = specialRequest.nurseId.toString();
      const current = (specialRequest.unreadCount as Map<string, number>).get(nurseIdStr) || 0;
      (specialRequest.unreadCount as Map<string, number>).set(nurseIdStr, current + 1);
    }
    // زيادة عداد المدراء إذا لم يكن المرسل منهم
    if (!isAdmin) {
      const admins = await User.find({ role: { $in: ['admin', 'subadmin'] }, isActive: { $ne: false } })
        .select('_id')
        .lean();
      for (const admin of admins) {
        const adminIdStr = admin._id.toString();
        const current = (specialRequest.unreadCount as Map<string, number>).get(adminIdStr) || 0;
        (specialRequest.unreadCount as Map<string, number>).set(adminIdStr, current + 1);
      }
    }

    // ── تحديث حالة الطلب إلى "جاري التفاوض" إذا كانت "جديد" ──
    if (specialRequest.status === 'new') {
      specialRequest.status = 'negotiating';
    }

    await specialRequest.save();

    const messageId = (specialRequest.messages[specialRequest.messages.length - 1] as any)._id?.toString() || `msg-${Date.now()}`;
    const messagePayload = {
      messageId,
      requestId: id,
      chatId: id, // for compatibility with chat UI
      senderId: user.userId,
      senderRole: user.role,
      content: content || '',
      type: newMessage.type,
      imageUrl: imageUrl || null,
      fileUrl: fileUrl || null,
      fileName: fileName || null,
      fileSize: fileSize || null,
      createdAt: newMessage.createdAt.toISOString(),
      requestStatus: specialRequest.status,
    };

    // ── إرسال إشعار للمستفيدين الآخرين ──
    const senderName = isAdmin ? 'الإدارة' : isBeneficiary ? specialRequest.beneficiaryName : 'الممرض/ـة';
    const notifTitle = `رسالة جديدة في طلب #${specialRequest.orderNumber}`;
    const notifBody = content
      ? `${senderName}: ${content.substring(0, 80)}${content.length > 80 ? '...' : ''}`
      : imageUrl ? `${senderName} أرسل صورة` : `${senderName} أرسل ملفاً`;

    // إشعار للمستفيد
    if (!isBeneficiary) {
      try {
        await Notification.create({
          userId: specialRequest.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: notifTitle,
          bodyAr: notifBody,
          type: 'chat',
          priority: 'medium',
          data: { requestId: id, messageId, voiceAlert: 'false' },
          actionUrl: `/beneficiary/special-requests/${id}`,
          read: false,
        });
        sendPushToUser(specialRequest.beneficiaryId.toString(), {
          title: notifTitle,
          body: notifBody,
          type: 'chat',
          priority: 'medium',
          url: `/beneficiary/special-requests/${id}`,
          userRole: 'beneficiary',
          data: { requestId: id, messageId },
        }).catch(() => {});
      } catch {}
    }

    // إشعار للممرض
    if (specialRequest.nurseId && !isNurse) {
      try {
        await Notification.create({
          userId: specialRequest.nurseId,
          userRole: 'nurse',
          titleAr: notifTitle,
          bodyAr: notifBody,
          type: 'chat',
          priority: 'medium',
          data: { requestId: id, messageId },
          actionUrl: `/nurse/special-requests/${id}`,
          read: false,
        });
        sendPushToUser(specialRequest.nurseId.toString(), {
          title: notifTitle,
          body: notifBody,
          type: 'chat',
          priority: 'medium',
          url: `/nurse/special-requests/${id}`,
          userRole: 'nurse',
          data: { requestId: id, messageId },
        }).catch(() => {});
      } catch {}
    }

    // إشعار لجميع المدراء
    if (!isAdmin) {
      try {
        const admins = await User.find({ role: { $in: ['admin', 'subadmin'] }, isActive: { $ne: false } })
          .select('_id role')
          .lean();
        for (const admin of admins) {
          await Notification.create({
            userId: admin._id,
            userRole: (admin as any).role || 'admin',
            titleAr: notifTitle,
            bodyAr: notifBody,
            type: 'chat',
            priority: 'medium',
            data: { requestId: id, messageId },
            actionUrl: `/admin/special-requests/${id}`,
            read: false,
          });
          sendPushToUser(admin._id.toString(), {
            title: notifTitle,
            body: notifBody,
            type: 'chat',
            priority: 'medium',
            url: `/admin/special-requests/${id}`,
            userRole: (admin as any).role || 'admin',
            data: { requestId: id, messageId },
          }).catch(() => {});
        }
      } catch {}
    }

    // ── إرسال أحداث Socket.IO فورية ──
    try {
      // إرسال للمستفيد
      if (!isBeneficiary) {
        emitToUser(specialRequest.beneficiaryId.toString(), 'special_request_message', messagePayload).catch(() => {});
      }
      // إرسال للممرض
      if (specialRequest.nurseId && !isNurse) {
        emitToUser(specialRequest.nurseId.toString(), 'special_request_message', messagePayload).catch(() => {});
      }
      // إرسال لجميع المدراء
      if (!isAdmin) {
        emitToAdmins('special_request_message', messagePayload).catch(() => {});
      } else {
        // إذا كان المرسل من الإدارة، أرسل للمستفيد والممرض فقط (تم أعلاه)
      }
      // إشعار data_change عام لتحديث القوائم
      emitToAdmins('data_change', {
        entity: 'special_request',
        entityId: id,
        action: 'updated',
        changedBy: user.userId,
        changedByRole: user.role,
        timestamp: new Date().toISOString(),
        data: { requestId: id, lastMessage: notifBody },
      }).catch(() => {});
    } catch {}

    return Response.json({
      success: true,
      data: messagePayload,
    }, { status: 201 });
  } catch (error) {
    console.error('[SPECIAL REQUEST MESSAGE SEND ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إرسال الرسالة', 500, 'INTERNAL_ERROR');
  }
}
