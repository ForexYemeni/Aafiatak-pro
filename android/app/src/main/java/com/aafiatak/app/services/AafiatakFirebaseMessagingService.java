package com.aafiatak.app.services;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.media.AudioAttributes;
import android.media.RingtoneManager;
import android.net.Uri;
import android.os.Build;
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
 * This service handles ALL FCM messages (foreground, background, and killed app).
 * 
 * Key features:
 * - Works when app is in FOREGROUND, BACKGROUND, or KILLED
 * - Plays notification sound (custom or default)
 * - Shows heads-up notification (popup banner)
 * - Supports emergency notifications with full-screen intent
 * - Wakes screen for high-priority notifications
 * - Handles both notification + data messages AND data-only messages
 * - Creates proper notification channels with HIGH importance for sound+popup
 * 
 * Why this replaces Capacitor's PushNotifications for message handling:
 * - Capacitor's plugin only reliably handles messages when the app is in foreground
 * - Our custom service uses Android's native FCM handling which works in all states
 * - Capacitor JS bridge still works for token registration
 * ============================================================================
 */
public class AafiatakFirebaseMessagingService extends FirebaseMessagingService {

    private static final String TAG = "AafiatakFCM";
    
    // Notification Channel IDs - must match what server sends
    private static final String CHANNEL_ID = "aafiatak_notifications";
    private static final String EMERGENCY_CHANNEL_ID = "aafiatak_emergency";
    private static final String CHAT_CHANNEL_ID = "aafiatak_chat";
    private static final String SERVICE_CHANNEL_ID = "aafiatak_services";
    
    // SharedPreferences for storing FCM token
    private static final String PREFS_NAME = "aafiatak_prefs";
    private static final String PREF_FCM_TOKEN = "fcm_token";

    private boolean channelsCreated = false;

    @Override
    public void onCreate() {
        super.onCreate();
        createNotificationChannels();
    }

    /**
     * Create notification channels for Android 8.0+ (API 26+).
     * Using IMPORTANCE_HIGH ensures:
     * - Sound plays
     * - Notification shows as heads-up (popup banner)
     * - Notification appears on lock screen
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
                .setUsage(AudioAttributes.USAGE_NOTIFICATION_RINGTONE)
                .build();

        // Try custom sound, fallback to default notification sound
        Uri notificationSoundUri;
        try {
            int resId = getResources().getIdentifier("notification_sound", "raw", getPackageName());
            if (resId != 0) {
                notificationSoundUri = Uri.parse("android.resource://" + getPackageName() + "/" + resId);
            } else {
                notificationSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
            }
        } catch (Exception e) {
            notificationSoundUri = RingtoneManager.getDefaultUri(RingtoneManager.TYPE_NOTIFICATION);
        }

        // ═══════════════════════════════════════════════════════════
        // DEFAULT NOTIFICATIONS CHANNEL - IMPORTANCE_HIGH for sound + popup
        // ═══════════════════════════════════════════════════════════
        NotificationChannel defaultChannel = new NotificationChannel(
                CHANNEL_ID,
                "إشعارات عافيتك",
                NotificationManager.IMPORTANCE_HIGH  // HIGH = sound + popup + lockscreen
        );
        defaultChannel.setDescription("إشعارات التطبيق العامة");
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
        // EMERGENCY CHANNEL - IMPORTANCE_HIGH + bypass DND
        // ═══════════════════════════════════════════════════════════
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
        emergencyChannel.setLockscreenVisibility(Notification.VISIBILITY_PUBLIC);
        // Bypass DND for emergency notifications
        try {
            if (Build.VERSION.SDK_INT >= 28) {
                emergencyChannel.setBypassDnd(true);
            }
        } catch (NoSuchMethodError ignored) {}
        notificationManager.createNotificationChannel(emergencyChannel);

        // ═══════════════════════════════════════════════════════════
        // CHAT CHANNEL - IMPORTANCE_HIGH for sound + popup
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
        // SERVICE CHANNEL - IMPORTANCE_DEFAULT for quieter updates
        // ═══════════════════════════════════════════════════════════
        NotificationChannel serviceChannel = new NotificationChannel(
                SERVICE_CHANNEL_ID,
                "تحديثات الخدمات",
                NotificationManager.IMPORTANCE_DEFAULT
        );
        serviceChannel.setDescription("إشعارات تحديثات الخدمات");
        serviceChannel.enableVibration(true);
        serviceChannel.setShowBadge(true);
        notificationManager.createNotificationChannel(serviceChannel);

        channelsCreated = true;
        Log.d(TAG, "✅ Notification channels created with HIGH importance (sound + popup enabled)");
    }

    /**
     * Called when a new FCM token is generated.
     * Store it in SharedPreferences so the JS bridge can pick it up.
     */
    @Override
    public void onNewToken(String token) {
        super.onNewToken(token);
        Log.d(TAG, "🆕 New FCM token: " + token.substring(0, Math.min(token.length(), 20)) + "...");

        // Store token in SharedPreferences for JS bridge to read
        SharedPreferences prefs = getSharedPreferences(PREFS_NAME, MODE_PRIVATE);
        prefs.edit().putString(PREF_FCM_TOKEN, token).apply();

        // Also store in a global accessible location
        AafiatakFCMTokenHolder.setCurrentToken(token);

        // Try to send token to server via the web app
        sendTokenToServerViaWebView(token);
    }

