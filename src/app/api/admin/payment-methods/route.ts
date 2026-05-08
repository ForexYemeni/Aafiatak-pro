// GET/POST /api/admin/payment-methods - List/Create payment methods
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import PaymentMethod from '@/models/PaymentMethod';
import { requireSubadminPermission, requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_payments');
    if (error) return error;

    const methods = await PaymentMethod.find({}).sort({ type: 1, nameAr: 1 }).lean();

    return Response.json({
      success: true,
      data: {
        paymentMethods: methods.map((m: any) => ({ ...m, id: m._id.toString() })),
      },
    });
  } catch (error) {
    console.error('[ADMIN PAYMENT METHODS LIST ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب طرق الدفع', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const body = await request.json();

    if (!body.nameAr) {
      return createErrorResponse('اسم طريقة الدفع بالعربية مطلوب', 400, 'VALIDATION_ERROR');
    }

    const pmData: any = {
      nameAr: body.nameAr,
      nameEn: body.nameEn || body.nameAr,
      type: body.type || 'wallet',
      walletType: body.type === 'wallet' ? (body.walletType || null) : null,
      icon: body.icon || '',
      isActive: body.isActive !== false,
      instructions: body.instructions || '',
    };

    const pm = await PaymentMethod.create(pmData);

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'create_payment_method',
      entity: 'PaymentMethod',
      entityId: pm._id.toString(),
      details: `إنشاء طريقة دفع: ${pm.nameAr}`,
      request,
    });

    return Response.json({
      success: true,
      data: { ...pm.toObject(), id: pm._id.toString() },
      message: 'تم إنشاء طريقة الدفع بنجاح',
    }, { status: 201 });
  } catch (error) {
    console.error('[ADMIN PAYMENT METHODS CREATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إنشاء طريقة الدفع', 500, 'INTERNAL_ERROR');
  }
}
