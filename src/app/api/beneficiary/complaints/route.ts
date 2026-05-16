// POST /api/beneficiary/complaints - Create complaint
// GET  /api/beneficiary/complaints - List beneficiary's complaints
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Complaint, Beneficiary, Nurse } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { serializeDoc, serializeDocs } from '@/lib/mongoose/serialize';

// POST - Create a new complaint
export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const body = await request.json();
    const { subject, description, category, againstUserId, againstUserName } = body;

    if (!subject || !subject.trim()) {
      return createErrorResponse('موضوع الشكوى مطلوب', 400, 'VALIDATION_ERROR');
    }
    if (!description || !description.trim()) {
      return createErrorResponse('وصف الشكوى مطلوب', 400, 'VALIDATION_ERROR');
    }
    if (description.trim().length < 10) {
      return createErrorResponse('الوصف يجب أن يكون 10 أحرف على الأقل', 400, 'VALIDATION_ERROR');
    }

    // Get beneficiary name for display
    const beneficiary = await Beneficiary.findById(user.userId).select('name').lean();
    const fromUserName = beneficiary?.name || user.name || 'مستفيد';

    // Determine priority based on category
    let priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium';
    if (category === 'technical') priority = 'high';
    if (category === 'payment') priority = 'high';

    const complaint = await Complaint.create({
      fromUserId: user.userId,
      fromUserName,
      fromUserRole: 'beneficiary',
      subject: subject.trim(),
      description: description.trim(),
      category: category || 'general',
      status: 'open',
      priority,
      againstUserId: againstUserId || undefined,
      againstUserName: againstUserName || undefined,
    });

    return Response.json({
      success: true,
      data: serializeDoc(complaint.toObject()),
      message: 'تم إرسال البلاغ بنجاح. سيتم مراجعته من قبل فريق الدعم.',
    }, { status: 201 });
  } catch (error) {
    console.error('[BENEFICIARY COMPLAINTS POST ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إرسال الشكوى', 500, 'INTERNAL_ERROR');
  }
}

// GET - List beneficiary's own complaints
export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'beneficiary') {
      return createErrorResponse('هذا الإجراء متاح للمستفيدين فقط', 403, 'FORBIDDEN');
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status') || '';

    const filter: any = { fromUserId: user.userId };
    if (status) filter.status = status;

    const [complaints, total] = await Promise.all([
      Complaint.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Complaint.countDocuments(filter),
    ]);

    return Response.json({
      success: true,
      data: {
        complaints: serializeDocs(complaints),
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[BENEFICIARY COMPLAINTS GET ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب الشكاوى', 500, 'INTERNAL_ERROR');
  }
}
