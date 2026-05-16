package com.aafiatak.app.services;

import android.content.Context;
import android.content.SharedPreferences;
import android.util.Log;

/**
 * Holds the current FCM token so it can be accessed from other parts of the app.
 * This is needed because the FirebaseMessagingService runs in a different context
 * than the Capacitor WebView, and we need to pass the token between them.
 *
 * CRITICAL FIX: Also persists the token to SharedPreferences so it survives
 * process kills. When the app process is killed and restarted by FCM,
 * the static variable is null but SharedPreferences still has the token.
 * Call initFromPrefs() on service creation to restore the token.
 */
public class AafiatakFCMTokenHolder {
    private static final String TAG = "AafiatakFCMTokenHolder";
    private static final String PREFS_NAME = "aafiatak_prefs";
    private static final String PREF_FCM_TOKEN = "fcm_token";

    private static String currentToken = null;
    private static Context appContext = null;

    /**
     * Initialize with application context for SharedPreferences access.
     * Must be called once from Application.onCreate() or Service.onCreate().
     */
    public static void init(Context context) {
        if (context != null) {
            appContext = context.getApplicationContext();
        }
        // Try to restore token from SharedPreferences
        restoreFromPrefs();
    }

    public static void setCurrentToken(String token) {
        currentToken = token;
        // Persist to SharedPreferences
        if (appContext != null && token != null) {
            try {
                SharedPreferences prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
                prefs.edit().putString(PREF_FCM_TOKEN, token).apply();
                Log.d(TAG, "FCM token saved to SharedPreferences");
            } catch (Exception e) {
                Log.w(TAG, "Failed to save FCM token to prefs: " + e.getMessage());
            }
        }
    }

    public static String getCurrentToken() {
        // If in-memory token is null, try SharedPreferences
        if (currentToken == null) {
            restoreFromPrefs();
        }
        return currentToken;
    }

    public static boolean hasToken() {
        return getCurrentToken() != null && !getCurrentToken().isEmpty();
    }

    /**
     * Restore token from SharedPreferences (survives process kill).
     */
    private static void restoreFromPrefs() {
        if (currentToken != null) return; // Already have it
        if (appContext == null) return; // No context yet

        try {
            SharedPreferences prefs = appContext.getSharedPreferences(PREFS_NAME, Context.MODE_PRIVATE);
            String savedToken = prefs.getString(PREF_FCM_TOKEN, null);
            if (savedToken != null && !savedToken.isEmpty()) {
                currentToken = savedToken;
                Log.d(TAG, "FCM token restored from SharedPreferences");
            }
        } catch (Exception e) {
            Log.w(TAG, "Failed to restore FCM token from prefs: " + e.getMessage());
        }
    }
}
