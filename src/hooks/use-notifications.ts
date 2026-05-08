// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Notification Hooks
// ============================================================================
// React hooks for notification management, permissions, sounds, and TTS.
// Integrates with the notification store, manager, and socket service.
// ============================================================================

'use client';

import { useEffect, useCallback, useState, useRef } from 'react';
import { useNotificationStore, type NotificationItem } from '@/lib/stores/notification-store';
import { notificationManager, type AppNotification } from '@/lib/notifications/notification-manager';
import { voiceManager } from '@/lib/notifications/voice-manager';
import { soundManager } from '@/lib/notifications/sound-manager';
import { usePushNotifications } from '@/hooks/use-push-notifications';
import { socketService } from '@/lib/socket';
import type { NotificationEvent, NotificationType, NotificationPriority } from '@/types';
import { useAuthStore } from '@/lib/stores/auth-store';

// ============================================================================
// useNotifications - Main hook for notification management
// ============================================================================

interface UseNotificationsReturn {
  /** List of notifications */
  notifications: NotificationItem[];
  /** Number of unread notifications */
  unreadCount: number;
  /** Whether notifications are being loaded */
  isLoading: boolean;
  /** Error message if any */
  error: string | null;
  /** Add a new notification */
  addNotification: (notification: AppNotification) => void;
  /** Mark a notification as read */
  markAsRead: (id: string) => void;
  /** Mark all notifications as read */
  markAllAsRead: () => void;
  /** Remove a notification */
  removeNotification: (id: string) => void;
  /** Clear all notifications */
  clearAll: () => void;
  /** Refresh notifications from server */
  refresh: () => Promise<void>;
  /** Filter notifications by type */
  filterByType: (type: NotificationType) => NotificationItem[];
  /** Get notifications by priority */
  filterByPriority: (priority: NotificationPriority) => NotificationItem[];
}

export function useNotifications(): UseNotificationsReturn {
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    fetchNotifications,
  } = useNotificationStore();

  const isInitialized = useRef(false);

  // Initialize notification system once
  useEffect(() => {
    if (isInitialized.current) return;
    isInitialized.current = true;

    notificationManager.init().then(() => {
      // Load default sounds
      soundManager.loadDefaultSounds();
    });

    // Fetch initial notifications
    fetchNotifications();
  }, [fetchNotifications]);

  // Listen for socket notification events
  useEffect(() => {
    const unsubscribe = socketService.onNotification((data: NotificationEvent) => {
      const notification: AppNotification = {
        id: data.id,
        title: data.titleAr || data.titleEn,
        body: data.bodyAr || data.bodyEn,
        type: data.type,
        priority: data.priority,
        data: data.data,
        clickAction: data.actionUrl,
      };

      addNotification(notification);
    });

    return unsubscribe;
  }, [addNotification]);

  // Listen for in-app notification custom events
  useEffect(() => {
    const handleAppNotification = (event: Event) => {
      const customEvent = event as CustomEvent<AppNotification>;
      const notification = customEvent.detail;
      if (notification) {
        addNotification(notification);
      }
    };

    window.addEventListener('app-notification', handleAppNotification);
    return () => {
      window.removeEventListener('app-notification', handleAppNotification);
    };
  }, [addNotification]);

  const refresh = useCallback(async () => {
    await fetchNotifications();
  }, [fetchNotifications]);

  const filterByType = useCallback(
    (type: NotificationType) => {
      return notifications.filter((n) => n.type === type);
    },
    [notifications]
  );

  const filterByPriority = useCallback(
    (priority: NotificationPriority) => {
      return notifications.filter((n) => n.priority === priority);
    },
    [notifications]
  );

  return {
    notifications,
    unreadCount,
    isLoading,
    error,
    addNotification,
    markAsRead,
    markAllAsRead,
    removeNotification,
    clearAll,
    refresh,
    filterByType,
    filterByPriority,
  };
}

// ============================================================================
// useNotificationPermission - Check/request notification permission
// ============================================================================

