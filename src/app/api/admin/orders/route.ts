// GET /api/admin/orders - List all orders with filters and populated names
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { ServiceRequest, Beneficiary, Nurse, Service } from '@/models/mongoose';
import PaymentMethod from '@/models/PaymentMethod';
import { requireSubadminPermission, requireRole, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = await requireSubadminPermission(request, 'manage_orders');
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const beneficiaryId = searchParams.get('beneficiaryId');
    const nurseId = searchParams.get('nurseId');
    const search = searchParams.get('search');
    const dateFrom = searchParams.get('dateFrom');
    const dateTo = searchParams.get('dateTo');

    const filter: any = {};
    if (status) filter.status = status;
    if (beneficiaryId) filter.beneficiaryId = beneficiaryId;
    if (nurseId) filter.nurseId = nurseId;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }

    // If search term provided, find matching beneficiaries/nurses/orders by ID
    if (search) {
      // Clean search: remove # prefix (from WhatsApp order number like #72397E)
      const cleanSearch = search.replace(/^#/, '');
      const idFilter: any[] = [];

      // If search looks like an order ID (hex string), try exact or partial match
      if (/^[0-9a-fA-F]+$/.test(cleanSearch)) {
        if (cleanSearch.length === 24) {
          // Full 24-char ObjectId - exact match
          try {
            const { Types } = await import('mongoose');
            if (Types.ObjectId.isValid(cleanSearch)) {
              idFilter.push({ _id: new Types.ObjectId(cleanSearch) });
            }
          } catch {}
        } else if (cleanSearch.length >= 4) {
          // Partial hex string (like 72397E) - match using $expr + $regexMatch on _id string
          idFilter.push({
            $expr: {
              $regexMatch: {
                input: { $toString: '$_id' },
                regex: cleanSearch,
                options: 'i'
              }
            }
          });
        }
      }

      const matchedBeneficiaries = await Beneficiary.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search } },
        ]
      }).select('_id').lean();
      const matchedNurses = await Nurse.find({
        $or: [
          { name: { $regex: search, $options: 'i' } },
          { phone: { $regex: search } },
        ]
      }).select('_id').lean();

      const beneficiaryIds = matchedBeneficiaries.map((b: any) => b._id);
      const nurseIds = matchedNurses.map((n: any) => n._id);

      const orConditions: any[] = [
        { beneficiaryId: { $in: beneficiaryIds } },
        { nurseId: { $in: nurseIds } },
        ...idFilter,
      ];

      // Also search by beneficiaryAddress
      orConditions.push({ beneficiaryAddress: { $regex: search, $options: 'i' } });

      filter.$or = orConditions;
    }

    const [orders, total] = await Promise.all([
      ServiceRequest.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      ServiceRequest.countDocuments(filter),
    ]);

    // Populate names
    const beneficiaryIds = [...new Set(orders.map((o: any) => o.beneficiaryId?.toString()).filter(Boolean))];
    const nurseIds = [...new Set(orders.map((o: any) => o.nurseId?.toString()).filter(Boolean))];
    const serviceIds = [...new Set(orders.map((o: any) => o.serviceId?.toString()).filter(Boolean))];

    // Collect payment method IDs for batch lookup
    const paymentMethodIds = [...new Set(orders.map((o: any) => o.paymentMethodId?.toString()).filter(Boolean))];

    const [beneficiaries, nurses, services, paymentMethods] = await Promise.all([
      Beneficiary.find({ _id: { $in: beneficiaryIds } }).select('name phone').lean(),
      Nurse.find({ _id: { $in: nurseIds } }).select('name phone').lean(),
      Service.find({ _id: { $in: serviceIds } }).select('nameAr').lean(),
      paymentMethodIds.length > 0
        ? PaymentMethod.find({ _id: { $in: paymentMethodIds } }).select('nameAr nameEn type walletType exchangeType accountName accountNumber instructions').lean()
        : [],
    ]);

    const beneficiaryMap = new Map(beneficiaries.map((b: any) => [b._id.toString(), b]));
    const nurseMap = new Map(nurses.map((n: any) => [n._id.toString(), n]));
    const serviceMap = new Map(services.map((s: any) => [s._id.toString(), s]));
    const paymentMethodMap = new Map(paymentMethods.map((p: any) => [p._id.toString(), p]));

    const populatedOrders = orders.map((o: any) => {
      const pm = o.paymentMethodId ? paymentMethodMap.get(o.paymentMethodId.toString()) : null;
      return {
        ...o,
        id: o._id.toString(),
        beneficiaryName: beneficiaryMap.get(o.beneficiaryId?.toString())?.name || 'غير معروف',
        beneficiaryPhone: beneficiaryMap.get(o.beneficiaryId?.toString())?.phone || '',
        nurseName: o.nurseId ? (nurseMap.get(o.nurseId?.toString())?.name || 'غير معروف') : null,
        nursePhone: o.nurseId ? (nurseMap.get(o.nurseId?.toString())?.phone || '') : '',
        serviceName: serviceMap.get(o.serviceId?.toString())?.nameAr || 'خدمة غير معروفة',
        // Detailed payment method info
        paymentMethodName: pm?.nameAr || null,
        paymentMethodAccountName: pm?.accountName || null,
        paymentMethodAccountNumber: pm?.accountNumber || null,
        paymentMethodInstructions: pm?.instructions || null,
      };
    });

    return Response.json({
      success: true,
      data: {
        orders: populatedOrders,
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[ADMIN ORDERS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب الطلبات', 500, 'INTERNAL_ERROR');
  }
}
