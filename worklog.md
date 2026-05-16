---
Task ID: 1
Agent: Main Agent
Task: Add Firebase configuration section to admin settings + fix FCM push notifications

Work Log:
- Cloned Aafiatak-pro repo from GitHub
- Analyzed entire codebase structure for notification system
- Found Firebase config API exists at /api/admin/firebase-config but no UI in admin settings
- Added Firebase & Push Notifications section to /src/app/admin/settings/page.tsx
  - Added Flame icon import
  - Added Firebase state variables (firebaseConfig, firebaseForm, etc.)
  - Added useEffect to fetch Firebase config when section is opened
  - Added handleSaveFirebaseConfig, handleTestFirebasePush, handleDeleteFirebaseConfig handlers
  - Added "firebase" section to sections array
  - Added comprehensive Firebase section JSX with status banners, form fields, action buttons, test results
- Fixed /api/admin/firebase-config/route.ts POST handler
  - Now supports updates without requiring privateKey (keeps existing key)
  - Added existingConfig check before validation
- Enhanced /api/notifications/test-push/route.ts
  - Added admin authentication requirement
  - Checks Firebase Admin SDK initialization
  - Shows FCM token counts and sends test to first Android device
  - Provides helpful hints when no devices registered
- Added FirebaseConfig seeding to /api/seed/route.ts
  - Auto-configures from FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY env vars
- Committed and pushed to GitHub (commit 9982356)

Stage Summary:
- Firebase config section now visible in admin settings under "Firebase والإشعارات"
- Admin can enter Service Account credentials directly from dashboard
- Test push notification feature available
- Backend supports updating config without changing private key
- Firebase auto-seeds from environment variables on first seed

---
Task ID: 2
Agent: Main Agent
Task: Fix background/killed notification delivery - FCM high priority + full-screen intent

Work Log:
- Diagnosed root cause: FCM android.priority was 'normal' for non-high-priority messages
- Android Doze mode does NOT deliver 'normal' priority data-only messages in background/killed
- Only 'high' priority FCM messages are guaranteed to wake the device and trigger onMessageReceived()
- Fixed server-side (firebase-admin-sdk.ts):
  - Changed ALL FCM messages to use android.priority='high' (was conditional before)
  - Added ttl=2419200 (4 weeks) to prevent message expiration when device is offline
- Fixed Android side:
  - Added USE_FULL_SCREEN_INTENT permission (required for Android 14+ heads-up popup)
  - Bumped notification channel IDs to v3 (forces Android to re-read channel settings)
  - Set setFullScreenIntent() on ALL notifications (not just emergency) for heads-up popup
  - Service resets channelsCreated flag on each message (handles killed process state)
  - Added requestFullScreenIntentPermission() in MainActivity for Android 14+
  - Enhanced logging throughout the service for debugging
- Pushed to GitHub (commit a531761)
- Triggered Vercel production deployment
- Built new APK and uploaded to tmpfiles.org

Stage Summary:
- FCM messages now use high priority for ALL notifications (critical fix)
- USE_FULL_SCREEN_INTENT permission added for Android 14+ popup support
- Notification channels upgraded to v3 with forced recreation
- APK built: /home/z/my-project/download/aafiatak-v3-fix.apk
- Download link: https://tmpfiles.org/dl/wOwJegg5Uqq2/aafiatak-v3-fix.apk
- Also available: https://gofile.io/d/QVjYec
