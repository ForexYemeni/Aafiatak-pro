package com.aafiatak.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.PackageManager;
import android.Manifest;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;
import android.widget.Toast;

import com.getcapacitor.BridgeActivity;
import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

public class MainActivity extends BridgeActivity {

    private static final String TAG = "AafiatakApp";

    // Must match the channel IDs in AafiatakFirebaseMessagingService (v4)
    private static final String CHANNEL_ID = "aafiatak_notifications_v4";
    private static final String EMERGENCY_CHANNEL_ID = "aafiatak_emergency_v4";
    private static final String CHAT_CHANNEL_ID = "aafiatak_chat_v4";
    private static final String SERVICE_CHANNEL_ID = "aafiatak_services_v4";

    // All old channel IDs to delete (v1, v2, v3)
    private static final String[] OLD_CHANNEL_IDS = {
        "aafiatak_notifications", "aafiatak_emergency", "aafiatak_chat", "aafiatak_services",
        "aafiatak_notifications_v2", "aafiatak_emergency_v2", "aafiatak_chat_v2", "aafiatak_services_v2",
        "aafiatak_notifications_v3", "aafiatak_emergency_v3", "aafiatak_chat_v3", "aafiatak_services_v3"
    };

    private static final int REQUEST_NOTIFICATION_PERMISSION = 1001;
    private static final int REQUEST_FULL_SCREEN_INTENT_PERMISSION = 1002;

    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // ═══════════════════════════════════════════════════════════
        // CRITICAL: Initialize Firebase FIRST before anything else
        // Without this, FCM token generation and message handling
        // will NOT work when the app starts from a killed state.
        // ═══════════════════════════════════════════════════════════
        try {
            FirebaseApp.initializeApp(this);
            Log.d(TAG, "FirebaseApp initialized in MainActivity");
        } catch (Exception e) {
            Log.e(TAG, "Failed to initialize FirebaseApp: " + e.getMessage());
        }

        // Create notification channels with v4 IDs (bypasses Android caching)
        createNotificationChannels();

        // Request permissions
        requestNotificationPermission();
        requestFullScreenIntentPermission();

