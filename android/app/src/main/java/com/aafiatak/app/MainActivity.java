package com.aafiatak.app;

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.Manifest;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.util.Log;
import android.webkit.WebView;
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
     * Handle deep links and notification tap intents.
     * When a notification is tapped, the FCM service puts a "url" extra
     * in the intent. We navigate the WebView to that URL.
     * Also handles custom scheme deep links like aafiatak://path
     */
    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
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
