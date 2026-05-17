package com.aafiatak.app.services;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.MediaPlayer;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
import android.os.Handler;
import android.os.Looper;
import android.os.PowerManager;
import android.util.Log;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

import com.aafiatak.app.MainActivity;
import com.aafiatak.app.R;
import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

/**
 * ============================================================================
 * عافيتك (Aafiatak) - Firebase Cloud Messaging Service v4
 * ============================================================================
 *
 * Handles ALL FCM messages in ALL app states:
 * - FOREGROUND: sound + heads-up popup
 * - BACKGROUND: sound + heads-up popup (WakeLock ensures delivery)
 * - KILLED: sound + heads-up popup (Firebase auto-starts this service)
 *
 * v4 Changes:
 * 1. Channel IDs bumped to v4 to force Android to re-read importance settings
 * 2. Added setGroup() for grouped notification display
 * 3. Improved sound fallback: try custom sound → default notification → ringtone
 * 4. Added notification summary for multiple notifications
 * 5. Better WakeLock handling with timeout safety
 * 6. Explicit FirebaseApp initialization on service create
 * 7. Fixed: setDefaults(DEFAULT_ALL) can override channel sound on Android 8+;
 *    removed it for API 26+ and rely on channel settings instead
 * ============================================================================
 */
public class AafiatakFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "AafiatakFCM";

    // Notification Channel IDs - v4 to force recreation with correct importance
    private static final String CHANNEL_ID = "aafiatak_notifications_v4";
    private static final String EMERGENCY_CHANNEL_ID = "aafiatak_emergency_v4";
    private static final String CHAT_CHANNEL_ID = "aafiatak_chat_v4";
    private static final String SERVICE_CHANNEL_ID = "aafiatak_services_v4";

    // Group key for grouped notifications
    private static final String GROUP_KEY = "com.aafiatak.app.NOTIFICATIONS";

    // All old channel IDs to delete (v1, v2, v3)
    private static final String[] OLD_CHANNEL_IDS = {
        "aafiatak_notifications", "aafiatak_emergency", "aafiatak_chat", "aafiatak_services",
        "aafiatak_notifications_v2", "aafiatak_emergency_v2", "aafiatak_chat_v2", "aafiatak_services_v2",
        "aafiatak_notifications_v3", "aafiatak_emergency_v3", "aafiatak_chat_v3", "aafiatak_services_v3"
    };

    // SharedPreferences for storing FCM token
    private static final String PREFS_NAME = "aafiatak_prefs";
    private static final String PREF_FCM_TOKEN = "fcm_token";

    private volatile boolean channelsCreated = false;

    @Override
    public void onCreate() {
        super.onCreate();

        // CRITICAL: Initialize FirebaseApp in case this service is started
        // by FCM after the app process was killed
        try {
            com.google.firebase.FirebaseApp.initializeApp(this);
            Log.d(TAG, "FirebaseApp initialized in FCM Service onCreate");
        } catch (Exception e) {
            Log.w(TAG, "FirebaseApp already initialized or error: " + e.getMessage());
        }

        // Initialize the token holder
        AafiatakFCMTokenHolder.init(getApplicationContext());
        createNotificationChannels();
        Log.d(TAG, "FCM Service created — token holder initialized, channels ready");
    }

    /**
     * Create notification channels for Android 8.0+ (API 26+).
     * v4: Deletes all v1/v2/v3 channels first.
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

        // Delete ALL old channels
        for (String oldId : OLD_CHANNEL_IDS) {
            try {
                notificationManager.deleteNotificationChannel(oldId);
            } catch (Exception e) {
                // Channel may not exist
            }
        }
        Log.d(TAG, "Deleted all old notification channels (v1+v2+v3)");

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();

        // Default notification sound URI — try custom, fallback to default
        Uri notificationSoundUri = resolveSoundUri();

        // ═══ MAIN NOTIFICATIONS CHANNEL — IMPORTANCE_HIGH ═══
        NotificationChannel defaultChannel = new NotificationChannel(
                CHANNEL_ID, "إشعارات عافيتك", NotificationManager.IMPORTANCE_HIGH
        );
        defaultChannel.setDescription("إشعارات التطبيق العامة — صوت وتنبيه منبثق");
        defaultChannel.enableLights(true);
        defaultChannel.setLightColor(0xFF14b8a6);
        defaultChannel.enableVibration(true);
        defaultChannel.setVibrationPattern(new long[]{0, 300, 200, 300});
        defaultChannel.setSound(notificationSoundUri, audioAttributes);
        defaultChannel.setShowBadge(true);
        defaultChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        defaultChannel.setBypassDnd(false);
        notificationManager.createNotificationChannel(defaultChannel);

        // ═══ EMERGENCY CHANNEL — IMPORTANCE_HIGH + bypass DND ═══
        NotificationChannel emergencyChannel = new NotificationChannel(
                EMERGENCY_CHANNEL_ID, "إشعارات الطوارئ", NotificationManager.IMPORTANCE_HIGH
        );
        emergencyChannel.setDescription("إشعارات حالات الطوارئ — أولوية قصوى");
        emergencyChannel.enableLights(true);
        emergencyChannel.setLightColor(0xFFFF0000);
        emergencyChannel.enableVibration(true);
        emergencyChannel.setVibrationPattern(new long[]{0, 500, 200, 500, 200, 500});
        emergencyChannel.setSound(notificationSoundUri, audioAttributes);
        emergencyChannel.setShowBadge(true);
        emergencyChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        try {
            if (Build.VERSION.SDK_INT >= 28) {
                emergencyChannel.setBypassDnd(true);
            }
        } catch (NoSuchMethodError ignored) {}
        notificationManager.createNotificationChannel(emergencyChannel);

        // ═══ CHAT CHANNEL — IMPORTANCE_HIGH ═══
        NotificationChannel chatChannel = new NotificationChannel(
                CHAT_CHANNEL_ID, "رسائل المحادثة", NotificationManager.IMPORTANCE_HIGH
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

        // ═══ SERVICE CHANNEL — IMPORTANCE_HIGH ═══
        NotificationChannel serviceChannel = new NotificationChannel(
                SERVICE_CHANNEL_ID, "تحديثات الخدمات", NotificationManager.IMPORTANCE_HIGH
        );
        serviceChannel.setDescription("إشعارات تحديثات الخدمات");
        serviceChannel.enableVibration(true);
        serviceChannel.setSound(notificationSoundUri, audioAttributes);
        serviceChannel.setShowBadge(true);
        serviceChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        notificationManager.createNotificationChannel(serviceChannel);

        channelsCreated = true;
        Log.d(TAG, "Notification channels created v4 with IMPORTANCE_HIGH (sound + popup)");
    }

    /**
     * Resolve the notification sound URI.
     * Tries: custom notification_sound → default notification → default ringtone
     */
    private Uri resolveSoundUri() {
        try {
            int resId = getResources().getIdentifier("notification_sound", "raw", getPackageName());
            if (resId != 0) {
                return Uri.parse("android.resource://" + getPackageName() + "/" + resId);
            }
        } catch (Exception e) { /* fallback */ }

        Uri defaultNotif = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        if (defaultNotif != null) return defaultNotif;

        return RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
    }

    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "New FCM token: " + token.substring(0, Math.min(token.length(), 20)) + "...");

        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        prefs.edit().putString(PREF_FCM_TOKEN, token).apply();

        AafiatakFCMTokenHolder.setCurrentToken(token);

        Log.d(TAG, "Token stored for Capacitor JS bridge delivery");
    }

    /**
     * ═══════════════════════════════════════════════════════════════
     * MOST IMPORTANT METHOD — Called when FCM message is received
     * ═══════════════════════════════════════════════════════════════
     */
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "=== FCM message received from: " + remoteMessage.getFrom() + " ===");
        Log.d(TAG, "Message ID: " + remoteMessage.getMessageId());
        Log.d(TAG, "Data payload present: " + (remoteMessage.getData() != null && !remoteMessage.getData().isEmpty()));

        // Acquire WakeLock to ensure CPU is active (critical for background/killed)
        PowerManager.WakeLock wakeLock = null;
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isInteractive()) {
                wakeLock = pm.newWakeLock(
                    PowerManager.PARTIAL_WAKE_LOCK,
                    "Aafiatak::FCMReceive"
                );
                wakeLock.acquire(30000); // Hold for 30 seconds max
                Log.d(TAG, "WakeLock acquired for background notification");
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire WakeLock: " + e.getMessage());
        }

        try {
            // Reset channels flag to force recreation (in case process was killed)
            channelsCreated = false;
            createNotificationChannels();

            // Parse message
            String title = "عافيتك";
            String body = "لديك إشعار جديد";
            String channelId = CHANNEL_ID;
            String type = "system";
            String priority = "medium";
            String url = "/";
            String image = null;
            boolean soundEnabled = true;

            Map<String, String> data = remoteMessage.getData();
            if (data != null && !data.isEmpty()) {
                Log.d(TAG, "Data payload keys: " + data.keySet().toString());
                type = data.getOrDefault("type", "system");
                priority = data.getOrDefault("priority", "medium");
                url = data.getOrDefault("url", "/");
                channelId = determineChannel(type);
                soundEnabled = !"false".equals(data.get("sound"));

                if (data.containsKey("title")) title = data.get("title");
                if (data.containsKey("body")) body = data.get("body");
                if (data.containsKey("image")) image = data.get("image");
            }

            // Check notification payload (shouldn't exist for data-only, but handle it)
            RemoteMessage.Notification notification = remoteMessage.getNotification();
            if (notification != null) {
                if (notification.getTitle() != null) title = notification.getTitle();
                if (notification.getBody() != null) body = notification.getBody();
                if (notification.getImageUrl() != null) image = notification.getImageUrl().toString();
                Log.d(TAG, "Notification payload: title=" + title);
            }

            Log.d(TAG, "Parsed: title=" + title + ", type=" + type + ", priority=" + priority + ", channel=" + channelId);

            // Wake screen for high-priority/emergency
            if ("high".equals(priority) || "urgent".equals(priority) || "emergency".equals(type)) {
                wakeUpScreen();
            }

            // Show notification with sound + heads-up
            showNotification(title, body, data, channelId, type, priority, url, image, soundEnabled);

        } finally {
            // Release WakeLock
            if (wakeLock != null && wakeLock.isHeld()) {
                try { wakeLock.release(); } catch (Exception ignored) {}
            }
        }
    }

    private String determineChannel(String type) {
        if (type == null) return CHANNEL_ID;
        switch (type) {
            case "emergency":
            case "emergency_assigned":
            case "emergency_update":
                return EMERGENCY_CHANNEL_ID;
            case "chat":
            case "message":
                return CHAT_CHANNEL_ID;
            case "service":
            case "booking":
            case "appointment":
                return SERVICE_CHANNEL_ID;
            default:
                return CHANNEL_ID;
        }
    }

    private void wakeUpScreen() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isInteractive()) {
                PowerManager.WakeLock screenWakeLock = pm.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK |
                    PowerManager.ACQUIRE_CAUSES_WAKEUP |
                    PowerManager.ON_AFTER_RELEASE,
                    "Aafiatak::ScreenWake"
                );
                screenWakeLock.acquire(5000);
                screenWakeLock.release();
                Log.d(TAG, "Screen woken up for notification");
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not wake screen: " + e.getMessage());
        }
    }

    /**
     * Play notification sound manually using MediaPlayer.
     * FALLBACK: If the channel sound doesn't play (Android caches old channel settings),
     * this ensures the user still hears the notification sound.
     *
     * Tries: custom notification_sound → default notification → default ringtone
     */
    private void playNotificationSound() {
        // Try custom sound first
        try {
            int resId = getResources().getIdentifier("notification_sound", "raw", getPackageName());
            if (resId != 0) {
                Uri customUri = Uri.parse("android.resource://" + getPackageName() + "/" + resId);
                playSoundFromUri(customUri);
                return;
            }
        } catch (Exception e) {
            Log.w(TAG, "Custom sound failed: " + e.getMessage());
        }

        // Try default notification sound
        try {
            Uri defaultNotifUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            if (defaultNotifUri != null) {
                playSoundFromUri(defaultNotifUri);
                return;
            }
        } catch (Exception e) {
            Log.w(TAG, "Default notification sound failed: " + e.getMessage());
        }

        // Last resort: try default ringtone
        try {
            Uri ringtoneUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_RINGTONE);
            if (ringtoneUri != null) {
                playSoundFromUri(ringtoneUri);
            }
        } catch (Exception e) {
            Log.w(TAG, "All sound fallbacks failed: " + e.getMessage());
        }
    }

    private void playSoundFromUri(Uri soundUri) {
        try {
            MediaPlayer mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(this, soundUri);
            mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build());
            mediaPlayer.setLooping(false);
            mediaPlayer.setOnCompletionListener(MediaPlayer::release);
            mediaPlayer.setOnErrorListener((mp, what, extra) -> {
                try { mp.release(); } catch (Exception ignored) {}
                return true;
            });
            mediaPlayer.prepareAsync();
            mediaPlayer.setOnPreparedListener(MediaPlayer::start);
            Log.d(TAG, "Playing sound from URI: " + soundUri);
        } catch (Exception e) {
            Log.w(TAG, "MediaPlayer failed for URI " + soundUri + ": " + e.getMessage());

            // Ultra-fallback: RingtoneManager
            try {
                android.media.Ringtone ringtone = RingtoneManager.getRingtone(this, soundUri);
                if (ringtone != null) {
                    ringtone.play();
                }
            } catch (Exception e2) {
                Log.w(TAG, "RingtoneManager also failed: " + e2.getMessage());
            }
        }
    }

    /**
     * Show the notification with proper sound, vibration, and heads-up display.
     */
    private void showNotification(String title, String body, Map<String, String> data,
                                   String channelId, String type, String priority, String url,
                                   String image, boolean soundEnabled) {
        try {
            int notificationId = (int) (System.currentTimeMillis() % 100000);

            // Create intent for notification tap
            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
            intent.setAction("NOTIFICATION_CLICK_" + System.currentTimeMillis());

            if (data != null) {
                for (Map.Entry<String, String> entry : data.entrySet()) {
                    intent.putExtra(entry.getKey(), entry.getValue());
                }
            }
            intent.putExtra("url", url);
            intent.putExtra("type", type);
            intent.putExtra("notificationId", notificationId);
            intent.putExtra("fromNotification", true);

            PendingIntent pendingIntent = PendingIntent.getActivity(
                this,
                notificationId,
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            boolean isEmergency = EMERGENCY_CHANNEL_ID.equals(channelId);
            boolean isHighPriority = "high".equals(priority) || "urgent".equals(priority);

            // ═══════════════════════════════════════════════════════
            // Build the notification
            // ═══════════════════════════════════════════════════════
            NotificationCompat.Builder builder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(getNotificationIcon())
                .setContentTitle(title)
                .setContentText(body)
                .setAutoCancel(true)
                // PRIORITY_HIGH for heads-up popup (pre-Android 8.0)
                .setPriority(isEmergency ? NotificationCompat.PRIORITY_MAX : NotificationCompat.PRIORITY_HIGH)
                .setContentIntent(pendingIntent)
                // CATEGORY_CALL triggers heads-up display on most devices
                .setCategory(isEmergency ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_CALL)
                .setShowWhen(true)
                .setWhen(System.currentTimeMillis())
                .setOnlyAlertOnce(false)
                // Show on lock screen
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setColor(0xFF14b8a6)
                .setTicker(body)
                // Group notifications for cleaner notification tray
                .setGroup(GROUP_KEY)
                // Timeout after 30 seconds for auto-dismiss
                .setTimeoutAfter(30000);

            // CRITICAL FIX: On Android 8+ (API 26+), setDefaults(DEFAULT_ALL)
            // can OVERRIDE the channel's sound settings. Only use setDefaults
            // for pre-Android 8 devices where channels don't exist.
            if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
                builder.setDefaults(Notification.DEFAULT_ALL);
            }

            // ═══════════════════════════════════════════════════════
            // FULL-SCREEN INTENT for emergency/high priority
            // ═══════════════════════════════════════════════════════
            if (isEmergency || isHighPriority) {
                Intent fullScreenIntent = new Intent(this, MainActivity.class);
                fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                fullScreenIntent.putExtra("type", type);
                fullScreenIntent.putExtra("url", url);
                fullScreenIntent.putExtra("fromNotification", true);

                PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                    this,
                    notificationId + 1000,
                    fullScreenIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                );
                builder.setFullScreenIntent(fullScreenPendingIntent, true);
                Log.d(TAG, "setFullScreenIntent applied for emergency/high priority");
            }

            // Add action button
            builder.addAction(
                getNotificationIcon(),
                "فتح التطبيق",
                pendingIntent
            );

            // Big text style for longer messages
            if (body != null && body.length() > 40) {
                builder.setStyle(
                    new NotificationCompat.BigTextStyle()
                        .bigText(body)
                        .setBigContentTitle(title)
                );
            }

            // Check POST_NOTIFICATIONS permission (Android 13+)
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                        != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    Log.w(TAG, "POST_NOTIFICATIONS permission not granted — notification suppressed");
                    return;
                }
            }

            // ═══════════════════════════════════════════════════════
            // Show the notification!
            // ═══════════════════════════════════════════════════════
            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
            Notification notification = builder.build();

            // Use FLAG_INSISTENT for emergency to keep playing sound until user dismisses
            if (isEmergency) {
                notification.flags |= Notification.FLAG_INSISTENT;
            }

            notificationManager.notify(notificationId, notification);

            // Also show a group summary notification for better tray display
            showGroupSummary(notificationManager, title, body, channelId, type);

            Log.d(TAG, "=== Notification shown: " + title + " [channel=" + channelId + ", type=" + type + ", priority=" + priority + "] ===");

            // ═══════════════════════════════════════════════════════
            // FALLBACK: Play sound manually via MediaPlayer
            // ═══════════════════════════════════════════════════════
            if (soundEnabled) {
                new Handler(Looper.getMainLooper()).post(() -> {
                    try {
                        playNotificationSound();
                    } catch (Exception e) {
                        Log.w(TAG, "Fallback sound failed: " + e.getMessage());
                    }
                });
            }

        } catch (Exception e) {
            Log.e(TAG, "Error showing notification: " + e.getMessage(), e);
        }
    }

    /**
     * Show a group summary notification so multiple notifications
     * are grouped together in the notification tray.
     */
    private void showGroupSummary(NotificationManagerCompat notificationManager,
                                   String title, String body, String channelId,
                                   String type) {
        try {
            Intent summaryIntent = new Intent(this, MainActivity.class);
            summaryIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            summaryIntent.setAction("NOTIFICATION_SUMMARY_" + System.currentTimeMillis());
            summaryIntent.putExtra("url", "/notifications");

            PendingIntent summaryPendingIntent = PendingIntent.getActivity(
                this,
                999999, // Fixed ID for summary
                summaryIntent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );

            NotificationCompat.Builder summaryBuilder = new NotificationCompat.Builder(this, channelId)
                .setSmallIcon(getNotificationIcon())
                .setContentTitle("عافيتك")
                .setContentText("لديك إشعارات جديدة")
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setCategory(NotificationCompat.CATEGORY_CALL)
                .setShowWhen(true)
                .setWhen(System.currentTimeMillis())
                .setGroup(GROUP_KEY)
                .setGroupSummary(true)
                .setContentIntent(summaryPendingIntent)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setColor(0xFF14b8a6);

            notificationManager.notify(999999, summaryBuilder.build());
        } catch (Exception e) {
            Log.w(TAG, "Group summary failed: " + e.getMessage());
        }
    }

    private int getNotificationIcon() {
        int resId = getResources().getIdentifier("ic_stat_aafiatak", "drawable", getPackageName());
        if (resId != 0) return resId;

        resId = getResources().getIdentifier("ic_launcher_foreground", "drawable", getPackageName());
        if (resId != 0) return resId;

        return R.drawable.ic_launcher_foreground;
    }
}
