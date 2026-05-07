// GET /api/payments/methods - List payment methods
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

// Yemeni payment methods - static data
const PAYMENT_METHODS = [
  {
    id: 'cash',
    nameAr: 'نقدي',
    nameEn: 'Cash',
    type: 'cash',
    icon: 'banknote',
    isActive: true,
    instructionsAr: 'ادفع للممرض مباشرة عند الوصول',
    instructionsEn: 'Pay the nurse directly upon arrival',
    sortOrder: 1,
  },
  {
    id: 'one_cash',
    nameAr: 'ون كاش',
    nameEn: 'One Cash',
    type: 'mobile_wallet',
    icon: 'smartphone',
    isActive: true,
    instructionsAr: 'قم بتحويل المبلغ إلى حساب الممرض عبر ون كاش',
    instructionsEn: 'Transfer the amount to the nurse account via One Cash',
    sortOrder: 2,
  },
  {
    id: 'jawali',
    nameAr: 'جوال',
    nameEn: 'Jawali',
    type: 'mobile_wallet',
    icon: 'smartphone',
    isActive: true,
    instructionsAr: 'قم بتحويل المبلغ إلى حساب الممرض عبر جوال',
    instructionsEn: 'Transfer the amount to the nurse account via Jawali',
    sortOrder: 3,
  },
  {
    id: 'yemen_wallet',
    nameAr: 'محفظة اليمن',
    nameEn: 'Yemen Wallet',
    type: 'mobile_wallet',
    icon: 'smartphone',
    isActive: true,
    instructionsAr: 'قم بتحويل المبلغ إلى حساب الممرض عبر محفظة اليمن',
    instructionsEn: 'Transfer the amount to the nurse account via Yemen Wallet',
    sortOrder: 4,
  },
  {
    id: 'saba_cash',
    nameAr: 'سبا كاش',
    nameEn: 'Saba Cash',
    type: 'mobile_wallet',
    icon: 'smartphone',
    isActive: true,
    instructionsAr: 'قم بتحويل المبلغ إلى حساب الممرض عبر سبا كاش',
    instructionsEn: 'Transfer the amount to the nurse account via Saba Cash',
    sortOrder: 5,
  },
  {
    id: 'bank_transfer',
    nameAr: 'تحويل بنكي',
    nameEn: 'Bank Transfer',
    type: 'bank_transfer',
    icon: 'building',
    isActive: false,
    instructionsAr: 'قم بتحويل المبلغ إلى الحساب البنكي',
    instructionsEn: 'Transfer the amount to the bank account',
    sortOrder: 6,
  },
  {
    id: 'exchange_transfer',
    nameAr: 'تحويل عبر الصرافة',
    nameEn: 'Exchange Transfer',
    type: 'exchange_transfer',
    icon: 'arrow-right-left',
    isActive: true,
    instructionsAr: 'قم بتحويل المبلغ عبر الصرافة',
    instructionsEn: 'Transfer the amount via exchange office',
    sortOrder: 7,
  },
];

export async function GET(request: NextRequest) {
  try {
    // No auth required for listing payment methods
    const activeOnly = new URL(request.url).searchParams.get('active') !== 'false';

    const methods = activeOnly
      ? PAYMENT_METHODS.filter(m => m.isActive)
      : PAYMENT_METHODS;

    return Response.json({
      success: true,
      data: methods,
    });
  } catch (error) {
    console.error('[PAYMENT METHODS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب طرق الدفع', 500, 'INTERNAL_ERROR');
  }
}
