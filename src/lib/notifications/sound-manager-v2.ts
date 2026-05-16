// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Sound Manager V2
// ============================================================================
// Complete rewrite of the original SoundManager that fixes:
//   1. DEBOUNCE_MS = 1000 too aggressive → reduced to 300ms
//   2. Autoplay policy handling unreliable → force unlock on EVERY interaction
//   3. AudioContext suspended & not resumed → resume before EVERY play attempt
//   4. No AudioContext warm-up → warm-up on first user interaction
//   5. Multiple tab sound conflicts → tab visibility awareness
//
// Architecture:
//   - Primary:   AudioBuffer playback via Web Audio API (most reliable)
//   - Fallback:  HTML5 Audio element
//   - Last resort: Oscillator tone
//   - Aggressive AudioContext lifecycle management
//   - Priority-based sound queue (urgent interrupts, medium queues)
//   - Tab visibility awareness (reduce sounds in background)
//   - Per-sound-type volume control
//   - Vibration patterns for mobile
//   - Sound dedup integration
//   - Structured logging via notification-logger
// ============================================================================

import { markSoundPlayed, isSoundPlayed } from './sound-dedup';
import { notificationLogger, type AudioEventType } from './notification-logger';

// ============================================================================
// Types
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
  /** Optional notification ID for dedup (skips sound if already played) */
  notificationId?: string;
}

/** Internal queued sound item */
interface QueuedSound {
  name: string;
  options: SoundOptions;
  queuedAt: number;
}

/** Per-sound-type configuration */
interface SoundConfig {
  src: string;
  defaultVolume: number;
  defaultPriority: 'low' | 'medium' | 'high' | 'urgent';
  /** Oscillator fallback tone configuration */
  tone: { freq: number; dur: number; type: OscillatorType };
  /** Vibration pattern key or custom pattern */
  vibrationKey: string;
}

/** Vibration patterns by priority / sound type */
const VIBRATION_PATTERNS: Record<string, number | number[]> = {
  low: 50,
  medium: [100, 50, 100],
  high: [200, 100, 200, 100, 200],
  urgent: [300, 100, 300, 100, 300, 100, 300],
  notification: [100, 50, 100],
  emergency: [300, 100, 300, 100, 300, 100, 300],
  chat: [50, 50, 50],
  success: [100, 50, 100],
  error: [200, 100, 200],
};

/** Sound file definitions with per-sound defaults */
const SOUND_CONFIGS: Record<string, SoundConfig> = {
  notification: {
    src: '/sounds/notification.mp3',
    defaultVolume: 0.8,
    defaultPriority: 'medium',
    tone: { freq: 880, dur: 0.15, type: 'sine' },
    vibrationKey: 'notification',
  },
  emergency: {
    src: '/sounds/emergency.mp3',
    defaultVolume: 1.0,
    defaultPriority: 'urgent',
    tone: { freq: 660, dur: 0.3, type: 'square' },
    vibrationKey: 'emergency',
  },
  chat: {
    src: '/sounds/chat.mp3',
    defaultVolume: 0.5,
    defaultPriority: 'low',
    tone: { freq: 1047, dur: 0.1, type: 'sine' },
    vibrationKey: 'chat',
  },
  success: {
    src: '/sounds/success.mp3',
    defaultVolume: 0.8,
    defaultPriority: 'medium',
    tone: { freq: 784, dur: 0.2, type: 'sine' },
    vibrationKey: 'success',
  },
  error: {
    src: '/sounds/error.mp3',
    defaultVolume: 0.8,
    defaultPriority: 'high',
    tone: { freq: 220, dur: 0.3, type: 'sawtooth' },
    vibrationKey: 'error',
  },
};

// ============================================================================
// Constants
// ============================================================================

/** Reduced debounce: 300ms (was 1000ms) — allows rapid notification sounds */
const DEBOUNCE_MS = 300;

/** Maximum sounds in the queue before dropping oldest low/medium priority */
const MAX_QUEUE_SIZE = 20;

