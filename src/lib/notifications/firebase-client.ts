// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Firebase Client
// ============================================================================
// Firebase client SDK setup for FCM (Firebase Cloud Messaging).
// Handles initialization, token management, and foreground/background messages.
// Uses environment variables for Firebase configuration.
// ============================================================================

// Note: Firebase SDK is imported dynamically to avoid SSR issues and
// to keep the bundle size small when FCM is not configured.

/** Firebase app type (dynamic import) */
type FirebaseAppType = import('firebase/app').FirebaseApp;

/** Firebase messaging type (dynamic import) */
type MessagingType = import('firebase/messaging').Messaging;

/** Firebase message payload type */
type MessagePayloadType = import('firebase/messaging').MessagePayload;

/** Firebase configuration from environment variables */
interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  measurementId?: string;
}

/** Callback type for foreground messages */
type MessageCallback = (payload: MessagePayloadType) => void;

// ============================================================================
// FirebaseClient Class
// ============================================================================

class FirebaseClient {
  private app: FirebaseAppType | null = null;
  private messaging: MessagingType | null = null;
  private initialized = false;
  private messageCallbacks: Set<MessageCallback> = new Set();

  // ---- Initialization ----

  /** Initialize Firebase app and messaging */
  async init(): Promise<void> {
    if (this.initialized) return;
    if (typeof window === 'undefined') return;

    const config = this.getFirebaseConfig();
    if (!config) {
      console.info('[FirebaseClient] Firebase not configured. Set NEXT_PUBLIC_FIREBASE_* env vars.');
      return;
    }

    try {
      // Dynamic import to avoid SSR issues
      const firebaseApp = await import('firebase/app');
      const firebaseMessaging = await import('firebase/messaging');

      // Initialize Firebase app (prevent duplicate initialization)
      const existingApps = firebaseApp.getApps();
      if (existingApps.length > 0) {
        this.app = existingApps[0] ?? null;
      } else {
        this.app = firebaseApp.initializeApp(config);
      }

      // Initialize messaging
      this.messaging = firebaseMessaging.getMessaging(this.app);

      // Set up foreground message listener
      firebaseMessaging.onMessage(this.messaging, (payload: MessagePayloadType) => {
        this.handleForegroundMessage(payload);
      });

      this.initialized = true;
    } catch (error) {
      console.warn('[FirebaseClient] Failed to initialize Firebase:', error);
    }
  }

  /** Read Firebase configuration from environment variables */
  private getFirebaseConfig(): FirebaseConfig | null {
    if (typeof window === 'undefined') return null;

    const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? '';
    const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? '';
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? '';
    const storageBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? '';
    const messagingSenderId = process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? '';
    const appId = process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? '';

    // Check if at least the required fields are present
    if (!apiKey || !projectId || !messagingSenderId || !appId) {
      return null;
    }

    return {
      apiKey,
      authDomain,
      projectId,
      storageBucket,
      messagingSenderId,
      appId,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? undefined,
    };
  }

  // ---- Token Management ----

  /** Request notification permission and get FCM token */
  async getToken(): Promise<string | null> {
    if (!this.messaging) {
      console.warn('[FirebaseClient] Messaging not initialized');
      return null;
    }

    try {
      const firebaseMessaging = await import('firebase/messaging');

      // Request permission first
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        console.info('[FirebaseClient] Notification permission not granted');
        return null;
      }

      // Get VAPID key from env
      const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY ?? '';

      const tokenOptions: { vapidKey?: string } = {};
      if (vapidKey) {
        tokenOptions.vapidKey = vapidKey;
      }

      const token = await firebaseMessaging.getToken(this.messaging, tokenOptions);
      return token;
    } catch (error) {
      console.warn('[FirebaseClient] Failed to get FCM token:', error);
      return null;
    }
  }

  // ---- Foreground Message Handling ----

  /** Register a callback for foreground messages */
  onMessage(callback: MessageCallback): () => void {
    this.messageCallbacks.add(callback);
    return () => {
      this.messageCallbacks.delete(callback);
    };
  }

  /** Handle an incoming foreground message */
  private handleForegroundMessage(payload: MessagePayloadType): void {
    // Notify all registered callbacks
    for (const callback of this.messageCallbacks) {
      try {
        callback(payload);
      } catch (error) {
        console.error('[FirebaseClient] Message callback error:', error);
      }
    }

    // Also show a browser notification if the app is in the foreground
    if (payload.notification) {
      const title = payload.notification.title ?? 'إشعار جديد';
      const body = payload.notification.body ?? '';
      const icon = payload.notification.icon ?? '/logo.svg';

      if ('Notification' in window && Notification.permission === 'granted') {
        const notification = new Notification(title, {
          body,
          icon,
          badge: '/logo.svg',
          dir: 'rtl',
          lang: 'ar',
          data: payload.data ?? {},
        });

        notification.onclick = () => {
          window.focus();
          notification.close();

          // Navigate to the appropriate page
          const clickAction = payload.data?.clickAction;
          if (clickAction && typeof clickAction === 'string') {
            window.location.href = clickAction;
          }
        };
      }
    }
  }

  // ---- Status ----

  /** Check if Firebase is initialized */
  isInitialized(): boolean {
    return this.initialized;
  }

  /** Check if Firebase is configured */
  isConfigured(): boolean {
    return this.getFirebaseConfig() !== null;
  }

  /** Get the Firebase app instance */
  getApp(): FirebaseAppType | null {
    return this.app;
  }

  /** Get the Messaging instance */
  getMessaging(): MessagingType | null {
    return this.messaging;
  }

  // ---- Cleanup ----

  /** Clean up resources */
  destroy(): void {
    this.messageCallbacks.clear();
    this.messaging = null;
    this.app = null;
    this.initialized = false;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/** Global FirebaseClient instance for FCM integration */
export const firebaseClient = new FirebaseClient();

export default firebaseClient;
