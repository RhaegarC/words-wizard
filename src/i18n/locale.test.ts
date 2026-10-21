import { describe, expect, it } from "vitest"

import {
  defaultLocale,
  htmlLang,
  speechLangFor,
  ENGLISH_SPEECH_LANG,
} from "./locale"

describe("defaultLocale", () => {
  it("selects Chinese for any zh language tag", () => {
    expect(defaultLocale("zh")).toBe("zh")
    expect(defaultLocale("zh-CN")).toBe("zh")
    expect(defaultLocale("zh-Hans")).toBe("zh")
  })

  it("selects English for every other tag", () => {
    expect(defaultLocale("en-GB")).toBe("en")
    expect(defaultLocale("fr-FR")).toBe("en")
    expect(defaultLocale(undefined)).toBe("en")
    expect(defaultLocale("")).toBe("en")
  })
})

describe("htmlLang", () => {
  it("writes a script-qualified Chinese tag", () => {
    expect(htmlLang("zh")).toBe("zh-Hans")
    expect(htmlLang("en")).toBe("en")
  })
})

describe("speech language", () => {
  it("keeps English words on an English voice", () => {
    expect(ENGLISH_SPEECH_LANG).toBe("en-US")
  })

  it("reads Chinese UI copy with a Chinese voice", () => {
    expect(speechLangFor("zh")).toBe("zh-CN")
    expect(speechLangFor("en")).toBe("en-US")
  })
})
