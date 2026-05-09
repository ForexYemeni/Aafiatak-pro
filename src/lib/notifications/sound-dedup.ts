// ============================================================================
// عافيتك (Aafiatak) Healthcare Platform - Sound Dedup Tracker
// ============================================================================
// Shared module for tracking which notification IDs have already had sounds
// played. This ensures that when a notification arrives via BOTH push and
// socket channels, the sound only plays ONCE.
// ============================================================================

// Maximum number of IDs to track (prevents memory leaks)
const MAX_TRACKED_IDS = 500;

// Set of notification IDs that have already triggered a sound
const playedSoundIds = new Set<string>();

/**
 * Check if a notification has already had its sound played.
 * If not, mark it as played and return false.
 * If yes, return true (already played - skip sound).
 */
export function markSoundPlayed(id: string): boolean {
  if (playedSoundIds.has(id)) return true;
  playedSoundIds.add(id);

  // Trim old entries if set gets too large
  if (playedSoundIds.size > MAX_TRACKED_IDS) {
    const iter = playedSoundIds.values();
    for (let i = 0; i < 100; i++) {
      const val = iter.next();
      if (val.done) break;
      playedSoundIds.delete(val.value);
    }
  }

  return false;
}

/** Check if a notification ID has been played (without marking it) */
export function isSoundPlayed(id: string): boolean {
  return playedSoundIds.has(id);
}

/** Clear all tracked IDs (e.g., on logout) */
export function clearPlayedSounds(): void {
  playedSoundIds.clear();
}
