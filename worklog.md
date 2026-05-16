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
