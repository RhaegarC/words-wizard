import { afterEach, describe, expect, it, vi } from "vitest"

import { config } from "./config"
import {
  hasEnglishVoice,
  pickEnglishVoice,
  resolveSpeechAvailability,
  speak,
  speechSupported,
} from "./speech"

type FakeVoice = {
  lang: string
  name?: string
  localService?: boolean
}

type FakeUtterance = {
  text: string
  lang: string
  rate: number
  pitch: number
  voice: FakeVoice | null
}

function withSpeech(voices: readonly FakeVoice[]) {
  const utterances: FakeUtterance[] = []
  const cancel = vi.fn()
  const spoken = vi.fn()

  class Utterance implements FakeUtterance {
    text: string
    lang = ""
    rate = 1
    pitch = 1
    voice: FakeVoice | null = null

    constructor(text: string) {
      this.text = text
      utterances.push(this)
    }
  }

  vi.stubGlobal("window", {
    speechSynthesis: {
      getVoices: () => voices,
      cancel,
      speak: spoken,
    },
    SpeechSynthesisUtterance: Utterance,
  })

  return { utterances, cancel, spoken }
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("speech", () => {
  it("prefers an en-US voice over any other English voice", () => {
    expect(
      pickEnglishVoice([
        { lang: "en-GB", name: "British" },
        { lang: "en-US", name: "American" },
      ])?.name,
    ).toBe("American")
  })

  it("falls back to any English voice", () => {
    expect(pickEnglishVoice([{ lang: "zh-CN" }, { lang: "en-AU" }])?.lang).toBe(
      "en-AU",
    )
  })

  it("returns null when no English voice is installed", () => {
    expect(pickEnglishVoice([{ lang: "zh-CN" }, { lang: "fr-FR" }])).toBeNull()
  })

  it("prefers a local English voice over a remote one", () => {
    const picked = pickEnglishVoice([
      { lang: "en-US", localService: false },
      { lang: "en-GB", localService: true },
    ])

    expect(picked?.lang).toBe("en-GB")
  })

  it("reports no support on a device without speechSynthesis", () => {
    expect(resolveSpeechAvailability(false, [{ lang: "en-US" }])).toBe(false)
  })

  it("assumes support while the voice list is still empty", () => {
    expect(resolveSpeechAvailability(true, [])).toBe(true)
  })

  it("disables listening when the loaded list has no English voice", () => {
    expect(resolveSpeechAvailability(true, [{ lang: "fr-FR" }])).toBe(false)
    expect(resolveSpeechAvailability(true, [{ lang: "en-GB" }])).toBe(true)
  })

  it("degrades to silence outside a browser", () => {
    expect(speechSupported()).toBe(false)
    expect(hasEnglishVoice()).toBe(false)
    expect(speak("bag")).toBe(false)
  })
})

describe("hasEnglishVoice", () => {
  it("is true when an English voice is installed", () => {
    withSpeech([{ lang: "en-AU" }])

    expect(hasEnglishVoice()).toBe(true)
  })

  it("is false when the loaded voice list has no English voice", () => {
    withSpeech([{ lang: "zh-CN" }])

    expect(hasEnglishVoice()).toBe(false)
  })

  it("assumes support while the voice list is still empty", () => {
    withSpeech([])

    expect(hasEnglishVoice()).toBe(true)
  })
})

describe("speak", () => {
  it("resolves without speaking when no English voice exists", () => {
    const { cancel, spoken } = withSpeech([{ lang: "zh-CN" }])

    expect(speak("bag")).toBe(false)
    expect(cancel).not.toHaveBeenCalled()
    expect(spoken).not.toHaveBeenCalled()
  })

  it("speaks once with the configured rate and pitch", () => {
    const { utterances, cancel, spoken } = withSpeech([{ lang: "en-US" }])

    expect(speak("bag")).toBe(true)
    expect(spoken).toHaveBeenCalledTimes(1)
    expect(cancel).toHaveBeenCalledTimes(1)

    const utterance = utterances[0]

    expect(utterance.text).toBe("bag")
    expect(utterance.rate).toBe(config.speech.rate)
    expect(utterance.pitch).toBe(config.speech.pitch)
    expect(utterance.voice?.lang.toLowerCase()).toMatch(/^en/)
  })

  it("cancels the previous utterance before speaking the next one", () => {
    const { cancel, spoken } = withSpeech([{ lang: "en-US" }])

    expect(speak("bag")).toBe(true)
    expect(speak("ball")).toBe(true)
    expect(cancel).toHaveBeenCalledTimes(2)
    expect(spoken).toHaveBeenCalledTimes(2)
  })
})
