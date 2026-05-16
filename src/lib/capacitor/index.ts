// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Capacitor Plugin Index
// ============================================================================
// Central export and initialization for all Capacitor plugin wrappers.
// All plugins gracefully degrade when running in a web browser (non-native).
// ============================================================================

export { isNative, initCapacitor } from './core';
export {
  registerPushNotifications,
  getPushToken,
  onNotificationReceived,
  onNotificationClicked,
  requestNotificationPermissions,
  syncFCMTokenWithServer,
} from './notifications';
export {
  getCurrentPosition,
  watchPosition,
  clearWatch,
  requestLocationPermissions,
  startBackgroundTracking,
  stopBackgroundTracking,
} from './geolocation';
export {
  hapticLight,
  hapticMedium,
  hapticHeavy,
  hapticNotification,
  vibrate,
} from './haptics';
export {
  setStatusBarColor,
  setStatusBarStyle,
  setStatusBarVisible,
} from './status-bar';
