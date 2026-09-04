import { Platform } from 'react-native';
import * as Speech from 'expo-speech';

/**
 * Voice guidance wrapper around expo-speech.
 *
 * - Coalesces rapid calls so we never stack overlapping instructions.
 * - Falls back to the Web Speech API on web, and no-ops if neither is
 *   available, so the same call sites work everywhere.
 */
let enabled = true;
let lastSpoken = '';
let lastSpokenAt = 0;

export function setVoiceEnabled(value: boolean): void {
  enabled = value;
  if (!value) stop();
}

export function isVoiceEnabled(): boolean {
  return enabled;
}

export function speak(text: string, options?: { force?: boolean }): void {
  if (!enabled || !text) return;

  // Debounce identical phrases within 4s to avoid repetition.
  const now = Date.now();
  if (!options?.force && text === lastSpoken && now - lastSpokenAt < 4000) {
    return;
  }
  lastSpoken = text;
  lastSpokenAt = now;

  try {
    if (Platform.OS === 'web') {
      const synth = (globalThis as any)?.speechSynthesis;
      const Utterance = (globalThis as any)?.SpeechSynthesisUtterance;
      if (synth && Utterance) {
        synth.cancel();
        const u = new Utterance(text);
        u.rate = 1.0;
        synth.speak(u);
      }
      return;
    }
    Speech.stop();
    Speech.speak(text, { rate: 1.0, pitch: 1.0, language: 'en-US' });
  } catch {
    // Ignore TTS failures — guidance is supplementary to the on-screen banner.
  }
}

export function stop(): void {
  try {
    if (Platform.OS === 'web') {
      (globalThis as any)?.speechSynthesis?.cancel();
      return;
    }
    Speech.stop();
  } catch {
    // no-op
  }
}
