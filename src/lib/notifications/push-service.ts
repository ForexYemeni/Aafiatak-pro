// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Unified Push Notification Service
// ============================================================================
// Server-side push notification delivery.
// Dual delivery: Web Push (VAPID) for browsers + FCM for Android/iOS devices.
// ============================================================================

import webpush from 'web-push';
import { connectDB } from '@/lib/mongodb';
import FCMToken from '@/models/FCMToken';
import { Notification } from '@/models/mongoose';
import { sendFCMToDevice, sendFCMToDevices } from './firebase-admin-sdk';

// ── VAPID Configuration ────────────────────────────────────────────
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? '';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY ?? '';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT ?? 'mailto:support@aafiatak.com';

const VAPID_CONFIGURED = Boolean(VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY);

if (VAPID_CONFIGURED) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log('[PUSH] VAPID configured successfully');
  } catch (error) {
    console.error('[PUSH] Failed to configure VAPID — check key format:', error);
  }
} else {
  console.warn(
    '[PUSH] VAPID_PUBLIC_KEY or VAPID_PRIVATE_KEY is not set. ' +
    'Web Push notifications will not be delivered.'
  );
}

// ── Types ──────────────────────────────────────────────────────────

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  image?: string;
  url?: string;
  type?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  sound?: boolean;
  tag?: string;
  data?: Record<string, unknown>;
  userRole?: string;
}

interface PushResult {
  sent: number;
  failed: number;
}

// ── Core: Send Push to a Single User (Web Push + FCM) ───────────────

