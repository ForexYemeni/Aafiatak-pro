package com.aafiatak.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.Manifest;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "AafiatakApp";

    // Must match the channel IDs in AafiatakFirebaseMessagingService (v3)
    private static final String CHANNEL_ID = "aafiatak_notifications_v3";
    private static final String EMERGENCY_CHANNEL_ID = "aafiatak_emergency_v3";
    private static final String CHAT_CHANNEL_ID = "aafiatak_chat_v3";
    private static final String SERVICE_CHANNEL_ID = "aafiatak_services_v3";

    // Old channel IDs to delete
    private static final String OLD_CHANNEL_ID_V1 = "aafiatak_notifications";
    private static final String OLD_EMERGENCY_CHANNEL_ID_V1 = "aafiatak_emergency";
    private static final String OLD_CHAT_CHANNEL_ID_V1 = "aafiatak_chat";
    private static final String OLD_SERVICE_CHANNEL_ID_V1 = "aafiatak_services";
    private static final String OLD_CHANNEL_ID_V2 = "aafiatak_notifications_v2";
    private static final String OLD_EMERGENCY_CHANNEL_ID_V2 = "aafiatak_emergency_v2";
    private static final String OLD_CHAT_CHANNEL_ID_V2 = "aafiatak_chat_v2";
    private static final String OLD_SERVICE_CHANNEL_ID_V2 = "aafiatak_services_v2";

    private static final int REQUEST_NOTIFICATION_PERMISSION = 1001;
    private static final int REQUEST_FULL_SCREEN_INTENT_PERMISSION = 1002;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
        requestNotificationPermission();
        requestFullScreenIntentPermission();
    }

    /**
     * Create notification channels on app start.
     * Deletes ALL old channels first to ensure IMPORTANCE_HIGH is actually applied.
     * Android caches channel settings and ignores code changes to existing channels.
     */
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            // Delete ALL old channels to force Android to use new settings
            try {
                // Delete v1 channels
                manager.deleteNotificationChannel(OLD_CHANNEL_ID_V1);
                manager.deleteNotificationChannel(OLD_EMERGENCY_CHANNEL_ID_V1);
                manager.deleteNotificationChannel(OLD_CHAT_CHANNEL_ID_V1);
                manager.deleteNotificationChannel(OLD_SERVICE_CHANNEL_ID_V1);
                // Delete v2 channels
                manager.deleteNotificationChannel(OLD_CHANNEL_ID_V2);
                manager.deleteNotificationChannel(OLD_EMERGENCY_CHANNEL_ID_V2);
                manager.deleteNotificationChannel(OLD_CHAT_CHANNEL_ID_V2);
                manager.deleteNotificationChannel(OLD_SERVICE_CHANNEL_ID_V2);
                Log.d(TAG, "Deleted all old notification channels (v1+v2)");
            } catch (Exception e) {
                // Channels may not exist yet
            }

            android.media.AudioAttributes audioAttributes = new android.media.AudioAttributes.Builder()
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build();

            android.net.Uri soundUri;
            try {
                int resId = getResources().getIdentifier("notification_sound", "raw", getPackageName());
                if (resId != 0) {
                    soundUri = android.net.Uri.parse("android.resource://" + getPackageName() + "/" + resId);
                } else {
                    soundUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION);
                }
            } catch (Exception e) {
                soundUri = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION);
            }

            // Main notifications channel - IMPORTANCE_HIGH = sound + popup + lockscreen
            NotificationChannel mainChannel = new NotificationChannel(
                CHANNEL_ID,
                "إشعارات عافيتك",
                NotificationManager.IMPORTANCE_HIGH
            );
            mainChannel.setDescription("إشعارات التطبيق — صوت وتنبيه منبثق");
            mainChannel.enableLights(true);
            mainChannel.setLightColor(0xFF14b8a6);
            mainChannel.enableVibration(true);
            mainChannel.setVibrationPattern(new long[]{0, 300, 200, 300});
            mainChannel.setSound(soundUri, audioAttributes);
            mainChannel.setShowBadge(true);
            mainChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            manager.createNotificationChannel(mainChannel);

            // Emergency channel - IMPORTANCE_HIGH + bypass DND
            NotificationChannel emergencyChannel = new NotificationChannel(
                EMERGENCY_CHANNEL_ID,
                "إشعارات الطوارئ",
                NotificationManager.IMPORTANCE_HIGH
            );
            emergencyChannel.setDescription("إشعارات الطوارئ العاجلة");
            emergencyChannel.enableLights(true);
            emergencyChannel.setLightColor(0xFFFF0000);
            emergencyChannel.enableVibration(true);
            emergencyChannel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
            emergencyChannel.setSound(soundUri, audioAttributes);
            emergencyChannel.setShowBadge(true);
            emergencyChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            try {
                if (Build.VERSION.SDK_INT >= 28) {
                    emergencyChannel.setBypassDnd(true);
                }
            } catch (NoSuchMethodError ignored) {}
            manager.createNotificationChannel(emergencyChannel);

            // Chat channel - IMPORTANCE_HIGH
            NotificationChannel chatChannel = new NotificationChannel(
                CHAT_CHANNEL_ID,
                "رسائل المحادثة",
                NotificationManager.IMPORTANCE_HIGH
            );
            chatChannel.setDescription("إشعارات رسائل المحادثة");
            chatChannel.enableLights(true);
            chatChannel.setLightColor(0xFF14b8a6);
            chatChannel.enableVibration(true);
            chatChannel.setVibrationPattern(new long[]{0, 200, 100, 200});
            chatChannel.setSound(soundUri, audioAttributes);
            chatChannel.setShowBadge(true);
            chatChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            manager.createNotificationChannel(chatChannel);

            // Service channel - IMPORTANCE_HIGH too
            NotificationChannel serviceChannel = new NotificationChannel(
                SERVICE_CHANNEL_ID,
                "تحديثات الخدمات",
                NotificationManager.IMPORTANCE_HIGH
            );
            serviceChannel.setDescription("إشعارات تحديثات الخدمات");
            serviceChannel.enableVibration(true);
            serviceChannel.setSound(soundUri, audioAttributes);
            serviceChannel.setShowBadge(true);
            serviceChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            manager.createNotificationChannel(serviceChannel);

            Log.d(TAG, "Notification channels created v3 with IMPORTANCE_HIGH");
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_NOTIFICATION_PERMISSION);
            }
        }
    }

    /**
     * Request USE_FULL_SCREEN_INTENT permission on Android 14+ (API 34+).
     * This permission is required for setFullScreenIntent() to work,
     * which shows the heads-up notification popup when the app is in
     * background or killed.
     *
     * On Android 14+, this is a special permission that the user must
     * grant through the system settings. We check if it's already granted
     * and if not, direct the user to the settings page.
     */
    private void requestFullScreenIntentPermission() {
        if (Build.VERSION.SDK_INT >= 34) { // Android 14 (API 34)
            try {
                // Check if the permission is already granted
                if (checkSelfPermission(Manifest.permission.USE_FULL_SCREEN_INTENT) != PackageManager.PERMISSION_GRANTED) {
                    Log.w(TAG, "USE_FULL_SCREEN_INTENT permission not granted - requesting");
                    // On Android 14+, this permission requires user action in settings
                    // We request it and show a toast explaining why
                    requestPermissions(
                        new String[]{Manifest.permission.USE_FULL_SCREEN_INTENT},
                        REQUEST_FULL_SCREEN_INTENT_PERMISSION
                    );
                } else {
                    Log.d(TAG, "USE_FULL_SCREEN_INTENT permission already granted");
                }
            } catch (Exception e) {
                Log.w(TAG, "Could not request USE_FULL_SCREEN_INTENT: " + e.getMessage());
            }
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] grantResults) {
        super.onRequestPermissionsResult(requestCode, permissions, grantResults);
        if (requestCode == REQUEST_NOTIFICATION_PERMISSION) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "POST_NOTIFICATIONS permission granted");
            } else {
                Log.w(TAG, "POST_NOTIFICATIONS permission denied - notifications won't work");
                Toast.makeText(this, "يجب السماح بالإشعارات لتلقي تنبيهات عافيتك", Toast.LENGTH_LONG).show();
            }
        }
        if (requestCode == REQUEST_FULL_SCREEN_INTENT_PERMISSION) {
            if (grantResults.length > 0 && grantResults[0] == PackageManager.PERMISSION_GRANTED) {
                Log.d(TAG, "USE_FULL_SCREEN_INTENT permission granted");
            } else {
                Log.w(TAG, "USE_FULL_SCREEN_INTENT permission denied - heads-up may not work");
                Toast.makeText(this, "لتلقي تنبيهات منبثقة، يرجى السماح بالعرض فوق التطبيقات من الإعدادات", Toast.LENGTH_LONG).show();
            }
        }
    }
}
