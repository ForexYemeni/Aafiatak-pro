// GET/PATCH/DELETE /api/admin/nurses/[id] - Get/update/delete nurse by ID
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse, Notification } from '@/models/mongoose';
import { requireSubadminPermission, requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';
import { sendPushToUser } from '@/lib/notifications/push-service';
import { emitRealtimeEvent } from '@/lib/notifications/emit-realtime-event';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_nurses');
    if (error) return error;

    const { id } = await params;
    // Exclude heavy document data - load separately via /documents endpoint
    const nurse = await Nurse.findById(id).select('-password -identityDocumentData -licenseDocumentData').lean();
    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    return Response.json({ success: true, data: serializeDoc(nurse) });
  } catch (error) {
    console.error('[ADMIN NURSE DETAIL ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_nurses');
    if (error) return error;

    const { id } = await params;
    const body = await request.json();

    // Prevent updating sensitive fields directly
    delete body.password;
    delete body._id;
    delete body.identityDocumentData;
    delete body.licenseDocumentData;

    // Handle block/unblock
    if (body.isBlocked !== undefined) {
      const isBlocked = Boolean(body.isBlocked);
      const blockedReason = body.blockedReason || '';
      const update: any = {
        isBlocked,
        blockedReason: isBlocked ? blockedReason : '',
        isActive: isBlocked ? false : undefined, // Auto-deactivate when blocked
      };
      // Don't set isActive to undefined if not blocked
      if (!isBlocked) delete update.isActive;

      const nurse = await Nurse.findByIdAndUpdate(id, update, { new: true })
        .select('-password -identityDocumentData -licenseDocumentData')
        .lean();
      if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

      // Notify nurse about block/unblock
      try {
        await Notification.create({
          userId: id,
          userRole: 'nurse',
          titleAr: isBlocked ? 'تم حظر حسابك' : 'تم إلغاء حظر حسابك',
          bodyAr: isBlocked
            ? `تم حظر حسابك${blockedReason ? `: ${blockedReason}` : ''}. لن تتمكن من استخدام المنصة حتى يتم إلغاء الحظر`
            : 'تم إلغاء حظر حسابك. يمكنك الآن استخدام المنصة بشكل طبيعي',
          type: 'system',
          priority: 'high',
          data: { isBlocked: String(isBlocked) },
          voiceEnabled: true,
        });

        // Send push notification to nurse about block/unblock
        sendPushToUser(id, {
          title: isBlocked ? 'تم حظر حسابك' : 'تم إلغاء حظر حسابك',
          body: isBlocked
            ? `تم حظر حسابك${blockedReason ? `: ${blockedReason}` : ''}`
            : 'تم إلغاء حظر حسابك. يمكنك الآن استخدام المنصة',
          type: 'system',
          priority: 'high',
          url: '/nurse/profile',
          userRole: 'nurse',
          data: { isBlocked: String(isBlocked) },
        }).catch(() => {});
      } catch {
        // Don't block main operation for notification failure
      }

      await logActivity({
        userId: user!.userId,
        userRole: user!.role,
        action: isBlocked ? 'block_nurse' : 'unblock_nurse',
        entity: 'Nurse',
        entityId: id,
        details: isBlocked ? `حظر الممرض: ${nurse.name}` : `إلغاء حظر الممرض: ${nurse.name}`,
        request,
      });

      // ═══ EMIT REAL-TIME EVENT ═══
      try {
        emitRealtimeEvent.userChanged(
          { userId: id, role: 'nurse', action: isBlocked ? 'blocked' : 'unblocked' },
          { changedBy: user!.userId, changedByRole: user!.role }
        );
      } catch {
        // Non-critical — socket server may be down
      }

      return Response.json({
        success: true,
        data: serializeDoc(nurse),
        message: isBlocked ? 'تم حظر الممرض بنجاح' : 'تم إلغاء حظر الممرض بنجاح',
      });
    }

    const nurse = await Nurse.findByIdAndUpdate(id, body, { new: true })
      .select('-password -identityDocumentData -licenseDocumentData')
      .lean();
    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'update_nurse',
      entity: 'Nurse',
      entityId: id,
      details: `تحديث بيانات الممرض: ${nurse.name}`,
      request,
    });

    // ═══ EMIT REAL-TIME EVENT ═══
    try {
      emitRealtimeEvent.userChanged(
        { userId: id, role: 'nurse', action: 'updated' },
        { changedBy: user!.userId, changedByRole: user!.role }
      );
    } catch {
      // Non-critical — socket server may be down
    }

    return Response.json({ success: true, data: serializeDoc(nurse), message: 'تم تحديث بيانات الممرض بنجاح' });
  } catch (error) {
    console.error('[ADMIN NURSE UPDATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء التحديث', 500, 'INTERNAL_ERROR');
  }
}

export async function DELETE(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const { id } = await params;

    const nurse = await Nurse.findByIdAndDelete(id).lean();
    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    // Delete related notifications
    try {
      await Notification.deleteMany({ userId: id });
    } catch {
      // Non-critical
    }

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'delete_nurse',
      entity: 'Nurse',
      entityId: id,
      details: `حذف الممرض نهائياً: ${nurse.name}`,
      request,
    });

    // ═══ EMIT REAL-TIME EVENT ═══
    try {
      emitRealtimeEvent.userChanged(
        { userId: id, role: 'nurse', action: 'deleted' },
        { changedBy: user!.userId, changedByRole: user!.role }
      );
    } catch {
      // Non-critical — socket server may be down
    }

    return Response.json({
      success: true,
      message: 'تم حذف الممرض نهائياً',
    });
  } catch (error) {
    console.error('[ADMIN NURSE DELETE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء حذف الممرض', 500, 'INTERNAL_ERROR');
  }
}
