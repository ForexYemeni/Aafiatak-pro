package com.aafiatak.app.services;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
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
 * عافيتك (Aafiatak) - Firebase Cloud Messaging Service
 * ============================================================================
 *
 * Handles ALL FCM messages in ALL app states:
 * - FOREGROUND: sound + heads-up popup
 * - BACKGROUND: sound + heads-up popup (WakeLock ensures delivery)
 * - KILLED: sound + heads-up popup (Firebase auto-starts this service)
 *
 * CRITICAL FIXES applied (v3):
 * 1. ALL FCM messages sent with android.priority='high' from server
 *    (normal priority data-only messages are NOT delivered in background on modern Android)
 * 2. Delete old channels & recreate with IMPORTANCE_HIGH (Android caches old settings)
 * 3. WakeLock before showing notification (ensures CPU is active in background)
 * 4. Play sound MANUALLY via MediaPlayer (bypasses channel sound caching issues)
 * 5. setDefaults(DEFAULT_ALL) as additional fallback for sound
 * 6. setFullScreenIntent for ALL notifications (heads-up popup outside app)
 * 7. USE_FULL_SCREEN_INTENT permission added in manifest (Android 14+ requirement)
 * 8. high-priority intent-filter to ensure this service gets FCM messages first
 * 9. Notification channel version bumped to v3 to force Android to re-read settings
 * ============================================================================
 */
