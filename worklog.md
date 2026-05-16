---
Task ID: 1
Agent: Main Agent
Task: Fix APK push notifications - no popup notifications, no sound, only vibration when app is open

Work Log:
- Analyzed the entire notification system architecture
- Identified ROOT CAUSE: Server sends notifications via Web Push (VAPID) only, NOT via Firebase Cloud Messaging (FCM). The native Android FCM service never receives any messages.
- Installed firebase-admin npm package
- Created Firebase Admin SDK initialization file (src/lib/notifications/firebase-admin-sdk.ts)
- Updated FCMToken model to support both Web Push subscriptions AND FCM device tokens
- Updated push-service.ts with dual delivery: Web Push (VAPID) for browsers + FCM for Android/iOS
- Updated register-token API to properly store FCM device tokens
- Updated Capacitor notifications.ts to register FCM token with server after receiving it
- Added CapacitorNativeInitializer component to PWA provider for auto FCM registration
- Fixed AndroidManifest.xml: removed conflicting Capacitor PushNotificationsService
- Fixed AafiatakFirebaseMessagingService.java: proper notification channels with sound/vibration, 3 channels (default, emergency, chat)
- Fixed next.config.ts security headers: frame-ancestors allows Vercel URL for WebView
- Added firebase-admin to serverExternalPackages
- Built APK successfully and uploaded to GitHub releases v4.0

Stage Summary:
- APK: https://github.com/ForexYemeni/Aafiatak-pro/releases/download/v4.0/aafiatak-v4.0.apk
- User needs to set FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY environment variables on Vercel
- The dual notification system is now in place: Web Push for browsers, FCM for Android devices
- 3 notification channels created: aafiatak_notifications (default), aafiatak_emergency, aafiatak_chat
- All changes pushed to GitHub main branch
