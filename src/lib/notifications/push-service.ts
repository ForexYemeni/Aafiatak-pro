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
// All VAPID keys MUST come from environment variables.
// Never hardcode keys in source code — they are secrets.
// Run `npx web-push generate-vapid-keys` to generate a fresh pair.
// Required env vars:
//   VAPID_PUBLIC_KEY   — the base64url-encoded public key
//   VAPID_PRIVATE_KEY  — the base64url-encoded private key
//   VAPID_SUBJECT      — mailto: or https: contact URI

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
    'Push notifications will not be delivered. ' +
    'Run: npx web-push generate-vapid-keys and add the output to your .env file.'
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

// ── Core: Send Push to a Single User ───────────────────────────────

/**
 * Send a Web Push notification to all active devices of a user.
 * Returns the count of sent and failed deliveries.
 */
export async function sendPushToUser(
  userId: string,
  payload: PushPayload
): Promise<PushResult> {
  if (!VAPID_CONFIGURED) {
    console.warn('[PUSH] VAPID not configured — skipping push for user:', userId);
    return { sent: 0, failed: 0 };
  }

  try {
    await connectDB();

    const tokens = await FCMToken.find({ userId, isActive: true }).lean();
    if (!tokens.length) return { sent: 0, failed: 0 };

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

    let sent = 0;
    let failed = 0;

    await Promise.allSettled(
      tokens.map(async (tokenDoc) => {
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
          sent++;
        } catch (error: unknown) {
          const webPushError = error as { statusCode?: number };
          if (webPushError.statusCode === 410 || webPushError.statusCode === 404) {
            try {
              await FCMToken.findByIdAndUpdate(tokenDoc._id, { isActive: false });
            } catch {
              // ignore cleanup errors
            }
          }
          failed++;
        }
      })
    );

    console.log(`[PUSH] User ${userId}: ${sent} sent, ${failed} failed`);
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
