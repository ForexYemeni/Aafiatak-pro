// POST /api/nurse/assignments/[id] - Accept/reject assignment
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, Nurse, Notification } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const { id } = await params;
    const { action, rejectedReason } = await request.json();

    if (!['accept', 'reject'].includes(action)) {
      return createErrorResponse('الإجراء مطلوب (accept/reject)', 400, 'VALIDATION_ERROR');
    }

    const order = await ServiceRequest.findById(id);
    if (!order) return createErrorResponse('الطلب غير موجود', 404, 'NOT_FOUND');

    if (order.nurseId?.toString() !== user.userId) {
      return createErrorResponse('هذا الطلب غير معين لك', 403, 'FORBIDDEN');
    }

    if (order.status !== 'assigned') {
      return createErrorResponse('لا يمكن التعامل مع هذا الطلب في حالته الحالية', 400, 'INVALID_STATUS');
    }

    if (action === 'accept') {
      order.status = 'accepted';
      await order.save();

      // Notify beneficiary
      try {
        await Notification.create({
          userId: order.beneficiaryId,
          userRole: 'beneficiary',
          titleAr: 'تم قبول طلبك',
          bodyAr: 'تم قبول طلبك وسيقوم الممرض بالوصول قريباً',
          type: 'status_change',
          priority: 'medium',
          data: { requestId: id, status: 'accepted' },
          voiceEnabled: true,
        });
      } catch {
        // Non-critical
      }

      return Response.json({
        success: true,
        data: { ...order.toObject(), id: order._id.toString() },
        message: 'تم قبول الطلب بنجاح',
      });
    } else {
      order.status = 'pending';
      order.nurseId = undefined;
      await order.save();

      return Response.json({
        success: true,
        data: { ...order.toObject(), id: order._id.toString() },
        message: 'تم رفض الطلب',
      });
    }
  } catch (error) {
    console.error('[NURSE ASSIGNMENT ACTION ERROR]', error);
    return createErrorResponse('حدث خطأ', 500, 'INTERNAL_ERROR');
  }
}
