# عافيتك (Aafiatak) - Notification Sound Files

This directory contains notification sound files for the healthcare platform.

## Required Sound Files

Place the following MP3 files in this directory:

- `notification.mp3` - Default notification sound (short, gentle chime)
- `emergency.mp3` - Emergency alert sound (urgent, attention-grabbing)
- `chat.mp3` - Chat message sound (soft, brief ping)
- `success.mp3` - Success action sound (positive, ascending tone)
- `error.mp3` - Error alert sound (low, descending tone)

## Sound Guidelines

- All sounds should be **short** (under 2 seconds for normal, under 3 seconds for emergency)
- Files should be **MP3 format** for broad browser compatibility
- **Volume** should be moderate - the SoundManager handles amplification
- **Emergency sound** should be distinguishable from other sounds
- Respect users' audio preferences - sounds can be disabled in settings

## Fallback

The SoundManager includes oscillator-based fallback tones for each sound type,
so the app will work even without these audio files. The MP3 files provide
a better user experience with higher quality sounds.
