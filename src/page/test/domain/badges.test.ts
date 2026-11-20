import { readFileSync } from "node:fs"

import { describe, expect, it } from "vitest"

import { MEDAL_DEFINITIONS, topicTrophyId } from "@shared/badges"
import {
  BADGE_CATEGORY_KEYS,
  MEDAL_DESCRIPTION_KEYS,
  MEDAL_NAME_KEYS,
  TROPHY_ARCHIVED_DESCRIPTION_KEY,
  TROPHY_ARCHIVED_NAME_KEY,
  TROPHY_DESCRIPTION_KEY,
  TROPHY_NAME_KEY,
  badgeDescriptionKey,
  badgeNameKey,
} from "../../domain/badges"

type Dictionary = Record<string, string>

function readLocale(locale: "en" | "zh"): Dictionary {
  const url = new URL(`../../i18n/locales/${locale}.json`, import.meta.url)

  return JSON.parse(readFileSync(url, "utf8")) as Dictionary
}

const en = readLocale("en")
const zh = readLocale("zh")

describe("badge copy", () => {
  it("names and describes every medal in both locales", () => {
    for (const definition of MEDAL_DEFINITIONS) {
      const name = badgeNameKey(definition)
      const description = badgeDescriptionKey(definition)

      expect(MEDAL_NAME_KEYS[definition.id], definition.id).toBe(name)
      expect(MEDAL_DESCRIPTION_KEYS[definition.id], definition.id).toBe(
        description,
      )
      expect(en[name], `${definition.id} en`).toBeTruthy()
      expect(zh[name], `${definition.id} zh`).toBeTruthy()
      expect(en[description], `${definition.id} desc en`).toBeTruthy()
      expect(zh[description], `${definition.id} desc zh`).toBeTruthy()
    }
  })

  it("covers every category heading", () => {
    for (const key of Object.values(BADGE_CATEGORY_KEYS)) {
      expect(en[key], key).toBeTruthy()
      expect(zh[key], key).toBeTruthy()
    }
  })

  it("names a live trophy from its topic and an archived one generically", () => {
    const trophy = {
      id: topicTrophyId("t1"),
      category: "topics" as const,
      tier: "trophy" as const,
      threshold: null,
      fact: "completedTopicIds" as const,
      topicId: "t1",
    }

    expect(badgeNameKey(trophy)).toBe(TROPHY_NAME_KEY)
    expect(badgeDescriptionKey(trophy)).toBe(TROPHY_DESCRIPTION_KEY)

    for (const key of [
      TROPHY_NAME_KEY,
      TROPHY_DESCRIPTION_KEY,
      TROPHY_ARCHIVED_NAME_KEY,
      TROPHY_ARCHIVED_DESCRIPTION_KEY,
    ]) {
      expect(en[key], key).toBeTruthy()
      expect(zh[key], key).toBeTruthy()
    }

    expect(en[TROPHY_NAME_KEY]).toContain("{topic}")
    expect(zh[TROPHY_NAME_KEY]).toContain("{topic}")
  })

  it("has distinct English medal names", () => {
    const names = MEDAL_DEFINITIONS.map((definition) =>
      en[MEDAL_NAME_KEYS[definition.id]],
    )

    expect(new Set(names).size).toBe(MEDAL_DEFINITIONS.length)
  })
})