/**
 * Send push notification to all active devices of a user.
 * Uses Web Push (VAPID) for web browsers and FCM for Android/iOS devices.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<PushResult> {
  // ═══════════════════════════════════════════════════════════════════
  // CRITICAL FIX: VAPID check should ONLY gate Web Push, NOT FCM!
  // Previously, if VAPID wasn't configured, ALL push notifications
  // (including FCM for Android/iOS) were silently dropped.
  // Now we proceed with FCM even if VAPID is missing.
  // ═══════════════════════════════════════════════════════════════════

  try {
    await connectDB();

    const tokens = await FCMToken.find({ userId, isActive: true }).lean();
    if (!tokens.length) {
      console.log('[PUSH] No active tokens found for user:', userId);
      return { sent: 0, failed: 0 };
    }

    // Separate tokens by platform
    const webTokens = tokens.filter((t) => t.platform === 'web' && t.endpoint);
    const fcmTokens = tokens.filter(
      (t) => (t.platform === 'android' || t.platform === 'ios') && t.fcmToken
    );

    let sent = 0;
    let failed = 0;

    // ── Send via Web Push (VAPID) to browsers ──────────────────────
    // Only attempt web push if VAPID is configured
    if (webTokens.length > 0 && VAPID_CONFIGURED) {
      const pushPayload = JSON.stringify({
        title: payload.title,
        body: payload.body,
        icon: payload.icon ?? '/icons/icon-192x192.png',
        badge: payload.badge ?? '/icons/icon-72x72.png',
        image: payload.image,
        url: payload.url,
        type: payload.type ?? 'system',
        priority: payload.priority ?? 'medium',
        sound: payload.sound !== false,
        tag: payload.tag,
        data: {
          ...(payload.data ?? {}),
          targetUserId: userId,
        },
        userRole: payload.userRole,
        timestamp: Date.now(),
      });

      const webResults = await Promise.allSettled(
        webTokens.map(async (tokenDoc) => {
          try {
            await webpush.sendNotification(
              {
                endpoint: tokenDoc.endpoint,
                keys: { p256dh: tokenDoc.p256dh, auth: tokenDoc.auth },
              } as webpush.PushSubscription,
              pushPayload,
              {
                TTL: 86400,
                urgency:
                  payload.priority === 'urgent' || payload.priority === 'high'
                    ? 'high'
                    : 'normal',
              }
            );
            return true;
          } catch (error: unknown) {
            const webPushError = error as { statusCode?: number };
            if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
              try {
                await FCMToken.findByIdAndUpdate(tokenDoc._id, { isActive: false });
              } catch {
                // ignore cleanup errors
              }
            }
            return false;
          }
        })
      );

      for (const result of webResults) {
        if (result.status === 'fulfilled' && result.value) sent++;
        else failed++;
      }
    } else if (webTokens.length > 0 && !VAPID_CONFIGURED) {
      console.warn('[PUSH] VAPID not configured — skipping Web Push for', webTokens.length, 'web tokens');
    }

    // ── Send via FCM to Android/iOS devices ────────────────────────
    if (fcmTokens.length > 0) {
      const fcmTokenStrings = fcmTokens.map((t) => t.fcmToken);

      const fcmPayload = {
        title: payload.title,
        body: payload.body,
        icon: payload.icon ?? '/icons/icon-192x192.png',
        image: payload.image,
        url: payload.url,
        type: payload.type ?? 'system',
        priority: payload.priority ?? 'medium',
        sound: payload.sound !== false,
        tag: payload.tag,
        data: (payload.data
          ? Object.fromEntries(
              Object.entries(payload.data).map(([k, v]) => [k, String(v)])
            )
          : {}) as Record<string, string>,
        userRole: payload.userRole,
      };

      if (fcmTokenStrings.length === 1) {
        // Single device — use single send
        const success = await sendFCMToDevice(fcmTokenStrings[0], fcmPayload);
        if (success) sent++;
        else failed++;
      } else {
        // Multiple devices — use multicast
        const result = await sendFCMToDevices(fcmTokenStrings, fcmPayload);
        sent += result.successCount;
        failed += result.failureCount;

        // Deactivate invalid FCM tokens
        if (result.invalidTokens.length > 0) {
          await Promise.allSettled(
            result.invalidTokens.map((invalidToken) =>
              FCMToken.updateMany(
                { fcmToken: invalidToken, isActive: true },
                { isActive: false }
              )
            )
          );
        }
      }
    }

    console.log(`[PUSH] User ${userId}: ${sent} sent, ${failed} failed (web: ${webTokens.length}, fcm: ${fcmTokens.length})`);
    return { sent, failed };
  } catch (error) {
    console.error('[PUSH] Error sending push to user:', error);
    return { sent: 0, failed: 1 };
  }
}

// ── Send Push to Multiple Users ────────────────────────────────────

export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<PushResult> {
  const results = await Promise.all(userIds.map((id) => sendPushToUser(id, payload)));
  return results.reduce(
    (acc, r) => ({ sent: acc.sent + r.sent, failed: acc.failed + r.failed }),
    { sent: 0, failed: 0 }
  );
}

// ── Send Push to All Users of a Role ───────────────────────────────

export async function sendPushToRole(
  role: 'nurse' | 'beneficiary',
  payload: PushPayload
): Promise<PushResult> {
  try {
    await connectDB();
    const tokenUserIds = await FCMToken.find({ isActive: true }).distinct('userId');
    const { Nurse, Beneficiary } = await import('@/models/mongoose');
    const Model = role === 'nurse' ? Nurse : Beneficiary;
    const users = await Model.find({ _id: { $in: tokenUserIds } }).select('_id').lean() as { _id: unknown }[];
    const userIds = users.map((u) => String(u._id));
    return sendPushToUsers(userIds, payload);
  } catch (error) {
    console.error('[PUSH] Error sending push to role:', error);
    return { sent: 0, failed: 0 };
  }
}

// ── Send Push + Create In-App Notification ─────────────────────────

export async function sendNotificationWithPush(
  userId: string,
  payload: PushPayload
): Promise<void> {
  try {
    await connectDB();
    await Notification.create({
      userId,
      userRole: payload.userRole ?? 'beneficiary',
      titleAr: payload.title,
      bodyAr: payload.body,
      type: payload.type ?? 'system',
      priority: payload.priority ?? 'medium',
      data: payload.data,
      read: false,
      actionUrl: payload.url,
      voiceEnabled: payload.priority === 'urgent' || payload.priority === 'high',
    });
  } catch (error) {
    console.error('[PUSH] Error creating in-app notification:', error);
  }

  await sendPushToUser(userId, payload);
}
