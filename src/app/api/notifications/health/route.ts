// GET /api/notifications/health - Comprehensive notification system health check
// Returns diagnostic information about the entire notification pipeline

import { NextRequest } from 'next/server';
import { connectDB } from '@/lib/mongodb';
import { requireAuth, createErrorResponse } from '@/lib/auth/middleware';
import { checkFirebaseHealth } from '@/lib/notifications/firebase-admin-sdk';
import FCMToken from '@/models/FCMToken';

export async function GET(request: NextRequest) {
  try {
    await connectDB();

    const { user, error } = requireAuth(request);
    if (error) return error;

    // Only admins can access health check
    if (user!.role !== 'admin' && user!.role !== 'subadmin') {
      return createErrorResponse('هذا الإجراء متاح للمسؤولين فقط', 403, 'FORBIDDEN');
    }

    // ═══════════════════════════════════════════════════════════
    // Step 1: Check Firebase Admin SDK status
    // ═══════════════════════════════════════════════════════════
    const firebaseHealth = await checkFirebaseHealth();

    // ═══════════════════════════════════════════════════════════
    // Step 2: Check FCM tokens in database
    // ═══════════════════════════════════════════════════════════
    const totalTokens = await FCMToken.countDocuments({ isActive: true });
    const androidTokens = await FCMToken.countDocuments({ isActive: true, platform: 'android' });
    const iosTokens = await FCMToken.countDocuments({ isActive: true, platform: 'ios' });
    const webTokens = await FCMToken.countDocuments({ isActive: true, platform: 'web' });
    const inactiveTokens = await FCMToken.countDocuments({ isActive: false });

    // Get recent tokens (last 24 hours)
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const recentTokens = await FCMToken.countDocuments({
      isActive: true,
      lastUsedAt: { $gte: oneDayAgo },
    });

    // Get sample Android tokens for testing
    const sampleAndroidToken = await FCMToken.findOne({
      isActive: true,
      platform: 'android',
    }).select('userId fcmToken platform lastUsedAt createdAt').lean();

    // ═══════════════════════════════════════════════════════════
    // Step 3: Check VAPID configuration
    // ═══════════════════════════════════════════════════════════
    const vapidConfigured = Boolean(
      process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY
    );

    // ═══════════════════════════════════════════════════════════
    // Step 4: Determine overall status
    // ═══════════════════════════════════════════════════════════
    let overallStatus: 'healthy' | 'degraded' | 'broken' = 'healthy';
    const issues: string[] = [];
    const recommendations: string[] = [];

    if (!firebaseHealth.hasApp) {
      overallStatus = 'broken';
      issues.push('Firebase Admin SDK NOT initialized — FCM push to Android/iOS will NOT work');
      if (!firebaseHealth.envVarsPresent.privateKey || firebaseHealth.envVarsPresent.privateKeyFormat === 'invalid') {
        recommendations.push('Set FIREBASE_PRIVATE_KEY env var with valid service account private key');
      }
      if (!firebaseHealth.envVarsPresent.projectId) {
        recommendations.push('Set FIREBASE_PROJECT_ID env var');
      }
      if (!firebaseHealth.envVarsPresent.clientEmail) {
        recommendations.push('Set FIREBASE_CLIENT_EMAIL env var');
      }
      if (!firebaseHealth.dbConfigPresent) {
        recommendations.push('Or configure Firebase credentials via admin dashboard');
      }
    }

    if (firebaseHealth.error) {
      issues.push(`Firebase error: ${firebaseHealth.error}`);
    }

    if (androidTokens === 0) {
      if (overallStatus === 'healthy') overallStatus = 'degraded';
      issues.push('No Android FCM tokens registered — push cannot reach any Android device');
      recommendations.push('Open the APK on an Android device and log in to register the FCM token');
    }

    if (recentTokens === 0 && totalTokens > 0) {
      if (overallStatus === 'healthy') overallStatus = 'degraded';
      issues.push('No tokens registered in last 24h — tokens may be stale');
      recommendations.push('Have users reopen the app to refresh their FCM tokens');
    }

    if (!vapidConfigured) {
      if (overallStatus === 'healthy') overallStatus = 'degraded';
      issues.push('VAPID not configured — Web Push for browser users will NOT work');
      recommendations.push('Set VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY env vars');
    }

    return Response.json({
      success: true,
      data: {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        firebase: {
          initialized: firebaseHealth.hasApp,
          credentialSource: firebaseHealth.credentialSource,
          error: firebaseHealth.error,
          envVars: {
            projectId: firebaseHealth.envVarsPresent.projectId,
            clientEmail: firebaseHealth.envVarsPresent.clientEmail,
            privateKeyPresent: firebaseHealth.envVarsPresent.privateKey,
            privateKeyFormat: firebaseHealth.envVarsPresent.privateKeyFormat,
          },
          dbConfig: firebaseHealth.dbConfigPresent,
        },
        tokens: {
          total: totalTokens,
          android: androidTokens,
          ios: iosTokens,
          web: webTokens,
          inactive: inactiveTokens,
          recentLast24h: recentTokens,
          sampleDevice: sampleAndroidToken ? {
            userId: sampleAndroidToken.userId,
            platform: sampleAndroidToken.platform,
            tokenPrefix: (sampleAndroidToken.fcmToken as string)?.substring(0, 20) + '...',
            lastUsedAt: sampleAndroidToken.lastUsedAt,
            createdAt: sampleAndroidToken.createdAt,
          } : null,
        },
        vapid: {
          configured: vapidConfigured,
        },
        issues: issues.length > 0 ? issues : undefined,
        recommendations: recommendations.length > 0 ? recommendations : undefined,
      },
    });
  } catch (error: any) {
    console.error('[NOTIFICATION HEALTH ERROR]', error);
    return createErrorResponse(
      error.message || 'حدث خطأ أثناء فحص حالة الإشعارات',
      500,
      'INTERNAL_ERROR'
    );
  }
}
