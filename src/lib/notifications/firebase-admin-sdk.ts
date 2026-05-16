// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Firebase Admin SDK
// ============================================================================
// Server-side Firebase Admin SDK for sending FCM push notifications
// to Android/iOS devices. Web browsers use Web Push (VAPID) instead.
//
// Credential resolution order:
//   1. Environment variables (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY)
//   2. MongoDB FirebaseConfig collection (admin-configured from dashboard)
// ============================================================================

import * as admin from 'firebase-admin';
import { connectDB } from '@/lib/mongodb';
import FirebaseConfig from '@/models/mongoose/FirebaseConfig';

// ── Firebase Admin Initialization ────────────────────────────────────
// Uses environment variables for credentials first, then falls back to
// the FirebaseConfig MongoDB collection.
// Required env vars (primary):
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

/**
 * Process a private key value: handles base64 encoding and escaped newlines.
 */
function processPrivateKey(raw: string): string {
  // Try base64 decode first
  try {
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

/**
 * Try to read Firebase credentials from the MongoDB FirebaseConfig collection.
 * Returns the credentials or null if not available.
 */
async function getCredentialsFromDB(): Promise<{
  projectId: string;
  clientEmail: string;
  privateKey: string;
  storageBucket?: string;
} | null> {
  try {
    await connectDB();
    const config = await FirebaseConfig.findOne({ isActive: true }).lean();
    if (!config) {
      console.log('[FIREBASE-ADMIN] No active Firebase config found in database');
      return null;
    }

    return {
      projectId: config.projectId,
      clientEmail: config.clientEmail,
      privateKey: processPrivateKey(config.privateKey),
      storageBucket: config.storageBucket || undefined,
    };
  } catch (error) {
    console.warn('[FIREBASE-ADMIN] Could not read Firebase config from database:', error);
    return null;
  }
}

export async function initializeFirebaseAdmin(): Promise<admin.app.App | null> {
  if (isInitialized) return firebaseApp;

  // 1. Try environment variables first
  let projectId = process.env.FIREBASE_PROJECT_ID;
  let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  let privateKey = getPrivateKey();
  let source = 'environment variables';

  // 2. If env vars are incomplete, try MongoDB fallback
  if (!projectId || !clientEmail || !privateKey) {
    console.log('[FIREBASE-ADMIN] Env vars incomplete, trying database fallback...');
    const dbCreds = await getCredentialsFromDB();
    if (dbCreds) {
      projectId = dbCreds.projectId;
      clientEmail = dbCreds.clientEmail;
      privateKey = dbCreds.privateKey;
      source = 'database (FirebaseConfig collection)';
    }
  }

  if (!projectId || !clientEmail || !privateKey) {
    console.warn(
      '[FIREBASE-ADMIN] Missing credentials (checked env vars + database). ' +
      'FCM push notifications to Android/iOS will not work. ' +
      'Required: FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY ' +
      '— either as env vars or configured in the admin dashboard.'
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
    console.log(`[FIREBASE-ADMIN] Initialized successfully from ${source} — FCM push enabled`);
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

/**
 * Force re-initialization of Firebase Admin SDK.
 * Call this after admin updates Firebase config in the dashboard.
 */
export async function reinitializeFirebaseAdmin(): Promise<admin.app.App | null> {
  // Delete the existing app if it exists
  try {
    if (firebaseApp) {
      await admin.app().delete();
    }
  } catch {
    // App may not exist or already deleted, that's fine
  }

  // Reset state
  firebaseApp = null;
  isInitialized = false;

  // Re-initialize (will pick up new credentials from DB)
  return initializeFirebaseAdmin();
}

// ── Get Firebase Messaging instance ─────────────────────────────────

export async function getFirebaseMessaging(): Promise<admin.messaging.Messaging | null> {
  const app = await initializeFirebaseAdmin();
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
  const messaging = await getFirebaseMessaging();
  if (!messaging) return false;

  try {
    const isEmergency = payload.type === 'emergency';
    const isHighPriority = payload.priority === 'high' || payload.priority === 'urgent';

    // ── DATA-ONLY MESSAGE ──────────────────────────────────────────────
    // CRITICAL: Do NOT include a top-level `notification` field.
    // When `notification` is present alongside `data`, Android auto-displays
    // the notification using system defaults and BYPASSES
    // onMessageReceived() while the app is in the background.
    //
    // By sending data-only messages, our custom
    // AafiatakFirebaseMessagingService.onMessageReceived() is ALWAYS
    // invoked — in foreground AND background — giving us full control
    // over sound, channel, heads-up popup, and emergency full-screen.
    // ──────────────────────────────────────────────────────────────────
    const message: admin.messaging.Message = {
      token: fcmToken,
      data: {
        // Core notification fields moved into data so our service can
        // build the Android Notification manually with the correct channel.
        title: payload.title,
        body: payload.body,
        ...(payload.icon ? { icon: payload.icon } : {}),
        ...(payload.image ? { image: payload.image } : {}),
        // Custom metadata
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
        // CRITICAL: Always use 'high' priority for FCM delivery!
        // When the app is in background or killed, Android's Doze mode
        // will NOT deliver 'normal' priority data-only messages. They
        // are batched and delayed until the device wakes up naturally.
        // Only 'high' priority guarantees immediate delivery and wakes
        // the app's FirebaseMessagingService.onMessageReceived().
        // Our internal 'priority' field (low/medium/high/urgent) controls
        // the notification's visual/sound behavior, NOT the FCM delivery.
        priority: 'high',
        collapseKey: payload.tag || undefined,
        // TTL: 4 weeks — ensures messages aren't dropped if device is offline
        ttl: 2419200,
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
  const messaging = await getFirebaseMessaging();
  if (!messaging || fcmTokens.length === 0) {
    return { successCount: 0, failureCount: 0, invalidTokens: [] };
  }

  try {
    const isEmergency = payload.type === 'emergency';
    const isHighPriority = payload.priority === 'high' || payload.priority === 'urgent';

    // ── DATA-ONLY MULTICAST MESSAGE ────────────────────────────────────
    // Same rationale as sendFCMToDevice: no top-level `notification` field
    // so that Android always delivers to our custom messaging service.
    // ──────────────────────────────────────────────────────────────────
    const message: admin.messaging.MulticastMessage = {
      tokens: fcmTokens,
      data: {
        title: payload.title,
        body: payload.body,
        ...(payload.icon ? { icon: payload.icon } : {}),
        ...(payload.image ? { image: payload.image } : {}),
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
        // CRITICAL: Always use 'high' priority for FCM delivery!
        // Same rationale as sendFCMToDevice — 'normal' priority messages
        // are NOT delivered when the app is in background/killed on
        // modern Android versions (Doze mode, App Standby buckets).
        priority: 'high',
        collapseKey: payload.tag || undefined,
        ttl: 2419200, // 4 weeks
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