        // Ensure FCM token is available
        ensureFCMToken();
    }

    /**
     * Ensure FCM token exists. If not, request one.
     * This handles the case where the token was not generated during
     * the initial Capacitor PushNotifications.register() call.
     */
    private void ensureFCMToken() {
        try {
            SharedPreferences prefs = getSharedPreferences("aafiatak_prefs", MODE_PRIVATE);
            String existingToken = prefs.getString("fcm_token", null);

            if (existingToken == null || existingToken.isEmpty()) {
                Log.d(TAG, "No FCM token found — requesting new token");
                FirebaseMessaging.getInstance().getToken()
                    .addOnCompleteListener(task -> {
                        if (task.isSuccessful() && task.getResult() != null) {
                            String token = task.getResult();
                            Log.d(TAG, "FCM token obtained: " + token.substring(0, Math.min(token.length(), 20)) + "...");
                            prefs.edit().putString("fcm_token", token).apply();

                            // Also update the token holder
                            com.aafiatak.app.services.AafiatakFCMTokenHolder.init(getApplicationContext());
                            com.aafiatak.app.services.AafiatakFCMTokenHolder.setCurrentToken(token);
                        } else {
                            Log.w(TAG, "Failed to get FCM token: " +
                                (task.getException() != null ? task.getException().getMessage() : "unknown"));
                        }
                    });
            } else {
                Log.d(TAG, "FCM token already exists: " + existingToken.substring(0, Math.min(existingToken.length(), 20)) + "...");

                // Initialize token holder with existing token
                com.aafiatak.app.services.AafiatakFCMTokenHolder.init(getApplicationContext());
            }
        } catch (Exception e) {
            Log.e(TAG, "Error ensuring FCM token: " + e.getMessage());
        }
    }

    /**
     * Handle deep links and notification tap intents.
     * When a notification is tapped, the FCM service puts a "url" extra
     * in the intent. We navigate the WebView to that URL.
     * Also handles custom scheme deep links like aafiatak://path
     */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleDeepLink(intent);
    }

    @Override
    public void onResume() {
        super.onResume();
        // Handle intent when app is brought to foreground from notification
        if (getIntent() != null) {
            handleDeepLink(getIntent());
        }
    }

    /**
     * Process deep link / notification tap URL.
     * If the intent contains a "url" extra (from FCM notification tap),
     * navigate the Capacitor WebView to that page.
     */
    private void handleDeepLink(Intent intent) {
        if (intent == null) return;

        String url = null;

        // Check for notification tap URL
        if (intent.hasExtra("url")) {
            url = intent.getStringExtra("url");
        }

        // Check for deep link data (aafiatak:// scheme)
        Uri data = intent.getData();
        if (data != null) {
            String scheme = data.getScheme();
            if ("aafiatak".equals(scheme) || "https".equals(scheme)) {
                // Convert aafiatak://path to /path for the WebView
                url = data.getPath();
                if (url == null || url.isEmpty()) {
                    url = "/";
                }
                // Include query parameters
                if (data.getQuery() != null) {
                    url = url + "?" + data.getQuery();
                }
            }
        }

        if (url != null && !url.isEmpty()) {
            Log.d(TAG, "Deep link / notification URL: " + url);
            // Navigate the Capacitor WebView to the URL
            final String targetUrl = url;
            runOnUiThread(() -> {
                try {
                    WebView webView = getBridge().getWebView();
                    if (webView != null) {
                        // Build full URL relative to the server URL
                        String baseUrl = "https://aafiatak-pro.vercel.app";
                        String fullUrl;
                        if (targetUrl.startsWith("http")) {
                            fullUrl = targetUrl;
                        } else if (targetUrl.startsWith("/")) {
                            fullUrl = baseUrl + targetUrl;
                        } else {
                            fullUrl = baseUrl + "/" + targetUrl;
                        }
                        Log.d(TAG, "Navigating WebView to: " + fullUrl);
                        webView.loadUrl(fullUrl);
                    }
                } catch (Exception e) {
                    Log.e(TAG, "Error navigating to deep link: " + e.getMessage());
                }
            });
        }
    }

    /**
     * Create notification channels on app start.
     * Deletes ALL old channels (v1+v2+v3) first to ensure IMPORTANCE_HIGH
     * is actually applied. Android caches channel settings and ignores code
     * changes to existing channels.
     *
     * v4: Bumped again because v3 channels may still have cached settings
     *     on some devices that prevent sound from playing.
     */
    private void createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager == null) return;

            // Delete ALL old channels to force Android to use new settings
            for (String oldId : OLD_CHANNEL_IDS) {
                try {
                    manager.deleteNotificationChannel(oldId);
                } catch (Exception e) {
                    // Channel may not exist yet
                }
            }
            Log.d(TAG, "Deleted all old notification channels (v1+v2+v3)");

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

            // ═══════════════════════════════════════════════════════════
            // MAIN NOTIFICATIONS CHANNEL — IMPORTANCE_HIGH = sound + popup
            // ═══════════════════════════════════════════════════════════
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

            // ═══════════════════════════════════════════════════════════
            // EMERGENCY CHANNEL — IMPORTANCE_HIGH + bypass DND
            // ═══════════════════════════════════════════════════════════
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

            // ═══════════════════════════════════════════════════════════
            // CHAT CHANNEL — IMPORTANCE_HIGH
            // ═══════════════════════════════════════════════════════════
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

            // ═══════════════════════════════════════════════════════════
            // SERVICE CHANNEL — IMPORTANCE_HIGH
            // ═══════════════════════════════════════════════════════════
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

            Log.d(TAG, "Notification channels created v4 with IMPORTANCE_HIGH + sound");
        }
    }

    private void requestNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
            if (checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS) != PackageManager.PERMISSION_GRANTED) {
                requestPermissions(new String[]{Manifest.permission.POST_NOTIFICATIONS}, REQUEST_NOTIFICATION_PERMISSION);
            } else {
                Log.d(TAG, "POST_NOTIFICATIONS permission already granted");
            }
        }
    }

    /**
     * Request USE_FULL_SCREEN_INTENT permission on Android 14+ (API 34+).
     * This permission is required for setFullScreenIntent() to work,
     * which shows the heads-up notification popup when the app is in
     * background or killed.
     */
    private void requestFullScreenIntentPermission() {
        if (Build.VERSION.SDK_INT >= 34) { // Android 14 (API 34)
            try {
                if (checkSelfPermission(Manifest.permission.USE_FULL_SCREEN_INTENT) != PackageManager.PERMISSION_GRANTED) {
                    Log.w(TAG, "USE_FULL_SCREEN_INTENT permission not granted - requesting");
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
