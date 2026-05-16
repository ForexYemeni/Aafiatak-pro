package com.aafiatak.app;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.Manifest;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "AafiatakApp";

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        createNotificationChannels();
        requestNotificationPermission();
    }

    /**
     * Create notification channels on app start.
     * These must match the channels used in AafiatakFirebaseMessagingService.
     * 
     * IMPORTANT: Using IMPORTANCE_HIGH ensures:
     * - Notification sound plays
     * - Heads-up notification (popup banner) appears
     * - Notification shows on lock screen
     */
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            android.media.AudioAttributes audioAttributes = new android.media.AudioAttributes.Builder()
                    .setContentType(android.media.AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(android.media.AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build();

            // Custom sound URI
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

            // ═══════════════════════════════════════════════════════
            // Main notifications channel - IMPORTANCE_HIGH for sound + popup
            // ═══════════════════════════════════════════════════════
            NotificationChannel mainChannel = new NotificationChannel(
                "aafiatak_notifications",
                "إشعارات عافيتك",
                NotificationManager.IMPORTANCE_HIGH  // HIGH = sound + popup + lockscreen
            );
            mainChannel.setDescription("إشعارات التطبيق الرئيسية");
            mainChannel.enableLights(true);
            mainChannel.setLightColor(0xFF14b8a6);
            mainChannel.enableVibration(true);
            mainChannel.setVibrationPattern(new long[]{0, 300, 200, 300});
            mainChannel.setSound(soundUri, audioAttributes);
            mainChannel.setShowBadge(true);
            mainChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
            manager.createNotificationChannel(mainChannel);

            // ═══════════════════════════════════════════════════════
            // Emergency channel - IMPORTANCE_HIGH + bypass DND
            // ═══════════════════════════════════════════════════════
            NotificationChannel emergencyChannel = new NotificationChannel(
                "aafiatak_emergency",
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

            // ═══════════════════════════════════════════════════════
            // Chat messages channel - IMPORTANCE_HIGH for sound + popup
            // ═══════════════════════════════════════════════════════
            NotificationChannel chatChannel = new NotificationChannel(
                "aafiatak_chat",
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

            // ═══════════════════════════════════════════════════════
            // Service updates channel - IMPORTANCE_DEFAULT (quieter)
            // ═══════════════════════════════════════════════════════
            NotificationChannel serviceChannel = new NotificationChannel(
                "aafiatak_services",
                "تحديثات الخدمات",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            serviceChannel.setDescription("إشعارات تحديثات الخدمات والطلبات");
            serviceChannel.enableVibration(true);
            serviceChannel.setShowBadge(true);
            manager.createNotificationChannel(serviceChannel);

            Log.d(TAG, "✅ Notification channels created with HIGH importance (sound + popup)");
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, 1001);
            }
        }
    }
}
