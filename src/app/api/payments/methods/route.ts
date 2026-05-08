// GET /api/payments/methods - List payment methods
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { createErrorResponse } from '@/lib/auth/middleware';

// Yemeni payment methods - comprehensive list of all e-wallets in Yemen
const PAYMENT_METHODS = [
  {
    id: 'cash',
    nameAr: 'نقدي (عند الاستلام)',
    nameEn: 'Cash (On Delivery)',
    type: 'cash',
    icon: 'banknote',
    isActive: true,
    instructionsAr: 'ادفع للممرض مباشرة عند الوصول',
    instructionsEn: 'Pay the nurse directly upon arrival',
    sortOrder: 1,
  },
  // ===== المحافظ الإلكترونية اليمنية =====
  {
    id: 'flous',
    nameAr: 'فلوس',
    nameEn: 'Flous',
    type: 'mobile_wallet',
    icon: 'smartphone',
    isActive: true,
    instructionsAr: 'قم بتحويل المبلغ إلى حساب الممرض عبر تطبيق فلوس',
    instructionsEn: 'Transfer the amount to the nurse account via Flous app',
    sortOrder: 2,
  },
  {
    id: 'zain_cash',
    nameAr: 'زين كاش',
    nameEn: 'Zain Cash',
    type: 'mobile_wallet',
    icon: 'smartphone',
    isActive: true,
    instructionsAr: 'قم بتحويل المبلغ إلى حساب الممرض عبر زين كاش',
    instructionsEn: 'Transfer the amount to the nurse account via Zain Cash',
    sortOrder: 3,
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
    sortOrder: 4,
  },
  {
    id: 'jawali',
    nameAr: 'جوال (يمن موبايل)',
    nameEn: 'Jawali (Yemen Mobile)',
    type: 'mobile_wallet',
    icon: 'smartphone',
    isActive: true,
    instructionsAr: 'قم بتحويل المبلغ إلى حساب الممرض عبر جوال',
    instructionsEn: 'Transfer the amount to the nurse account via Jawali',
    sortOrder: 5,
  },
  {
    id: 'halelflos',
    nameAr: 'حالف فلوس',
    nameEn: 'Halelflos',
    type: 'mobile_wallet',
    icon: 'smartphone',
    isActive: true,
    instructionsAr: 'قم بتحويل المبلغ إلى حساب الممرض عبر حالف فلوس',
    instructionsEn: 'Transfer the amount to the nurse account via Halelflos',
    sortOrder: 6,
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
    sortOrder: 7,
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
    sortOrder: 8,
  },
  {
    id: 'mtn_momo',
    nameAr: 'إم تي إن موبايل موني',
    nameEn: 'MTN Mobile Money',
    type: 'mobile_wallet',
    icon: 'smartphone',
    isActive: true,
    instructionsAr: 'قم بتحويل المبلغ إلى حساب الممرض عبر إم تي إن موبايل موني',
    instructionsEn: 'Transfer the amount to the nurse account via MTN Mobile Money',
    sortOrder: 9,
  },
  {
    id: 'snb_wallet',
    nameAr: 'محفظة سبأون',
    nameEn: 'SNB Wallet',
    type: 'mobile_wallet',
    icon: 'smartphone',
    isActive: true,
    instructionsAr: 'قم بتحويل المبلغ إلى حساب الممرض عبر محفظة سبأون',
    instructionsEn: 'Transfer the amount to the nurse account via SNB Wallet',
    sortOrder: 10,
  },
  // ===== طرق الدفع الأخرى =====
  {
    id: 'exchange_transfer',
    nameAr: 'تحويل عبر الصرافة',
    nameEn: 'Exchange Transfer',
    type: 'exchange_transfer',
    icon: 'arrow-right-left',
    isActive: true,
    instructionsAr: 'قم بتحويل المبلغ عبر الصرافة إلى حساب الممرض',
    instructionsEn: 'Transfer the amount via exchange office to the nurse account',
    sortOrder: 11,
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
    sortOrder: 12,
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