    /**
     * Send FCM token to server by triggering the web app's registration flow.
     * Since we use a remote URL in Capacitor, we inject the token via JavaScript.
     */
    private void sendTokenToServerViaWebView(String token) {
        // The token is stored in SharedPreferences. When the WebView loads,
        // the JS code (notifications.ts) will call registerPushNotifications()
        // which will get the token from the Capacitor plugin.
        // No additional action needed here — Capacitor handles token delivery.
        Log.d(TAG, "Token stored for Capacitor JS bridge delivery");
    }

    /**
     * ═══════════════════════════════════════════════════════════════
     * MOST IMPORTANT METHOD - Called when FCM message is received
     * ═══════════════════════════════════════════════════════════════
     * This method is called in ALL app states:
     * - App in FOREGROUND: message is delivered here AND to onMessageReceived in JS
     * - App in BACKGROUND: message is delivered here (system tray shows notification)
     * - App KILLED: message is delivered here (system tray shows notification)
     * 
     * For data-only messages: ALWAYS delivered here regardless of app state.
     * For notification+data messages: delivered here in foreground, system handles in background.
     * 
     * CRITICAL: We must ALWAYS call showNotification() here because:
     * 1. In foreground: FCM doesn't auto-show notifications
     * 2. In background with data-only: FCM doesn't auto-show notifications
     * 3. In background with notification payload: system shows notification, but
     *    we want to ensure proper sound/channel handling
     * ═══════════════════════════════════════════════════════════════
     */
    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        super.onMessageReceived(remoteMessage);
        Log.d(TAG, "📩 FCM message received from: " + remoteMessage.getFrom());

        // Ensure channels exist before showing any notification
        createNotificationChannels();

        // Wake up the screen for high-priority notifications
        String priority = "medium";
        Map<String, String> data = remoteMessage.getData();
        if (data != null && !data.isEmpty()) {
            priority = data.getOrDefault("priority", "medium");
        }
        
        if ("high".equals(priority) || "urgent".equals(priority)) {
            wakeUpScreen();
        }

        // Parse the message
        String title = "عافيتك";
        String body = "لديك إشعار جديد";
        String channelId = CHANNEL_ID;
        String type = "system";
        String url = "/";

