// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Firebase Admin SDK
// ============================================================================
// Server-side Firebase Admin SDK for sending FCM push notifications
// to Android/iOS devices. Web browsers use Web Push (VAPID) instead.
// ============================================================================

import * as admin from 'firebase-admin';

// ── Firebase Admin Initialization ────────────────────────────────────
// Uses environment variables for credentials.
// Required env vars:
//   FIREBASE_PROJECT_ID       — Firebase project ID
//   FIREBASE_CLIENT_EMAIL     — Firebase service account client email
//   FIREBASE_PRIVATE_KEY      — Firebase service account private key (base64 or raw)
//   FIREBASE_DATABASE_URL     — (optional) Firebase Realtime Database URL

let firebaseApp: admin.app.App | null = null;
let isInitialized = false;

function getPrivateKey(): string | undefined {
  const raw = process.env.FIREBASE_PRIVATE_KEY;
  if (!raw) return undefined;

  // The private key may be base64-encoded (common in Vercel env vars)
  // or contain literal \n characters that need to be replaced
  try {
    // Try base64 decode first
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    if (decoded.includes('-----BEGIN PRIVATE KEY-----')) {
      return decoded;
    }
  } catch {
    // Not base64, continue with raw value
  }

  // Replace escaped newlines with real newlines
  return raw.replace(/\\n/g, '\n');
}

export function initializeFirebaseAdmin(): admin.app.App | null {
  if (isInitialized) return firebaseApp;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = getPrivateKey();

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      '[FIREBASE-ADMIN] Missing environment variables. ' +
      'FCM push notifications to Android/iOS will not work. ' +
      'Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY'
    );
    isInitialized = true;
    return null;
  }

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
      // databaseURL is optional but recommended
      ...(process.env.FIREBASE_DATABASE_URL
        ? { databaseURL: process.env.FIREBASE_DATABASE_URL }
        : {}),
    });

    isInitialized = true;
    console.log('[FIREBASE-ADMIN] Initialized successfully — FCM push enabled');
    return firebaseApp;
  } catch (error: any) {
    // If already initialized, reuse existing app
    if (error?.code === 'app/duplicate-app') {
      firebaseApp = admin.app();
      isInitialized = true;
      console.log('[FIREBASE-ADMIN] Reusing existing Firebase app');
      return firebaseApp;
    }

    console.error('[FIREBASE-ADMIN] Failed to initialize:', error);
    isInitialized = true;
    return null;
  }
}

// ── Get Firebase Messaging instance ─────────────────────────────────

export function getFirebaseMessaging(): admin.messaging.Messaging | null {
  const app = initializeFirebaseAdmin();
  if (!app) return null;

  try {
    return admin.messaging(app);
  } catch (error) {
    console.error('[FIREBASE-ADMIN] Failed to get messaging instance:', error);
    return null;
  }
}

// ── Send FCM Message to a Single Device ─────────────────────────────

export interface FCMPayload {
  title: string;
  body: string;
  icon?: string;
  image?: string;
  url?: string;
  type?: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  sound?: boolean;
  tag?: string;
  data?: Record<string, string>;
  userRole?: string;
}

