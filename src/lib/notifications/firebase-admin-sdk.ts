// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Firebase Admin SDK v2
// ============================================================================
// Server-side Firebase Admin SDK for sending FCM push notifications
// to Android/iOS devices. Web browsers use Web Push (VAPID) instead.
//
// v2 Changes:
// 1. Better error messages with specific diagnostic codes
// 2. Auto-retry initialization from DB (in case env vars fail)
// 3. Comprehensive health check function
// 4. Better private key processing (handles more formats)
// 5. Force re-init capability for hot-reload
// ============================================================================

import * as admin from 'firebase-admin';
import { connectDB } from '@/lib/mongodb';
import FirebaseConfig from '@/models/mongoose/FirebaseConfig';

// ── Firebase Admin Initialization ────────────────────────────────────
let firebaseApp: admin.app.App | null = null;
let isInitialized = false;
let initError: string | null = null;
let credentialSource: string | null = null;

function processPrivateKey(raw: string): string {
  if (!raw) return raw;

  // Try base64 decode first
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    if (decoded.includes('-----BEGIN PRIVATE KEY-----')) {
      return decoded;
    }
  } catch {
    // Not base64, continue with raw value
  }

  // Try URL-safe base64 decode
  try {
    const padded = raw.replace(/-/g, '+').replace(/_/g, '/');
    const padLen = (4 - (padded.length % 4)) % 4;
    const paddedFull = padded + '='.repeat(padLen);
    const decoded = Buffer.from(paddedFull, 'base64').toString('utf-8');
    if (decoded.includes('-----BEGIN PRIVATE KEY-----')) {
      return decoded;
    }
  } catch {
    // Not URL-safe base64
  }

  // Replace escaped newlines with real newlines
  return raw.replace(/\\n/g, '\n');
}

/**
 * Try to read Firebase credentials from the MongoDB FirebaseConfig collection.
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

    if (!config.projectId || !config.clientEmail || !config.privateKey) {
      console.warn('[FIREBASE-ADMIN] Firebase config in DB is incomplete');
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
  let privateKey = process.env.FIREBASE_PRIVATE_KEY ? processPrivateKey(process.env.FIREBASE_PRIVATE_KEY) : undefined;
  credentialSource = 'environment variables';

  // 2. If env vars are incomplete, try MongoDB fallback
  if (!projectId || !clientEmail || !privateKey) {
    console.log('[FIREBASE-ADMIN] Env vars incomplete, trying database fallback...');
    const dbCreds = await getCredentialsFromDB();
    if (dbCreds) {
      projectId = dbCreds.projectId;
      clientEmail = dbCreds.clientEmail;
      privateKey = dbCreds.privateKey;
      credentialSource = 'database (FirebaseConfig collection)';
    }
  }

  if (!projectId || !clientEmail || !privateKey) {
    initError = `Missing credentials — checked env vars and database. ` +
      `Missing: ${!projectId ? 'FIREBASE_PROJECT_ID ' : ''}${!clientEmail ? 'FIREBASE_CLIENT_EMAIL ' : ''}${!privateKey ? 'FIREBASE_PRIVATE_KEY ' : ''}`;
    console.warn(`[FIREBASE-ADMIN] ${initError}`);
    isInitialized = true;
    return null;
  }

  // Validate private key format
  if (!privateKey.includes('-----BEGIN PRIVATE KEY-----')) {
    initError = 'Private key format is invalid — must contain -----BEGIN PRIVATE KEY-----';
    console.error(`[FIREBASE-ADMIN] ${initError}`);
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
      ...(process.env.FIREBASE_DATABASE_URL
        ? { databaseURL: process.env.FIREBASE_DATABASE_URL }
        : {}),
    });

    isInitialized = true;
    initError = null;
    console.log(`[FIREBASE-ADMIN] Initialized successfully from ${credentialSource} — FCM push enabled`);
    return firebaseApp;
  } catch (error: any) {
    // If already initialized, reuse existing app
    if (error?.code === 'app/duplicate-app') {
      firebaseApp = admin.app();
      isInitialized = true;
      initError = null;
      console.log('[FIREBASE-ADMIN] Reusing existing Firebase app');
      return firebaseApp;
    }

    initError = `Initialization failed: ${error?.message || error}`;
    console.error('[FIREBASE-ADMIN]', initError);
    isInitialized = true;
    return null;
  }
}

/**
 * Force re-initialization of Firebase Admin SDK.
 * Call this after admin updates Firebase config in the dashboard.
 */
export async function reinitializeFirebaseAdmin(): Promise<admin.app.App | null> {
  try {
    if (firebaseApp) {
      await admin.app().delete();
    }
  } catch {
    // App may not exist or already deleted
  }

  firebaseApp = null;
  isInitialized = false;
  initError = null;
  credentialSource = null;

  return initializeFirebaseAdmin();
}

// ── Health Check ────────────────────────────────────────────────────

export interface FirebaseHealthCheck {
  initialized: boolean;
  hasApp: boolean;
  credentialSource: string | null;
  error: string | null;
  envVarsPresent: {
    projectId: boolean;
    clientEmail: boolean;
    privateKey: boolean;
    privateKeyFormat: 'valid' | 'invalid' | 'missing';
  };
  dbConfigPresent: boolean;
}

/**
 * Comprehensive health check for Firebase Admin SDK.
 * Returns diagnostic information about the SDK state.
 */
export async function checkFirebaseHealth(): Promise<FirebaseHealthCheck> {
  const rawKey = process.env.FIREBASE_PRIVATE_KEY;
  const processedKey = rawKey ? processPrivateKey(rawKey) : undefined;

  const health: FirebaseHealthCheck = {
    initialized: isInitialized,
    hasApp: firebaseApp !== null,
    credentialSource,
    error: initError,
    envVarsPresent: {
      projectId: !!process.env.FIREBASE_PROJECT_ID,
      clientEmail: !!process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: !!rawKey,
      privateKeyFormat: !rawKey ? 'missing' :
        (processedKey?.includes('-----BEGIN PRIVATE KEY-----') ? 'valid' : 'invalid'),
    },
    dbConfigPresent: false,
  };

  // Check DB config
  try {
    await connectDB();
    const config = await FirebaseConfig.findOne({ isActive: true }).lean();
    health.dbConfigPresent = !!config;
  } catch {
    // DB not accessible
  }

  // If not initialized yet, try to initialize
  if (!isInitialized) {
    await initializeFirebaseAdmin();
    health.initialized = isInitialized;
    health.hasApp = firebaseApp !== null;
    health.error = initError;
    health.credentialSource = credentialSource;
  }

  return health;
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
  if (!messaging) {
    console.warn('[FIREBASE-ADMIN] Cannot send FCM — messaging instance is null. Check Firebase credentials.');
    return false;
  }

  try {
    const message: admin.messaging.Message = {
      token: fcmToken,
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

    console.error('[FIREBASE-ADMIN] Error sending FCM:', error?.code || error?.message || error);
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
        priority: 'high',
        collapseKey: payload.tag || undefined,
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
