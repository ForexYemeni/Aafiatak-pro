// GET/POST /api/admin/payment-methods - List/Create payment methods
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import PaymentMethod from '@/models/PaymentMethod';
import { requireSubadminPermission, requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';
import { emitToAdmins } from '@/lib/notifications/socket-client';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
const walletNames: Record<string, { ar: string; en: string }> = {
  jeep: { ar: 'جيب', en: 'Jeeb' },
  jawali: { ar: 'جوالي', en: 'Jawali' },
  cash_wallet: { ar: 'كاش', en: 'Cash' },
  one_cash: { ar: 'ون كاش', en: 'One Cash' },
  flousk: { ar: 'فلوسك', en: 'Fulousk' },
  saba_cash: { ar: 'سبأ كاش', en: 'Saba Cash' },
};

const exchangeNames: Record<string, { ar: string; en: string }> = {
  al_najm: { ar: 'صرافة النجم', en: 'Al-Najm Exchange' },
  yemen_express: { ar: 'صرافة يمن اكسبرس', en: 'Yemen Express' },
  al_imtiaz: { ar: 'صرافة الامتياز', en: 'Al-Imtiaz Exchange' },
  al_hazmi: { ar: 'صرافة الحزمي', en: 'Al-Hazmi Exchange' },
};

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_payments');
    if (error) return error;

    const methods = await PaymentMethod.find({}).sort({ type: 1, nameAr: 1 }).lean();

    return Response.json({
      success: true,
      data: {
        paymentMethods: methods.map((m: any) => (serializeDoc(m))),
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

    if (!body.type) {
      return createErrorResponse('نوع طريقة الدفع مطلوب', 400, 'VALIDATION_ERROR');
    }

    const pmData: any = {
      nameAr: body.nameAr || '',
      nameEn: body.nameEn || '',
      type: body.type,
      walletType: body.type === 'wallet_deposit' ? (body.walletType || null) : null,
      exchangeType: body.type === 'bank_transfer' ? (body.exchangeType || null) : null,
      customProviderName: body.customProviderName || '',
      icon: body.icon || '',
      isActive: body.isActive !== false,
      instructions: body.instructions || '',
      accountName: body.accountName || '',
      accountNumber: body.accountNumber || '',
    };

    // Auto-generate name from wallet/exchange type if not provided
    if (!pmData.nameAr) {
      if (body.type === 'wallet_deposit' && body.walletType) {
        if (body.walletType === 'other') {
          pmData.nameAr = body.customProviderName || 'محفظة أخرى';
          pmData.nameEn = body.customProviderName || 'Other Wallet';
        } else {
          const wn = walletNames[body.walletType];
          if (wn) {
            pmData.nameAr = wn.ar;
            pmData.nameEn = wn.en;
          }
        }
      } else if (body.type === 'bank_transfer' && body.exchangeType) {
        if (body.exchangeType === 'other') {
          pmData.nameAr = 'صرافة ' + (body.customProviderName || 'أخرى');
          pmData.nameEn = (body.customProviderName || 'Other') + ' Exchange';
        } else {
          const en = exchangeNames[body.exchangeType];
          if (en) {
            pmData.nameAr = en.ar;
            pmData.nameEn = en.en;
          }
        }
      } else if (body.type === 'cash') {
        pmData.nameAr = 'نقدي عند وصول الممرض';
        pmData.nameEn = 'Cash on Nurse Arrival';
      }
    }

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

    emitToAdmins('data_change', { entity: 'payment_method', entityId: pm._id.toString(), action: 'created', timestamp: new Date().toISOString() }).catch(() => {});

    return Response.json({
      success: true,
      data: serializeDoc(pm.toObject()),
      message: 'تم إنشاء طريقة الدفع بنجاح',
    }, { status: 201 });
  } catch (error) {
    console.error('[ADMIN PAYMENT METHODS CREATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إنشاء طريقة الدفع', 500, 'INTERNAL_ERROR');
  }
}
