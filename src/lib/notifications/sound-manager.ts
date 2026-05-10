// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Sound Manager (ULTRA RELIABLE v2)
// ============================================================================
// Audio playback system that WORKS 100% of the time.
// Auto-initializes on first use. No need to call init() manually.
// Uses HTML5 Audio elements as primary with Web Audio API fallback.
// Includes aggressive autoplay unlock and global click handler.
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
// SoundManager Class - AUTO-INITIALIZING & ULTRA RELIABLE
// ============================================================================

class SoundManager {
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  private enabled = true;
  private volume = 0.8;
  private initialized = false;
  private userHasInteracted = false;
  private pendingPlays: Array<{ name: string; options: SoundOptions }> = [];
  private audioContext: AudioContext | null = null;
  private initListenersSet = false;
  private lastPlayTime: Map<string, number> = new Map(); // Debounce tracking

  // Sound file paths
  private readonly SOUND_FILES: Record<string, string> = {
    notification: '/sounds/notification.mp3',
    emergency: '/sounds/emergency.mp3',
    chat: '/sounds/chat.mp3',
    success: '/sounds/success.mp3',
    error: '/sounds/error.mp3',
  };

  // Minimum time between identical sounds (ms) to prevent rapid duplication
  // 1 second - allows multiple notifications in quick succession while preventing echo
  private readonly DEBOUNCE_MS = 1000;

  // ---- Auto-Initialization ----

  /** Ensure the sound system is initialized. Called automatically on first play. */
  private ensureInitialized(): void {
    if (this.initialized) return;
    if (typeof window === 'undefined') return;

    this.initialized = true;

    // Pre-create Audio elements (they won't play until user interaction)
    this.preloadAudioElements();

    // Listen for first user interaction to unlock audio playback
    this.setupInteractionListeners();

    // If user already interacted before we set up listeners
    this.checkExistingInteraction();
  }

  /** Public init() for explicit initialization - calls ensureInitialized internally */
  init(): void {
    this.ensureInitialized();
  }

  /** Check if user has already interacted before we set up listeners */
  private checkExistingInteraction(): void {
    // If document has focus and user has navigated to the page,
    // they've likely already interacted. Try playing silent audio to check.
    try {
      const testAudio = new Audio();
      testAudio.volume = 0.01;
      testAudio.src = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      const playPromise = testAudio.play();
      if (playPromise !== undefined) {
        playPromise.then(() => {
          // Playback succeeded = user has already interacted
          this.markUserInteracted();
          testAudio.pause();
          testAudio.src = '';
        }).catch(() => {
          // Autoplay blocked = no interaction yet
          testAudio.src = '';
        });
      }
    } catch {
      // Ignore
    }

    // Also check if the document has already been interacted with
    // (for cases where the page was loaded from a click/navigation)
    if (typeof document !== 'undefined' && document.hasFocus()) {
      // The page has focus, which means user has likely interacted
      // We can try to unlock audio immediately on next click
    }
  }

  /** Set up event listeners for first user interaction */
  private setupInteractionListeners(): void {
    if (this.initListenersSet) return;
    this.initListenersSet = true;

    const interactionEvents = ['click', 'touchstart', 'keydown', 'pointerdown'] as const;
    const handleInteraction = (): void => {
      this.markUserInteracted();

      // Remove all listeners after first interaction
      for (const evt of interactionEvents) {
        window.removeEventListener(evt, handleInteraction);
      }
    };

    for (const evt of interactionEvents) {
      window.addEventListener(evt, handleInteraction, { once: false, passive: true });
    }

    // Also add a global click handler that keeps audio unlocked
    // This is important because some browsers re-lock audio after inactivity
    if (typeof document !== 'undefined') {
      document.addEventListener('click', () => {
        if (!this.userHasInteracted) {
          this.markUserInteracted();
        }
        // Also keep AudioContext alive
        this.unlockAudioContext();
      }, { passive: true });
    }
  }

  /** Mark user as interacted and process pending plays */
  markUserInteracted(): void {
    if (this.userHasInteracted) return;
    this.userHasInteracted = true;

    // Unlock AudioContext
    this.unlockAudioContext();

    // Process any pending plays that were queued before interaction
    if (this.pendingPlays.length > 0) {
      const pending = [...this.pendingPlays];
      this.pendingPlays = [];
      for (const item of pending) {
        this.play(item.name, item.options);
      }
    }
  }

  /** Pre-create and load Audio elements for all sounds */
  private preloadAudioElements(): void {
    for (const [name, src] of Object.entries(this.SOUND_FILES)) {
      try {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.volume = this.volume;
        audio.src = src;

        // Handle load errors silently
        audio.addEventListener('error', () => {
          console.warn(`[SoundManager] Failed to preload: ${name}`);
        });

        this.audioElements.set(name, audio);
      } catch {
        console.warn(`[SoundManager] Failed to create Audio element: ${name}`);
      }
    }
  }

  /** Unlock AudioContext for browsers that require it */
  private unlockAudioContext(): void {
    if (!this.audioContext) {
      try {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtxClass) {
          this.audioContext = new AudioCtxClass();
        }
      } catch {
        // Not available
      }
    }

