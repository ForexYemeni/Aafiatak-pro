// GET/POST /api/admin/subadmins - List/Create sub-admins
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User } from '@/models/mongoose';
import { hashPassword, generateReferralCode, createErrorResponse } from '@/lib/auth';
import { requireRole } from '@/lib/auth/middleware';
import { logActivity } from '@/lib/api/helpers';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');

    const filter: any = { role: 'subadmin' };

    const [subadmins, total] = await Promise.all([
      User.find(filter).select('-password').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
      User.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: {
        subadmins: subadmins.map((s: any) => ({ ...s, id: s._id.toString() })),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[ADMIN SUBADMINS LIST ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب المشرفين', 500, 'INTERNAL_ERROR');
  }
}

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin']);
    if (error) return error;

    const body = await request.json();
    const { name, phone, password } = body;

    if (!name || !phone || !password) {
      return createErrorResponse('الاسم ورقم الهاتف وكلمة المرور مطلوبون', 400, 'VALIDATION_ERROR');
    }

    if (password.length < 6) {
      return createErrorResponse('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 400, 'VALIDATION_ERROR');
    }

    // Check if phone already exists
    const existing = await User.findOne({ phone });
    if (existing) {
      return createErrorResponse('رقم الهاتف مسجل بالفعل', 409, 'PHONE_EXISTS');
    }

    const hashedPassword = await hashPassword(password);

    const subadmin = await User.create({
      name,
      phone,
      password: hashedPassword,
      role: 'subadmin',
      isActive: true,
    });

    await logActivity({
      userId: user!.userId,
      userRole: user!.role,
      action: 'create_subadmin',
      entity: 'User',
      entityId: subadmin._id.toString(),
      details: `إنشاء مشرف جديد: ${name}`,
      request,
    });

    return Response.json({
      success: true,
      data: { id: subadmin._id.toString(), name: subadmin.name, phone: subadmin.phone, role: subadmin.role, isActive: subadmin.isActive },
      message: 'تم إنشاء المشرف بنجاح',
    }, { status: 201 });
  } catch (error) {
    console.error('[ADMIN SUBADMINS CREATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إنشاء المشرف', 500, 'INTERNAL_ERROR');
  }
}