/** How long a queued sound lives before being discarded (ms) */
const QUEUE_TTL_MS = 10_000;

/** Interval for AudioContext keep-alive pulse (ms) */
const KEEP_ALIVE_INTERVAL_MS = 30_000;

/** Priority rank mapping (higher number = higher priority) */
const PRIORITY_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

// ============================================================================
// SoundManagerV2 Class
// ============================================================================

class SoundManagerV2 {
  // ---- State ----
  private enabled = true;
  private globalVolume = 0.8;
  private initialized = false;
  private userHasInteracted = false;
  private destroyed = false;

  // ---- Audio Resources ----
  /** HTML5 Audio elements for fallback playback */
  private audioElements: Map<string, HTMLAudioElement> = new Map();
  /** Decoded AudioBuffers for primary Web Audio API playback */
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  /** Track which sounds failed to load as buffers so we don't retry endlessly */
  private bufferLoadFailed: Set<string> = new Set();
  /** Shared AudioContext — created on first user interaction, kept alive */
  private audioContext: AudioContext | null = null;

  // ---- Interaction & Debounce ----
  private interactionListenersSet = false;
  private lastPlayTime: Map<string, number> = new Map();

  // ---- Sound Queue ----
  private soundQueue: QueuedSound[] = [];
  private queueProcessing = false;

  // ---- Tab Visibility ----
  private isTabVisible = true;

  // ---- Keep-alive ----
  private keepAliveTimer: ReturnType<typeof setInterval> | null = null;

  // ---- Per-sound volume overrides ----
  private soundVolumes: Map<string, number> = new Map();

  // ---- Currently playing sources for interrupt support ----
  private activeSources: Map<string, AudioBufferSourceNode> = new Map();

  // ============================================================================
  // Initialization
  // ============================================================================

  /**
   * Initialize the sound system. Safe to call multiple times.
   * Sets up AudioContext, preloads sounds, and registers interaction listeners.
   */
  init(): void {
    if (this.initialized || this.destroyed) return;
    if (typeof window === 'undefined') return;

    this.initialized = true;
    notificationLogger.logAudio('preload', { action: 'init' });

    // 1. Preload HTML5 Audio elements (works even before user interaction)
    this.preloadAudioElements();

    // 2. Attempt to preload AudioBuffers (will retry after user interaction if AudioContext is blocked)
    this.preloadAudioBuffers();

    // 3. Set up aggressive user interaction listeners
    this.setupInteractionListeners();

    // 4. Tab visibility tracking
    this.setupVisibilityListeners();

    // 5. Start AudioContext keep-alive
    this.startKeepAlive();

    // 6. Check if user already interacted before we set up listeners
    this.checkExistingInteraction();
  }

  /** Lazy auto-init guard — called before every play */
  private ensureInitialized(): void {
    if (!this.initialized && !this.destroyed) {
      this.init();
    }
  }

  // ============================================================================
  // AudioContext Lifecycle
  // ============================================================================

