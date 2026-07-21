// GET/POST /api/beneficiary/emergency - List/Create emergency requests
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { EmergencyRequest, Notification, Nurse, AdminSettings } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { sendPushToUser } from '@/lib/notifications/push-service';
import { emitNotificationToUsers, emitToAdmins } from '@/lib/notifications/socket-client';
import { emitRealtimeEvent } from '@/lib/notifications/emit-realtime-event';
import { serializeDoc } from '@/lib/mongoose/serialize';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const emergencies = await EmergencyRequest.find({
      beneficiaryId: user.userId,
    })
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();

    // Populate nurse names
    const nurseIds = [...new Set(emergencies.map((e: any) => e.nurseId?.toString()).filter(Boolean))];
    const nurses = await Nurse.find({ _id: { $in: nurseIds } }).select('name').lean();
    const nurseMap = new Map(nurses.map((n: any) => [n._id.toString(), n]));

    const populatedEmergencies = emergencies.map((e: any) => ({
      ...serializeDoc(e),
      nurseName: e.nurseId ? (nurseMap.get(e.nurseId?.toString())?.name || null) : null,
    }));

    return Response.json({
      success: true,
      data: {
        emergencies: populatedEmergencies,
      },
    });
  } catch (error) {
    console.error('[BENEFICIARY EMERGENCY LIST ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب طلبات الطوارئ', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    // ── التحقق من أن الخدمات العامة مفعّلة ──
    // لا نكشف للمستخدم أن الخدمات معطّلة - نُرجع رسالة عامة
    const generalSettings = await AdminSettings.findOne().lean().select('generalServicesEnabled');
    if (generalSettings && generalSettings.generalServicesEnabled === false) {
      return createErrorResponse('تعذر معالجة طلب الطوارئ حالياً، يرجى المحاولة لاحقاً', 503, 'UNAVAILABLE');
    }

    const body = await request.json();
    const { type, description, lat, lng, address, paymentMethod, paymentMethodId, hasPaymentProof, paymentProofData } = body;

    if (!description) {
      return createErrorResponse('وصف الحالة الطارئة مطلوب', 400, 'VALIDATION_ERROR');
    }

    // Prevent duplicate emergency requests - check if beneficiary has an active emergency
    const activeEmergency = await EmergencyRequest.findOne({
      beneficiaryId: user.userId,
      status: { $in: ['pending', 'dispatched', 'in_progress'] },
    }).lean();

    if (activeEmergency) {
      return createErrorResponse('لديك بالفعل طلب طوارئ نشط. يرجى الانتظار حتى يتم التعامل معه', 409, 'DUPLICATE_EMERGENCY');
    }

    // Calculate emergency fee from admin settings
    let emergencyFee = 5000; // default fallback
    try {
      const settings = await AdminSettings.findOne().lean();
      if (settings && settings.emergencyFee !== undefined) {
        emergencyFee = settings.emergencyFee || 5000;
      }
    } catch {
      // Use default
    }

    const emergency = await EmergencyRequest.create({
      beneficiaryId: user.userId,
      type: type || 'medical',
      description,
      lat,
      lng,
      address,
      status: 'pending',
      priority: 'high',
      emergencyFee,
      paymentMethod: paymentMethod || 'cash',
      paymentMethodId: paymentMethodId || undefined,
      hasPaymentProof: hasPaymentProof || false,
      paymentProofData: paymentProofData || undefined,
      paymentStatus: paymentMethod === 'cash' ? 'pending' : 'pending',
    });

    // ═══ NOTIFY INSTANTLY: Admins first (voice alert), then nurses ═══
    // Run all notifications in parallel for maximum speed
    const notificationPromises: Promise<any>[] = [];

    // Get beneficiary name for all notifications (declared at function scope)
    const { User, Beneficiary: BeneficiaryModel } = await import('@/models/mongoose');
    const beneficiaryDoc = await BeneficiaryModel.findById(user.userId).select('name phone').lean();
    const beneficiaryName = beneficiaryDoc?.name || 'مستفيد';

    // 1. Notify admins IMMEDIATELY with voice alert (highest priority)
    try {
      const admins = await User.find({ role: { $in: ['admin', 'subadmin'] } }).select('_id role').lean();

      for (const admin of admins) {
        const adminRole = (admin as any).role || 'admin';
        // Create DB notification + push in parallel
        notificationPromises.push(
          Notification.create({
            userId: admin._id,
            userRole: adminRole,
            titleAr: '🚨 حالة طوارئ جديدة - تنبيه عاجل!',
            bodyAr: `طلب طوارئ عاجل من ${beneficiaryName}: ${description.substring(0, 80)}. نوع الطوارئ: ${type || 'طبية'}`,
            type: 'emergency',
            priority: 'urgent',
            data: { emergencyRequestId: emergency._id.toString(), beneficiaryId: user.userId, type: type || 'medical', voiceAlert: true, voiceText: `حالة طوارئ جديدة من ${beneficiaryName}` },
            actionUrl: '/admin/emergencies',
            voiceEnabled: true,
          }),
          sendPushToUser(admin._id.toString(), {
            title: '🚨 حالة طوارئ جديدة - تنبيه عاجل!',
            body: `طلب طوارئ عاجل من ${beneficiaryName}`,
            type: 'emergency',
            priority: 'urgent',
            sound: true,
            url: '/admin/emergencies',
            userRole: adminRole,
            data: { emergencyRequestId: emergency._id.toString(), voiceAlert: true, voiceText: `حالة طوارئ جديدة من ${beneficiaryName}` },
          })
        );
      }

      // 1b. Emit real-time Socket.IO events (instant delivery, non-blocking)
      const adminIds = admins.map((a: any) => a._id.toString());

      // Emit emergency_created to admins room (includes subadmins)
      emitToAdmins('emergency_created', {
        emergencyRequestId: emergency._id.toString(),
        type: type || 'medical',
        description,
        beneficiaryId: user.userId,
        beneficiaryName,
        location: lat && lng ? { lat, lng, updatedAt: new Date().toISOString() } : null,
        address: address || '',
        priority: 'urgent',
        createdAt: new Date().toISOString(),
      }).catch(() => {});

      // Emit notification event to each admin/subadmin individually
      emitNotificationToUsers(adminIds, {
        titleAr: '🚨 حالة طوارئ جديدة - تنبيه عاجل!',
        bodyAr: `طلب طوارئ عاجل من ${beneficiaryName}`,
        type: 'emergency',
        priority: 'urgent',
        data: { emergencyRequestId: emergency._id.toString(), voiceAlert: true, voiceText: `حالة طوارئ جديدة من ${beneficiaryName}` },
        actionUrl: '/admin/emergencies',
        voiceEnabled: true,
        voiceText: `حالة طوارئ جديدة من ${beneficiaryName}`,
      }).catch(() => {});
    } catch {
      // Non-critical
    }

    // 2. Notify nearby available nurses with geospatial search
    try {
      if (lat && lng) {
        const maxDistanceKm = 20;
        const latDelta = maxDistanceKm / 111;
        const lngDelta = maxDistanceKm / (111 * Math.cos(lat * Math.PI / 180));

        const nearbyNurses = await Nurse.find({
          verificationStatus: 'verified',
          isAvailable: true,
          lat: { $ne: null, $gte: lat - latDelta, $lte: lat + latDelta },
          lng: { $ne: null, $gte: lng - lngDelta, $lte: lng + lngDelta },
        })
          .select('_id name lat lng')
          .limit(15)
          .lean();

        // Calculate distance for each nurse and sort
        const nursesWithDistance = nearbyNurses.map(nurse => {
          const R = 6371;
          const dLat = ((nurse.lat || 0) - lat) * Math.PI / 180;
          const dLon = ((nurse.lng || 0) - lng) * Math.PI / 180;
          const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
                    Math.cos(lat * Math.PI / 180) * Math.cos((nurse.lat || 0) * Math.PI / 180) *
                    Math.sin(dLon/2) * Math.sin(dLon/2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
          const distance = R * c;
          return { ...nurse, distance: Math.round(distance * 10) / 10 };
        }).sort((a, b) => a.distance - b.distance);

        for (const nurse of nursesWithDistance) {
          // All nurse notifications in parallel too — with TTS voice alert
          notificationPromises.push(
            Notification.create({
              userId: nurse._id,
              userRole: 'nurse',
              titleAr: '🚨 حالة طوارئ!',
              bodyAr: `حالة طوارئ جديدة على بُعد ${nurse.distance} كم منك: ${description.substring(0, 100)}`,
              type: 'emergency',
              priority: 'urgent',
              data: { emergencyRequestId: emergency._id.toString(), type: type || 'medical', distance: nurse.distance, voiceAlert: true, voiceText: `حالة طوارئ جديدة على بُعد ${nurse.distance} كيلومتر منك. ${type === 'medical' ? 'طبية عامة' : type === 'injury' ? 'إصابة' : type === 'breathing' ? 'صعوبة تنفس' : type === 'cardiac' ? 'أزمة قلبية' : 'حالة طوارئ'}` },
              voiceEnabled: true,
            }),
            sendPushToUser(nurse._id.toString(), {
              title: '🚨 حالة طوارئ!',
              body: `حالة طوارئ جديدة على بُعد ${nurse.distance} كم منك`,
              type: 'emergency',
              priority: 'urgent',
              sound: true,
              url: '/nurse',
              userRole: 'nurse',
              data: { emergencyRequestId: emergency._id.toString(), distance: nurse.distance, voiceAlert: true, voiceText: `حالة طوارئ جديدة على بُعد ${nurse.distance} كيلومتر منك. ${type === 'medical' ? 'طبية عامة' : type === 'injury' ? 'إصابة' : type === 'breathing' ? 'صعوبة تنفس' : type === 'cardiac' ? 'أزمة قلبية' : 'حالة طوارئ'}` },
            })
          );
        }
      }
    } catch {
      // Non-critical notification
    }

    // Fire ALL notifications in parallel for maximum speed
    await Promise.allSettled(notificationPromises);

    // ═══ EMIT REAL-TIME EVENT (supplement existing raw socket calls) ═══
    try {
      emitRealtimeEvent.emergencyCreated(
        {
          emergencyRequestId: emergency._id.toString(),
          beneficiaryId: user.userId,
          type: type || 'medical',
          status: 'pending',
        },
        { changedBy: user.userId, changedByRole: 'beneficiary' }
      );
    } catch {
      // Non-critical — socket server may be down
    }

    return Response.json({
      success: true,
      data: { ...serializeDoc(emergency.toObject()), emergencyFee },
      message: 'تم إرسال طلب الطوارئ بنجاح. سيتم إرسال مساعدة فوراً',
    }, { status: 201 });
  } catch (error) {
    console.error('[BENEFICIARY EMERGENCY ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إرسال طلب الطوارئ', 500, 'INTERNAL_ERROR');
  }
}