interface UseNotificationPermissionReturn {
  /** Current permission status */
  permission: NotificationPermission | 'default';
  /** Whether browser notifications are supported */
  isSupported: boolean;
  /** Request notification permission */
  requestPermission: () => Promise<NotificationPermission>;
  /** Whether permission is granted */
  isGranted: boolean;
  /** Whether permission is denied */
  isDenied: boolean;
}

export function useNotificationPermission(): UseNotificationPermissionReturn {
  const [permission, setPermission] = useState<NotificationPermission | 'default'>(
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'default'
  );

  const isSupported = typeof window !== 'undefined' && 'Notification' in window;

  const requestPermission = useCallback(async (): Promise<NotificationPermission> => {
    const result = await notificationManager.requestPermission();
    setPermission(result as NotificationPermission);
    return result as NotificationPermission;
  }, []);

  // Listen for permission changes
  useEffect(() => {
    if (!isSupported) return;

    // Check periodically for permission changes (some browsers don't fire events)
    const interval = setInterval(() => {
      if ('Notification' in window && Notification.permission !== permission) {
        setPermission(Notification.permission);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [isSupported, permission]);

  return {
    permission,
    isSupported,
    requestPermission,
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
  };
}

// ============================================================================
// useNotificationSound - Control notification sounds
// ============================================================================

interface UseNotificationSoundReturn {
  /** Whether sounds are enabled */
  soundEnabled: boolean;
  /** Toggle sounds on/off */
  setSoundEnabled: (enabled: boolean) => void;
  /** Play a specific notification sound */
  playSound: (name: string) => void;
  /** Play default notification sound */
  playNotification: () => void;
  /** Play emergency sound */
  playEmergency: () => void;
  /** Play chat sound */
  playChat: () => void;
  /** Play success sound */
  playSuccess: () => void;
  /** Play error sound */
  playError: () => void;
  /** Set volume level */
  setVolume: (volume: number) => void;
  /** Get current volume */
  volume: number;
  /** Whether audio is available */
  isAvailable: boolean;
  /** Whether vibration is available */
  isVibrationAvailable: boolean;
  /** Whether user has interacted (required for autoplay) */
  hasUserInteracted: boolean;
}

export function useNotificationSound(): UseNotificationSoundReturn {
  const { soundEnabled, setSoundEnabled: storeSetSoundEnabled } = useNotificationStore();
  const [volume, setVolumeState] = useState(soundManager.getVolume());
  const [hasInteracted, setHasInteracted] = useState(soundManager.hasUserInteracted());

  // Sync sound enabled state with sound manager
  useEffect(() => {
    soundManager.setEnabled(soundEnabled);
  }, [soundEnabled]);

  // Monitor user interaction
  useEffect(() => {
    const interval = setInterval(() => {
      setHasInteracted(soundManager.hasUserInteracted());
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const setSoundEnabled = useCallback(
    (enabled: boolean) => {
      storeSetSoundEnabled(enabled);
      soundManager.setEnabled(enabled);
    },
    [storeSetSoundEnabled]
  );

  const playSound = useCallback(
    (name: string) => {
      if (soundEnabled) {
        soundManager.play(name);
      }
    },
    [soundEnabled]
  );

  const playNotification = useCallback(() => {
    if (soundEnabled) soundManager.playNotification();
  }, [soundEnabled]);

  const playEmergency = useCallback(() => {
    // Emergency sounds always play regardless of settings
    soundManager.playEmergency();
  }, []);

  const playChat = useCallback(() => {
    if (soundEnabled) soundManager.playChat();
  }, [soundEnabled]);

  const playSuccess = useCallback(() => {
    if (soundEnabled) soundManager.playSuccess();
  }, [soundEnabled]);

  const playError = useCallback(() => {
    if (soundEnabled) soundManager.playError();
  }, [soundEnabled]);

  const setVolume = useCallback((vol: number) => {
    soundManager.setVolume(vol);
    setVolumeState(vol);
  }, []);

  return {
    soundEnabled,
    setSoundEnabled,
    playSound,
    playNotification,
    playEmergency,
    playChat,
    playSuccess,
    playError,
    setVolume,
    volume,
    isAvailable: soundManager.isAvailable(),
    isVibrationAvailable: soundManager.isVibrationAvailable(),
    hasUserInteracted: hasInteracted,
  };
}

// ============================================================================
// useNotificationTTS - Control text-to-speech
// ============================================================================

interface UseNotificationTTSReturn {
  /** Whether TTS is enabled */
  ttsEnabled: boolean;
  /** Toggle TTS on/off */
  setTtsEnabled: (enabled: boolean) => void;
  /** Speak text in Arabic */
  speak: (text: string, priority?: NotificationPriority) => void;
  /** Stop current speech */
  stop: () => void;
  /** Clear speech queue */
  clearQueue: () => void;
  /** Set voice gender */
  setVoiceGender: (gender: 'male' | 'female') => void;
  /** Whether TTS is available */
  isAvailable: boolean;
  /** Whether TTS is currently speaking */
  isSpeaking: boolean;
  /** Available Arabic voices */
  arabicVoices: SpeechSynthesisVoice[];
  /** Queue length */
  queueLength: number;
}

export function useNotificationTTS(): UseNotificationTTSReturn {
  const { ttsEnabled, setTtsEnabled: storeSetTtsEnabled } = useNotificationStore();
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [queueLength, setQueueLength] = useState(0);
  const [arabicVoices, setArabicVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Initialize voice manager
  useEffect(() => {
    voiceManager.init();

    // Load Arabic voices after a short delay (voices load async in some browsers)
    const voicesTimeout = setTimeout(() => {
      setArabicVoices(voiceManager.getArabicVoices());
    }, 100);

    // Update speaking state periodically
    const interval = setInterval(() => {
      setIsSpeaking(voiceManager.getIsSpeaking());
      setQueueLength(voiceManager.getQueueLength());
    }, 500);

    return () => {
      clearTimeout(voicesTimeout);
      clearInterval(interval);
    };
  }, []);

  const setTtsEnabled = useCallback(
    (enabled: boolean) => {
      storeSetTtsEnabled(enabled);
      if (!enabled) {
        voiceManager.stop();
      }
    },
    [storeSetTtsEnabled]
  );

  const speak = useCallback(
    (text: string, priority: NotificationPriority = 'medium') => {
      if (ttsEnabled) {
        voiceManager.speak(text, { priority });
      }
    },
    [ttsEnabled]
  );

  const stop = useCallback(() => {
    voiceManager.stop();
  }, []);

  const clearQueue = useCallback(() => {
    voiceManager.clearQueue();
  }, []);

  const setVoiceGender = useCallback((gender: 'male' | 'female') => {
    voiceManager.setVoice(gender);
    setArabicVoices(voiceManager.getArabicVoices());
  }, []);

  return {
    ttsEnabled,
    setTtsEnabled,
    speak,
    stop,
    clearQueue,
    setVoiceGender,
    isAvailable: voiceManager.isAvailable(),
    isSpeaking,
    arabicVoices,
    queueLength,
  };
}

// ============================================================================
// useFCMToken - Manage Web Push subscription (VAPID-based, NO Firebase)
// ============================================================================

interface UseFCMTokenReturn {
  /** Whether push notifications are supported */
  isSupported: boolean;
  /** Whether the user is currently subscribed */
  isSubscribed: boolean;
  /** Current notification permission status */
  permission: NotificationPermission | 'default';
  /** Subscribe to push notifications */
  subscribe: () => Promise<boolean>;
  /** Unsubscribe from push notifications */
  unsubscribe: () => Promise<boolean>;
  /** Whether a subscribe/unsubscribe operation is in progress */
  isLoading: boolean;
  /** Last error message, if any */
  error: string | null;
}

export function useFCMToken(): UseFCMTokenReturn {
  const { isSupported, isSubscribed, permission, subscribe, unsubscribe, isLoading, error } =
    usePushNotifications();

  // Auto-subscribe when user logs in and has granted permission
  useEffect(() => {
    if (isSupported && !isSubscribed && permission === 'granted' && !isLoading) {
      subscribe();
    }
  }, [isSupported, isSubscribed, permission, subscribe, isLoading]);

  return {
    isSupported,
    isSubscribed,
    permission,
    subscribe,
    unsubscribe,
    isLoading,
    error,
  };
}
