// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Web Push Notification Service
// ============================================================================
// Server-side push notification library using web-push with VAPID keys.
// NO Firebase — pure Web Push Protocol (RFC 8030) over VAPID (RFC 8292).
// ============================================================================

import webpush from 'web-push';
import { connectDB } from '@/lib/mongodb';
import FCMToken from '@/models/FCMToken';
import { Notification } from '@/models/mongoose';

// ── VAPID Configuration ────────────────────────────────────────────

// VAPID keys - fallback to hardcoded keys if env vars not set
// This ensures push notifications work even without Vercel env configuration
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY || 'BN36yGFOlkT2JcWmoW_vDsUBxD9icwAisjLwRZ9imYkWfExWulyeGjd0ANwWP7uZOr26p6trG3RjhJ1CxNGVtrU';
const VAPID_PRIVATE_KEY = process.env.VAPID_PRIVATE_KEY || '8lU09hjwDsqQo6gl8LJcbZVCrSAap0WFRoQH3DXjUxI';
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || 'mailto:support@aafiatak.com';

if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
    console.log('[PUSH] VAPID configured successfully');
  } catch (error) {
    console.error('[PUSH] Failed to configure VAPID:', error);
  }
} else {
  console.warn('[PUSH] VAPID keys not configured — push notifications will not work');
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
  data?: Record<string, any>;
  userRole?: string;
}

interface PushResult {
  sent: number;
  failed: number;
}

// ── Core: Send Push to a Single User ───────────────────────────────

/**
 * Send a Web Push notification to all active devices of a user.
 * Returns the count of sent and failed deliveries.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<PushResult> {
  if (!VAPID_PUBLIC_KEY || !VAPID_PRIVATE_KEY) {
    console.warn('[PUSH] VAPID keys not configured — skipping push');
    return { sent: 0, failed: 0 };
  }

  try {
    await connectDB();

    // Get all active push subscriptions for this user
    const tokens = await FCMToken.find({ userId, isActive: true }).lean();
    if (!tokens.length) return { sent: 0, failed: 0 };

    // Build the push payload
    // IMPORTANT: Include targetUserId so the Service Worker can filter
    // notifications by the currently logged-in user (multi-user device support)
    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      icon: payload.icon || '/icons/icon-192x192.png',
      badge: payload.badge || '/icons/icon-72x72.png',
      image: payload.image,
      url: payload.url,
      type: payload.type || 'system',
      priority: payload.priority || 'medium',
      sound: payload.sound !== false,
      tag: payload.tag,
      data: {
        ...(payload.data || {}),
        targetUserId: userId,  // Critical for multi-user device filtering in SW
      },
      userRole: payload.userRole,
      timestamp: Date.now(),
    });

    let sent = 0;
    let failed = 0;

    // Send to all devices in parallel
    const results = await Promise.allSettled(
      tokens.map(async (tokenDoc) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: tokenDoc.endpoint,
              keys: {
                p256dh: tokenDoc.p256dh,
                auth: tokenDoc.auth,
              },
            } as webpush.PushSubscription,
            pushPayload,
            {
              TTL: 86400, // 24 hours
              urgency:
                payload.priority === 'urgent' || payload.priority === 'high'
                  ? 'high'
                  : 'normal',
            }
          );
          sent++;
        } catch (error: any) {
          // If subscription is expired or gone, deactivate it
          if (error.statusCode === 410 || error.statusCode === 404) {
            try {
              await FCMToken.findByIdAndUpdate(tokenDoc._id, {
                isActive: false,
              });
            } catch {
              // Ignore deactivation errors
            }
          }
          failed++;
        }
      })
    );

    console.log(
      `[PUSH] Sent to user ${userId}: ${sent} sent, ${failed} failed`
    );
    return { sent, failed };
  } catch (error) {
    console.error('[PUSH] Error sending push to user:', error);
    return { sent: 0, failed: 1 };
  }
}

// ── Send Push to Multiple Users ────────────────────────────────────

/**
 * Send a Web Push notification to multiple users.
 */
export async function sendPushToUsers(
  userIds: string[],
  payload: PushPayload
): Promise<PushResult> {
  const results = await Promise.all(
    userIds.map((id) => sendPushToUser(id, payload))
  );
  return results.reduce(
    (acc, r) => ({ sent: acc.sent + r.sent, failed: acc.failed + r.failed }),
    { sent: 0, failed: 0 }
  );
}

// ── Send Push to All Users of a Role ───────────────────────────────

/**
 * Send a Web Push notification to all active users of a given role.
 */
export async function sendPushToRole(
  role: 'nurse' | 'beneficiary',
  payload: PushPayload
): Promise<PushResult> {
  try {
    await connectDB();

    // Get all distinct userIds that have active push subscriptions
    const tokenUserIds = await FCMToken.find({ isActive: true }).distinct('userId');

    // Filter by role using the appropriate model
    const { Nurse, Beneficiary } = await import('@/models/mongoose');
    const Model = role === 'nurse' ? Nurse : Beneficiary;
    const users = await Model.find({ _id: { $in: tokenUserIds } })
      .select('_id')
      .lean();
    const userIds = users.map((u: any) => u._id.toString());

    return sendPushToUsers(userIds, payload);
  } catch (error) {
    console.error('[PUSH] Error sending push to role:', error);
    return { sent: 0, failed: 0 };
  }
}

// ── Send Push + Create In-App Notification ─────────────────────────

/**
 * Create an in-app notification in MongoDB AND send a Web Push notification.
 * Use this for important events that need both persistent storage and real-time delivery.
 */
export async function sendNotificationWithPush(
  userId: string,
  payload: PushPayload
): Promise<void> {
  // 1. Create in-app notification
  try {
    await connectDB();
    await Notification.create({
      userId,
      userRole: payload.userRole || 'beneficiary',
      titleAr: payload.title,
      bodyAr: payload.body,
      type: payload.type || 'system',
      priority: payload.priority || 'medium',
      data: payload.data,
      read: false,
      actionUrl: payload.url,
      voiceEnabled:
        payload.priority === 'urgent' || payload.priority === 'high',
    });
  } catch (error) {
    console.error('[PUSH] Error creating notification:', error);
  }

  // 2. Send push notification (non-blocking, fire-and-forget)
  await sendPushToUser(userId, payload);
}
