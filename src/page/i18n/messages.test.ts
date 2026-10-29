import { afterEach, describe, expect, it, vi } from "vitest"

import { CATALOG } from "./catalog"
import {
  createTranslator,
  interpolate,
  type MessageKey,
} from "./messages"

const en = {
  "topics.locked": "Master {count} words to unlock.",
  "home.streakDays_one": "{count} day",
  "home.streakDays_other": "{count} days",
}

const zh = {
  "topics.locked": "掌握 {count} 个单词即可解锁。",
  "home.streakDays_one": "{count} 天",
  "home.streakDays_other": "{count} 天",
}

describe("interpolate", () => {
  it("replaces named placeholders", () => {
    expect(interpolate("Hello, {name}!", { name: "Ada" })).toBe("Hello, Ada!")
  })

  it("leaves a placeholder with no matching param untouched", () => {
    expect(interpolate("Hello, {name}!", {})).toBe("Hello, {name}!")
  })
})

describe("createTranslator", () => {
  it("translates a plain key with a count but no plural family", () => {
    const t = createTranslator("en", en, en)

    expect(t("topics.locked", { count: 3 })).toBe(
      "Master 3 words to unlock.",
    )
  })

  it("selects the plural form with Intl.PluralRules", () => {
    const t = createTranslator("en", en, en)

    expect(t("home.streakDays", { count: 1 })).toBe("1 day")
    expect(t("home.streakDays", { count: 3 })).toBe("3 days")
  })

  it("resolves Chinese to the _other form", () => {
    const t = createTranslator("zh", zh, zh)

    expect(t("home.streakDays", { count: 1 })).toBe("1 天")
  })

  it("falls back to the English string before the key", () => {
    const t = createTranslator("zh", {}, en)

    expect(t("topics.locked", { count: 3 })).toBe(
      "Master 3 words to unlock.",
    )
  })

  it("falls back to the key and warns in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const t = createTranslator("en", en, en)

    expect(t("missing.key" as MessageKey)).toBe("missing.key")
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("missing.key"),
    )
  })
})

afterEach(() => {
  vi.restoreAllMocks()
})

// Checked by `pnpm typecheck`; never executed. A key that is not in en.json is
// rejected, so a typo is a compile error rather than a runtime fallback.
function assertKeyTyping() {
  const t = createTranslator("en", CATALOG.en, CATALOG.en)

  t("common.appName")

  // @ts-expect-error — not a key in en.json
  t("common.notAKey")
}

void assertKeyTyping
