// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Firebase Admin SDK
// ============================================================================
// Server-side Firebase Admin SDK for sending push notifications.
// Handles single token, multi-token, and topic-based notifications.
// Uses Firebase Cloud Messaging (FCM) for reliable delivery.
// ============================================================================

// ============================================================================
// Types
// ============================================================================

/** Options for sending a push notification */
export interface SendNotificationOptions {
  /** Single device FCM token */
  token?: string;
  /** Multiple device FCM tokens (max 500) */
  tokens?: string[];
  /** FCM topic to send to */
  topic?: string;
  /** Notification title (Arabic) */
  title: string;
  /** Notification body (Arabic) */
  body: string;
  /** Custom data payload */
  data?: Record<string, string>;
  /** Message priority */
  priority?: 'high' | 'normal';
  /** Notification sound */
  sound?: string;
  /** Badge number (iOS) */
  badge?: number;
}

/** Result of a multi-token notification send */
export interface MulticastResult {
  successCount: number;
  failureCount: number;
  responses: Array<{
    success: boolean;
    messageId?: string;
    error?: string;
  }>;
}

// ============================================================================
// Firebase Admin Initialization
// ============================================================================

let firebaseAdminApp: unknown = null;
let messagingInstance: unknown = null;
let initializationAttempted = false;

/**
 * Get the Firebase Admin app instance.
 * Initializes on first call with service account credentials from environment.
 * Returns null if Firebase is not configured.
 */
async function getFirebaseAdmin(): Promise<{ app: unknown; messaging: unknown } | null> {
  if (firebaseAdminApp && messagingInstance) {
    return { app: firebaseAdminApp, messaging: messagingInstance };
  }

  if (initializationAttempted) {
    return null;
  }

  initializationAttempted = true;

  try {
    // Check for required environment variables
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    const privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      console.info('[FirebaseAdmin] Firebase Admin SDK not configured. Set FIREBASE_* env vars.');
      return null;
    }

    // Dynamic import to avoid bundling on client side
    const admin = await import('firebase-admin/app');
    const adminMessaging = await import('firebase-admin/messaging');

    // Initialize the Admin SDK
    const serviceAccount = {
      projectId,
      clientEmail,
      privateKey: privateKey.replace(/\\n/g, '\n'),
    };

    firebaseAdminApp = admin.initializeApp({
      credential: admin.cert(serviceAccount),
      projectId,
    });

    messagingInstance = adminMessaging.getMessaging(firebaseAdminApp);

    console.info('[FirebaseAdmin] Firebase Admin SDK initialized successfully');
    return { app: firebaseAdminApp, messaging: messagingInstance };
  } catch (error) {
    console.warn('[FirebaseAdmin] Failed to initialize Firebase Admin SDK:', error);
    return null;
  }
}

// ============================================================================
// Send Push Notification
// ============================================================================

/**
 * Send a push notification via Firebase Cloud Messaging.
 *
 * Supports three modes:
 * 1. Single token: Provide `token`
 * 2. Multiple tokens: Provide `tokens` (max 500)
 * 3. Topic-based: Provide `topic`
 *
 * @param options - Notification options including target, title, body, and data
 * @throws Error if no target is specified or Firebase is not configured
 */