export async function sendFCMToDevice(
  fcmToken: string,
  payload: FCMPayload
): Promise<boolean> {
  const messaging = getFirebaseMessaging();
  if (!messaging) return false;

  try {
    const isEmergency = payload.type === 'emergency';
    const isHighPriority = payload.priority === 'high' || payload.priority === 'urgent';

    const message: admin.messaging.Message = {
      token: fcmToken,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.image ? { image: payload.image } : {}),
      },
      data: {
        // FCM data payload must be string key-value pairs
        ...(payload.data || {}),
        type: payload.type || 'system',
        priority: payload.priority || 'medium',
        url: payload.url || '/',
        userRole: payload.userRole || '',
        sound: String(payload.sound !== false),
        tag: payload.tag || '',
        timestamp: String(Date.now()),
      },
      android: {
        priority: isHighPriority ? 'high' : 'normal',
        notification: {
          icon: 'ic_launcher_foreground',
          color: '#14b8a6',
          sound: payload.sound !== false ? 'notification_sound.wav' : undefined,
          tag: payload.tag || undefined,
          clickAction: 'OPEN_ACTIVITY',
          channelId: isEmergency ? 'aafiatak_emergency' : 'aafiatak_notifications',
          priority: isEmergency
            ? ('max' as const)
            : isHighPriority
            ? ('high' as const)
            : ('default' as const),
          defaultSound: payload.sound !== false,
          defaultVibrateTimings: true,
          notificationCount: 1,
          sticky: isEmergency,
          localOnly: false,
        },
        collapseKey: payload.tag || undefined,
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
            },
            sound: payload.sound !== false ? 'default' : undefined,
            badge: 1,
            'content-available': 1,
          },
        },
      },
    };

    const response = await messaging.send(message);
    console.log('[FIREBASE-ADMIN] FCM sent successfully:', response);
    return true;
  } catch (error: any) {
    // Handle invalid/unregistered tokens
    if (
      error?.code === 'messaging/invalid-registration-token' ||
      error?.code === 'messaging/registration-token-not-registered'
    ) {
      console.warn('[FIREBASE-ADMIN] Invalid FCM token, should be deactivated:', fcmToken.substring(0, 20) + '...');
      return false;
    }

    console.error('[FIREBASE-ADMIN] Error sending FCM:', error?.message || error);
    return false;
  }
}

// ── Send FCM to Multiple Devices ────────────────────────────────────

export async function sendFCMToDevices(
  fcmTokens: string[],
  payload: FCMPayload
): Promise<{ successCount: number; failureCount: number; invalidTokens: string[] }> {
  const messaging = getFirebaseMessaging();
  if (!messaging || fcmTokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  try {
    const isEmergency = payload.type === 'emergency';
    const isHighPriority = payload.priority === 'high' || payload.priority === 'urgent';

    const message: admin.messaging.MulticastMessage = {
      tokens: fcmTokens,
      notification: {
        title: payload.title,
        body: payload.body,
        ...(payload.image ? { image: payload.image } : {}),
      },
      data: {
        ...(payload.data || {}),
        type: payload.type || 'system',
        priority: payload.priority || 'medium',
        url: payload.url || '/',
        userRole: payload.userRole || '',
        sound: String(payload.sound !== false),
        tag: payload.tag || '',
        timestamp: String(Date.now()),
      },
      android: {
        priority: isHighPriority ? 'high' : 'normal',
        notification: {
          icon: 'ic_launcher_foreground',
          color: '#14b8a6',
          sound: payload.sound !== false ? 'notification_sound.wav' : undefined,
          tag: payload.tag || undefined,
          clickAction: 'OPEN_ACTIVITY',
          channelId: isEmergency ? 'aafiatak_emergency' : 'aafiatak_notifications',
          priority: isEmergency
            ? ('max' as const)
            : isHighPriority
            ? ('high' as const)
            : ('default' as const),
          defaultSound: payload.sound !== false,
          defaultVibrateTimings: true,
          notificationCount: 1,
          sticky: isEmergency,
          localOnly: false,
        },
      },
      apns: {
        payload: {
          aps: {
            alert: {
              title: payload.title,
              body: payload.body,
            },
            sound: payload.sound !== false ? 'default' : undefined,
            badge: 1,
            'content-available': 1,
          },
        },
      },
    };

    const response = await messaging.sendEachForMulticast(message);
    const invalidTokens: string[] = [];

    if (response.failureCount > 0) {
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          const err = resp.error;
          if (
            err?.code === 'messaging/invalid-registration-token' ||
            err?.code === 'messaging/registration-token-not-registered'
          ) {
            invalidTokens.push(fcmTokens[idx]);
          }
        }
      });
    }

    console.log(
      `[FIREBASE-ADMIN] FCM multicast: ${response.successCount} sent, ${response.failureCount} failed`
    );

    return {
      successCount: response.successCount,
      failureCount: response.failureCount,
      invalidTokens,
    };
  } catch (error) {
    console.error('[FIREBASE-ADMIN] Error sending FCM multicast:', error);
    return { successCount: 0, failureCount: fcmTokens.length, invalidTokens: [] };
  }
}
