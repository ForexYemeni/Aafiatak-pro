package com.aafiatak.app.services;

import android.content.Intent;
import android.util.Log;
import com.google.firebase.iid.FirebaseInstanceId;
import com.google.firebase.iid.FirebaseInstanceIdService;

/**
 * Handles FCM Instance ID token refresh events.
 * When the token changes, we store it and make it available to the JS bridge.
 * 
 * Note: FirebaseInstanceIdService is deprecated in newer Firebase versions,
 * but we include it for backward compatibility with devices running older
 * Google Play Services.
 */
public class AafiatakInstanceIDService extends FirebaseInstanceIdService {

    private static final String TAG = "AafiatakInstanceID";

    @Override
    public void onTokenRefresh() {
        // Get updated InstanceID token
        String refreshedToken = FirebaseInstanceId.getInstance().getToken();
        Log.d(TAG, "Token refreshed: " + (refreshedToken != null ? refreshedToken.substring(0, Math.min(refreshedToken.length(), 20)) + "..." : "null"));

        if (refreshedToken != null) {
            // Store token for Capacitor JS bridge
            AafiatakFCMTokenHolder.setCurrentToken(refreshedToken);
            
            // Also save to SharedPreferences
            getSharedPreferences("aafiatak_prefs", MODE_PRIVATE)
                .edit()
                .putString("fcm_token", refreshedToken)
                .apply();
        }
    }
}
