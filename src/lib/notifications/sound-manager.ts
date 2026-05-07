// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Sound Manager
// ============================================================================
// Audio playback system using Web Audio API with oscillator fallback.
// Manages notification sounds, vibration, and Android native bridge.
// ============================================================================

/** Options for sound playback */
export interface SoundOptions {
  /** Volume override for this playback: 0 - 1 */
  volume?: number;
  /** Number of times to repeat the sound */
  repeat?: number;
  /** Whether to vibrate the device (mobile) */
  vibrate?: boolean;
  /** Notification priority level */
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

/** Sound definition for internal tracking */
interface LoadedSound {
  name: string;
  buffer: AudioBuffer;
  url: string;
}

/** Predefined sound configurations using oscillators */
interface ToneConfig {
  frequency: number;
  duration: number;
  type: OscillatorType;
  gain: number;
}

/** Tone configurations for each notification type */
const NOTIFICATION_TONES: Record<string, ToneConfig | ToneConfig[]> = {
  notification: { frequency: 880, duration: 0.15, type: 'sine', gain: 0.3 },
  emergency: [
    { frequency: 880, duration: 0.2, type: 'square', gain: 0.4 },
    { frequency: 660, duration: 0.2, type: 'square', gain: 0.4 },
    { frequency: 880, duration: 0.2, type: 'square', gain: 0.4 },
  ],
  chat: { frequency: 1047, duration: 0.1, type: 'sine', gain: 0.2 },
  success: [
    { frequency: 523, duration: 0.1, type: 'sine', gain: 0.25 },
    { frequency: 659, duration: 0.1, type: 'sine', gain: 0.25 },
    { frequency: 784, duration: 0.15, type: 'sine', gain: 0.25 },
  ],
  error: { frequency: 220, duration: 0.3, type: 'sawtooth', gain: 0.3 },
};

/** Vibration patterns by priority */
const VIBRATION_PATTERNS: Record<string, number | number[]> = {
  low: 50,
  medium: [100, 50, 100],
  high: [200, 100, 200, 100, 200],
  urgent: [300, 100, 300, 100, 300, 100, 300],
  chat: [50, 50, 50],
  error: [200, 100, 200],
};

// ============================================================================
// SoundManager Class
// ============================================================================

class SoundManager {
  private audioContext: AudioContext | null = null;
  private sounds: Map<string, LoadedSound> = new Map();
  private enabled = true;
  private volume = 0.7;
  private initialized = false;
  private userHasInteracted = false;
  private pendingPlays: Array<{ name: string; options: SoundOptions }> = [];

  // ---- Initialization ----

  /** Initialize the audio context. Must be called after user interaction. */
  init(): void {
    if (this.initialized) return;
    if (typeof window === 'undefined') return;

    this.initialized = true;

    // Listen for first user interaction to unlock audio
    const interactionEvents = ['click', 'touchstart', 'keydown', 'pointerdown'] as const;
    const handleInteraction = (): void => {
      this.userHasInteracted = true;
      this.createAudioContext();

      // Process any pending plays
      if (this.pendingPlays.length > 0) {
        const pending = [...this.pendingPlays];
        this.pendingPlays = [];
        for (const item of pending) {
          this.play(item.name, item.options);
        }
      }

      // Remove all listeners after first interaction
      for (const evt of interactionEvents) {
        window.removeEventListener(evt, handleInteraction);
      }
    };

    for (const evt of interactionEvents) {
      window.addEventListener(evt, handleInteraction, { once: false, passive: true });
    }
  }

  /** Create or resume the AudioContext */
  private createAudioContext(): void {
    if (this.audioContext) {
      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {
          // Ignore resume errors
        });
      }
      return;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.audioContext = new AudioCtxClass();

