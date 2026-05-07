// GET /api/payments/methods - List payment methods

import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import {
  requireAuth, successResponse, handleApiError,
} from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    await requireAuth(request);

    let paymentMethods = await db.paymentMethod.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // If no payment methods exist, seed defaults
    if (paymentMethods.length === 0) {
      await db.paymentMethod.createMany({
        data: [
          { nameAr: 'نقدي', nameEn: 'Cash', type: 'cash', icon: 'banknote', instructionsAr: 'ادفع عند وصول الممرض', instructionsEn: 'Pay when nurse arrives', sortOrder: 1 },
          { nameAr: 'تحويل بنكي', nameEn: 'Bank Transfer', type: 'bank_transfer', icon: 'building-columns', instructionsAr: 'حول المبلغ للحساب البنكي المحدد', instructionsEn: 'Transfer to the specified bank account', sortOrder: 2 },
          { nameAr: 'إيداع محفظة', nameEn: 'Wallet Deposit', type: 'wallet_deposit', icon: 'wallet', instructionsAr: 'أودع المبلغ في المحفظة المحددة', instructionsEn: 'Deposit to the specified wallet', sortOrder: 3 },
          { nameAr: 'تحويل صراف', nameEn: 'Exchange Transfer', type: 'exchange_transfer', icon: 'money-bill-transfer', instructionsAr: 'حول المبلغ عبر الصراف المحدد', instructionsEn: 'Transfer via the specified exchange office', sortOrder: 4 },
          { nameAr: 'محفظة موبايل', nameEn: 'Mobile Wallet', type: 'mobile_wallet', icon: 'mobile-screen', instructionsAr: 'ادفع عبر محفظة الموبايل', instructionsEn: 'Pay via mobile wallet', sortOrder: 5 },
        ],
      });

      paymentMethods = await db.paymentMethod.findMany({
        where: { isActive: true },
        orderBy: { sortOrder: 'asc' },
      });
    }

    return successResponse(paymentMethods);
  } catch (error) {
    return handleApiError(error);
  }
}
