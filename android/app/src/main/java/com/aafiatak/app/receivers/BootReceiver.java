package com.aafiatak.app.receivers;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

import com.google.firebase.FirebaseApp;
import com.google.firebase.messaging.FirebaseMessaging;

/**
 * Boot receiver that re-initializes Firebase after device restart.
 * This ensures FCM token remains valid and notifications work after reboot.
 */
public class BootReceiver extends BroadcastReceiver {

    private static final String TAG = "AafiatakBootReceiver";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (intent == null || intent.getAction() == null) return;

        String action = intent.getAction();
        Log.d(TAG, "Boot event received: " + action);

        if (Intent.ACTION_BOOT_COMPLETED.equals(action) || 
            "android.intent.action.QUICKBOOT_POWERON".equals(action)) {
            
            // Initialize Firebase app
            try {
                FirebaseApp.initializeApp(context);
                Log.d(TAG, "✅ Firebase re-initialized after boot");
            } catch (Exception e) {
                Log.e(TAG, "❌ Failed to initialize Firebase after boot: " + e.getMessage());
            }
        }
    }
}
