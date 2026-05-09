// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Voice Manager
// ============================================================================
// Text-to-speech system using Web Speech API with Arabic voice support.
// Handles speech queue, priority, Chrome quirks, and voice selection.
// ============================================================================

/** Options for text-to-speech output */
export interface VoiceOptions {
  /** Speech rate: 0.1 - 10, default 1 */
  rate?: number;
  /** Speech pitch: 0 - 2, default 1 */
  pitch?: number;
  /** Speech volume: 0 - 1, default 1 */
  volume?: number;
  /** Preferred voice gender for Arabic TTS */
  gender?: 'male' | 'female';
  /** Notification priority level */
  priority?: 'low' | 'medium' | 'high' | 'urgent';
}

/** Priority queue item for TTS */
interface QueuedUtterance {
  text: string;
  options: VoiceOptions;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  timestamp: number;
}

/** Priority weight mapping (higher = spoken first) */
const PRIORITY_WEIGHT: Record<'low' | 'medium' | 'high' | 'urgent', number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};

// ============================================================================
// VoiceManager Class
// ============================================================================

class VoiceManager {
  private synth: SpeechSynthesis | null = null;
  private queue: QueuedUtterance[] = [];
  private isSpeaking = false;
  private selectedVoice: SpeechSynthesisVoice | null = null;
  private selectedGender: 'male' | 'female' = 'female';
  private chromeResumeInterval: ReturnType<typeof setInterval> | null = null;
  private initialized = false;

  // ---- Initialization ----

  /** Initialize the speech synthesis engine */
  init(): void {
    if (this.initialized) return;
    if (typeof window === 'undefined') return;

    if ('speechSynthesis' in window) {
      this.synth = window.speechSynthesis;

      // Load voices - they may load asynchronously
      this.loadVoices();

      // Chrome loads voices asynchronously
      if ('onvoiceschanged' in this.synth) {
        this.synth.onvoiceschanged = () => {
          this.loadVoices();
        };
      }

      this.initialized = true;
    }
  }

  /** Load and select an appropriate Arabic voice */
  private loadVoices(): void {
    if (!this.synth) return;

    const voices = this.synth.getVoices();
    this.selectArabicVoice(voices, this.selectedGender);
  }

  /** Select an Arabic voice from the available voices list */
  private selectArabicVoice(voices: SpeechSynthesisVoice[], gender: 'male' | 'female'): void {
    // Try to find an Arabic voice matching the preferred gender
    const arabicVoices = voices.filter((v) => v.lang.startsWith('ar'));

    if (arabicVoices.length === 0) {
      // Fallback: no Arabic voice available, use default
      this.selectedVoice = null;
      return;
    }

    // Attempt to find a voice matching the requested gender
    // Note: Voice names often contain gender hints like "Male", "Female", "رجل", "امرأة"
    const genderKeywords: Record<'male' | 'female', string[]> = {
      male: ['male', 'رجل', 'mohammad', 'hisham', 'ali', 'naayf'],
      female: ['female', 'امرأة', 'laila', 'maha', 'zira', 'layla'],
    };

    const keywords = genderKeywords[gender];
    const genderMatch = arabicVoices.find((v) =>
      keywords.some((kw) => v.name.toLowerCase().includes(kw))
    );

    if (genderMatch) {
      this.selectedVoice = genderMatch;
      return;
    }

    // Fallback: use the first Arabic voice available
    this.selectedVoice = arabicVoices[0] ?? null;
  }

  // ---- Speech Control ----

  /** Speak text aloud in Arabic */
  speak(text: string, options: VoiceOptions = {}): void {
    if (!this.isAvailable()) return;

    const priority = options.priority ?? 'medium';

    // Urgent and high-priority notifications speak immediately
    if (priority === 'urgent' || priority === 'high') {
      // Stop current speech for urgent notifications
      if (priority === 'urgent' && this.isSpeaking) {
        this.stop();
      }

      // Insert at front of queue for high priority
      this.queue.unshift({
        text,
        options,
        priority,
        timestamp: Date.now(),
      });
    } else {
      this.queue.push({
        text,
        options,
        priority,
        timestamp: Date.now(),
      });
    }

    this.processQueue();
  }

  /** Add text to the speech queue with a priority level */
  enqueue(text: string, priority: 'low' | 'medium' | 'high' | 'urgent' = 'medium'): void {
    this.speak(text, { priority });
  }

  /** Stop current speech and clear the queue */
  stop(): void {
    if (this.synth) {
      this.synth.cancel();
    }
    this.isSpeaking = false;
    this.stopChromeFix();
  }

  /** Clear the speech queue without stopping current speech */
  clearQueue(): void {
    this.queue = [];
  }

