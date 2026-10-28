import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

type Dictionary = Record<string, string>

function readLocale(locale: "en" | "zh"): Dictionary {
  const url = new URL(`../public/locales/${locale}.json`, import.meta.url)

  return JSON.parse(readFileSync(url, "utf8")) as Dictionary
}

const en = readLocale("en")
const zh = readLocale("zh")

function placeholders(value: string): string[] {
  return [...value.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort()
}

describe("locale files", () => {
  it("have exactly the same key set in both directions", () => {
    const enKeys = new Set(Object.keys(en))
    const zhKeys = new Set(Object.keys(zh))
    const missingInZh = [...enKeys].filter((key) => !zhKeys.has(key))
    const missingInEn = [...zhKeys].filter((key) => !enKeys.has(key))

    expect(missingInZh).toEqual([])
    expect(missingInEn).toEqual([])
  })

  it("carry a non-empty string for every key", () => {
    for (const [locale, dictionary] of [
      ["en", en],
      ["zh", zh],
    ] as const) {
      for (const [key, value] of Object.entries(dictionary)) {
        expect(value.trim(), `${locale}:${key}`).not.toBe("")
      }
    }
  })

  it("uses the same placeholders in both languages", () => {
    for (const key of Object.keys(en)) {
      expect(placeholders(zh[key]), key).toEqual(placeholders(en[key]))
    }
  })

  it("covers every required namespace", () => {
    const namespaces = [
      "common",
      "boot",
      "create",
      "install",
      "topics",
      "home",
      "session",
      "feedback",
      "modes",
      "words",
      "review",
      "character",
      "settings",
      "errors",
    ]

    for (const namespace of namespaces) {
      expect(
        Object.keys(en).some((key) => key.startsWith(`${namespace}.`)),
        namespace,
      ).toBe(true)
    }
  })

  it("pairs every _one key with an _other key", () => {
    for (const key of Object.keys(en)) {
      if (key.endsWith("_one")) {
        expect(en[`${key.slice(0, -4)}_other`], key).toBeDefined()
      }
    }
  })

  it("never says wrong in session or feedback copy", () => {
    for (const [locale, dictionary] of [
      ["en", en],
      ["zh", zh],
    ] as const) {
      for (const [key, value] of Object.entries(dictionary)) {
        if (key.startsWith("session.") || key.startsWith("feedback.")) {
          expect(value, `${locale}:${key}`).not.toMatch(/\bwrong\b/i)
        }
      }
    }
  })
})
