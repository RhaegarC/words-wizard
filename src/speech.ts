import { config } from "./config"

/**
 * Tap-to-hear pronunciation. Feature 08 adds the practice-mode audio; this
 * module is the single place that touches `speechSynthesis`.
 */

export interface VoiceLike {
  lang: string
  name?: string
}

/** Prefer an en-US voice, then any English voice, then none. */
export function pickEnglishVoice(
  voices: readonly VoiceLike[],
): VoiceLike | null {
  return (
    voices.find((voice) => voice.lang.toLowerCase() === "en-us") ??
    voices.find((voice) => voice.lang.toLowerCase().startsWith("en")) ??
    null
  )
}

/**
 * An empty list means the browser has not loaded its voices yet (iOS Safari
 * does this until speech is first used), so support is assumed rather than
 * proven absent. Only a loaded list with no English voice disables listening.
 */
export function resolveSpeechAvailability(
  supported: boolean,
  voices: readonly VoiceLike[],
): boolean {
  if (!supported) {
    return false
  }

  return voices.length === 0 || pickEnglishVoice(voices) !== null
}

export function speechSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "speechSynthesis" in window &&
    typeof window.SpeechSynthesisUtterance === "function"
  )
}

export function listVoices(): readonly VoiceLike[] {
  return speechSupported() ? window.speechSynthesis.getVoices() : []
}

/** Speak one word; returns false when the device cannot speak it. */
export function speak(text: string): boolean {
  // An empty voice list may simply not have loaded yet, so try the default
  // voice rather than refusing until `voiceschanged` fires.
  if (!speechSupported() || !resolveSpeechAvailability(true, listVoices())) {
    return false
  }

  try {
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.lang = "en-US"
    utterance.rate = config.speech.rate
    utterance.pitch = config.speech.pitch
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    return true
  } catch {
    return false
  }
}
