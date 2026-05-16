package com.aafiatak.app.services;

/**
 * Holds the current FCM token so it can be accessed from other parts of the app.
 * This is needed because the FirebaseMessagingService runs in a different context
 * than the Capacitor WebView, and we need to pass the token between them.
 */
public class AafiatakFCMTokenHolder {
    private static String currentToken = null;

    public static void setCurrentToken(String token) {
        currentToken = token;
    }

    public static String getCurrentToken() {
        return currentToken;
    }

    public static boolean hasToken() {
        return currentToken != null && !currentToken.isEmpty();
    }
}
