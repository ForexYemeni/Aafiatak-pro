// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Capacitor Configuration
// ============================================================================
// Configuration for building native iOS/Android apps using Capacitor.
// Supports push notifications, geolocation, local notifications, and more.
// ============================================================================

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aafiatak.app',
  appName: 'عافيتك',
  webDir: 'out', // Next.js static export directory
  server: {
    url: process.env.CAPACITOR_SERVER_URL || undefined,
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    Geolocation: {
      permissions: ['location', 'coarseLocation'],
    },
    LocalNotifications: {
      smallIcon: 'ic_stat_icon_config_sample',
      iconColor: '#9333ea',
      sound: 'default',
    },
  },
};

export default config;
