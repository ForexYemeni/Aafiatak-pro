// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Capacitor Configuration
// ============================================================================

import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.aafiatak.app',
  appName: 'عافيتك',
  webDir: 'out',
  server: {
    url: 'https://aafiatak-pro.vercel.app',
    cleartext: true,
    androidScheme: 'https',
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
      iconColor: '#14b8a6',
      sound: 'default',
    },
    Camera: {
      presentationStyle: 'fullscreen',
    },
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#020711',
  },
};

export default config;
