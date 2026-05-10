// ============================================================================
// GET/POST /api/deployments - List/Create deployments (تكليف)
// MongoDB/Mongoose based - NO Prisma, NO Firebase
// ============================================================================

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Deployment, Notification, Nurse, AdminSettings, User } from '@/models/mongoose';
import { requireAuth, requireRole, createErrorResponse } from '@/lib/auth/middleware';
import { sendPushToUser } from '@/lib/notifications/push-service';

// ── GET: List deployments with filters ──────────────────────────────────────

export async function GET(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '20');
    const status = searchParams.get('status');
    const type = searchParams.get('type');
    const governorate = searchParams.get('governorate');

    // Build filter
    const filter: any = {};

    // Role-based filtering:
    // - Nurses see only their own deployments + open ones they can apply to
    // - Admins/subadmins see everything
    if (user.role === 'nurse') {
      filter.$or = [
        { status: 'open' },
        { createdBy: user.userId },
        { 'applications.applicantId': user.userId },
        { assignedTo: user.userId },
      ];
    }

    if (status) filter.status = status;
    if (type) filter.type = type;
    if (governorate) filter['location.governorate'] = governorate;

    const [deployments, total] = await Promise.all([
      Deployment.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('createdBy', 'name phone')
        .populate('assignedTo', 'name phone')
        .lean(),
      Deployment.countDocuments(filter),
    ]);

    // Serialize _id fields with fallback for unpopulated references
    const serialized = deployments.map((d: any) => {
      // Handle createdBy: if populated, it's an object; if not, it's an ObjectId string
      let createdBySerialized = null;
      if (d.createdBy && typeof d.createdBy === 'object' && d.createdBy._id) {
        createdBySerialized = { ...d.createdBy, id: d.createdBy._id.toString() };
      } else if (d.createdBy) {
        // createdBy wasn't populated (still an ObjectId) — create minimal object
        createdBySerialized = { id: d.createdBy.toString() };
      }

      let assignedToSerialized = null;
      if (d.assignedTo && typeof d.assignedTo === 'object' && d.assignedTo._id) {
        assignedToSerialized = { ...d.assignedTo, id: d.assignedTo._id.toString() };
      } else if (d.assignedTo) {
        assignedToSerialized = { id: d.assignedTo.toString() };
      }

      return {
        ...d,
        id: d._id.toString(),
        createdBy: createdBySerialized,
        assignedTo: assignedToSerialized,
        applications: (d.applications || []).map((a: any) => ({
          ...a,
          applicantId: a.applicantId?.toString(),
          paymentVerifiedBy: a.paymentVerifiedBy?.toString(),
        })),
      };
    });

    return Response.json({
      success: true,
      data: {
        deployments: serialized,
        total,
        page,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('[DEPLOYMENTS LIST ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء جلب التكاليف', 500, 'INTERNAL_ERROR');
  }
}

// ── POST: Create a new deployment ───────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireRole(request, ['admin', 'subadmin', 'nurse']);
    if (error) return error;

    const body = await request.json();
    const {
      title,
      description,
      type,
      specialization,
      hours,
      location,
      amount,
      startDate,
      endDate,
      requirements,
      notes,
    } = body;

    // ── Validation ──
    if (!title || !description || !hours || !amount) {
      return createErrorResponse('العنوان والوصف وعدد الساعات والمبلغ مطلوبة', 400, 'VALIDATION_ERROR');
    }

    if (hours < 1) {
      return createErrorResponse('عدد الساعات يجب أن يكون 1 على الأقل', 400, 'VALIDATION_ERROR');
    }

    if (amount < 0) {
      return createErrorResponse('المبلغ يجب أن يكون رقم موجب', 400, 'VALIDATION_ERROR');
    }

    // ── Get settings for commission and service fees ──
    const settings = await AdminSettings.findOne().lean();
    const commissionRate = settings?.commissionRate ?? 15;
    const deploymentCreatorFee = settings?.deploymentCreatorFee ?? 0;
    const deploymentApplicantFee = settings?.deploymentApplicantFee ?? 500;

    // ── Calculate financials ──
    const adminCommissionPercent = commissionRate;
    const adminCommissionAmount = Math.round((amount * adminCommissionPercent) / 100);
    const serviceFee = deploymentApplicantFee; // the fee the applicant pays
    const totalWithFee = amount + serviceFee;

    // ── Determine creator info ──
    const creatorRole: 'admin' | 'nurse' = user.role === 'nurse' ? 'nurse' : 'admin';

    // ── Get creator phone ──
    const creatorUser = await User.findById(user.userId).select('phone').lean();
    const creatorPhone = creatorUser?.phone || '';

    // ── Create deployment ──
    const deployment = await Deployment.create({
      createdBy: user.userId,
      creatorRole,
      creatorPhone,
      title,
      description,
      type: type || 'nursing',
      specialization: specialization || [],
      hours,
      location: location || {},
      amount,
      adminCommissionPercent,
      adminCommissionAmount,
      creatorServiceFee: deploymentCreatorFee,
      applicantServiceFee: deploymentApplicantFee,
      serviceFee,
      totalWithFee,
      status: 'open',
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      requirements,
      notes,
    });

    // ═══ NOTIFY: Notify relevant nurses (if admin created) or admins (if nurse created) ═══
    const notificationPromises: Promise<any>[] = [];

    try {
      const typeLabels: Record<string, string> = {
        nursing: 'تمريض',
        lab: 'مختبر',
        midwife: 'توليد',
        home_care: 'رعاية منزلية',
        other: 'أخرى',
      };
      const deploymentType = typeLabels[type || 'nursing'] || 'تمريض';

      if (creatorRole === 'admin') {
        // Notify relevant nurses about the new deployment
        const nurseFilter: any = { verificationStatus: 'verified', isAvailable: true };

        // If specialization is specified, filter by that
        if (specialization?.length) {
          nurseFilter.specialization = { $in: specialization };
        }

        // If governorate is specified, filter by that
        if (location?.governorate) {
          nurseFilter.governorate = location.governorate;
        }

        const nurses = await Nurse.find(nurseFilter)
          .select('_id name')
          .limit(50)
          .lean();

        for (const nurse of nurses) {
          const voiceText = `تكليف جديد: ${title}. نوعه ${deploymentType}`;
          notificationPromises.push(
            Notification.create({
              userId: nurse._id,
              userRole: 'nurse',
              titleAr: '📋 تكليف جديد متاح',
              bodyAr: `تم إضافة تكليف جديد: ${title} (${deploymentType}) - ${hours} ساعة`,
              type: 'deployment',
              priority: 'high',
              data: {
                deploymentId: deployment._id.toString(),
                deploymentType: type || 'nursing',
                voiceAlert: true,
                voiceText,
              },
              actionUrl: '/nurse/deployments',
              voiceEnabled: true,
            }),
            sendPushToUser(nurse._id.toString(), {
              title: '📋 تكليف جديد متاح',
              body: `تم إضافة تكليف جديد: ${title} (${deploymentType}) - ${hours} ساعة`,
              type: 'deployment',
              priority: 'high',
              url: '/nurse/deployments',
              userRole: 'nurse',
              sound: true,
              data: {
                deploymentId: deployment._id.toString(),
                deploymentType: type || 'nursing',
                voiceAlert: true,
                voiceText,
              },
            })
          );
        }
      } else {
        // Nurse created — notify admins (also notify subadmins)
        const admins = await User.find({ role: { $in: ['admin', 'subadmin'] } }).select('_id').lean();

        const nurseDoc = await Nurse.findById(user.userId).select('name').lean();
        const nurseName = nurseDoc?.name || 'ممرض';

        const voiceText = `أنشأ الممرض ${nurseName} تكليفاً جديداً: ${title}`;

        for (const admin of admins) {
          const isAdmin = (admin as any).role === 'admin';
          const adminActionUrl = '/admin/deployments';

          notificationPromises.push(
            Notification.create({
              userId: admin._id,
              userRole: 'admin',
              titleAr: '📋 تكليف جديد من ممرض',
              bodyAr: `أنشأ ${nurseName} تكليفاً جديداً: ${title} (${deploymentType}) - ${hours} ساعة`,
              type: 'deployment',
              priority: 'high',
              data: {
                deploymentId: deployment._id.toString(),
                nurseId: user.userId,
                voiceAlert: true,
                voiceText,
              },
              actionUrl: adminActionUrl,
              voiceEnabled: true,
            }),
            sendPushToUser(admin._id.toString(), {
              title: '📋 تكليف جديد من ممرض',
              body: `أنشأ ${nurseName} تكليفاً جديداً: ${title}`,
              type: 'deployment',
              priority: 'high',
              url: adminActionUrl,
              userRole: 'admin',
              sound: true,
              data: {
                deploymentId: deployment._id.toString(),
                nurseId: user.userId,
                voiceAlert: true,
                voiceText,
              },
            })
          );
        }
      }
    } catch (notifError) {
      console.error('[DEPLOYMENT CREATE] Notification error:', notifError);
      // Non-critical — notifications should not block creation
    }

    // Fire ALL notifications in parallel
    await Promise.allSettled(notificationPromises);

    return Response.json({
      success: true,
      data: {
        ...deployment.toObject(),
        id: deployment._id.toString(),
      },
      message: 'تم إنشاء التكليف بنجاح',
    }, { status: 201 });
  } catch (error) {
    console.error('[DEPLOYMENT CREATE ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء إنشاء التكليف', 500, 'INTERNAL_ERROR');
  }
}