  /**
   * Get or create the AudioContext.
   * Creation is deferred until we know the browser allows it,
   * but we eagerly try in case autoplay is already allowed.
   */
  private getOrCreateAudioContext(): AudioContext | null {
    if (this.audioContext) return this.audioContext;

    try {
      const AudioCtxClass =
        window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtxClass) return null;

      this.audioContext = new AudioCtxClass();
      notificationLogger.info('audio', 'AudioContext created', {
        action: 'audiocontext_created',
        state: this.audioContext.state,
      });

      // If context is already running, preload buffers now
      if (this.audioContext.state === 'running') {
        this.preloadAudioBuffers();
      }

      return this.audioContext;
    } catch (err) {
      notificationLogger.warn('audio', 'Failed to create AudioContext', {
        action: 'audiocontext_failed',
        reason: String(err),
      });
      return null;
    }
  }

  /**
   * Ensure AudioContext is running. Resume if suspended.
   * Called before EVERY play attempt and on every user interaction.
   * Returns true if the context is (or was successfully resumed to) running.
   */
  private async ensureAudioContextRunning(): Promise<boolean> {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx) return false;

    // Capture state once to avoid TypeScript narrowing issues across async boundaries
    const currentState = ctx.state;
    if (currentState === 'running') return true;

    if (currentState === 'suspended') {
      try {
        await ctx.resume();
        const stateAfterResume: AudioContextState = ctx.state;
        notificationLogger.info('audio', 'AudioContext resumed', {
          action: 'audiocontext_resumed',
          state: stateAfterResume,
        });
        // Now that context is running, try preloading buffers if not done
        this.preloadAudioBuffers();
        return stateAfterResume === 'running';
      } catch (err) {
        notificationLogger.warn('audio', 'AudioContext resume failed', {
          action: 'audiocontext_resume_failed',
          reason: String(err),
        });
        return false;
      }
    }

    // 'closed' — irrecoverable, create a new one next time
    if (ctx.state === 'closed') {
      this.audioContext = null;
      return false;
    }

    return false;
  }

  /**
   * Play a short silent buffer to "warm up" the AudioContext.
   * This is crucial for mobile browsers that require audio to originate
   * from a user gesture.
   */
  private warmUpAudioContext(): void {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    try {
      const buffer = ctx.createBuffer(1, 1, 22050);
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start(0);
      notificationLogger.debug('audio', 'AudioContext warmed up', {
        action: 'audiocontext_warmup',
      });
    } catch {
      // Silent fail — warm-up is best-effort
    }
  }

  /** Start a periodic keep-alive to prevent AudioContext from being garbage-collected */
  private startKeepAlive(): void {
    if (this.keepAliveTimer) return;

    this.keepAliveTimer = setInterval(() => {
      if (this.destroyed) {
        this.stopKeepAlive();
        return;
      }
      // Resume if suspended and user has interacted
      if (this.userHasInteracted && this.audioContext?.state === 'suspended') {
        this.audioContext.resume().catch(() => {});
      }
    }, KEEP_ALIVE_INTERVAL_MS);
  }

  private stopKeepAlive(): void {
    if (this.keepAliveTimer) {
      clearInterval(this.keepAliveTimer);
      this.keepAliveTimer = null;
    }
  }

  // ============================================================================
  // User Interaction Detection
  // ============================================================================

  /**
   * Set up listeners for user interaction events.
   * IMPORTANT: We listen on EVERY interaction (not just the first) to
   * force-unlock audio on each gesture. This is necessary because some
   * browsers re-suspend AudioContext after periods of inactivity.
   */
  private setupInteractionListeners(): void {
    if (this.interactionListenersSet) return;
    this.interactionListenersSet = true;

    const interactionEvents = ['click', 'touchstart', 'keydown', 'pointerdown'] as const;

    const handleInteraction = (): void => {
      if (this.destroyed) return;

      const wasInteracted = this.userHasInteracted;
      this.userHasInteracted = true;

      // Force audio unlock on EVERY user interaction
      this.ensureAudioContextRunning().then((running) => {
        if (running) {
          this.warmUpAudioContext();
          // Retry loading any buffers that failed earlier
          this.preloadAudioBuffers();
        }
      });

      // Process pending queue on first interaction
      if (!wasInteracted && this.soundQueue.length > 0) {
        notificationLogger.info('audio', 'First user interaction — processing queued sounds', {
          action: 'first_interaction',
          queueSize: this.soundQueue.length,
        });
        this.processQueue();
      }
    };

    for (const evt of interactionEvents) {
      window.addEventListener(evt, handleInteraction, { passive: true });
    }

    notificationLogger.debug('audio', 'Interaction listeners registered', {
      action: 'interaction_listeners_set',
    });
  }

  /** Check if the user has already interacted before we registered listeners */
  private checkExistingInteraction(): void {
    // Attempt silent playback to detect if autoplay is already allowed
    try {
      const testAudio = new Audio();
      testAudio.volume = 0.01;
      testAudio.src =
        'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=';
      const promise = testAudio.play();
      if (promise !== undefined) {
        promise
          .then(() => {
            this.userHasInteracted = true;
            testAudio.pause();
            testAudio.src = '';
            this.ensureAudioContextRunning().then((running) => {
              if (running) {
                this.warmUpAudioContext();
                this.preloadAudioBuffers();
                this.processQueue();
              }
            });
            notificationLogger.info('audio', 'Autoplay already allowed — user previously interacted', {
              action: 'autoplay_detected',
            });
          })
          .catch(() => {
            testAudio.src = '';
          });
      }
    } catch {
      // Ignore
    }
  }

  // ============================================================================
  // Tab Visibility
  // ============================================================================

  private setupVisibilityListeners(): void {
    if (typeof document === 'undefined') return;

    const handleVisibility = (): void => {
      this.isTabVisible = !document.hidden;
      notificationLogger.debug('audio', 'Tab visibility changed', {
        action: 'visibility_change',
        visible: this.isTabVisible,
      });
    };

    document.addEventListener('visibilitychange', handleVisibility, { passive: true });

    // Check initial state
    this.isTabVisible = !document.hidden;
  }

  // ============================================================================
  // Preloading
  // ============================================================================

  /** Pre-create and load HTML5 Audio elements for all sounds */
  private preloadAudioElements(): void {
    const entries = Object.entries(SOUND_CONFIGS);
    for (let i = 0; i < entries.length; i++) {
      const [name, config] = entries[i];
      if (this.audioElements.has(name)) continue;

      try {
        const audio = new Audio();
        audio.preload = 'auto';
        audio.volume = this.getEffectiveVolume(name);
        audio.src = config.src;

        audio.addEventListener('error', () => {
          notificationLogger.logAudio('preload-error', {
            action: 'preload_html5_failed',
            soundName: name,
          });
        });

        this.audioElements.set(name, audio);
      } catch (err) {
        notificationLogger.logAudio('preload-error', {
          action: 'create_html5_failed',
          soundName: name,
          reason: String(err),
        });
      }
    }
  }

  /**
   * Preload sounds as AudioBuffers via Web Audio API.
   * Requires AudioContext to be running; will silently skip if not available
   * and retry later when the context becomes available.
   */
  private preloadAudioBuffers(): void {
    const ctx = this.getOrCreateAudioContext();
    if (!ctx || ctx.state !== 'running') return;

    const entries = Object.entries(SOUND_CONFIGS);
    for (let i = 0; i < entries.length; i++) {
      const [name, config] = entries[i];
      if (this.audioBuffers.has(name)) continue;
      if (this.bufferLoadFailed.has(name)) continue;

      this.fetchAndDecodeBuffer(name, config.src);
    }
  }

  /** Fetch an audio file and decode it into an AudioBuffer */
  private async fetchAndDecodeBuffer(name: string, src: string): Promise<void> {
    try {
      const response = await fetch(src);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      const arrayBuffer = await response.arrayBuffer();
      const ctx = this.audioContext;
      if (!ctx) return;

      const audioBuffer = await ctx.decodeAudioData(arrayBuffer);
      this.audioBuffers.set(name, audioBuffer);
      notificationLogger.logAudio('preload', {
        action: 'buffer_loaded',
        soundName: name,
        duration: audioBuffer.duration,
      });
    } catch (err) {
      this.bufferLoadFailed.add(name);
      notificationLogger.logAudio('preload-error', {
        action: 'buffer_load_failed',
        soundName: name,
        reason: String(err),
      });
    }
  }

  // ============================================================================
  // Volume
  // ============================================================================

  /** Get the effective volume for a sound: per-sound override → global volume */
  private getEffectiveVolume(name: string): number {
    const override = this.soundVolumes.get(name);
    if (override !== undefined) return override;

    const config = SOUND_CONFIGS[name];
    if (config) return config.defaultVolume * this.globalVolume;

    return this.globalVolume;
  }

  // ============================================================================
  // Core Playback
  // ============================================================================

  /**
   * Play a sound by name. Auto-initializes if needed.
   *
   * Playback strategy (in order):
   *  1. AudioBuffer via Web Audio API (most reliable for notifications)
   *  2. HTML5 Audio element fallback
   *  3. Oscillator tone fallback (last resort)
   */
  play(name: string, options: SoundOptions = {}): void {
    if (!this.enabled) return;
    if (typeof window === 'undefined') return;
    if (this.destroyed) return;

    // Auto-initialize on first use
    this.ensureInitialized();

    // Sound dedup: skip if this notification already had a sound played
    if (options.notificationId) {
      if (isSoundPlayed(options.notificationId)) {
        notificationLogger.logAudio('debounced' as AudioEventType, {
          action: 'dedup_skip',
          soundName: name,
          notificationId: options.notificationId,
        });
        return;
      }
      markSoundPlayed(options.notificationId);
    }

    // Resolve effective priority
    const config = SOUND_CONFIGS[name];
    const priority = options.priority ?? config?.defaultPriority ?? 'medium';

    // Debounce: prevent identical sounds from playing too rapidly
    const now = Date.now();
    const lastPlay = this.lastPlayTime.get(name) || 0;
    const debounceMs = priority === 'urgent' ? 0 : DEBOUNCE_MS; // Urgent sounds bypass debounce

    if (debounceMs > 0 && now - lastPlay < debounceMs) {
      // Still vibrate even if sound is debounced
      if (options.vibrate !== false) {
        this.vibrate(config?.vibrationKey ?? priority);
      }
      notificationLogger.logAudio('debounced', {
        action: 'debounced',
        soundName: name,
        elapsed: now - lastPlay,
      });
      return;
    }
    this.lastPlayTime.set(name, now);

    // If user hasn't interacted yet, queue the sound
    if (!this.userHasInteracted) {
      this.enqueueSound(name, options);
      return;
    }

    // Tab visibility: reduce sounds when tab is in background
    // Urgent/high sounds always play; medium/low are suppressed in background
    if (!this.isTabVisible && PRIORITY_RANK[priority] < PRIORITY_RANK['high']) {
      notificationLogger.debug('audio', 'Sound suppressed — tab in background', {
        action: 'background_suppressed',
        soundName: name,
        priority,
      });
      if (options.vibrate !== false) {
        this.vibrate(config?.vibrationKey ?? priority);
      }
      return;
    }

    // Urgent sounds interrupt any currently playing sound of the same type
    if (priority === 'urgent') {
      this.interruptActiveSound(name);
    }

    // Execute playback
    this.executePlay(name, options);
  }

  /** Execute the actual playback attempt with fallback chain */
  private async executePlay(name: string, options: SoundOptions): Promise<void> {
    const volume = options.volume ?? this.getEffectiveVolume(name);
    const repeat = options.repeat ?? 1;
    const priority = options.priority ?? SOUND_CONFIGS[name]?.defaultPriority ?? 'medium';

    // Ensure AudioContext is running before attempting Web Audio playback
    const ctxRunning = await this.ensureAudioContextRunning();

    let played = false;

    // METHOD 1: AudioBuffer via Web Audio API (primary — most reliable)
    if (ctxRunning && this.audioBuffers.has(name)) {
      played = this.playWithAudioBuffer(name, volume, repeat, priority);
    }

    // METHOD 2: HTML5 Audio element fallback
    if (!played) {
      played = this.playWithAudioElement(name, volume, repeat);
    }

    // METHOD 3: Oscillator tone fallback (last resort)
    if (!played && ctxRunning) {
      this.playOscillatorFallback(name, volume);
      notificationLogger.logAudio('play-fallback', {
        action: 'oscillator_fallback',
        soundName: name,
      });
    }

    if (!played && !ctxRunning) {
      notificationLogger.logAudio('play-blocked', {
        action: 'playback_blocked',
        soundName: name,
      });
    }

    // Log successful play
    if (played) {
      notificationLogger.logAudio('play', {
        action: 'sound_played',
        soundName: name,
        volume,
        priority,
      });
    }

    // Vibration for mobile devices
    if (options.vibrate !== false) {
      const config = SOUND_CONFIGS[name];
      this.vibrate(config?.vibrationKey ?? priority);
    }
  }

  // ============================================================================
  // Playback: Method 1 — AudioBuffer (Web Audio API)
  // ============================================================================

  /**
   * Play a sound using a pre-decoded AudioBuffer.
   * This is the most reliable method for notification sounds because:
   *  - No network request at play time (already decoded)
   *  - Works even when HTML5 Audio is blocked by autoplay policy
   *  - Supports precise timing and overlapping sounds
   */
  private playWithAudioBuffer(name: string, volume: number, repeat: number, priority: string): boolean {
    const ctx = this.audioContext;
    const buffer = this.audioBuffers.get(name);
    if (!ctx || !buffer) return false;

    try {
      const source = ctx.createBufferSource();
      source.buffer = buffer;

      // Create gain node for volume control
      const gainNode = ctx.createGain();
      gainNode.gain.setValueAtTime(Math.max(0, Math.min(1, volume)), ctx.currentTime);

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      // Track active source for interrupt support (urgent sounds)
      if (priority === 'urgent') {
        this.activeSources.set(name, source);
        source.onended = () => {
          this.activeSources.delete(name);
        };
      }

      // Handle repeat
      if (repeat > 1) {
        let playCount = 1;
        source.onended = () => {
          this.activeSources.delete(name);
          if (playCount < repeat) {
            playCount++;
            this.playWithAudioBuffer(name, volume, 1, priority);
          }
        };
      }

      source.start(0);
      return true;
    } catch (err) {
      notificationLogger.warn('audio', 'AudioBuffer playback failed', {
        action: 'buffer_play_failed',
        soundName: name,
        reason: String(err),
      });
      return false;
    }
  }

  // ============================================================================
  // Playback: Method 2 — HTML5 Audio Element
  // ============================================================================

  /**
   * Play a sound using an HTML5 Audio element.
   * Creates a clone for each play to allow overlapping sounds.
   */
  private playWithAudioElement(name: string, volume: number, repeat: number): boolean {
    let audio = this.audioElements.get(name);

    // If no preloaded element, try creating one on the fly
    if (!audio) {
      const config = SOUND_CONFIGS[name];
      if (!config) return false;

      try {
        audio = new Audio();
        audio.preload = 'auto';
        audio.volume = volume;
        audio.src = config.src;
        this.audioElements.set(name, audio);
      } catch {
        return false;
      }
    }

    try {
      // Clone for overlapping playback
      const clone = audio.cloneNode() as HTMLAudioElement;
      clone.volume = Math.max(0, Math.min(1, volume));

      const playPromise = clone.play();
      if (playPromise) {
        playPromise.catch((err) => {
          notificationLogger.logAudio('play-blocked', {
            action: 'html5_autoplay_blocked',
            soundName: name,
            reason: String(err),
          });
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

      // Auto-cleanup
      clone.addEventListener('ended', () => {
        clone.src = '';
      });

      return true;
    } catch (err) {
      notificationLogger.warn('audio', 'HTML5 Audio playback failed', {
        action: 'html5_play_failed',
        soundName: name,
        reason: String(err),
      });
      return false;
    }
  }

  // ============================================================================
  // Playback: Method 3 — Oscillator Tone (Last Resort)
  // ============================================================================

  /** Play a simple tone using Web Audio API oscillator */
  private playOscillatorFallback(name: string, volume: number): void {
    const ctx = this.audioContext;
    if (!ctx) return;

    const config = SOUND_CONFIGS[name];
    const tone = config?.tone ?? { freq: 880, dur: 0.15, type: 'sine' as OscillatorType };

    try {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = tone.type;
      oscillator.frequency.value = tone.freq;
      gainNode.gain.setValueAtTime(volume * 0.4, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + tone.dur);

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.start();
      oscillator.stop(ctx.currentTime + tone.dur + 0.01);
    } catch (err) {
      notificationLogger.warn('audio', 'Oscillator fallback failed', {
        action: 'oscillator_failed',
        soundName: name,
        reason: String(err),
      });
    }
  }

  // ============================================================================
  // Sound Queue
  // ============================================================================

  /** Enqueue a sound for later playback (when user interacts or queue is processed) */
  private enqueueSound(name: string, options: SoundOptions): void {
    const priority = options.priority ?? SOUND_CONFIGS[name]?.defaultPriority ?? 'medium';

    // Enforce queue size limit — drop oldest low-priority items
    if (this.soundQueue.length >= MAX_QUEUE_SIZE) {
      // Find and remove the lowest-priority, oldest item
      const lowestIdx = this.findLowestPriorityItem();
      if (lowestIdx !== -1) {
        const removed = this.soundQueue.splice(lowestIdx, 1)[0];
        notificationLogger.debug('audio', 'Queue full — evicted lowest priority item', {
          action: 'queue_evict',
          soundName: removed.name,
        });
      } else {
        // All items are same priority, drop the oldest
        const removed = this.soundQueue.shift();
        if (removed) {
          notificationLogger.debug('audio', 'Queue full — evicted oldest item', {
            action: 'queue_evict_oldest',
            soundName: removed.name,
          });
        }
      }
    }

    this.soundQueue.push({ name, options, queuedAt: Date.now() });
    notificationLogger.logAudio('play-pending', {
      action: 'queue_add',
      soundName: name,
      priority,
      queueSize: this.soundQueue.length,
    });
  }

  /** Find the index of the lowest-priority item in the queue */
  private findLowestPriorityItem(): number {
    let lowestRank = Infinity;
    let lowestIdx = -1;

    for (let i = 0; i < this.soundQueue.length; i++) {
      const item = this.soundQueue[i];
      const itemPriority = item.options.priority ?? SOUND_CONFIGS[item.name]?.defaultPriority ?? 'medium';
      const rank = PRIORITY_RANK[itemPriority] ?? 1;

      if (rank < lowestRank) {
        lowestRank = rank;
        lowestIdx = i;
      }
    }

    return lowestIdx;
  }

  /** Process all queued sounds that haven't expired */
  private processQueue(): void {
    if (this.queueProcessing) return;
    this.queueProcessing = true;

    try {
      const now = Date.now();
      // Filter out expired items
      const valid = this.soundQueue.filter((item) => now - item.queuedAt < QUEUE_TTL_MS);
      const expiredCount = this.soundQueue.length - valid.length;

      if (expiredCount > 0) {
        notificationLogger.debug('audio', 'Expired queued sounds discarded', {
          action: 'queue_expired',
          count: expiredCount,
        });
      }

      this.soundQueue = [];

      // Sort by priority (highest first) then by queue time (oldest first)
      valid.sort((a, b) => {
        const rankA = PRIORITY_RANK[a.options.priority ?? 'medium'] ?? 1;
        const rankB = PRIORITY_RANK[b.options.priority ?? 'medium'] ?? 1;
        if (rankA !== rankB) return rankB - rankA; // Higher priority first
        return a.queuedAt - b.queuedAt; // Older first within same priority
      });

      // Play each sound
      for (let i = 0; i < valid.length; i++) {
        const item = valid[i];
        this.executePlay(item.name, item.options);
      }
    } finally {
      this.queueProcessing = false;
    }
  }

  // ============================================================================
  // Interrupt (for Urgent Sounds)
  // ============================================================================

  /** Stop a currently playing AudioBufferSourceNode for the given sound name */
  private interruptActiveSound(name: string): void {
    const source = this.activeSources.get(name);
    if (source) {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Already stopped
      }
      this.activeSources.delete(name);
      notificationLogger.debug('audio', 'Interrupted active sound for urgent priority', {
        action: 'interrupted',
        soundName: name,
      });
    }
  }

  // ============================================================================
  // Vibration
  // ============================================================================

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
      // Vibration not supported or blocked
    }
  }

  // ============================================================================
  // Predefined Sound Methods (backward compatible)
  // ============================================================================

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

  // ============================================================================
  // Volume Control
  // ============================================================================

  /**
   * Set the global volume level.
   * @param volume - Value between 0 (mute) and 1 (max)
   */
  setVolume(volume: number): void {
    this.globalVolume = Math.max(0, Math.min(1, volume));

    // Update all pre-loaded HTML5 Audio elements
    this.audioElements.forEach((audio, name) => {
      audio.volume = this.getEffectiveVolume(name);
    });

    notificationLogger.logAudio('volume-change', {
      action: 'volume_set',
      volume: this.globalVolume,
    });
  }

  /**
   * Get the current global volume level.
   */
  getVolume(): number {
    return this.globalVolume;
  }

  /**
   * Set volume for a specific sound type, overriding the global volume.
   * @param name - Sound name (notification, emergency, chat, success, error)
   * @param volume - Value between 0 (mute) and 1 (max)
   */
  setSoundVolume(name: string, volume: number): void {
    this.soundVolumes.set(name, Math.max(0, Math.min(1, volume)));

    // Update HTML5 Audio element if loaded
    const audio = this.audioElements.get(name);
    if (audio) {
      audio.volume = Math.max(0, Math.min(1, volume));
    }

    notificationLogger.logAudio('volume-change', {
      action: 'sound_volume_set',
      soundName: name,
      volume,
    });
  }

  /**
   * Get the volume for a specific sound type.
   */
  getSoundVolume(name: string): number {
    return this.getEffectiveVolume(name);
  }

  // ============================================================================
  // Enable/Disable
  // ============================================================================

  /** Enable or disable all sound playback */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    notificationLogger.logAudio('enabled-change', {
      action: 'enabled_set',
      enabled,
    });
  }

  /** Check if sound playback is enabled */
  isEnabled(): boolean {
    return this.enabled;
  }

  // ============================================================================
  // User Interaction State
  // ============================================================================

  /**
   * Force mark the user as having interacted.
   * Useful after login or when the app knows the user is active.
   */
  forceUserInteracted(): void {
    this.ensureInitialized();

    const wasInteracted = this.userHasInteracted;
    this.userHasInteracted = true;

    this.ensureAudioContextRunning().then((running) => {
      if (running) {
        this.warmUpAudioContext();
        this.preloadAudioBuffers();
      }
    });

    if (!wasInteracted) {
      this.processQueue();
    }

    notificationLogger.info('audio', 'User interaction forced', {
      action: 'force_interacted',
    });
  }

  /** Check if the user has interacted with the page (required for autoplay) */
  hasUserInteracted(): boolean {
    return this.userHasInteracted;
  }

  // ============================================================================
  // Cleanup
  // ============================================================================

  /** Clean up all resources. After calling destroy(), the manager cannot be reused. */
  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;

    notificationLogger.logAudio('destroy', { action: 'destroy' });

    // Stop all active AudioBuffer sources
    this.activeSources.forEach((source) => {
      try {
        source.stop();
        source.disconnect();
      } catch {
        // Already stopped
      }
    });
    this.activeSources.clear();

    // Clean up HTML5 Audio elements
    this.audioElements.forEach((audio) => {
      audio.pause();
      audio.src = '';
    });
    this.audioElements.clear();

    // Clean up AudioBuffers
    this.audioBuffers.clear();
    this.bufferLoadFailed.clear();

    // Clean up AudioContext
    if (this.audioContext) {
      this.audioContext.close().catch(() => {});
      this.audioContext = null;
    }

    // Stop keep-alive
    this.stopKeepAlive();

    // Clear queue and debounce tracking
    this.soundQueue = [];
    this.lastPlayTime.clear();
    this.soundVolumes.clear();

    // Reset state
    this.initialized = false;
    this.interactionListenersSet = false;
    this.userHasInteracted = false;
  }
}

// ============================================================================
// Singleton Export (backward compatible with original SoundManager)
// ============================================================================

export const soundManagerV2 = new SoundManagerV2();

/** Default export — same shape as original soundManager for drop-in replacement */
export default soundManagerV2;
