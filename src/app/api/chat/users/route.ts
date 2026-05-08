// GET /api/chat/users - Search users for starting new chats
// Only accessible by admin/subadmin

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { User, Nurse, Beneficiary } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    // Only admin/subadmin can search users
    if (user.role !== 'admin' && user.role !== 'subadmin') {
      return createErrorResponse('غير مصرح بهذا الإجراء', 403, 'FORBIDDEN');
    }

    const { searchParams } = new URL(request.url);
    const q = searchParams.get('q') || '';
    const role = searchParams.get('role') || ''; // optional filter: nurse, beneficiary, subadmin

    if (!q || q.length < 2) {
      return Response.json({
        success: true,
        data: [],
      });
    }

    const results: any[] = [];

    // Search nurses
    if (!role || role === 'nurse') {
      const nurses = await Nurse.find({
        name: { $regex: q, $options: 'i' },
        isActive: { $ne: false },
      })
        .select('name phone specialty')
        .limit(10)
        .lean();

      for (const n of nurses) {
        results.push({
          id: n._id.toString(),
          name: n.name,
          phone: n.phone || null,
          role: 'nurse',
          roleLabel: 'ممرض/ـة',
          subtitle: n.specialty || '',
        });
      }
    }

    // Search beneficiaries
    if (!role || role === 'beneficiary') {
      const beneficiaries = await Beneficiary.find({
        name: { $regex: q, $options: 'i' },
      })
        .select('name phone')
        .limit(10)
        .lean();

      for (const b of beneficiaries) {
        results.push({
          id: b._id.toString(),
          name: b.name,
          phone: b.phone || null,
          role: 'beneficiary',
          roleLabel: 'مستفيد/ـة',
          subtitle: '',
        });
      }
    }

    // Search subadmins/admins
    if (!role || role === 'subadmin' || role === 'admin') {
      const adminUsers = await User.find({
        name: { $regex: q, $options: 'i' },
        role: { $in: ['admin', 'subadmin'] },
        _id: { $ne: user.userId },
      })
        .select('name phone role')
        .limit(10)
        .lean();

      for (const a of adminUsers) {
        results.push({
          id: a._id.toString(),
          name: a.name,
          phone: a.phone || null,
          role: a.role,
          roleLabel: a.role === 'admin' ? 'مدير النظام' : 'مدير فرعي',
          subtitle: a.role === 'admin' ? 'مدير النظام' : 'مدير فرعي',
        });
      }
    }

    return Response.json({
      success: true,
      data: results,
    });
  } catch (error) {
    console.error('[CHAT USERS SEARCH ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء البحث', 500, 'INTERNAL_ERROR');
  }
}