      if (this.audioContext.state === 'suspended') {
        this.audioContext.resume().catch(() => {
          // Ignore resume errors
        });
      }
    } catch {
      console.warn('[SoundManager] Web Audio API not available');
    }
  }

  // ---- Sound Loading ----

  /** Load a sound file from a URL and store it by name */
  async loadSound(name: string, url: string): Promise<void> {
    if (!this.audioContext) {
      this.createAudioContext();
    }

    if (!this.audioContext) {
      console.warn('[SoundManager] Cannot load sound: AudioContext not available');
      return;
    }

    try {
      const response = await fetch(url);
      if (!response.ok) {
        console.warn(`[SoundManager] Failed to fetch sound: ${url}`);
        return;
      }

      const arrayBuffer = await response.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);

      this.sounds.set(name, { name, buffer: audioBuffer, url });
    } catch (error) {
      console.warn(`[SoundManager] Failed to load sound "${name}":`, error);
    }
  }

  /** Load all default notification sounds lazily */
  async loadDefaultSounds(): Promise<void> {
    const soundFiles: Array<{ name: string; url: string }> = [
      { name: 'notification', url: '/sounds/notification.mp3' },
      { name: 'emergency', url: '/sounds/emergency.mp3' },
      { name: 'chat', url: '/sounds/chat.mp3' },
      { name: 'success', url: '/sounds/success.mp3' },
      { name: 'error', url: '/sounds/error.mp3' },
    ];

    const loadPromises = soundFiles.map((s) =>
      this.loadSound(s.name, s.url).catch(() => {
        // Silently fail - oscillator fallback will be used
      })
    );

    await Promise.allSettled(loadPromises);
  }

  // ---- Sound Playback ----

  /** Play a loaded sound by name, with oscillator fallback */
  play(name: string, options: SoundOptions = {}): void {
    if (!this.enabled) return;

    // If audio context not yet available, queue the play
    if (!this.audioContext) {
      if (!this.userHasInteracted) {
        this.pendingPlays.push({ name, options });
        return;
      }
      this.createAudioContext();
    }

    if (!this.audioContext) return;

    const soundVolume = (options.volume ?? this.volume);

    // Try to play loaded sound file first
    const loadedSound = this.sounds.get(name);
    if (loadedSound) {
      this.playBuffer(loadedSound.buffer, soundVolume, options.repeat ?? 1);
    } else {
      // Fallback: use oscillator tone
      this.playToneFallback(name, soundVolume, options);
    }

    // Vibration for mobile devices
    if (options.vibrate !== false) {
      const vibratePriority = options.priority ?? name;
      this.vibrate(vibratePriority);
    }
  }

  /** Play an AudioBuffer through the AudioContext */
  private playBuffer(buffer: AudioBuffer, volume: number, repeat: number): void {
    if (!this.audioContext) return;

    for (let i = 0; i < repeat; i++) {
      const source = this.audioContext.createBufferSource();
      const gainNode = this.audioContext.createGain();

      source.buffer = buffer;
      gainNode.gain.value = volume;

      source.connect(gainNode);
      gainNode.connect(this.audioContext.destination);

      const offset = i * buffer.duration;
      source.start(this.audioContext.currentTime + offset);
    }
  }

  /** Play a predefined tone using oscillator as fallback */
  private playToneFallback(name: string, volume: number, options: SoundOptions): void {
    const toneConfig = NOTIFICATION_TONES[name];
    if (!toneConfig) {
      // Unknown sound, play default notification tone
      this.playToneFallback('notification', volume, options);
      return;
    }

    const repeat = options.repeat ?? 1;

    for (let r = 0; r < repeat; r++) {
      if (Array.isArray(toneConfig)) {
        // Multi-tone sequence
        let totalDuration = 0;
        for (const tone of toneConfig) {
          this.playTone(tone.frequency, tone.duration, tone.type, volume * tone.gain, totalDuration + r * this.calculateTotalDuration(toneConfig));
          totalDuration += tone.duration;
        }
      } else {
        // Single tone
        this.playTone(toneConfig.frequency, toneConfig.duration, toneConfig.type, volume * toneConfig.gain, r * toneConfig.duration);
      }
    }
  }

  /** Calculate total duration of a tone sequence */
  private calculateTotalDuration(tones: ToneConfig[]): number {
    return tones.reduce((sum, t) => sum + t.duration, 0);
  }

  /** Play a tone using Web Audio API oscillator */
  playTone(frequency: number, duration: number, type: OscillatorType = 'sine', gainValue?: number, startOffset = 0): void {
    if (!this.audioContext) {
      this.createAudioContext();
    }

    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.type = type;
    oscillator.frequency.value = frequency;

    const effectiveGain = gainValue ?? this.volume * 0.3;
    gainNode.gain.setValueAtTime(effectiveGain, this.audioContext.currentTime + startOffset);
    gainNode.gain.exponentialRampToValueAtTime(
      0.001,
      this.audioContext.currentTime + startOffset + duration
    );

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.start(this.audioContext.currentTime + startOffset);
    oscillator.stop(this.audioContext.currentTime + startOffset + duration + 0.01);
  }

  // ---- Predefined Sound Methods ----

  /** Play default notification sound */
  playNotification(): void {
    this.play('notification', { priority: 'medium' });
  }

  /** Play emergency/urgent notification sound */
  playEmergency(): void {
    this.play('emergency', {
      priority: 'urgent',
      repeat: 2,
      volume: 1.0,
      vibrate: true,
    });
  }

  /** Play chat message sound */
  playChat(): void {
    this.play('chat', { priority: 'low', volume: 0.5 });
  }

  /** Play success sound */
  playSuccess(): void {
    this.play('success', { priority: 'medium' });
  }

  /** Play error sound */
  playError(): void {
    this.play('error', { priority: 'high' });
  }

  // ---- Vibration ----

  /** Vibrate the device using the Vibration API (mobile) */
  vibrate(pattern: string | number | number[]): void {
    if (typeof navigator === 'undefined') return;
    if (!('vibrate' in navigator)) return;

    let vibrationPattern: number | number[];

    if (typeof pattern === 'string') {
      vibrationPattern = VIBRATION_PATTERNS[pattern] ?? VIBRATION_PATTERNS['medium'];
    } else {
      vibrationPattern = pattern;
    }

    try {
      navigator.vibrate(vibrationPattern);
    } catch {
      // Vibration not supported or permission denied
    }
  }

  // ---- Android Native Bridge ----

  /**
   * Communicate with the Android WebView native bridge.
   * Used when the app is running inside an Android WebView wrapper
   * and needs to trigger native notifications or sounds.
   */
  private nativeBridge(action: string, data?: Record<string, unknown>): void {
    if (typeof window === 'undefined') return;

    // Check for Android native bridge
    const androidBridge = (window as unknown as Record<string, unknown>)['AndroidBridge'] as
      | { postMessage?: (message: string) => void }
      | undefined;

    if (androidBridge?.postMessage) {
      const message = JSON.stringify({
        action,
        data: data ?? {},
        timestamp: Date.now(),
      });
      androidBridge.postMessage(message);
      return;
    }

    // Check for generic webkit messageHandlers (iOS-style bridge adapted for Android)
    const webkit = (window as unknown as Record<string, unknown>)['webkit'] as
      | { messageHandlers?: Record<string, { postMessage?: (message: string) => void }> }
      | undefined;

    if (webkit?.messageHandlers?.[action]?.postMessage) {
      webkit.messageHandlers[action].postMessage(JSON.stringify(data ?? {}));
    }
  }

  /** Send a native notification through the Android bridge */
  sendNativeNotification(title: string, body: string, data?: Record<string, unknown>): void {
    this.nativeBridge('notification', { title, body, ...data });
  }

  /** Play a native sound through the Android bridge */
  playNativeSound(soundName: string): void {
    this.nativeBridge('playSound', { sound: soundName });
  }

  // ---- Volume & Enable/Disable ----

  /** Set the global volume level */
  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
  }

  /** Get the current volume level */
  getVolume(): number {
    return this.volume;
  }

  /** Enable or disable all sounds */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  /** Check if sounds are enabled */
  isEnabled(): boolean {
    return this.enabled;
  }

  /** Check if Web Audio API is available */
  isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    return !!(window.AudioContext || (window as unknown as Record<string, unknown>)['webkitAudioContext']);
  }

  /** Check if vibration is available */
  isVibrationAvailable(): boolean {
    if (typeof navigator === 'undefined') return false;
    return 'vibrate' in navigator;
  }

  /** Check if user has interacted (required for audio playback) */
  hasUserInteracted(): boolean {
    return this.userHasInteracted;
  }

  // ---- Cleanup ----

  /** Clean up all resources */
  destroy(): void {
    this.sounds.clear();
    this.pendingPlays = [];

    if (this.audioContext) {
      this.audioContext.close().catch(() => {
        // Ignore close errors
      });
      this.audioContext = null;
    }

    this.initialized = false;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/** Global SoundManager instance for audio playback */
export const soundManager = new SoundManager();

export default soundManager;
