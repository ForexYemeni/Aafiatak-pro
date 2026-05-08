// POST /api/whatsapp/send - Queue a WhatsApp message for sending
import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import WhatsAppQueue from '@/models/WhatsAppQueue';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { to, template, params } = await request.json();

    if (!to || !template) {
      return createErrorResponse('رقم المستلم واسم القالب مطلوبان', 400, 'VALIDATION_ERROR');
    }

    // Validate phone number format (Yemeni)
    const cleanPhone = to.replace(/[^0-9]/g, '');
    if (cleanPhone.length < 9) {
      return createErrorResponse('رقم الهاتف غير صالح', 400, 'INVALID_PHONE');
    }

    const message = await WhatsAppQueue.create({
      to: cleanPhone,
      template,
      params: params || [],
      status: 'pending',
      retries: 0,
      maxRetries: 3,
    });

    return Response.json({
      success: true,
      data: { id: message._id.toString(), status: 'pending' },
      message: 'تم إضافة الرسالة إلى قائمة الانتظار',
    }, { status: 201 });
  } catch (error) {
    console.error('[WHATSAPP SEND ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إرسال الرسالة', 500, 'INTERNAL_ERROR');
  }
}
