---
Task ID: 1
Agent: Main Agent
Task: Fix notification sounds - make them work 100% even when user is outside the app

Work Log:
- Analyzed existing notification system (SoundManager, NotificationManager, firebase-client, push-service, SW)
- Found root causes: no actual MP3 files, AudioContext requires user interaction, SW doesn't message windows on push
- Generated 5 real MP3 sound files using Python + ffmpeg (notification, emergency, chat, success, error)
- Rewrote SoundManager to use HTML5 Audio elements (most reliable) with oscillator fallback
- Modified Service Worker to send PUSH_NOTIFICATION_RECEIVED message to all open windows on push
- Rewrote PWA Provider to listen for SW messages and play sound immediately
- Created /admin/test-notifications page for testing sounds and push notifications
- Created /api/notifications/test-push endpoint for sending test push notifications
- Simplified NotificationManager for reliable sound playback
- Fixed notification-store to not depend on removed requestPermission method
- Added sound playback in NotificationBell when new notifications arrive
- Build passes successfully
- Pushed to GitHub

Stage Summary:
- Real MP3 sound files now exist in /public/sounds/
- Sound system works via HTML5 Audio elements (primary) + Web Audio API oscillator (fallback)
- Service Worker communicates push events to open windows for foreground sound playback
- Browser notifications use silent: false for OS default notification sound when app is in background
- VAPID keys are configured in .env but need to be set in Vercel environment variables
- Test page at /admin/test-notifications allows testing all sounds and push notifications
