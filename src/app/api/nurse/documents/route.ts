// POST /api/nurse/documents - Upload nurse documents (ID + License)
// Stores images as base64 in MongoDB (Vercel serverless has read-only filesystem)
// MongoDB/Mongoose based - NO Prisma, NO Firebase

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { Nurse, Notification, User } from '@/models/mongoose';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { sendPushToUser } from '@/lib/notifications/push-service';
import { emitRealtimeEvent } from '@/lib/notifications/emit-realtime-event';

export async function POST(request: NextRequest) {
  try {
    await connectDB();
    const { user, error } = requireAuth(request);
    if (error) return error;

    if (user.role !== 'nurse') {
      return createErrorResponse('هذا الإجراء متاح للممرضين فقط', 403, 'FORBIDDEN');
    }

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      const file = formData.get('file') as File | null;
      const documentType = formData.get('type') as string || '';

      if (!file || !documentType) {
        return createErrorResponse('الملف ونوع المستند مطلوبان', 400, 'VALIDATION_ERROR');
      }

      // Validate file
      const maxSize = 10 * 1024 * 1024;
      if (file.size > maxSize) {
        return createErrorResponse('حجم الملف يجب أن يكون أقل من 10 ميجابايت', 400, 'FILE_TOO_LARGE');
      }

      const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
      if (!allowedTypes.includes(file.type)) {
        return createErrorResponse('نوع الملف غير مدعوم. يُسمح بصور فقط (JPEG, PNG, WebP, GIF)', 400, 'INVALID_FILE_TYPE');
      }

      // Validate document type
      if (!['identity', 'license'].includes(documentType)) {
        return createErrorResponse('نوع المستند غير صالح. يجب أن يكون identity أو license', 400, 'VALIDATION_ERROR');
      }

      // Convert file to base64 for MongoDB storage (Vercel serverless has no persistent filesystem)
      const arrayBuffer = await file.arrayBuffer();
      const base64Data = `data:${file.type};base64,${Buffer.from(arrayBuffer).toString('base64')}`;

      // Update nurse document - store base64 data directly in MongoDB
      const updateField = documentType === 'identity' ? 'identityDocumentData' : 'licenseDocumentData';
      const urlField = documentType === 'identity' ? 'identityDocumentUrl' : 'licenseDocumentUrl';

      const nurse = await Nurse.findByIdAndUpdate(
        user.userId,
        {
          [updateField]: base64Data,
          [urlField]: `data:stored/${documentType}`, // marker that data is in Data field
        },
        { new: true }
      ).select('identityDocumentUrl licenseDocumentUrl identityDocumentData licenseDocumentData verificationStatus name').lean();

      if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

      // Check if both documents are uploaded - if so, set verification to pending
      const bothUploaded = !!(nurse.identityDocumentData && nurse.licenseDocumentData);
      if (bothUploaded && nurse.verificationStatus !== 'verified') {
        await Nurse.findByIdAndUpdate(user.userId, { verificationStatus: 'pending' });
      }

      // ═══ NOTIFY: Send voice & push notifications to admins when nurse uploads documents ═══
      const docLabel = documentType === 'identity' ? 'الهوية الوطنية' : 'مزاولة المهنة';
      try {
        const nurseName = nurse.name || 'ممرض';
        const admins = await User.find({ role: { $in: ['admin', 'subadmin'] } }).select('_id role').lean();
        const voiceText = `قام الممرض ${nurseName} برفع ${docLabel}. يرجى المراجعة`;
        const notificationPromises: Promise<any>[] = [];

        for (const admin of admins) {
          const adminRole = (admin as any).role || 'admin';
          notificationPromises.push(
            Notification.create({
              userId: admin._id,
              userRole: adminRole,
              titleAr: '📄 رفع مستندات ممرض',
              bodyAr: `قام ${nurseName} برفع ${docLabel}${bothUploaded ? ' - اكتملت المستندات' : ''}. يرجى المراجعة`,
              type: 'verification',
              priority: bothUploaded ? 'high' : 'medium',
              data: {
                nurseId: user.userId,
                nurseName,
                documentType,
                bothUploaded,
                voiceAlert: true,
                voiceText,
              },
              actionUrl: '/admin/nurses',
              voiceEnabled: true,
            }),
            sendPushToUser(admin._id.toString(), {
              title: '📄 رفع مستندات ممرض',
              body: `قام ${nurseName} برفع ${docLabel}${bothUploaded ? ' - اكتملت المستندات' : ''}`,
              type: 'verification',
              priority: bothUploaded ? 'high' : 'medium',
              url: '/admin/nurses',
              userRole: adminRole,
              sound: true,
              data: {
                nurseId: user.userId,
                documentType,
                bothUploaded,
                voiceAlert: true,
                voiceText,
              },
            })
          );
        }
        await Promise.allSettled(notificationPromises);
      } catch (notifError) {
        console.error('[NURSE DOCUMENTS] Notification error:', notifError);
        // Non-critical
      }

      // ═══ EMIT REAL-TIME EVENT (multipart path) ═══
      try {
        emitRealtimeEvent.userChanged(
          { userId: user.userId, role: 'nurse', action: 'updated' },
          { changedBy: user.userId, changedByRole: 'nurse' }
        );
      } catch {
        // Non-critical — socket server may be down
      }

      return Response.json({
        success: true,
        data: {
          identityDocumentData: nurse.identityDocumentData,
          licenseDocumentData: nurse.licenseDocumentData,
          verificationStatus: bothUploaded && nurse.verificationStatus !== 'verified' ? 'pending' : nurse.verificationStatus,
          bothUploaded,
        },
        message: `تم رفع ${docLabel} بنجاح`,
      });
    }

    // Handle JSON upload (with base64 data URL)
    const body = await request.json();
    const documentType = body.documentType || body.type;
    const documentData = body.documentData;

    if (!documentType || !documentData) {
      return createErrorResponse('نوع المستند وبيانات المستند مطلوبان', 400, 'VALIDATION_ERROR');
    }

    if (!['identity', 'license'].includes(documentType)) {
      return createErrorResponse('نوع المستند غير صالح. يجب أن يكون identity أو license', 400, 'VALIDATION_ERROR');
    }

    const updateField = documentType === 'identity' ? 'identityDocumentData' : 'licenseDocumentData';
    const urlField = documentType === 'identity' ? 'identityDocumentUrl' : 'licenseDocumentUrl';

    const nurse = await Nurse.findByIdAndUpdate(
      user.userId,
      {
        [updateField]: documentData,
        [urlField]: `data:stored/${documentType}`,
      },
      { new: true }
    ).select('identityDocumentUrl licenseDocumentUrl identityDocumentData licenseDocumentData verificationStatus name').lean();

    if (!nurse) return createErrorResponse('الممرض غير موجود', 404, 'NOT_FOUND');

    const bothUploaded = !!(nurse.identityDocumentData && nurse.licenseDocumentData);
    if (bothUploaded && nurse.verificationStatus !== 'verified') {
      await Nurse.findByIdAndUpdate(user.userId, { verificationStatus: 'pending' });
    }

    // ═══ NOTIFY: Send voice & push notifications to admins (JSON path) ═══
    const docLabel = documentType === 'identity' ? 'الهوية الوطنية' : 'مزاولة المهنة';
    try {
      const nurseName = nurse.name || 'ممرض';
      const admins = await User.find({ role: { $in: ['admin', 'subadmin'] } }).select('_id role').lean();
      const voiceText = `قام الممرض ${nurseName} برفع ${docLabel}. يرجى المراجعة`;
      const notificationPromises: Promise<any>[] = [];

      for (const admin of admins) {
        const adminRole = (admin as any).role || 'admin';
        notificationPromises.push(
          Notification.create({
            userId: admin._id,
            userRole: adminRole,
            titleAr: '📄 رفع مستندات ممرض',
            bodyAr: `قام ${nurseName} برفع ${docLabel}${bothUploaded ? ' - اكتملت المستندات' : ''}. يرجى المراجعة`,
            type: 'verification',
            priority: bothUploaded ? 'high' : 'medium',
            data: {
              nurseId: user.userId,
              nurseName,
              documentType,
              bothUploaded,
              voiceAlert: true,
              voiceText,
            },
            actionUrl: '/admin/nurses',
            voiceEnabled: true,
          }),
          sendPushToUser(admin._id.toString(), {
            title: '📄 رفع مستندات ممرض',
            body: `قام ${nurseName} برفع ${docLabel}${bothUploaded ? ' - اكتملت المستندات' : ''}`,
            type: 'verification',
            priority: bothUploaded ? 'high' : 'medium',
            url: '/admin/nurses',
            userRole: adminRole,
            sound: true,
            data: {
              nurseId: user.userId,
              documentType,
              bothUploaded,
              voiceAlert: true,
              voiceText,
            },
          })
        );
      }
      await Promise.allSettled(notificationPromises);
    } catch (notifError) {
      console.error('[NURSE DOCUMENTS] Notification error:', notifError);
    }

    // ═══ EMIT REAL-TIME EVENT (JSON path) ═══
    try {
      emitRealtimeEvent.userChanged(
        { userId: user.userId, role: 'nurse', action: 'updated' },
        { changedBy: user.userId, changedByRole: 'nurse' }
      );
    } catch {
      // Non-critical — socket server may be down
    }

    return Response.json({
      success: true,
      data: {
        identityDocumentData: nurse.identityDocumentData,
        licenseDocumentData: nurse.licenseDocumentData,
        verificationStatus: bothUploaded && nurse.verificationStatus !== 'verified' ? 'pending' : nurse.verificationStatus,
        bothUploaded,
      },
      message: `تم رفع ${docLabel} بنجاح`,
    });
  } catch (error) {
    console.error('[NURSE DOCUMENTS ERROR]', error);
    return createErrorResponse('حدث خطأ أثناء رفع المستند', 500, 'INTERNAL_ERROR');
  }
}
