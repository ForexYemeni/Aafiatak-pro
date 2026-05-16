package com.aafiatak.app.services;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
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

    private boolean channelsCreated = false;

    @Override
    public void onCreate() {
        super.onCreate();
        // Create notification channels on service creation
        createNotificationChannels();
    }

    /**
     * Create notification channels for Android 8.0+ (API 26+).
     * This MUST be called before posting any notification.
     */
    private void createNotificationChannels() {
        if (channelsCreated) return;
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            channelsCreated = true;
            return;
        }

        NotificationManager notificationManager =
                (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (notificationManager == null) {
            channelsCreated = true;
            return;
        }

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION)
                .build();

        // Try custom sound, fallback to default
        Uri notificationSoundUri;
        try {
            notificationSoundUri = Uri.parse("android.resource://" + getPackageName() + "/" + R.raw.notification_sound);
        } catch (Exception e) {
            notificationSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }

        // Default notifications channel
        NotificationChannel defaultChannel = new NotificationChannel(
                CHANNEL_ID,
                "إشعارات عافيتك",
                NotificationManager.IMPORTANCE_HIGH
        );
        defaultChannel.setDescription("إشعارات التطبيق العامة");
        defaultChannel.enableLights(true);
        defaultChannel.setLightColor(0xFF14b8a6);
        defaultChannel.enableVibration(true);
        defaultChannel.setVibrationPattern(new long[]{0, 300, 200, 300});
        defaultChannel.setSound(notificationSoundUri, audioAttributes);
        defaultChannel.setShowBadge(true);
        defaultChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        notificationManager.createNotificationChannel(defaultChannel);

        // Emergency channel - highest priority
        NotificationChannel emergencyChannel = new NotificationChannel(
                EMERGENCY_CHANNEL_ID,
                "إشعارات الطوارئ",
                NotificationManager.IMPORTANCE_HIGH
        );
        emergencyChannel.setDescription("إشعارات حالات الطوارئ - أولوية قصوى");
        emergencyChannel.enableLights(true);
        emergencyChannel.setLightColor(0xFFFF0000);
        emergencyChannel.enableVibration(true);
        emergencyChannel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
        emergencyChannel.setSound(notificationSoundUri, audioAttributes);
        emergencyChannel.setShowBadge(true);
        // Bypass DND for emergency notifications (API 28+)
        try {
            if (Build.VERSION.SDK_INT >= 28) {
                emergencyChannel.setBypassDnd(true);
            }
        } catch (NoSuchMethodError ignored) {}
        emergencyChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        notificationManager.createNotificationChannel(emergencyChannel);

        // Chat channel
        NotificationChannel chatChannel = new NotificationChannel(
                CHAT_CHANNEL_ID,
                "رسائل المحادثة",
                NotificationManager.IMPORTANCE_HIGH
        );
        chatChannel.setDescription("إشعارات الرسائل والمحادثات");
        chatChannel.enableLights(true);
        chatChannel.setLightColor(0xFF14b8a6);
        chatChannel.enableVibration(true);
        chatChannel.setVibrationPattern(new long[]{0, 200, 100, 200});
        chatChannel.setSound(notificationSoundUri, audioAttributes);
        chatChannel.setShowBadge(true);
        chatChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        notificationManager.createNotificationChannel(chatChannel);

        channelsCreated = true;
        Log.d(TAG, "Notification channels created successfully");
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM token received: " + token.substring(0, Math.min(token.length(), 20)) + "...");
        // The token will be sent to the server via the Capacitor JS bridge
        // when the app initializes (see notifications.ts -> sendTokenToServer)
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "Message received from: " + remoteMessage.getFrom());

        // Ensure channels exist before showing notification
        createNotificationChannels();

        String title = "عافيتك";
        String body = "لديك إشعار جديد";
        Map<String, String> data = remoteMessage.getData();
        String channelId = CHANNEL_ID;
        String type = "system";
        String priority = "medium";
        String url = "/";

        // Extract data payload
        if (data != null && !data.isEmpty()) {
            Log.d(TAG, "Data payload: " + data.toString());
            type = data.getOrDefault("type", "system");
            priority = data.getOrDefault("priority", "medium");
            url = data.getOrDefault("url", "/");
            channelId = determineChannel(type);
        }

        // Check if message contains a notification payload
        RemoteMessage.Notification notification = remoteMessage.getNotification();
        if (notification != null) {
            if (notification.getTitle() != null) title = notification.getTitle();
            if (notification.getBody() != null) body = notification.getBody();
        } else if (data != null && !data.isEmpty()) {
            // Data-only message — use data fields for title/body
            if (data.containsKey("title")) title = data.get("title");
            if (data.containsKey("body")) body = data.get("body");
        }

        // Always show the notification (both foreground and background)
        showNotification(title, body, data, channelId, type, priority, url);
    }

    private String determineChannel(String type) {
        if (type == null) return CHANNEL_ID;
        switch (type) {
            case "emergency":
            case "emergency_assigned":
                return EMERGENCY_CHANNEL_ID;
            case "chat":
            case "message":
                return CHAT_CHANNEL_ID;
            default:
                return CHANNEL_ID;
        }
    }

    private void showNotification(String title, String body, Map<String, String> data,
                                   String channelId, String type, String priority, String url) {
        try {
            int notificationId = (int) (System.currentTimeMillis() % 100000);

            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            intent.setAction("NOTIFICATION_CLICK");

            // Add data to intent for handling when notification is tapped
            if (data != null) {
                for (Map.Entry<String, String> entry : data.entrySet()) {
                    intent.putExtra(entry.getKey(), entry.getValue());
                }
            }
            intent.putExtra("url", url);
            intent.putExtra("type", type);

            PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                notificationId,
                intent,
                PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
            );

            // Determine notification priority
            boolean isEmergency = EMERGENCY_CHANNEL_ID.equals(channelId);
            int compatPriority = NotificationCompat.PRIORITY_HIGH;

            if (isEmergency) {
                compatPriority = NotificationCompat.PRIORITY_MAX;
            }

            // Build notification with sound and vibration
            NotificationCompat.Builder notificationBuilder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(R.drawable.ic_launcher_foreground)
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                .setPriority(compatPriority)
                .setContentIntent(pendingIntent)
                .setCategory(isEmergency ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_MESSAGE)
                .setShowWhen(true)
                .setWhen(System.currentTimeMillis())
                .setOnlyAlertOnce(false)
                // Sound and vibration — use defaults which respect channel settings
                .setDefaults(Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE)
                // Make notification visible on lock screen
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                // Color for small icon background
                .setColor(0xFF14b8a6);

            // Emergency: set full-screen intent for heads-up notification
            if (isEmergency) {
                notificationBuilder.setFullScreenIntent(pendingIntent, true);
                // Add action buttons for emergency
                notificationBuilder.addAction(
                    R.drawable.ic_launcher_foreground,
                    "فتح",
                    pendingIntent
                );
            }

            // Style for longer messages
            if (body != null && body.length() > 50) {
                notificationBuilder.setStyle(
                    new NotificationCompat.BigTextStyle()
                        .bigText(body)
                        .setBigContentTitle(title)
                );
            }

            // Check notification permission for Android 13+
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                        != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    Log.w(TAG, "POST_NOTIFICATIONS permission not granted — notification will not show");
                    return;
                }
            }

            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
            notificationManager.notify(notificationId, notificationBuilder.build());
            Log.d(TAG, "Notification shown: " + title + " [channel=" + channelId + ", priority=" + priority + "]");

        } catch (Exception e) {
            Log.e(TAG, "Error showing notification: " + e.getMessage(), e);
        }
    }
}