        // ═══════════════════════════════════════════════════════
        // Step 1: Extract data payload (always available)
        // ═══════════════════════════════════════════════════════
        if (data != null && !data.isEmpty()) {
            Log.d(TAG, "📦 Data payload: " + data.toString());
            type = data.getOrDefault("type", "system");
            priority = data.getOrDefault("priority", "medium");
            url = data.getOrDefault("url", "/");
            channelId = determineChannel(type);

            // Data-only messages: title/body come from data
            if (data.containsKey("title")) title = data.get("title");
            if (data.containsKey("body")) body = data.get("body");
        }

        // ═══════════════════════════════════════════════════════
        // Step 2: Check notification payload (may override data)
        // ═══════════════════════════════════════════════════════
        RemoteMessage.Notification notification = remoteMessage.getNotification();
        if (notification != null) {
            // Notification+data message: notification payload takes precedence for title/body
            if (notification.getTitle() != null) title = notification.getTitle();
            if (notification.getBody() != null) body = notification.getBody();
            Log.d(TAG, "🔔 Notification payload: title=" + title + ", body=" + body);
        }

        // ═══════════════════════════════════════════════════════
        // Step 3: ALWAYS show the notification ourselves
        // ═══════════════════════════════════════════════════════
        // This ensures:
        // - Sound plays (via channel importance)
        // - Heads-up notification shows (via IMPORTANCE_HIGH)
        // - Works when app is killed/background/foreground
        // ═══════════════════════════════════════════════════════
        showNotification(title, body, data, channelId, type, priority, url);
    }

    /**
     * Determine which notification channel to use based on message type.
     */
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

    /**
     * Wake up the device screen for high-priority/emergency notifications.
     */
    private void wakeUpScreen() {
        try {
            PowerManager pm = (PowerManager) getSystemService(Context.POWER_SERVICE);
            if (pm != null && !pm.isInteractive()) {
                PowerManager.WakeLock wakeLock = pm.newWakeLock(
                    PowerManager.FULL_WAKE_LOCK |
                    PowerManager.ACQUIRE_CAUSES_WAKEUP |
                    PowerManager.ON_AFTER_RELEASE,
                    "Aafiatak::NotificationWake"
                );
                wakeLock.acquire(5000); // Wake for 5 seconds
                wakeLock.release();
                Log.d(TAG, "💡 Screen woken up for notification");
            }
        } catch (Exception e) {
            Log.w(TAG, "Could not wake screen: " + e.getMessage());
        }
    }

    /**
     * Show the notification with proper sound, vibration, and heads-up display.
     * 
     * KEY POINTS for making notifications work properly:
     * 1. Channel MUST have IMPORTANCE_HIGH for sound + heads-up
     * 2. Notification MUST use setPriority(PRIORITY_HIGH) for pre-Oreo
     * 3. setDefaults(DEFAULT_SOUND | DEFAULT_VIBRATE) ensures sound plays
     * 4. setCategory(CATEGORY_MESSAGE) makes it a conversation notification
     * 5. VISIBILITY_PUBLIC shows on lock screen
     */
    private void showNotification(String title, String body, Map<String, String> data,
                                   String channelId, String type, String priority, String url) {
        try {
            // Generate unique notification ID based on timestamp
            int notificationId = (int) (System.currentTimeMillis() % 100000);

            // Create intent for when notification is tapped
            Intent intent = new Intent(this, MainActivity.class);
            intent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
            intent.setAction("NOTIFICATION_CLICK_" + System.currentTimeMillis());

            // Pass all data to the intent
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
                PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
            );

            boolean isEmergency = EMERGENCY_CHANNEL_ID.equals(channelId);

            // ═══════════════════════════════════════════════════════
            // Build the notification
            // ═══════════════════════════════════════════════════════
            NotificationCompat.Builder notificationBuilder = new NotificationCompat.Builder(this, channelId)
                // Icon
                .setSmallIcon(getNotificationIcon())
                // Content
                .setContentTitle(title)
                .setContentText(body)
                // Auto-dismiss when tapped
                .setAutoCancel(true)
                // HIGH priority for heads-up notification on pre-Oreo
                .setPriority(isEmergency ? NotificationCompat.PRIORITY_MAX : NotificationCompat.PRIORITY_HIGH)
                // Intent when tapped
                .setContentIntent(pendingIntent)
                // Category - helps Android classify the notification
                .setCategory(isEmergency ? NotificationCompat.CATEGORY_ALARM : NotificationCompat.CATEGORY_MESSAGE)
                // Show timestamp
                .setShowWhen(true)
                .setWhen(System.currentTimeMillis())
                // Allow multiple notifications (don't group them)
                .setOnlyAlertOnce(false)
                // ═══════════════════════════════════════════════════
                // CRITICAL: Sound + Vibration
                // ═══════════════════════════════════════════════════
                // setDefaults ensures sound/vibration even if channel settings are wrong
                .setDefaults(Notification.DEFAULT_SOUND | Notification.DEFAULT_VIBRATE)
                // ═══════════════════════════════════════════════════
                // Show on lock screen
                // ═══════════════════════════════════════════════════
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                // App color (teal)
                .setColor(0xFF14b8a6)
                // Set ticker for accessibility
                .setTicker(body);

            // ═══════════════════════════════════════════════════════
            // Emergency: Full-screen intent (shows over everything)
            // ═══════════════════════════════════════════════════════
            if (isEmergency) {
                // Full-screen intent - shows even when screen is locked
                Intent fullScreenIntent = new Intent(this, MainActivity.class);
                fullScreenIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
                fullScreenIntent.putExtra("type", "emergency");
                fullScreenIntent.putExtra("url", url);
                
                PendingIntent fullScreenPendingIntent = PendingIntent.getActivity(
                    this,
                    notificationId + 1000,
                    fullScreenIntent,
                    PendingIntent.FLAG_ONE_SHOT | PendingIntent.FLAG_IMMUTABLE
                );
                
                notificationBuilder.setFullScreenIntent(fullScreenPendingIntent, true);
                
                // Add action button
                notificationBuilder.addAction(
                    getNotificationIcon(),
                    "فتح التطبيق",
                    pendingIntent
                );
            }

            // ═══════════════════════════════════════════════════════
            // Big text style for longer messages
            // ═══════════════════════════════════════════════════════
            if (body != null && body.length() > 40) {
                notificationBuilder.setStyle(
                    new NotificationCompat.BigTextStyle()
                        .bigText(body)
                        .setBigContentTitle(title)
                );
            }

            // ═══════════════════════════════════════════════════════
            // Check POST_NOTIFICATIONS permission (Android 13+)
            // ═══════════════════════════════════════════════════════
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
                if (checkSelfPermission(android.Manifest.permission.POST_NOTIFICATIONS)
                        != android.content.pm.PackageManager.PERMISSION_GRANTED) {
                    Log.w(TAG, "⚠️ POST_NOTIFICATIONS permission not granted — notification suppressed");
                    return;
                }
            }

            // ═══════════════════════════════════════════════════════
            // Show the notification!
            // ═══════════════════════════════════════════════════════
            NotificationManagerCompat notificationManager = NotificationManagerCompat.from(this);
            notificationManager.notify(notificationId, notificationBuilder.build());
            
            Log.d(TAG, "✅ Notification shown: " + title + " [channel=" + channelId + ", type=" + type + ", priority=" + priority + "]");

        } catch (Exception e) {
            Log.e(TAG, "❌ Error showing notification: " + e.getMessage(), e);
        }
    }

    /**
     * Get the appropriate notification icon.
     * Uses the status bar icon for Android 5+, launcher icon for older.
     */
    private int getNotificationIcon() {
        // Try to use the status bar icon first (monochrome for Android 5+)
        int resId = getResources().getIdentifier("ic_stat_aafiatak", "drawable", getPackageName());
        if (resId != 0) return resId;
        
        // Fallback to launcher foreground
        resId = getResources().getIdentifier("ic_launcher_foreground", "drawable", getPackageName());
        if (resId != 0) return resId;
        
        // Final fallback
        return R.drawable.ic_launcher_foreground;
    }
}
