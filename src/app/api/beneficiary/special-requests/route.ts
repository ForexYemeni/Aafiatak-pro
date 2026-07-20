// GET/POST /api/beneficiary/special-requests
// إنشاء وعرض طلبات الخدمات الخاصة للمستفيد

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { SpecialServiceRequest, AdminSettings, Beneficiary, Notification, User } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';
import { sendPushToUser } from '@/lib/notifications/push-service';
import { emitToAdmins, emitToUser } from '@/lib/notifications/socket-client';
import { serializeDoc } from '@/lib/mongoose/serialize';

export const dynamic = 'force-dynamic';

// ── GET: قائمة طلبات المستفيد الخاصة ──
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');

    const filter: any = { beneficiaryId: user.userId };
    if (status) {
      const statuses = status.split(',').map(s => s.trim()).filter(Boolean);
      filter.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
    }

    const requests = await SpecialServiceRequest.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    return Response.json({
      success: true,
      data: serializeDoc(requests),
    });
  } catch (error) {
    console.error('[BENEFICIARY SPECIAL REQUESTS LIST ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب الطلبات', 500, 'INTERNAL_ERROR');
  }
}

// ── POST: إنشاء طلب خدمة خاصة جديد ──
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    // ── التحقق من أن الخدمات مفعّلة ──
    const settings = await AdminSettings.findOne().lean().select('specialServicesEnabled');
    if (settings && settings.specialServicesEnabled === false) {
      return createErrorResponse('الخدمات غير متاحة حالياً', 403, 'SERVICES_DISABLED');
    }

    const body = await request.json();
    const {
      serviceName,
      requestedServices,
      notes,
      address,
      lat,
      lng,
      scheduledDate,
      scheduledTime,
    } = body;

    // ── التحقق من الحقول المطلوبة ──
    if (!serviceName || typeof serviceName !== 'string' || serviceName.trim().length < 2) {
      return createErrorResponse('اسم الخدمة الرئيسية مطلوب', 400, 'VALIDATION_ERROR');
    }
    if (!requestedServices || !Array.isArray(requestedServices) || requestedServices.length === 0) {
      return createErrorResponse('يجب تحديد خدمة واحدة على الأقل', 400, 'VALIDATION_ERROR');
    }
    const cleanServices = requestedServices.map((s: string) => String(s).trim()).filter(Boolean);
    if (cleanServices.length === 0) {
      return createErrorResponse('يجب تحديد خدمة واحدة على الأقل', 400, 'VALIDATION_ERROR');
    }
    if (!address || typeof address !== 'string' || address.trim().length === 0) {
      return createErrorResponse('الموقع مطلوب', 400, 'VALIDATION_ERROR');
    }
    if (typeof lat !== 'number' || typeof lng !== 'number' || lat === 0 || lng === 0) {
      return createErrorResponse('الإحداثيات الجغرافية غير صحيحة', 400, 'VALIDATION_ERROR');
    }

    // ── جلب بيانات المستفيد ──
    const beneficiary = await Beneficiary.findById(user.userId).select('name phone').lean();
    if (!beneficiary) {
      return createErrorResponse('بيانات المستفيد غير موجودة', 404, 'NOT_FOUND');
    }

    // ── إنشاء الطلب ──
    const newRequest = await SpecialServiceRequest.create({
      beneficiaryId: user.userId,
      beneficiaryName: beneficiary.name,
      beneficiaryPhone: beneficiary.phone || '',
      serviceName: serviceName.trim(),
      requestedServices: cleanServices,
      notes: notes?.trim() || undefined,
      address: address.trim(),
      lat,
      lng,
      scheduledDate: scheduledDate ? new Date(scheduledDate) : undefined,
      scheduledTime: scheduledTime || undefined,
      status: 'new',
      offers: [],
      messages: [{
        senderId: user.userId,
        senderRole: 'beneficiary',
        type: 'system',
        content: `تم إنشاء طلب جديد لخدمة: ${serviceName.trim()}`,
        readBy: [user.userId],
      }],
      lastMessageAt: new Date(),
      lastMessageContent: `تم إنشاء طلب جديد لخدمة: ${serviceName.trim()}`,
      lastMessageSender: 'system',
      unreadCount: new Map(),
    });

    // ── تعيين unreadCount للمدراء = 1 ──
    newRequest.unreadCount = new Map();
    // سنحدّث العد لكل مدير عند الإرسال عبر socket
    await newRequest.save();

    const requestId = newRequest._id.toString();
    const orderNumber = newRequest.orderNumber;

    // ── تسجيل النشاط ──
    await logActivity({
      userId: user.userId,
      userRole: user.role,
      action: 'create_special_service_request',
      entity: 'SpecialServiceRequest',
      entityId: requestId,
      details: `إنشاء طلب خدمة خاصة: ${serviceName}`,
      request,
    });

    // ── إرسال إشعار للمدراء ──
    try {
      const admins = await User.find({ role: { $in: ['admin', 'subadmin'] }, isActive: { $ne: false } })
        .select('_id role')
        .lean();

      const notifTitle = 'طلب خدمة خاصة جديد';
      const notifBody = `طلب جديد #${orderNumber} من ${beneficiary.name} - ${serviceName.trim()}`;

      for (const admin of admins) {
        const adminRole = (admin as any).role || 'admin';
        await Notification.create({
          userId: admin._id,
          userRole: adminRole,
          titleAr: notifTitle,
          bodyAr: notifBody,
          type: 'assignment',
          priority: 'high',
          data: {
            requestId,
            orderNumber,
            voiceAlert: 'true',
            voiceText: `طلب خدمة خاصة جديد من ${beneficiary.name}`,
          },
          actionUrl: `/admin/special-requests/${requestId}`,
          voiceEnabled: true,
          read: false,
        });

        sendPushToUser(admin._id.toString(), {
          title: notifTitle,
          body: notifBody,
          type: 'special_service_request',
          priority: 'high',
          url: `/admin/special-requests/${requestId}`,
          userRole: adminRole,
          data: { requestId, orderNumber, voiceAlert: true, voiceText: `طلب خدمة خاصة جديد من ${beneficiary.name}` },
        }).catch(() => {});
      }
    } catch {
      // Non-critical
    }

    // ── إشعار تأكيد للمستفيد ──
    try {
      await Notification.create({
        userId: user.userId,
        userRole: 'beneficiary',
        titleAr: 'تم استلام طلبك',
        bodyAr: `تم إنشاء طلب الخدمة الخاصة بنجاح - رقم الطلب #${orderNumber}. سيتم التواصل معك عبر المحادثة.`,
        type: 'system',
        priority: 'medium',
        data: { requestId, orderNumber },
        actionUrl: `/beneficiary/special-requests/${requestId}`,
        read: false,
      });

      sendPushToUser(user.userId, {
        title: 'تم استلام طلبك',
        body: `تم إنشاء طلب الخدمة الخاصة بنجاح - رقم الطلب #${orderNumber}`,
        type: 'system',
        priority: 'medium',
        url: `/beneficiary/special-requests/${requestId}`,
        userRole: 'beneficiary',
        data: { requestId, orderNumber },
      }).catch(() => {});
    } catch {
      // Non-critical
    }

    // ── إرسال أحداث Socket.IO فورية ──
    try {
      const eventPayload = {
        requestId,
        orderNumber,
        beneficiaryId: user.userId,
        beneficiaryName: beneficiary.name,
        serviceName: serviceName.trim(),
        status: 'new',
        createdAt: new Date().toISOString(),
      };

      // إشعار جميع المدراء بطلب جديد
      emitToAdmins('special_request_created', eventPayload).catch(() => {});

      // إشعار data_change عام
      emitToAdmins('data_change', {
        entity: 'special_request',
        entityId: requestId,
        action: 'created',
        changedBy: user.userId,
        changedByRole: user.role,
        timestamp: new Date().toISOString(),
        data: eventPayload,
      }).catch(() => {});

      // إشعار المستفيد نفسه بتحديث الواجهة
      emitToUser(user.userId, 'data_change', {
        entity: 'special_request',
        entityId: requestId,
        action: 'created',
        timestamp: new Date().toISOString(),
        data: eventPayload,
      }).catch(() => {});
    } catch {
      // Non-critical
    }

    return Response.json({
      success: true,
      data: serializeDoc(newRequest.toObject()),
      message: 'تم إنشاء طلب الخدمة الخاصة بنجاح',
    }, { status: 201 });
  } catch (error) {
    console.error('[BENEFICIARY SPECIAL REQUEST CREATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إنشاء الطلب', 500, 'INTERNAL_ERROR');
  }
}
