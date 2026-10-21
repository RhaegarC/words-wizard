import { config } from "./config"

/**
 * Tap-to-hear pronunciation. Feature 08 adds the practice-mode audio; this
 * module is the single place that touches `speechSynthesis`.
 */

export interface VoiceLike {
  lang: string
  name?: string
  /** Browsers mark on-device voices here; those work offline. */
  localService?: boolean
}

/**
 * Prefer a local `en-*` voice, then any `en-*` voice. Within each group en-US
 * wins, matching the app's American-English content.
 */
export function pickEnglishVoice(
  voices: readonly VoiceLike[],
): VoiceLike | null {
  const english = voices.filter((voice) =>
    voice.lang.toLowerCase().startsWith("en"),
  )
  const local = english.filter((voice) => voice.localService === true)

  return (
    local.find((voice) => voice.lang.toLowerCase() === "en-us") ??
    local[0] ??
    english.find((voice) => voice.lang.toLowerCase() === "en-us") ??
    english[0] ??
    null
  )
}

/** Whether the loaded voice list can speak English; an empty list still can. */
export function hasEnglishVoice(): boolean {
  return resolveSpeechAvailability(speechSupported(), listVoices())
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
  if (!speechSupported()) {
    return false
  }

  const voices = listVoices()

  // An empty voice list may simply not have loaded yet (iOS Safari), so try
  // the default voice; a loaded list with no English voice resolves to false.
  if (!resolveSpeechAvailability(true, voices)) {
    return false
  }

  const voice = pickEnglishVoice(voices)

  try {
    // Reach through `window`: the constructor is a global in browsers but is
    // not guaranteed to exist as a bare identifier in every test host.
    const utterance = new window.SpeechSynthesisUtterance(text)
    utterance.lang = "en-US"
    utterance.rate = config.speech.rate
    utterance.pitch = config.speech.pitch

    if (voice !== null) {
      utterance.voice = voice as SpeechSynthesisVoice
    }

    // A second tap replaces the first sound rather than queueing behind it.
    window.speechSynthesis.cancel()
    window.speechSynthesis.speak(utterance)
    return true
  } catch {
    return false
  }
}