public class AafiatakFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "AafiatakFCM";

    // Notification Channel IDs - versioned to force recreation with correct importance
    // Bumped to v3 because v2 channels may still be cached with wrong settings on some devices
    private static final String CHANNEL_ID = "aafiatak_notifications_v3";
    private static final String EMERGENCY_CHANNEL_ID = "aafiatak_emergency_v3";
    private static final String CHAT_CHANNEL_ID = "aafiatak_chat_v3";
    private static final String SERVICE_CHANNEL_ID = "aafiatak_services_v3";

    // OLD channel IDs to delete (forces Android to use new channel settings)
    private static final String OLD_CHANNEL_ID_V1 = "aafiatak_notifications";
    private static final String OLD_EMERGENCY_CHANNEL_ID_V1 = "aafiatak_emergency";
    private static final String OLD_CHAT_CHANNEL_ID_V1 = "aafiatak_chat";
    private static final String OLD_SERVICE_CHANNEL_ID_V1 = "aafiatak_services";
    private static final String OLD_CHANNEL_ID_V2 = "aafiatak_notifications_v2";
    private static final String OLD_EMERGENCY_CHANNEL_ID_V2 = "aafiatak_emergency_v2";
    private static final String OLD_CHAT_CHANNEL_ID_V2 = "aafiatak_chat_v2";
    private static final String OLD_SERVICE_CHANNEL_ID_V2 = "aafiatak_services_v2";

    // SharedPreferences for storing FCM token
    private static final String PREFS_NAME = "aafiatak_prefs";
    private static final String PREF_FCM_TOKEN = "fcm_token";

    private volatile boolean channelsCreated = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    /**
     * Create notification channels for Android 8.0+ (API 26+).
     *
     * CRITICAL: We delete ALL old channels first, then create new versioned ones.
     * Android caches channel settings — once a channel is created with a certain
     * importance level, it CANNOT be upgraded programmatically. The only way
     * to ensure IMPORTANCE_HIGH is active is to use a new channel ID.
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

        // ═══════════════════════════════════════════════════════════
        // DELETE ALL OLD CHANNELS — forces Android to use new settings
        // ═══════════════════════════════════════════════════════════
        try {
            // Delete v1 channels
            notificationManager.deleteNotificationChannel(OLD_CHANNEL_ID_V1);
            notificationManager.deleteNotificationChannel(OLD_EMERGENCY_CHANNEL_ID_V1);
            notificationManager.deleteNotificationChannel(OLD_CHAT_CHANNEL_ID_V1);
            notificationManager.deleteNotificationChannel(OLD_SERVICE_CHANNEL_ID_V1);
            // Delete v2 channels
            notificationManager.deleteNotificationChannel(OLD_CHANNEL_ID_V2);
            notificationManager.deleteNotificationChannel(OLD_EMERGENCY_CHANNEL_ID_V2);
            notificationManager.deleteNotificationChannel(OLD_CHAT_CHANNEL_ID_V2);
            notificationManager.deleteNotificationChannel(OLD_SERVICE_CHANNEL_ID_V2);
            Log.d(TAG, "Deleted all old notification channels (v1+v2)");
        } catch (Exception e) {
            // Channels may not exist yet, that's fine
        }

        AudioAttributes audioAttributes = new AudioAttributes.Builder()
                .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();

        // Default notification sound URI
        Uri notificationSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        try {
            int resId = getResources().getIdentifier("notification_sound", "raw", getPackageName());
            if (resId != 0) {
                notificationSoundUri = Uri.parse("android.resource://" + getPackageName() + "/" + resId);
            }
        } catch (Exception e) {
            // Use default
        }

        // ═══════════════════════════════════════════════════════════
        // MAIN NOTIFICATIONS CHANNEL — IMPORTANCE_HIGH = sound + popup
        // ═══════════════════════════════════════════════════════════
        NotificationChannel defaultChannel = new NotificationChannel(
                CHANNEL_ID,
                "إشعارات عافيتك",
                NotificationManager.IMPORTANCE_HIGH
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

        // ═══════════════════════════════════════════════════════════
        // EMERGENCY CHANNEL — IMPORTANCE_HIGH + bypass DND
        // ═══════════════════════════════════════════════════════════
        NotificationChannel emergencyChannel = new NotificationChannel(
                EMERGENCY_CHANNEL_ID,
                "إشعارات الطوارئ",
                NotificationManager.IMPORTANCE_HIGH
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

        // ═══════════════════════════════════════════════════════════
        // CHAT CHANNEL — IMPORTANCE_HIGH for sound + popup
        // ═══════════════════════════════════════════════════════════
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

        // ═══════════════════════════════════════════════════════════
        // SERVICE CHANNEL — IMPORTANCE_HIGH too (for reliable delivery)
        // ═══════════════════════════════════════════════════════════
        NotificationChannel serviceChannel = new NotificationChannel(
                SERVICE_CHANNEL_ID,
                "تحديثات الخدمات",
                NotificationManager.IMPORTANCE_HIGH
        );
        serviceChannel.setDescription("إشعارات تحديثات الخدمات");
        serviceChannel.enableVibration(true);
        serviceChannel.setSound(notificationSoundUri, audioAttributes);
        serviceChannel.setShowBadge(true);
        serviceChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        notificationManager.createNotificationChannel(serviceChannel);

        channelsCreated = true;
        Log.d(TAG, "Notification channels created v3 with IMPORTANCE_HIGH (sound + popup)");
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
     * This method is called in ALL app states for data-only messages
     * sent with android.priority='high'.
     *
     * CRITICAL for background/killed:
     * 1. FCM messages MUST be sent with android.priority='high' (server-side)
     * 2. We acquire a WakeLock to ensure the CPU processes the notification
     * 3. We play sound manually via MediaPlayer as a fallback
     * 4. We use IMPORTANCE_HIGH channels with new IDs to bypass Android caching
     * 5. We use setFullScreenIntent for heads-up popup (requires USE_FULL_SCREEN_INTENT)
     * ═══════════════════════════════════════════════════════════════
     */
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "=== FCM message received from: " + remoteMessage.getFrom() + " ===");
        Log.d(TAG, "Message ID: " + remoteMessage.getMessageId());
        Log.d(TAG, "Message priority: " + remoteMessage.getPriority());
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
                wakeLock.acquire(15000); // Hold for 15 seconds max
                Log.d(TAG, "WakeLock acquired for background notification");
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not acquire WakeLock: " + e.getMessage());
        }

        try {
            // Reset channels flag to force recreation (in case process was killed)
            channelsCreated = false;
            // Ensure channels exist
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
                Log.d(TAG, "Data payload: " + data.toString());
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
     * This is a FALLBACK — if the NotificationChannel sound doesn't play
     * (e.g., Android cached the old channel settings), this ensures the
     * user still hears the notification sound.
     */
    private void playNotificationSound() {
        try {
            Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            MediaPlayer mediaPlayer = new MediaPlayer();
            mediaPlayer.setDataSource(this, soundUri);
            mediaPlayer.setAudioAttributes(new AudioAttributes.Builder()
                    .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
                    .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                    .build());
            mediaPlayer.setLooping(false);
            mediaPlayer.setOnCompletionListener(MediaPlayer::release);
            mediaPlayer.setOnErrorListener((mp, what, extra) -> {
                mp.release();
                return true;
            });
            mediaPlayer.prepareAsync();
            mediaPlayer.setOnPreparedListener(MediaPlayer::start);
            Log.d(TAG, "Playing notification sound via MediaPlayer");
        } catch (Exception e) {
            Log.w(TAG, "Could not play notification sound via MediaPlayer: " + e.getMessage());
            // Fallback: try RingtoneManager
            try {
                Uri soundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
                android.media.Ringtone ringtone = RingtoneManager.getRingtone(this, soundUri);
                if (ringtone != null) {
                    ringtone.play();
                }
            } catch (Exception e2) {
                Log.w(TAG, "Could not play via RingtoneManager either: " + e2.getMessage());
            }
        }
    }

    /**
     * Show the notification with proper sound, vibration, and heads-up display.
     *
     * KEY POINTS for making notifications work in BACKGROUND/KILLED:
     * 1. Channel MUST have IMPORTANCE_HIGH — NEW channel IDs (v3) to bypass caching
     * 2. WakeLock acquired before showing (ensures CPU processes it)
     * 3. Sound played manually via MediaPlayer as fallback
     * 4. setDefaults(DEFAULT_ALL) for additional fallback
     * 5. setFullScreenIntent for ALL notifications (shows heads-up popup even outside app)
     * 6. USE_FULL_SCREEN_INTENT permission in manifest (Android 14+ requirement)
     * 7. PRIORITY_HIGH on the notification builder for pre-Android 8.0 devices
     * 8. CATEGORY_CALL or CATEGORY_ALARM for high-priority visual treatment
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
                // CRITICAL: setDefaults as fallback for sound/vibration
                .setDefaults(Notification.DEFAULT_ALL)
                // Show on lock screen
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .setColor(0xFF14b8a6)
                .setTicker(body)
                // Timeout after 30 seconds for auto-dismiss
                .setTimeoutAfter(30000);

            // ═══════════════════════════════════════════════════════
            // FULL-SCREEN INTENT — The key to showing popup OUTSIDE the app!
            //
            // This is what makes the notification appear as a heads-up
            // banner when the app is in the background or killed.
            // Without this, Android may show the notification silently
            // in the status bar without any popup or sound.
            //
            // Requires USE_FULL_SCREEN_INTENT permission on Android 14+.
            // ═══════════════════════════════════════════════════════
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

            // Set full-screen intent for ALL notifications, not just emergency
            // This is what makes the heads-up popup appear outside the app
            builder.setFullScreenIntent(fullScreenPendingIntent, true);

            // Add action button for all notifications
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

            Log.d(TAG, "=== Notification shown successfully: " + title + " [channel=" + channelId + ", type=" + type + ", priority=" + priority + "] ===");

            // ═══════════════════════════════════════════════════════
            // FALLBACK: Play sound manually via MediaPlayer
            // This ensures sound even if channel settings are cached wrong
            // or the app process was killed and recreated without channels
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

    private int getNotificationIcon() {
        int resId = getResources().getIdentifier("ic_stat_aafiatak", "drawable", getPackageName());
        if (resId != 0) return resId;

        resId = getResources().getIdentifier("ic_launcher_foreground", "drawable", getPackageName());
        if (resId != 0) return resId;

        return R.drawable.ic_launcher_foreground;
    }
}