  /** Check if TTS is available in the current browser */
  isAvailable(): boolean {
    if (typeof window === 'undefined') return false;
    return 'speechSynthesis' in window;
  }

  /** Check if currently speaking */
  getIsSpeaking(): boolean {
    return this.isSpeaking;
  }

  /** Get the number of items in the queue */
  getQueueLength(): number {
    return this.queue.length;
  }

  /** Set the preferred voice gender for Arabic TTS */
  setVoice(gender: 'male' | 'female'): void {
    this.selectedGender = gender;
    if (this.synth) {
      const voices = this.synth.getVoices();
      this.selectArabicVoice(voices, gender);
    }
  }

  /** Get the currently selected voice */
  getSelectedVoice(): SpeechSynthesisVoice | null {
    return this.selectedVoice;
  }

  /** Get all available Arabic voices */
  getArabicVoices(): SpeechSynthesisVoice[] {
    if (!this.synth) return [];
    return this.synth.getVoices().filter((v) => v.lang.startsWith('ar'));
  }

  // ---- Queue Processing ----

  /** Process the next item in the speech queue */
  private processQueue(): void {
    if (!this.synth || this.isSpeaking) return;
    if (this.queue.length === 0) return;

    // Sort queue by priority (highest first), then by timestamp (oldest first within same priority)
    this.queue.sort((a, b) => {
      const priorityDiff = PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.timestamp - b.timestamp;
    });

    const item = this.queue.shift();
    if (!item) return;

    this.speakNow(item.text, item.options);
  }

  /** Immediately speak text using SpeechSynthesisUtterance */
  private speakNow(text: string, options: VoiceOptions): void {
    if (!this.synth) return;

    const utterance = new SpeechSynthesisUtterance(text);

    // Set Arabic language
    utterance.lang = 'ar-SA';

    // Apply voice selection
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }

    // Apply options
    utterance.rate = options.rate ?? 1;
    utterance.pitch = options.pitch ?? 1;
    utterance.volume = options.volume ?? 1;

    // Override gender-specific voice if specified in options
    if (options.gender && options.gender !== this.selectedGender) {
      const voices = this.synth.getVoices();
      const arabicVoices = voices.filter((v) => v.lang.startsWith('ar'));

      const genderKeywords: Record<'male' | 'female', string[]> = {
        male: ['male', 'رجل', 'mohammad', 'hisham', 'ali', 'naayf'],
        female: ['female', 'امرأة', 'laila', 'maha', 'zira', 'layla'],
      };

      const keywords = genderKeywords[options.gender];
      const genderVoice = arabicVoices.find((v) =>
        keywords.some((kw) => v.name.toLowerCase().includes(kw))
      );

      if (genderVoice) {
        utterance.voice = genderVoice;
      }
    }

    // Event handlers
    utterance.onstart = () => {
      this.isSpeaking = true;
      this.startChromeFix();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.stopChromeFix();
      this.processQueue();
    };

    utterance.onerror = (event: SpeechSynthesisErrorEvent) => {
      console.error('[VoiceManager] Speech error:', event.error);
      this.isSpeaking = false;
      this.stopChromeFix();
      this.processQueue();
    };

    utterance.onpause = () => {
      // Do NOT set isSpeaking = false on pause — speech is not done yet.
      // Only onend/onerror should mark speech as complete.
    };

    utterance.onresume = () => {
      this.isSpeaking = true;
    };

    this.synth.speak(utterance);
  }

  // ---- Chrome Fix ----

  /**
   * Chrome has a known bug where speechSynthesis stops after ~15 seconds.
   * This workaround pauses and resumes synthesis periodically to keep it alive.
   */
  private startChromeFix(): void {
    this.stopChromeFix();

    this.chromeResumeInterval = setInterval(() => {
      if (this.synth && this.isSpeaking) {
        this.resumeChromeFix();
      }
    }, 10000);
  }

  /** Pause and resume synthesis to work around Chrome's bug */
  private resumeChromeFix(): void {
    if (!this.synth) return;

    if (this.synth.pause && this.synth.resume) {
      this.synth.pause();
      this.synth.resume();
    }
  }

  /** Stop the Chrome fix interval */
  private stopChromeFix(): void {
    if (this.chromeResumeInterval) {
      clearInterval(this.chromeResumeInterval);
      this.chromeResumeInterval = null;
    }
  }

  // ---- Cleanup ----

  /** Clean up all resources */
  destroy(): void {
    this.stop();
    this.clearQueue();
    this.initialized = false;
    this.selectedVoice = null;
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

/** Global VoiceManager instance for text-to-speech */
export const voiceManager = new VoiceManager();

export default voiceManager;
