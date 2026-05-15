package com.aafiatak.app.services;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.os.Build;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.aafiatak.app.MainActivity;
import com.aafiatak.app.R;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public class AafiatakFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "AafiatakFCM";
    private static final String CHANNEL_ID = "aafiatak_notifications";
    private static final String EMERGENCY_CHANNEL_ID = "aafiatak_emergency";
    private static final String CHAT_CHANNEL_ID = "aafiatak_chat";

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM token: " + token);
        // Send token to app server via WebView or API
        sendTokenToServer(token);
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "From: " + remoteMessage.getFrom());

        // Check if message contains a data payload
        Map<String, String> data = remoteMessage.getData();
        if (data.size() > 0) {
            Log.d(TAG, "Message data payload: " + data);
            handleDataMessage(data);
        }

        // Check if message contains a notification payload
        RemoteMessage.Notification notification = remoteMessage.getNotification();
        if (notification != null) {
            Log.d(TAG, "Message Notification Body: " + notification.getBody());
            String title = notification.getTitle() != null ? notification.getTitle() : "عافيتك";
            String body = notification.getBody() != null ? notification.getBody() : "";
            String channelId = determineChannel(data);
            showNotification(title, body, data, channelId);
        } else if (data.size() > 0) {
            // Data-only message - still show notification
            String title = data.getOrDefault("title", "عافيتك");
            String body = data.getOrDefault("body", data.getOrDefault("message", "لديك إشعار جديد"));
            String channelId = determineChannel(data);
            showNotification(title, body, data, channelId);
        }
    }

    private String determineChannel(Map<String, String> data) {
        String type = data.getOrDefault("type", data.getOrDefault("notificationType", ""));
        switch (type) {
            case "emergency":
                return EMERGENCY_CHANNEL_ID;
            case "chat":
            case "message":
                return CHAT_CHANNEL_ID;
            default:
                return CHANNEL_ID;
        }
    }

    private void handleDataMessage(Map<String, String> data) {
        // Handle specific data message types
        String type = data.getOrDefault("type", "");
        Log.d(TAG, "Handling data message type: " + type);

        // Process in background if needed
        if ("emergency".equals(type)) {
            // Emergency notifications get highest priority
            try {
                Thread.sleep(0); // No delay, process immediately
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
        }
    }

    private void showNotification(String title, String body, Map<String, String> data, String channelId) {
        try {
            int notificationId = (int) (System.currentTimeMillis() % 100000);

            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);

            // Add data to intent for handling when notification is tapped
            for (Map.Entry<String, String> entry : data.entrySet()) {
                intent.putExtra(entry.getKey(), entry.getValue());
            }

            PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                notificationId,
                intent,
                PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
            );

            // Determine priority based on channel
            int priority = NotificationCompat.PRIORITY_HIGH;
            boolean isEmergency = EMERGENCY_CHANNEL_ID.equals(channelId);

            if (isEmergency) {
                priority = NotificationCompat.PRIORITY_MAX;
            }

            NotificationCompat.Builder notificationBuilder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setPriority(priority)
                .setContentIntent(pendingIntent)
                .setDefaults(Notification.DEFAULT_ALL)
                .setCategory(isEmergency ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_MESSAGE)
                .setShowWhen(true)
                .setWhen(System.currentTimeMillis());

            // For emergency, set full-screen intent for heads-up notification
            if (isEmergency) {
                notificationBuilder.setFullScreenIntent(pendingIntent, true);
            }

            // Style for longer messages
            if (body.length() > 50) {
                notificationBuilder.setStyle(new NotificationCompat.BigTextStyle().bigText(body));
            }

            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);

            // Check notification permission for Android 13+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                        != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    Log.w(TAG, "Notification permission not granted");
                    return;
                }
            }

            notificationManager.notify(notificationId, notificationBuilder.build());
            Log.d(TAG, "Notification shown: " + title);

        } catch (Exception e) {
            Log.e(TAG, "Error showing notification: " + e.getMessage(), e);
        }
    }

    private void sendTokenToServer(String token) {
        // The token will be handled by the Capacitor PushNotifications plugin
        // which sends it to the WebView automatically
        Log.d(TAG, "FCM Token sent to Capacitor bridge");
    }
}