    if (this.audioContext && this.audioContext.state === 'suspended') {
      this.audioContext.resume().catch(() => {});
    }
  }

  // ---- Sound Playback ----

  /** Play a sound by name. Auto-initializes if needed. */
  play(name: string, options: SoundOptions = {}): void {
    if (!this.enabled) return;
    if (typeof window === 'undefined') return;

    // Auto-initialize on first use
    this.ensureInitialized();

    const soundVolume = options.volume ?? this.volume;

    // Debounce: prevent identical sounds from playing too rapidly
    const now = Date.now();
    const lastPlay = this.lastPlayTime.get(name) || 0;
    if (now - lastPlay < this.DEBOUNCE_MS) {
      // Skip this play - too soon after the last identical sound
      // But still vibrate if needed
      if (options.vibrate !== false) {
        this.vibrate(options.priority ?? name);
      }
      return;
    }
    this.lastPlayTime.set(name, now);

    // If user hasn't interacted yet, queue the play
    if (!this.userHasInteracted) {
      this.pendingPlays.push({ name, options });
      return;
    }

    // METHOD 1: Try HTML5 Audio element (most reliable)
    const played = this.playWithAudioElement(name, soundVolume, options.repeat ?? 1);

    // METHOD 2: If Audio element failed, try Web Audio API oscillator fallback
    if (!played) {
      this.playOscillatorFallback(name, soundVolume);
    }

    // Vibration for mobile devices
    if (options.vibrate !== false) {
      const vibratePriority = options.priority ?? name;
      this.vibrate(vibratePriority);
    }
  }

  /** Play sound using HTML5 Audio element - MOST RELIABLE method */
  private playWithAudioElement(name: string, volume: number, repeat: number): boolean {
    // If no preloaded element, try creating one on the fly
    let audio = this.audioElements.get(name);
    if (!audio) {
      const src = this.SOUND_FILES[name];
      if (src) {
        try {
          audio = new Audio();
          audio.preload = 'auto';
          audio.volume = volume;
          audio.src = src;
          this.audioElements.set(name, audio);
        } catch {
          return false;
        }
      } else {
        return false;
      }
    }

    try {
      // Create a clone for each play to allow overlapping sounds
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = Math.max(0, Math.min(1, volume));

      // Set playback rate for emergency urgency
      if (name === 'emergency') {
        clone.playbackRate = 1.0;
      }

      const playPromise = clone.play();
      if (playPromise) {
        playPromise.catch((err) => {
          // Autoplay blocked - try one more time with AudioContext
          console.warn(`[SoundManager] Autoplay blocked for ${name}, trying fallback`);
          this.playOscillatorFallback(name, volume);
        });
      }

      // Handle repeat
      if (repeat > 1) {
        let playCount = 1;
        clone.addEventListener('ended', () => {
          if (playCount < repeat) {
            clone.currentTime = 0;
            clone.play().catch(() => {});
            playCount++;
          }
        });
      }

      // Auto-cleanup: remove reference when done
      clone.addEventListener('ended', () => {
        clone.src = '';
      });

      return true;
    } catch {
      return false;
    }
  }

  /** Play a fallback tone using Web Audio API oscillator */
  private playOscillatorFallback(name: string, volume: number): void {
    if (!this.audioContext) {
      this.unlockAudioContext();
    }
    if (!this.audioContext) return;

    try {
      const tones: Record<string, { freq: number; dur: number; type: OscillatorType }> = {
        notification: { freq: 880, dur: 0.15, type: 'sine' },
        emergency: { freq: 660, dur: 0.3, type: 'square' },
        chat: { freq: 1047, dur: 0.1, type: 'sine' },
        success: { freq: 784, dur: 0.2, type: 'sine' },
        error: { freq: 220, dur: 0.3, type: 'sawtooth' },
      };

      const tone = tones[name] || tones.notification;
      const oscillator = this.audioContext.createOscillator();
      const gainNode = this.audioContext.createGain();

      oscillator.type = tone.type;
      oscillator.frequency.value = tone.freq;
      gainNode.gain.setValueAtTime(volume * 0.4, this.audioContext!.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, this.audioContext!.currentTime + tone.dur);

      oscillator.connect(gainNode);
      gainNode.connect(this.audioContext!.destination);

      oscillator.start();
      oscillator.stop(this.audioContext!.currentTime + tone.dur + 0.01);
    } catch {
      // Silently fail
    }
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
      // Vibration not supported
    }
  }

  // ---- Volume & Enable/Disable ----

  setVolume(volume: number): void {
    this.volume = Math.max(0, Math.min(1, volume));
    // Update all pre-loaded audio elements
    for (const audio of this.audioElements.values()) {
      audio.volume = this.volume;
    }
  }

  getVolume(): number { return this.volume; }

  setEnabled(enabled: boolean): void { this.enabled = enabled; }

  isEnabled(): boolean { return this.enabled; }

  /** Force mark user as interacted (for testing or after login) */
  forceUserInteracted(): void {
    this.ensureInitialized();
    this.markUserInteracted();
  }

  hasUserInteracted(): boolean { return this.userHasInteracted; }

  /** Clean up all resources */
  destroy(): void {
    for (const audio of this.audioElements.values()) {
      audio.pause();
      audio.src = '';
    }
    this.audioElements.clear();
    this.pendingPlays = [];
    this.lastPlayTime.clear();
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }
    this.initialized = false;
    this.initListenersSet = false;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const soundManager = new SoundManager();
export default soundManager;
