import { describe, expect, it } from "vitest"

import {
  pickEnglishVoice,
  resolveSpeechAvailability,
  speak,
  speechSupported,
} from "./speech"

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
    expect(speak("bag")).toBe(false)
  })
})
