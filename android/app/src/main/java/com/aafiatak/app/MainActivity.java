package com.aafiatak.app;

import android.os.Bundle;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.pm.PackageManager;
import android.Manifest;
import android.os.Build;
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

    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            // Main notifications channel
            NotificationChannel mainChannel = new NotificationChannel(
                "aafiatak_notifications",
                "إشعارات عافيتك",
                NotificationManager.IMPORTANCE_HIGH
            );
            mainChannel.setDescription("إشعارات التطبيق الرئيسية");
            mainChannel.enableLights(true);
            mainChannel.enableVibration(true);
            mainChannel.setShowBadge(true);
            mainChannel.setSound(
                android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION),
                null
            );
            manager.createNotificationChannel(mainChannel);

            // Emergency channel - highest priority
            NotificationChannel emergencyChannel = new NotificationChannel(
                "aafiatak_emergency",
                "إشعارات الطوارئ",
                NotificationManager.IMPORTANCE_HIGH
            );
            emergencyChannel.setDescription("إشعارات الطوارئ العاجلة");
            emergencyChannel.enableLights(true);
            emergencyChannel.enableVibration(true);
            emergencyChannel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
            emergencyChannel.setShowBadge(true);
            manager.createNotificationChannel(emergencyChannel);

            // Chat messages channel
            NotificationChannel chatChannel = new NotificationChannel(
                "aafiatak_chat",
                "رسائل المحادثة",
                NotificationManager.IMPORTANCE_HIGH
            );
            chatChannel.setDescription("إشعارات رسائل المحادثة");
            chatChannel.enableLights(true);
            chatChannel.enableVibration(true);
            chatChannel.setShowBadge(true);
            manager.createNotificationChannel(chatChannel);

            // Service updates channel
            NotificationChannel serviceChannel = new NotificationChannel(
                "aafiatak_services",
                "تحديثات الخدمات",
                NotificationManager.IMPORTANCE_DEFAULT
            );
            serviceChannel.setDescription("إشعارات تحديثات الخدمات والطلبات");
            serviceChannel.enableVibration(true);
            serviceChannel.setShowBadge(true);
            manager.createNotificationChannel(serviceChannel);

            Log.d(TAG, "Notification channels created successfully");
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