export async function sendPushNotification(options: SendNotificationOptions): Promise<void> {
  const { token, tokens, topic, title, body, data, priority, sound, badge } = options;

  // Validate that at least one target is specified
  if (!token && !tokens && !topic) {
    throw new Error('يجب تحديد هدف واحد على الأقل: token أو tokens أو topic');
  }

  // Validate multi-token limit
  if (tokens && tokens.length > 500) {
    throw new Error('الحد الأقصى لعدد الرموز هو 500 لكل طلب');
  }

  const adminInstance = await getFirebaseAdmin();
  if (!adminInstance) {
    console.warn('[FirebaseAdmin] Cannot send notification: Firebase not configured');
    return;
  }

  const { messaging } = adminInstance;

  try {
    // Import messaging types dynamically
    const adminMessaging = await import('firebase-admin/messaging');

    // ---- Single Token ----
    if (token) {
      const message: adminMessaging.Message = {
        token,
        notification: {
          title,
          body,
        },
        data: data ?? {},
        android: {
          priority: priority === 'high' ? 'high' : 'normal',
          notification: {
            sound: sound ?? 'default',
            channelId: 'default',
            clickAction: data?.clickAction ?? 'OPEN_APP',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: sound ?? 'default',
              badge: badge ?? 1,
              contentAvailable: true,
            },
          },
        },
      };

      await adminMessaging.sendMessaging(messaging, message);
      console.info(`[FirebaseAdmin] Notification sent to token: ${token.substring(0, 10)}...`);
      return;
    }

    // ---- Multiple Tokens (Multicast) ----
    if (tokens && tokens.length > 0) {
      const message: adminMessaging.MulticastMessage = {
        tokens,
        notification: {
          title,
          body,
        },
        data: data ?? {},
        android: {
          priority: priority === 'high' ? 'high' : 'normal',
          notification: {
            sound: sound ?? 'default',
            channelId: 'default',
            clickAction: data?.clickAction ?? 'OPEN_APP',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: sound ?? 'default',
              badge: badge ?? 1,
              contentAvailable: true,
            },
          },
        },
      };

      const response = await adminMessaging.sendMulticast(messaging, message);
      console.info(
        `[FirebaseAdmin] Multicast sent: ${response.successCount} success, ${response.failureCount} failure`
      );
      return;
    }

    // ---- Topic ----
    if (topic) {
      const message: adminMessaging.Message = {
        topic,
        notification: {
          title,
          body,
        },
        data: data ?? {},
        android: {
          priority: priority === 'high' ? 'high' : 'normal',
          notification: {
            sound: sound ?? 'default',
            channelId: 'default',
            clickAction: data?.clickAction ?? 'OPEN_APP',
          },
        },
        apns: {
          payload: {
            aps: {
              sound: sound ?? 'default',
              badge: badge ?? 1,
              contentAvailable: true,
            },
          },
        },
      };

      await adminMessaging.sendMessaging(messaging, message);
      console.info(`[FirebaseAdmin] Notification sent to topic: ${topic}`);
    }
  } catch (error) {
    console.error('[FirebaseAdmin] Failed to send notification:', error);
    throw new Error('فشل إرسال الإشعار. يرجى المحاولة مرة أخرى');
  }
}

// ============================================================================
// Topic Subscription
// ============================================================================

/**
 * Subscribe device tokens to an FCM topic.
 * Useful for role-based or category-based notification groups.
 * @param tokens - Array of FCM tokens to subscribe
 * @param topic - The topic to subscribe to
 */
export async function subscribeToTopic(tokens: string[], topic: string): Promise<void> {
  const adminInstance = await getFirebaseAdmin();
  if (!adminInstance) return;

  try {
    const adminMessaging = await import('firebase-admin/messaging');
    await adminMessaging.subscribeToTopic(messagingInstance, tokens, topic);
    console.info(`[FirebaseAdmin] Subscribed ${tokens.length} tokens to topic: ${topic}`);
  } catch (error) {
    console.error('[FirebaseAdmin] Failed to subscribe to topic:', error);
  }
}

/**
 * Unsubscribe device tokens from an FCM topic.
 * @param tokens - Array of FCM tokens to unsubscribe
 * @param topic - The topic to unsubscribe from
 */
export async function unsubscribeFromTopic(tokens: string[], topic: string): Promise<void> {
  const adminInstance = await getFirebaseAdmin();
  if (!adminInstance) return;

  try {
    const adminMessaging = await import('firebase-admin/messaging');
    await adminMessaging.unsubscribeFromTopic(messagingInstance, tokens, topic);
    console.info(`[FirebaseAdmin] Unsubscribed ${tokens.length} tokens from topic: ${topic}`);
  } catch (error) {
    console.error('[FirebaseAdmin] Failed to unsubscribe from topic:', error);
  }
}
