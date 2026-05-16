// GET /api/payments/methods - List payment methods (public for beneficiary)
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import PaymentMethod from '@/models/PaymentMethod';
import { createErrorResponse } from '@/lib/auth/middleware';

import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';
export async function GET(request: NextRequest) {
  try {
    await connectDB();

    // Try to get from database first
    const dbMethods = await PaymentMethod.find({ isActive: true }).sort({ type: 1, nameAr: 1 }).lean();

    if (dbMethods.length > 0) {
      return Response.json({
        success: true,
        data: dbMethods.map((m: any) => ({
          ...m,
          id: m._id.toString(),
          _id: undefined,
          __v: undefined,
        })),
      });
    }

    // Fallback: return default static methods if DB is empty
    const defaultMethods = [
      {
        id: 'default_cash',
        nameAr: 'نقدي عند وصول الممرض',
        nameEn: 'Cash on Nurse Arrival',
        type: 'cash',
        walletType: null,
        exchangeType: null,
        icon: 'banknote',
        isActive: true,
        instructions: 'ادفع للممرض مباشرة عند الوصول',
        accountName: '',
        accountNumber: '',
        sortOrder: 1,
      },
    ];

    return Response.json({
      success: true,
      data: defaultMethods,
    });
  } catch (error) {
    console.error('[PAYMENT METHODS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب طرق الدفع', 500, 'INTERNAL_ERROR');
  }
}
